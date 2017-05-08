var X = 0;
var Y = 1;
var TOP = 0;
var RIGHT = 1;
var BOTTOM = 2;
var LEFT = 3;
var ATLAS = 'atlas.json';
var IS_MOBILE = (typeof window.orientation !== 'undefined');

var KEYS = {
  8: 'backspace', 9: 'tab', 13: 'enter', 16: 'shift', 17: 'ctrl', 18: 'alt',
  19: 'pause', 20: 'capsLock', 27: 'esc', 33: 'pageUp', 34: 'pageDown',
  35: 'end', 36: 'home', 37: 'left', 38: 'up', 39: 'right', 40: 'down',
  45: 'insert', 46: 'delete',
  65: 'a', 66: 'b', 67: 'c', 68: 'd', 69: 'e', 70: 'f', 71: 'g', 72: 'h',
  73: 'i', 74: 'j', 75: 'k', 76: 'l', 77: 'm', 78: 'n', 79: 'o', 80: 'p',
  81: 'q', 82: 'r', 83: 's', 84: 't', 85: 'u', 86: 'v', 87: 'w', 88: 'x',
  89: 'y', 90: 'z'
};

var limit = function(n, min, max) {
  return Math.max(min, Math.min(max, n));
};

var normalizePadding = function(padding) {
  switch (padding ? padding.length : 0) {
    case 0:
      return [0, 0, 0, 0];
    case 1:
      return [padding[0], padding[0], padding[0], padding[0]];
    case 2:
      return [padding[0], padding[1], padding[0], padding[1]];
    case 3:
      return [padding[0], padding[1], padding[2], padding[1]];
    default:
      return padding;
  }
};

var calcFrame = function(fps, time) {
  return Math.floor(time * fps / 1000);
};

var getTexture = function(name) {
  return PIXI.loader.resources[ATLAS].textures[name];
};

var textureToCanvas = function(texture) {
  var t = texture;
  var r = new PIXI.CanvasRenderer(t.width, t.height, {transparent: true});
  r.render(new PIXI.Sprite(t));
  return r.view;
};

var palette = {};
var pickColor = function(name) {
  if (palette[name] !== undefined) {
    return palette[name];
  }
  var t = getTexture('palette-' + name);
  var canvas = textureToCanvas(t);
  var pixel = canvas.getContext('2d').getImageData(0, 0, 1, 1).data;
  var color = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
  palette[name] = color;  // cache
  return color;
};

var rgb = function(color) {
  return '#' + ('000000' + color.toString(16)).slice(-6);
};

var GameObject = Class.$extend({

  __name__: 'GameObject',

  __init__: function(/* parent or ctx */arg) {
    this.children = {};
    this.childIdSeq = 0;
    if (arg instanceof GameObject) {
      var parent = arg;
      this.parent = parent;
      this.childId = parent.addChild(this);
      this.ctx = parent.ctx;
    } else {
      this.ctx = arg ? arg : {};
    }
    this.innerPadding = normalizePadding(this.innerPadding);
    this.killed = false;
    if (this.animationName) {
      this.setAnimation(this.animationName);
    }
  },

  addChild: function(child) {
    var childId = this.childIdSeq;
    this.childIdSeq += 1;
    this.children[childId] = child;
    return childId;
  },

  removeChild: function(child) {
    delete this.children[child.childId];
  },

  /* Destruct */

  kill: function() {
    this.killed = true;
  },

  destroy: function() {
    var disp = this.disp();
    if (disp) {
      disp.destroy();
    }
    if (this.parent) {
      this.parent.removeChild(this);
    }
  },

  /* View */

  width: null,
  height: null,
  innerPadding: null,

  anchor: [0, 0],
  offset: [0, 0],

  disp: function() {
    // Returns cached a PIXI.DisplayObject.
    var disp = this.__disp__();
    if (disp) {
      if (disp.anchor) {
        disp.anchor.set(this.anchor[X], this.anchor[Y]);
      }
      if (this.offset[X] < 0) {
        disp.position.x = this.parent.width + this.offset[X] + 1;
      } else {
        disp.position.x = this.offset[X];
      }
      if (this.offset[Y] < 0) {
        disp.position.y = this.parent.height + this.offset[Y] + 1;
      } else {
        disp.position.y = this.offset[Y];
      }
      this.disp = function() { return disp; };
    }
    return disp;
  },

  __disp__: function() {
    var anim = this.currentAnimation();
    if (!anim || !anim.textureNames) {
      return null;
    }
    var texture = this.getTexture(anim.textureNames[0]);
    return new PIXI.Sprite(texture);
  },

  innerWidth: function() {
    return this.width - this.innerPadding[RIGHT] - this.innerPadding[LEFT];
  },

  innerHeight: function() {
    return this.height - this.innerPadding[TOP] - this.innerPadding[BOTTOM];
  },

  /* Animation */

  fps: 60,
  animations: null,
  animationName: null,

  currentAnimation: function() {
    if (!this.animations || !this.animationName) {
      return null;
    }
    return this.animations[this.animationName] || null;
  },

  setAnimation: function(animationName, frame) {
    if (this.animationName !== animationName || frame !== undefined) {
      this.rebaseFrame(frame);
    }
    this.animationName = animationName;
  },

  animationEnds: function() {
    var anim = this.currentAnimation();
    if (!anim) {
      return true;  // never started
    } else if (!anim.once) {
      return false;  // never ends
    }
    return this.animationFrame(anim) >= anim.textureNames.length;
  },

  animationFrame: function(anim) {
    anim = anim || this.currentAnimation();
    if (!anim) {
      return 0;
    }
    var fps = anim.fps || this.fps;
    return this.frame(fps);
  },

  animationIndex: function(anim, frame) {
    var length = anim.textureNames.length;
    if (anim.once) {
      return Math.min(frame, length - 1);
    } else {
      return Math.floor(frame % length);
    }
  },

  updateAnimation: function(anim, index) {
    var texture = this.getTexture(anim.textureNames[index]);
    this.disp().texture = texture;
  },

  /* Move */

  position: 0,
  speed: 0,
  duration: 1,
  acceleration: 1,  // per second
  step: 1,  // per second

  left: function(deltaTime) {
    this.duration = -1;
    this.forward(deltaTime);
  },

  right: function(deltaTime) {
    this.duration = 1;
    this.forward(deltaTime);
  },

  up: function(deltaTime) {
    this.duration = -1;
    this.forward(deltaTime);
  },

  down: function(deltaTime) {
    this.duration = 1;
    this.forward(deltaTime);
  },

  forward: function(deltaTime) {
    this.speed += this.duration * this.acceleration *
                  this.resist() * deltaTime / 1000;
    this.speed = limit(this.speed, -1, 1);
  },

  rest: function(deltaTime) {
    this.speed = Math.abs(this.speed) - this.acceleration *
                 this.resist() * deltaTime / 1000;
    this.speed = Math.max(0, this.speed) * this.duration;
  },

  updatePosition: function(deltaTime) {
    if (!deltaTime) {
      return;
    }
    this.position += this.speed * this.step * this.resist() * deltaTime / 1000;
  },

  resist: function() {
    return this.ctx.slow ? 0.25 : 1;
  },

  /* Schedule */

  time: null,
  baseFrame: 0,
  baseTime: 0,

  rebaseFrame: function(frame, time) {
    this.baseFrame = frame || 0;
    this.baseTime = (time === undefined ? this.time : time);
  },

  frame: function(fps, time) {
    /// Gets the frame number at now .  The base frame can be set by
    /// `rebaseFrame`.
    if (fps === undefined) {
      fps = this.fps;
    }
    fps *= this.resist();
    time = (time === undefined ? this.time : time);
    return this.baseFrame + calcFrame(fps, time - this.baseTime);
  },

  update: function(time, fps) {
    /// Call this method at each animation frames.

    // Update children first.
    $.each(this.children, $.proxy(function(childId, child) {
      child.update(time, fps);
      if (this.killed) {
        return false;
      }
    }, this));

    // Arguments for __update__().
    if (!this.baseTime) {
      this.rebaseFrame(0, time);
    }
    var frame = this.frame(this.fps, time);
    var prevTime = this.time;
    var prevFrame = 0;
    var deltaTime = 0;
    if (prevTime !== null) {
      deltaTime = time - prevTime;
      prevFrame = this.frame(this.fps, prevTime);
      // Cut off too slow delta time and frame.
      fps = (fps === undefined ? 60 : fps);
      deltaTime = limit(deltaTime, 0, 1000 / fps);
      prevFrame = Math.max(frame - Math.ceil(this.fps / fps), prevFrame);
    }

    // Update this.
    this.time = time;
    this.__update__(frame, prevFrame, deltaTime);
  },

  __update__: function(frame, prevFrame, deltaTime) {
    var time = this.time;

    if (this.killed) {
      this.destroy();
      return;
    }

    var anim = this.currentAnimation();
    if (anim) {
      var f = this.animationFrame(anim);
      var i = this.animationIndex(anim, f);
      this.updateAnimation(anim, i);
    }
  },

  /* Misc */

  random: function() {
    return (this.ctx.random || Math.random)();
  },

  getTexture: function(name) {
    if (!this.ctx.debug) {
      return getTexture(name);
    }
    var frameId = this.__name__ + '/' + name;
    var texture;
    try {
      texture = PIXI.Texture.fromFrame(frameId);
    } catch (e) {
      // Draw bounding box.
      var t = getTexture(name);
      var canvas = textureToCanvas(t);
      function drawRect(style, x, y, w, h) {
        var c = canvas.getContext('2d');
        c.fillStyle = style;
        c.fillRect(x, y, w - 1, 1);
        c.fillRect(x + w - 1, y, 1, h - 1);
        c.fillRect(x + 1, y + h - 1, w - 1, 1);
        c.fillRect(x, y + 1, 1, h - 1);
      }
      drawRect('rgba(255, 255, 255, 0.25)', 0, 0, t.width, t.height);
      if (t.width !== this.innerWidth() || t.height !== this.innerHeight()) {
        drawRect('#fff', this.innerPadding[LEFT], this.innerPadding[TOP],
                 this.innerWidth(), this.innerHeight());
      }
      texture = PIXI.Texture.fromCanvas(canvas);
      PIXI.Texture.addToCache(texture, frameId);
    }
    return texture;
  }

});

var Game = GameObject.$extend({

  'class': '',

  rendererClass: PIXI.CanvasRenderer,

  /// Event handlers.
  ///
  /// Available events:
  /// - key{KEY}(Boolean pressed)  (e.g., keyLeft, keyRight, ...)
  /// - touch(Touch[] touches, String eventType)
  /// - blur()
  /// - resize()
  ///
  handlers: null,

  __init__: function() {
    this.$super.apply(this, arguments);
    this.renderer = new this.rendererClass(this.width, this.height);
    this.handlers = this.handlers || {};
    this._first = true;
  },

  __disp__: function() {
    return new PIXI.Container();
  },

  __elem__: function() {
    var elem = $('<div>').addClass(this['class']);
    var view = $(this.renderer.view).css('display', 'block');
    elem.css({position: 'relative', imageRendering: 'pixelated'});
    elem.append(view);
    return elem;
  },

  elem: function() {
    /// Gets the cached element.
    var elem = this.__elem__();
    if (elem) {
      this.elem = function() { return elem; }
    }
    return elem;
  },

  zoom: function(scale) {
    this.disp().scale.set(scale, scale);
    this.renderer.resize(this.width * scale, this.height * scale);
  },

  watch: function(window, document, handlers) {
    handlers = handlers || {};
    // Keyboard events.
    function makeKeyHandler(pressed) {
      var eventType = pressed ? 'keydown' : 'keyup';
      return $.proxy(function(e) {
        var key = KEYS[e.which];
        if (!key) {
          return;
        }
        var handlerName = 'key' + key.charAt(0).toUpperCase() + key.slice(1);
        var handler = this.handlers[handlerName];
        handler && handler.call(this, pressed);
        handlers[eventType] && handlers[eventType].call(this, key);
      }, this);
    }
    $(window).on({
      keydown: makeKeyHandler.call(this, true),
      keyup: makeKeyHandler.call(this, false),
      blur: $.proxy(function(e) {
        this.handlers.blur && this.handlers.blur.call(this);
        handlers.blur && handlers.blur.call(this);
      }, this)
    });
    // Touch events.
    $(document).on('touchstart touchmove touchend', $.proxy(function(e) {
      if (e.target !== document.body) {
        var elem = this.elem();
        if (!elem || !$.contains(elem.get(0), e.target)) {
          // Filter touch target.  Some overlapped layers should be touchable.
          return;
        }
      }
      if (this.handlers.touch) {
        if (e.type !== 'touchend') {
          e.preventDefault();
        }
        this.handlers.touch.call(this, e.touches, e.type);
      }
    }, this));
    // Window events.
    $(window).on('resize', $.proxy(function() {
      var scale = Math.max(1, Math.floor(window.innerHeight / this.height));
      this.zoom(scale);
      handlers.resize && handlers.resize.call(this, scale);
    }, this)).trigger('resize');
  },

  setup: function() {
    /// Will be called before the first update.
  },

  update: function(time, fps) {
    if (this._first) {
      this.setup();
      this._first = false;
    }
    this.$super.apply(this, arguments);
  },

  __update__: function(frame, prevFrame, deltaTime) {
    this.$super.apply(this, arguments);
    this.renderer.render(this.disp());
  },

  run: function(fps, before, after) {
    var _requestAnimationFrame = window.requestAnimationFrame;
    if (fps !== undefined) {
      _requestAnimationFrame = function(f) {
        setTimeout(function() { f(Date.now()); }, 1000 / fps);
      };
    }
    PIXI.loader.add(ATLAS).load($.proxy(function() {
      var update = $.proxy(function(time) {
        before && before.call(this, time);
        game.update(time, fps);
        if (!this.killed) {
          _requestAnimationFrame(update);
        }
        after && after.call(this, time);
      }, this);
      _requestAnimationFrame(update);
    }, this));
  }

});

var Subleerunker = Game.$extend({

  __name__: 'Subleerunker',

  'class': 'subleerunker',

  width: 320,
  height: 480,

  fps: 30,
  difficulty: 0.25,

  setup: function() {
    // Set background color.
    this.renderer.backgroundColor = pickColor('background');

    // Init scores.
    var m = /best-score=(\d+)/.exec(document.cookie);
    if (!m) {
      // "my_best_score" is deprecated but for backward compatibility.
      m = /my_best_score=(\d+)/.exec(document.cookie);
    }
    this.scores = {
      current: 0,
      localBest: m ? Number(m[1]) : 0,
      worldBest: 0
    };
    var scores = $('<div class="scores">').css({
      position: 'absolute',
      right: 5,
      top: 3,
      textAlign: 'right',
      fontSize: 12,
      fontFamily: '"Share Tech Mono", monospace'
    }).html([
      '<div class="world-best"></div>',
      '<div class="local-best"></div>',
      '<div class="current"></div>'
    ].join('')).appendTo(this.hudElem());
    this.scoreElems = {
      worldBest: scores.find('>.world-best'),
      localBest: scores.find('>.local-best'),
      current: scores.find('>.current')
    };
    this.scoreElems.worldBest.css('color', rgb(pickColor('world-best-score')));
    this.scoreElems.localBest.css('color', rgb(pickColor('local-best-score')));
    this.scoreElems.current.css('color', rgb(pickColor('current-score')))
    this.scoreElems.current.text(this.scores.current);
    this.updateScore();
    this.loadWorldBestScore();

    // Reset game state.
    this.reset();
  },

  hudElem: function() {
    var elem = this.elem();
    var hudElem = elem.find('>.ui:eq(0)');
    if (!hudElem.length) {
      hudElem = $('<div class="hud">').css({
        position: 'absolute', top: 0, left: 0,
        margin: 0, padding: 0,
        // "100%" makes a layout bug on IE11.
        width: this.width, height: this.height
      });
      elem.append(hudElem);
    }
    this.hudElem = function() { return hudElem; }
    return hudElem;
  },

  zoom: function(scale) {
    this.$super.apply(this, arguments);
    this.hudElem().css('zoom', scale);
  },

  showSplash: function() {
    var Logo = GameObject.$extend({
      width: 148, height: 66,
      anchor: [0.5, 0],
      offset: [this.width / 2, 156],
      fps: 0,
      animations: {'default': {textureNames: ['logo']}},
      animationName: 'default',
    });
    var control = {};
    if (IS_MOBILE) {
      $.extend(control, {
        width: 33, height: 35, animationTextureNames: ['touch-0', 'touch-1']
      });
    } else {
      $.extend(control, {
        width: 65, height: 14, animationTextureNames: ['key-0', 'key-1']
      });
    }
    var Control = GameObject.$extend({
      width: control.width,
      height: control.height,
      anchor: [0.5, 1],
      offset: [this.width / 2, -31],
      fps: 1,
      animations: {'blink': {textureNames: control.animationTextureNames}},
      animationName: 'blink'
    });
    this.logo = new Logo(this);
    this.control = new Control(this);
    var disp = this.disp();
    disp.addChild(this.logo.disp());
    disp.addChild(this.control.disp());
  },

  hideSplash: function() {
    this.logo.kill();
    this.logo.destroy();
    this.control.kill();
    this.control.destroy();
    delete this.logo, this.control;
  },

  handlers: {
    keyLeft: function(press) {
      this.ctx.leftPressed = press;
      this.ctx.rightPrior = false;  // evaluate left first
      if (press) {
        this.ctx.shouldPlay = true;
      }
    },
    keyRight: function(press) {
      this.ctx.rightPressed = press;
      this.ctx.rightPrior = true;  // evaluate right first
      if (press) {
        this.ctx.shouldPlay = true;
      }
    },
    keyShift: function(press, lock) {
      this.ctx.shiftPressed = press;
      this.ctx.shiftLocked = !!lock;
      if (press && lock) {
        this.ctx.shouldPlay = true;
      }
    },
    blur: function() {
      this.ctx.leftPressed = false;
      this.ctx.rightPressed = false;
      this.ctx.shiftPressed = false;
      this.ctx.shiftLocked = false;
    },
    touch: function(touches, eventType) {
      if (eventType === 'start' && touches.length === 3) {
        // Toggle shift by 3 fingers.
        this.handlers.keyShift.call(this, !this.ctx.shiftPressed, true);
        return;
      }
      var pressLeft = false;
      var pressRight = false;
      if (touches.length) {
        var lastTouch = touches[touches.length - 1];
        if (lastTouch.pageX / window.innerWidth < 0.5) {
          pressLeft = true;
        } else {
          pressRight = true;
        }
      }
      this.handlers.keyLeft.call(this, pressLeft);
      this.handlers.keyRight.call(this, pressRight);
    },
    // WASD style
    keyA: function(press) { this.handlers.keyLeft.call(this, press); },
    keyD: function(press) { this.handlers.keyRight.call(this, press); },
    // Vim style
    keyH: function(press) { this.handlers.keyLeft.call(this, press); },
    keyL: function(press) { this.handlers.keyRight.call(this, press); }
  },

  releaseLockedShift: function() {
    if (this.ctx.shiftLocked) {
      this.ctx.shiftPressed = false;
      this.ctx.shiftLocked = false;
    }
  },

  reset: function() {
    this.ctx.shouldPlay = false;
    this.releaseLockedShift();
    this.showSplash();
    delete this.difficulty;
  },

  play: function() {
    this.player = new Subleerunker.Player(this);
    if (this.ctx.shiftPressed) {
      // Hommarju for SUBERUNKER's shift-enter easter egg.
      this.player.acceleration *= 0.25;
      this.releaseLockedShift();
    }
    this.disp().addChild(this.player.disp());
    this.scores.current = 0;
    this.updateScore();
    this.hideSplash();
    this.ctx.random = new Math.seedrandom(this.ctx.randomSeed);
  },

  upScore: function() {
    this.scores.current++;
    this.updateScore();
  },

  updateScore: function(score) {
    if (score !== undefined) {
      this.scores.current = score;
    }
    this.renderScores();
  },

  renderScores: function() {
    // current
    this.scoreElems.current.text(this.scores.current);
    // local-best
    if (this.scores.localBest <= this.scores.current) {
      this.scoreElems.localBest.text('');
    } else {
      this.scoreElems.localBest.text(this.scores.localBest);
    }
    // world-best
    if (this.scores.worldBest <= this.scores.current ||
        this.scores.worldBest <= this.scores.localBest) {
      this.scoreElems.worldBest.text('');
    } else {
      this.scoreElems.worldBest.text(this.scores.worldBest);
    }
  },

  _worldBestScoreReceived: function(score) {
    this.scores.worldBest = Number(score);
    this.renderScores();
  },

  loadWorldBestScore: function() {
    if (!ctx.worldBestScoreURL) {
      return;
    }
    $.get(ctx.worldBestScoreURL, $.proxy(this._worldBestScoreReceived, this));
  },

  challengeWorldBestScore: function() {
    if (GameObject.debug) {
      return;
    }
    if (!ctx.worldBestScoreURL) {
      return;
    }
    if (this.scores.current <= this.scores.worldBest) {
      return;
    }
    $.ajax(ctx.worldBestScoreURL, {
      method: 'PUT',
      data: {score: this.scores.current},
      success: $.proxy(this._worldBestScoreReceived, this)
    });
  },

  gameOver: function() {
    this.player.die();

    var cookie;
    if (this.scores.localBest < this.scores.current) {
      this.scores.localBest = this.scores.current;
      // Save local best score in Cookie for a month.
      var expires = new Date();
      expires.setMonth(expires.getMonth() + 1);
      cookie = 'best-score=' + this.scores.localBest + '; '
      cookie += 'expires=' + expires.toUTCString() + '; ';
      cookie += 'path=/';
      document.cookie = cookie;
    }

    this.challengeWorldBestScore();

    // Trigger custom event to track the score by outside.
    $(window).trigger('score', [this.scores.current, !!this.ctx.debug]);
  },

  __update__: function(frame, prevFrame, deltaTime) {
    this.$super.apply(this, arguments);

    this.ctx.slow = (this.ctx.debug && this.ctx.shiftPressed);

    if (!this.player) {
      if (this.ctx.shouldPlay) {
        this.play();
        this.ctx.shouldPlay = false;
        this.rebaseFrame(0);
      }
      return;
    }

    var movements = [[this.ctx.leftPressed, this.player.left],
                     [this.ctx.rightPressed, this.player.right]];
    for (var i = 0; i < 2; ++i) {
      var mov = movements[this.ctx.rightPrior ? 1 - i : i];
      if (mov[0]) {
        mov[1].call(this.player, deltaTime);
        break;
      }
    }
    if (this.ctx.leftPressed || this.ctx.rightPressed) {
      this.player.forward(deltaTime);
    } else {
      this.player.rest(deltaTime);
    }

    if (!this.player.dead) {
      var deltaFrame = frame - prevFrame;
      for (var i = 0; i < deltaFrame; ++i) {
        if (this.random() < this.difficulty) {
          var flame = new Subleerunker.Flame(this);
          this.disp().addChild(flame.disp());
        }
        this.difficulty *= 1.001;
      }
    } else {
      var done = true;
      $.each(this.children, function() {
        done = false;
        return false;
      });
      if (done) {
        delete this.player;
        this.reset();
      }
    }
  }
});

$.extend(Subleerunker, {

  Player: GameObject.$extend({

    __name__: 'Player',

    __init__: function(parent) {
      this.$super.apply(this, arguments);
      this.position = parent.width / 2 - this.width / 2;
      this.updatePosition();
    },

    __update__: function(frame, prevFrame, deltaTime) {
      this.$super.apply(this, arguments);
      if (this.blink.frame !== frame) {
        this.blink = {frame: frame, active: this.random() < 0.02};
      }
      if (this.dead) {
        if (this.animationEnds()) {
          this.kill();
        }
      } else if (this.speed) {
        this.updatePosition(deltaTime);
      }
    },

    /* Animation */

    fps: 12,
    animations: {
      idle: {textureNames: [
        'player-idle-0', 'player-idle-1', 'player-idle-2', 'player-idle-3',
        'player-idle-4', 'player-idle-5', 'player-idle-6'
      ]},
      run: {textureNames: [
        'player-run-0', 'player-run-1', 'player-run-2', 'player-run-3',
        'player-run-4', 'player-run-5', 'player-run-6', 'player-run-7'
      ]},
      die: {textureNames: [
        'player-die-0', 'player-die-1', 'player-die-2', 'player-die-3',
        'player-die-4', 'player-die-5', 'player-die-6', 'player-die-7'
      ], once: true}
    },
    animationName: 'idle',

    blink: {frame: 0, active: false},

    updateAnimation: function(anim, index) {
      this.$super.apply(this, arguments);
      this.overlapEyelids(anim, index);
    },

    overlapEyelids: function(anim, index) {
      if (this._eyelids) {
        this._eyelids.visible = false;
      }
      if (this.animationName === 'die') {
        // There's no eyelids for "die" animation.
        return;
      }
      if (this.blink.active) {
        var disp = this.disp();
        var eyelidsTexture = getTexture(anim.textureNames[index] + '-eyelids');
        if (this._eyelids) {
          this._eyelids.texture = eyelidsTexture;
          this._eyelids.visible = true;
        } else {
          this._eyelids = new PIXI.Sprite(eyelidsTexture);
          disp.addChild(this._eyelids);
        }
        this._eyelids.x = disp.width * -disp.anchor.x;
        this._eyelids.y = disp.height * -disp.anchor.y;
      }
    },

    /* View */

    width: 48,
    height: 72,
    innerPadding: [10, 18, 50],
    anchor: [0, 1],
    offset: [0, -1],

    /* Move */

    speed: 0,
    acceleration: 6,
    step: 300,

    setRunAnimation: function(duration) {
      var frame;
      if (this.animationName === 'idle') {
        frame = 0;
      } else if (this.animationName === 'run' && duration !== this.duration) {
        frame = this.animationFrame() + 4;
      }
      var disp = this.disp();
      switch (duration) {
        case -1:
          disp.scale.x = -1;
          disp.anchor.x = 1;
          break;
        case +1:
          disp.scale.x = +1;
          disp.anchor.x = 0;
          break;
      }
      this.setAnimation('run', frame);
    },

    left: function(deltaTime) {
      this.$super.apply(this, arguments);
      this.setRunAnimation(-1);
    },

    right: function(deltaTime) {
      this.$super.apply(this, arguments);
      this.setRunAnimation(+1);
    },

    rest: function(deltaTime) {
      this.$super.apply(this, arguments);
      this.setAnimation('idle');
    },

    updatePosition: function(deltaTime) {
      this.$super.apply(this, arguments);

      var position = this.position;
      var max = this.parent.width - this.width;
      this.position = limit(this.position, 0, max);

      if (position !== this.position) {
        this.speed = 0;
      }

      this.disp().x = this.position;
    },

    /* Own */

    die: function() {
      this.dead = true;
      this.speed = 0;
      this.setAnimation('die');
      this.left = this.right = this.forward = this.rest = $.noop;
    }

  }),

  Flame: GameObject.$extend({

    __name__: 'Flame',

    __init__: function(parent) {
      this.$super.apply(this, arguments);
      var W = parent.width;
      var w = this.width;
      this.xPosition = (W - w * 2) * this.random() + w / 2;
      this.position = -this.height;
    },

    __update__: function(frame, prevFrame, deltaTime) {
      this.$super.apply(this, arguments);
      var player = this.parent.player;

      if (this.landed) {
        if (this.animationEnds()) {
          this.destroy();
          if (!player.dead) {
            this.parent.upScore();
          }
        }
      } else {
        var prevPosition = this.position;
        this.forward(deltaTime);
        this.updatePosition(deltaTime);

        var max = this.parent.height - this.height - this.landingMargin;
        var min = this.parent.height - player.height;

        if (this.position > max) {
          this.position = max;
          this.speed = 0;
          this.updatePosition(deltaTime);
          this.setAnimation('land');
          this.landed = true;
        } else if (this.position < min) {
          return;
        }

        if (!player.dead && this.hits(player, prevPosition)) {
          this.destroy();
          this.parent.gameOver();
        }
      }
    },

    /* View */

    width: 24,
    height: 16,
    innerPadding: [8, 8, 2],
    landingMargin: 2,

    /* Animation */

    animations: {
      burn: {fps: 12, textureNames: [
        'flame-burn-0', 'flame-burn-1', 'flame-burn-2', 'flame-burn-3',
        'flame-burn-4', 'flame-burn-5', 'flame-burn-6'
      ]},
      land: {fps: 24, textureNames: [
        'flame-land-0', 'flame-land-1', 'flame-land-2'
      ], once: true}
    },
    animationName: 'burn',

    /* Move */

    speed: 0,
    acceleration: 0.6,
    step: 600,

    updatePosition: function(deltaTime) {
      this.$super.apply(this, arguments);
      var disp = this.disp();
      if (disp) {
        disp.x = this.xPosition;
        disp.y = this.position;
      }
    },

    /* Own */

    hits: function(player, prevPosition) {
      var H = this.parent.height;

      var top = prevPosition + this.innerPadding[TOP];
      var bottom = this.position + this.height - this.innerPadding[2];
      var left = this.xPosition + this.innerPadding[3];
      var right = left + this.innerWidth();

      var pTop = player.height - player.innerPadding[0];
      var pBottom = player.innerPadding[2];
      var pLeft = player.position + player.innerPadding[3];
      var pRight = pLeft + player.innerWidth();

      pTop = H - pTop;
      pBottom = H - pBottom;

      var checkAltitude = top <= pBottom && pTop <= bottom;
      var checkLeft = pLeft <= left && left <= pRight;
      var checkRight = pLeft <= right && right <= pRight;

      return checkAltitude && (checkLeft || checkRight);
    }

  })

});
