var limit = function(n, min, max) {
  return Math.max(min, Math.min(max, n));
};

var X = 0;
var Y = 1;
var TOP = 0;
var RIGHT = 1;
var BOTTOM = 2;
var LEFT = 3;

var getTexture = function(name) {
  return PIXI.loader.resources['atlas.json'].textures[name];
};

var calcFrame = function(fps, time) {
  return Math.floor(time * fps / 1000);
};

var GameObject = Class.$extend({

  __classvars__: {
    debug: false,
    keys: {
      8: 'backspace', 9: 'tab', 13: 'enter', 16: 'shift', 17: 'ctrl',
      18: 'alt', 19: 'pause', 20: 'capsLock', 27: 'esc', 33: 'pageUp',
      34: 'pageDown', 35: 'end', 36: 'home', 37: 'left', 38: 'up',
      39: 'right', 40: 'down', 45: 'insert', 46: 'delete'
    }
  },

  'class': null,

  __init__: function(parent) {
    this.parent = parent;

    var p = this.padding;
    if (!p) {
      this.padding = [0, 0, 0, 0];
    } else if (p.length === 1) {
      this.padding = [p[0], p[0], p[0], p[0]];
    } else if (p.length === 2) {
      this.padding = [p[0], p[1], p[0], p[1]];
    } else if (p.length === 3) {
      this.padding = [p[0], p[1], p[2], p[1]];
    }

    if (parent) {
      this.jobs = parent.jobs;
      this.jobIndex = parent.jobs.length;
      parent.jobs.push($.proxy(this.update, this));
    } else {
      this.jobs = [];
    }

    if (this.animationName) {
      this.setAnimation(this.animationName);
    }

    this.killed = false;
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
    delete this.parent.jobs[this.jobIndex];
  },

  /* DOM */

  width: null,
  height: null,
  padding: null,

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
    var texture = getTexture(anim.textureNames[0]);
    return new PIXI.Sprite(texture);
  },

  outerWidth: function() {
    return this.width + this.padding[RIGHT] + this.padding[LEFT];
  },

  outerHeight: function() {
    return this.height + this.padding[TOP] + this.padding[BOTTOM];
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
    if (this.animationName != animationName || frame !== undefined) {
      this.rebaseFrame(frame);
    }
    this.animationName = animationName;
  },

  animationFrame: function(anim) {
    anim = anim || this.currentAnimation();
    if (!anim) {
      return 0;
    }
    var fps = anim.fps || this.fps;
    return this.frame(fps);
  },

  animationEnds: function() {
    var anim = this.currentAnimation();
    if (!anim) {
      // Never started.
      return true;
    } else if (!anim.once) {
      // Never ends.
      return false;
    }
    return this.animationFrame(anim) >= anim.textureNames.length;
  },

  /* Move */

  position: 0,
  speed: 0,
  duration: 1,
  friction: 1,
  step: 1,

  left: function() {
    this.duration = -1;
    this.forward();
  },

  right: function() {
    this.duration = 1;
    this.forward();
  },

  up: function() {
    this.duration = -1;
    this.forward();
  },

  down: function() {
    this.duration = 1;
    this.forward();
  },

  forward: function() {
    this.speed += this.duration * this.friction;
    this.speed = limit(this.speed, -1, 1);
  },

  rest: function() {
    this.speed = Math.abs(this.speed) - this.friction;
    this.speed = Math.max(0, this.speed) * this.duration;
  },

  updatePosition: function() {
    this.position += this.speed * this.step * this.resist();
  },

  slow: function() {
    return false;
  },

  resist: function() {
    var root = this;
    while (root.parent) {
      root = root.parent;
    }
    return root.slow() ? 0.25 : 1;
  },

  /* Schedule */

  _time: 0,

  time: function() {
    if (this.parent) {
      return this.parent.time();
    } else {
      return this._time;
    }
  },

  baseFrame: 0,
  baseTime: 0,

  rebaseFrame: function(frame, time) {
    this.baseFrame = frame || 0;
    this.baseTime = (time === undefined ? this.time() : time);
  },

  frame: function(fps, time) {
    /// Gets the frame number at now .  The base frame can be set by
    /// `rebaseFrame`.
    if (fps === undefined) {
      fps = this.fps;
    }
    fps *= this.resist();
    time = (time === undefined ? this.time() : time);
    return this.baseFrame + calcFrame(fps, time - this.baseTime);
  },

  update: function(time) {
    if (this.baseTime == 0) {
      this.rebaseFrame(0, time);
    }
    var frame = this.frame(this.fps, time);
    var prevTime = this.time();
    var prevFrame = this.frame(this.fps, prevTime);
    var deltaTime = time - prevTime;
    if (!this.parent) {
      this._time = time;
    }
    this.__update__(frame, prevFrame, deltaTime);
  },

  __update__: function(frame, prevFrame, deltaTime) {
    var time = this.time();
    var self = this;
    if (this.parent === undefined) {
      $.each(this.jobs, function(i, job) {
        if (job !== undefined) {
          job(time);
          if (self.killed) {
            return false;
          }
        }
      });
      if (this.killed) {
        this.stop();
      }
    } else if (this.killed) {
      this.destroy();
    }

    if (this.killed) {
      return;
    }

    var anim = this.currentAnimation();
    if (anim) {
      var animFrame = this.animationFrame(anim);
      var animLength = anim.textureNames.length;
      var i;
      if (anim.once) {
        i = Math.min(animFrame, animLength - 1);
      } else {
        i = Math.floor(animFrame % animLength);
      }
      this.disp().texture = getTexture(anim.textureNames[i]);
    }
  }

});

var Game = GameObject.$extend({

  __init__: function() {
    this.$super.apply(this, arguments);
    this.renderer = new PIXI.CanvasRenderer(this.width, this.height);
  },

  __disp__: function() {
    return new PIXI.Container();
  },

  __elem__: function() {
    return $('<div>')
      .addClass(this['class'])
      .css('position', 'relative')
      .append(this.renderer.view);
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
    // this.disp().scale.set(scale, scale);
    // this.renderer.resize(this.width * scale, this.height * scale);
    this.elem().css('zoom', scale);
  },

  __update__: function(frame, prevFrame, deltaTime) {
    this.$super.apply(this, arguments);
    this.renderer.render(this.disp());
  }

});

var Subleerunker = Game.$extend({

  'class': 'subleerunker',

  width: 320,
  height: 480 - 2,
  padding: [0, 0, 2, 0],

  leftPrior: true,
  leftPressed: false,
  rightPressed: false,
  shiftPressed: false,
  shiftLocked: false,
  shouldPlay: false,

  fps: 30,
  difficulty: 0.25,

  __init__: function() {
    this.$super.apply(this, arguments);

    this.css = {
      left: '50%',
      top: '50%',
      marginLeft: this.outerWidth() / -2,
      marginTop: this.outerHeight() / -2,
      outline: '1px solid #222',
      backgroundColor: '#000'
    };

    var m = /best-score=(\d+)/.exec(document.cookie);
    if (!m) {
      // "my_best_score" is deprecated but for backward compatibility.
      m = /my_best_score=(\d+)/.exec(document.cookie);
    }
    this.scores = {
      current: 0,
      localBest: m ? m[1] : 0,
      worldBest: 0
    };
    var scores = $('<div>').addClass('scores').css({
      position: 'absolute',
      right: 5,
      top: 3,
      textAlign: 'right',
      fontSize: 12,
      fontFamily: '"Share Tech Mono", monospace'
    }).html([
      '<div class="local-best"></div>',
      '<div class="current"></div>'
    ].join('')).appendTo(this.elem());
    this.scoreElems = {
			localBest: scores.find('>.local-best'),
			current: scores.find('>.current')
		};
		this.scoreElems.localBest.css('color', '#a6b2b1');
    this.scoreElems.current.css('color', '#fff').text(this.scores.current);

    this.updateScore();
    this.reset();
  },

  showSplash: function() {
    var Logo = GameObject.$extend({
      'class': 'logo',
      width: 148, height: 66,
      anchor: [0.5, 0],
      offset: [this.width / 2, 156],
      fps: 1,
      animations: {'default': {textureNames: ['logo']}},
      animationName: 'default',
    });
    if (typeof window.orientation !== 'undefined') {
      // mobile
      var control = {
        width: 33, height: 35,
        animationTextureNames: ['touch-0', 'touch-1']
      };
    } else {
      // desktop
      var control = {
        width: 65, height: 14,
        animationTextureNames: ['key-0', 'key-1']
      };
    }
    var Control = GameObject.$extend({
      'class': 'control',
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

  keyEvents: {
    left: function(press) {
      this.leftPressed = press;
      this.leftPrior = true;  // evaluate left first
      if (press) {
        this.shouldPlay = true;
      }
    },
    right: function(press) {
      this.rightPressed = press;
      this.leftPrior = false;  // evaluate right first
      if (press) {
        this.shouldPlay = true;
      }
    },
    shift: function(press, lock) {
      this.shiftPressed = press;
      this.shiftLocked = !!lock;
      if (press && lock) {
        this.shouldPlay = true;
      }
    },
    released: function() {
      this.leftPressed = false;
      this.rightPressed = false;
      this.shiftPressed = false;
      this.shiftLocked = false;
    }
  },

  releaseLockedShift: function() {
    if (this.shiftLocked) {
      this.shiftPressed = false;
      this.shiftLocked = false;
    }
  },

  captureKeys: function(window, document) {
    var self = this;

    $(window).on('keydown', function(e) {
      var handler = self.keyEvents[GameObject.keys[e.which]];
      if ($.isFunction(handler)) {
        handler.call(self, true);
      }
    }).on('keyup', function(e) {
      var handler = self.keyEvents[GameObject.keys[e.which]];
      if ($.isFunction(handler)) {
        handler.call(self, false);
      }
    }).on('blur', function(e) {
      self.keyEvents.released.call(self);
    });

    $(document).on('touchstart touchmove touchend', function(e) {
      e.preventDefault();
      if (e.type == 'touchstart' && e.touches.length == 3) {
        // Toggle shift by 3 fingers.
        self.keyEvents.shift.call(self, !self.shiftPressed, true);
        return;
      }
      var pressLeft = false;
      var pressRight = false;
      if (e.touches.length) {
        var lastTouch = e.touches[e.touches.length - 1];
        if (lastTouch.pageX / window.innerWidth < 0.5) {
          pressLeft = true;
        } else {
          pressRight = true;
        }
      }
      self.keyEvents.left.call(self, pressLeft);
      self.keyEvents.right.call(self, pressRight);
    });
  },

  slow: function() {
    return GameObject.debug && this.shiftPressed;
  },

  reset: function() {
    this.shouldPlay = false;
    this.releaseLockedShift();
    this.showSplash();
    delete this.difficulty;
  },

  play: function() {
    this.player = new Subleerunker.Player(this);
    if (this.shiftPressed) {
      // Hommarju for SUBERUNKER's shift-enter easter egg.
      this.player.friction *= 0.25;
      this.releaseLockedShift();
    }
    this.disp().addChild(this.player.disp());
    this.scores.current = 0;
    this.updateScore();
    this.hideSplash();
  },

  upScore: function() {
    this.scores.current++;
    this.updateScore();
  },

  updateScore: function(score) {
    if (score !== undefined) {
      this.scores.current = score;
    }
    this.renderCurrentScore();
    this.renderLocalBestScore();
  },

  renderCurrentScore: function() {
    if (this.scoreElems.current === undefined) {
      this.scoreElems.current = this.elem().find('>.scores>.current');
    }
    this.scoreElems.current.text(this.scores.current);
  },

  renderLocalBestScore: function() {
    if (this.scoreElems.localBest === undefined) {
      this.scoreElems.localBest = this.elem().find('>.scores>.local-best');
    }
    if (this.scores.localBest <= this.scores.current) {
      this.scoreElems.localBest.text('');
    } else {
      this.scoreElems.localBest.text(this.scores.localBest);
    }
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

    // Trigger custom event to track the score by outside.
    $(window).trigger('score', [this.scores.current]);
  },

  __update__: function(frame, prevFrame, deltaTime) {
    if (!this.player) {
      if (this.shouldPlay) {
        this.play();
        this.shouldPlay = false;
        this.rebaseFrame(0);
      }
      this.$super.apply(this, arguments);
      return;
    }

    var movements = [[this.leftPressed, this.player.left],
                     [this.rightPressed, this.player.right]];
    for (var i = 0; i < 2; ++i) {
      var mov = movements[this.leftPrior ? i : 1 - i];
      if (mov[0]) {
        mov[1].call(this.player);
        break;
      }
    }
    if (this.leftPressed || this.rightPressed) {
      this.player.forward();
    } else {
      this.player.rest();
    }

    if (!this.player.dead) {
      var deltaFrame = frame - prevFrame;
      for (var i = 0; i < deltaFrame; ++i) {
        if (Math.random() < this.difficulty) {
          var flame = new Subleerunker.Flame(this);
          this.disp().addChild(flame.disp());
        }
        this.difficulty *= 1.001;
      }
    } else {
      var done = true;
      $.each(this.jobs, function(i, job) {
        if (job) {
          done = false;
          return false;
        }
      });
      if (done) {
        delete this.player;
        delete this.jobs;
        this.jobs = [];
        this.reset();
      }
    }

    this.$super.apply(this, arguments);
  }
});

$.extend(Subleerunker, {

  Player: GameObject.$extend({

    'class': 'player',

    __init__: function(parent) {
      this.$super.apply(this, arguments);

      this.position = parent.outerWidth() / 2 - this.outerWidth() / 2;
      this.updatePosition();
    },

    __update__: function(frame, prevFrame, deltaTime) {
      this.$super.apply(this, arguments);

      if (this.dead) {
        if (this.animationEnds()) {
          this.kill();
        }
      } else if (this.speed) {
        this.updatePosition();
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

    /* DOM */

    width: 12,
    height: 12,
    padding: [10, 18, 50],
    anchor: [0, 1],
    offset: [0, -1],

    /* Move */

    speed: 0,
    friction: 0.1,
    step: 5,

    setRunAnimation: function(duration) {
      var frame;
      if (this.animationName == 'idle') {
        frame = 0;
      } else if (this.animationName == 'run' && duration != this.duration) {
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

    left: function() {
      this.$super.apply(this, arguments);
      this.setRunAnimation(-1);
    },

    right: function() {
      this.$super.apply(this, arguments);
      this.setRunAnimation(+1);
    },

    rest: function() {
      this.$super.apply(this, arguments);
      this.setAnimation('idle');
    },

    updatePosition: function() {
      this.$super.apply(this, arguments);

      var position = this.position;
      var max = this.parent.outerWidth() - this.outerWidth();
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

    'class': 'flame',

    __init__: function(parent) {
      this.$super.apply(this, arguments);

      var W = parent.outerWidth();
      var w = this.outerWidth();
      this.xPosition = (W - w * 2) * Math.random() + w / 2;
      this.position = -this.outerHeight();
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
        this.forward();
        this.updatePosition();

        var max = this.parent.height - this.outerHeight();
        var min = this.parent.height - player.outerHeight();

        if (this.position > max) {
          this.position = max;
          this.speed = 0;
          this.updatePosition();
          this.setAnimation('land');
          this.landed = true;
        } else if (this.position < min) {
          return;
        }

        if (!player.dead && this.hits(player)) {
          this.destroy();
          this.parent.gameOver();
        }
      }
    },

    /* DOM */

    width: 6,
    height: 6,
    padding: [8, 8, 2],

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
    friction: 0.01,
    step: 10,

    updatePosition: function() {
      this.$super.apply(this, arguments);

      var disp = this.disp();
      if (disp) {
        disp.x = this.xPosition;
        disp.y = this.position;
      }
    },

    /* Own */

    hits: function(player) {
      var prevPosition = this.position - this.speed * this.step;
      var H = this.parent.outerHeight();

      var top = prevPosition + this.padding[TOP];
      var bottom = this.position + this.outerHeight() - this.padding[2];
      var left = this.xPosition + this.padding[3];
      var right = left + this.width;

      var pTop = player.outerHeight() - player.padding[0];
      var pBottom = player.padding[2];
      var pLeft = player.position + player.padding[3];
      var pRight = pLeft + player.width;

      pTop = H - pTop;
      pBottom = H - pBottom;

      var checkAltitude = top <= pBottom && pTop <= bottom;
      var checkLeft = pLeft <= left && left <= pRight;
      var checkRight = pLeft <= right && right <= pRight;

      return checkAltitude && (checkLeft || checkRight);
    }

  })

});
