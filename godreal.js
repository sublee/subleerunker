var X      = 0;
var Y      = 1;

var TOP    = 0;
var RIGHT  = 1;
var BOTTOM = 2;
var LEFT   = 3;

var KEYS = {
   8: 'backspace',  9: 'tab',   13: 'enter',    16: 'shift',  17: 'ctrl',
  18: 'alt',       19: 'pause', 20: 'capsLock', 27: 'esc',    33: 'pageUp',
  34: 'pageDown',  35: 'end',   36: 'home',     37: 'left',   38: 'up',
  39: 'right',     40: 'down',  45: 'insert',   46: 'delete',

  65: 'a', 66: 'b', 67: 'c', 68: 'd', 69: 'e', 70: 'f', 71: 'g', 72: 'h',
  73: 'i', 74: 'j', 75: 'k', 76: 'l', 77: 'm', 78: 'n', 79: 'o', 80: 'p',
  81: 'q', 82: 'r', 83: 's', 84: 't', 85: 'u', 86: 'v', 87: 'w', 88: 'x',
  89: 'y', 90: 'z'
};

/**
 * Gets the next Id.  A new Id is greater than the Ids generated before.
 */
var nextId = (function() {
  var idSeq = 0;
  return function() {
    return idSeq++;
  };
})();

var limit = function(n, min, max) {
  return Math.max(min, Math.min(max, n));
};

/**
 * Normalizes a padding array into a 4-element array by CSS padding
 * normalization rule.
 *
 * e.g.:
 *
 *   > normalizePadding([])
 *   [0, 0, 0, 0]
 *   > normalizePadding([3])
 *   [3, 3, 3, 3]
 *   > normalizePadding([2, 4])
 *   [2, 4, 2, 4]
 *   > normalizePadding([5, 10, 15])
 *   [5, 10, 15, 10]
 *   > normalizePadding([1, 2, 3, 4])
 *   [1, 2, 3, 4]
 *
 */
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

var rgb = function(color) {
  return '#' + ('000000' + color.toString(16)).slice(-6);
};

var textureToCanvas = function(texture) {
  var t = texture;
  var r = new PIXI.CanvasRenderer(t.width, t.height, {transparent: true});
  r.render(new PIXI.Sprite(t));
  return r.view;
};

var GameObject = Class.$extend({

  __name__: 'GameObject',

  __init__: function(/* parent or ctx */arg) {
    this.__id__     = nextId();
    this.children   = {};
    this._firstTick = true;
    this._destroyed = false;

    if (arg instanceof GameObject) {
      var parent = arg;
      this.parent = parent;
      this.root = parent.root;
      parent.addChild(this);
      this.ctx = parent.ctx;
    } else {
      this.root = this;
      this.ctx = arg ? arg : {};
    }

    this.innerPadding = normalizePadding(this.innerPadding);

    if (this.animationName) {
      this.setAnimation(this.animationName);
    }
  },

  addChild: function(child) {
    this.children[child.__id__] = child;
  },

  removeChild: function(child) {
    delete this.children[child.__id__];
  },

  /* Destruct */

  destroy: function() {
    this._destroyed = true;

    var disp = this.disp();
    if (disp) {
      disp.destroy();
    }

    if (this.parent) {
      this.parent.removeChild(this);
    }
  },

  destroySoon: function() {
    this._destroyed = true;
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
      this.render();
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

  animationFrame: function(anim) {
    anim = anim || this.currentAnimation();
    if (!anim) {
      return 0;
    }
    var fps = anim.fps * this.timeScale();
    return this.baseFrame + calcFrame(fps, this.time - this.baseTime);
  },

  animationIndex: function(anim, frame) {
    var length = anim.textureNames.length;
    if (anim.once) {
      return Math.min(frame, length - 1);
    } else {
      return Math.floor(frame % length);
    }
  },

  hasAnimationEnded: function() {
    var anim = this.currentAnimation();
    if (!anim) {
      return true;  // never started
    } else if (!anim.once) {
      return false;  // never ends
    }
    return this.animationFrame(anim) >= anim.textureNames.length;
  },

  renderAnimation: function(anim, index) {
    var texture = this.getTexture(anim.textureNames[index]);
    this.disp().texture = texture;
  },

  /* Move */

  position: 0,
  speed: 0,
  acceleration: 0,  // per frame
  friction: 0,  // per frame
  maxVelocity: undefined,  // max velocity

  timeScale: function() {
    return this.ctx.timeScale === undefined ? 1 : this.ctx.timeScale;
  },

  boundary: function() {
    return [-Infinity, +Infinity];
  },

  /* Schedule */

  time: null,
  lag: 0,
  frame: 0,
  baseFrame: 0,
  baseTime: 0,

  rebaseFrame: function(frame, time) {
    this.frame = 0;
    this.baseTime = (time === undefined ? this.time : time);
    // this.baseFrame = frame || 0;
    // this.baseTime = (time === undefined ? this.time : time);
  },

  /** An iteration of the game loop.
   *
   *  Call this method at each animation frames.
   *
   *  The game loop follows the deterministic lockstep style with fixed delta
   *  time.  See also: https://gafferongames.com/post/fix_your_timestep
   *
   */
  tick: function(time) {
    // Call __setup__ at the first tick.
    if (this._firstTick) {
      this._firstTick = false;
      this.__setup__();
      return;
    }

    // Ensure that the base frame is set.
    if (!this.baseTime) {
      this.rebaseFrame(0, time);
    }

    // Accumulate lag.
    if (this._refocused) {
      this.lag = 0;
      this._refocused = false;
    } else {
      var prevTime = this.time;
      if (prevTime !== null) {
        this.lag += (time - prevTime) * this.timeScale();
      }
    }
    this.time = time;

    var FPS       = 60;          // FPS for simulation
    var TIME_STEP = 1000 / FPS;  // ms per frame
    var MAX_STEPS = 6;           // prevent the spiral of death.

    var i = 0;
    var prevFrame = this.frame;

    while (this.lag >= TIME_STEP) {
      this.frame += this.timeScale();

      this.simulateThenUpdate(this.frame, prevFrame);

      this.lag -= TIME_STEP;
      prevFrame = this.frame;

      ++i;
      if (i >= MAX_STEPS) {
        break;
      }
    }

    this.render(this.lag / TIME_STEP);
  },

  simulateThenUpdate: function(frame, prevFrame) {
    $.each(this.children, $.proxy(function(__, child) {
      child.time = this.time;
      child.simulateThenUpdate(frame, prevFrame);
      if (this._destroyed) {
        return false;
      }
    }, this));

    var sim = this.simulate(frame - prevFrame);
    this.position = sim.position;
    this.speed = sim.speed;

    if (this._destroyed) {
      this.destroy();
      return;
    }

    // Call __update__() when only the current frame as an integer is updated.
    var intFrame     = Math.floor(frame);
    var intPrevFrame = Math.floor(prevFrame);
    if (intFrame !== intPrevFrame) {
      this.__update__(intFrame);
    }
  },

  simulate: function(deltaFrame) {
    var impact = deltaFrame;

    var speed = this.speed;
    speed += this.acceleration * impact;
    if (speed !== 0 && this.friction !== 0) {
      var speedIsPositive = speed > 0;
      speed = Math.abs(speed);
      speed -= this.friction * impact;
      speed = Math.max(0, speed) * (speedIsPositive ? +1 : -1);
    }
    if (this.maxVelocity !== undefined) {
      speed = limit(speed, -this.maxVelocity, +this.maxVelocity);
    }

    var position = this.position;
    position += speed * impact;

    var boundary = this.boundary();
    if (position < boundary[0]) {
      position = boundary[0];
      speed = 0;
    } else if (position > boundary[1]) {
      position = boundary[1];
      speed = 0;
    }

    return {position: position, speed: speed};
  },

  render: function(deltaFrame) {
    var anim = this.currentAnimation();
    if (anim) {
      var f = this.animationFrame(anim);
      var i = this.animationIndex(anim, f);
      this.renderAnimation(anim, i);
    }
  },

  __setup__: function() {
    /// Will be called before the first tick in the game loop.
  },

  __update__: function(frame) {
  },

  /* Misc */

  random: function() {
    return (this.ctx.random || Math.random)();
  },

  _getTexture: function(name) {
    return PIXI.loader.resources[this.root.atlas].textures[name];
  },

  getTexture: function(name) {
    if (!this.ctx.debug) {
      return this._getTexture(name);
    }
    var frameId = this.__name__ + '/' + name;
    var texture;
    try {
      texture = PIXI.Texture.fromFrame(frameId);
    } catch (e) {
      // Draw bounding box.
      var t = this._getTexture(name);
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
  },

  pickColor: function(name) {
    if (this._palette === undefined) {
      this._palette = {};
    } else if (this._palette[name] !== undefined) {
      return this._palette[name];
    }
    var t = this._getTexture('palette-' + name);
    var canvas = textureToCanvas(t);
    var pixel = canvas.getContext('2d').getImageData(0, 0, 1, 1).data;
    var color = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
    this._palette[name] = color;  // cache
    return color;
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

  /// The name of the atlas JSON file.
  atlas: null,

  __init__: function() {
    this.$super.apply(this, arguments);
    this.renderer = new this.rendererClass(this.width, this.height);
    this.handlers = this.handlers || {};
    this._refocused = false;
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
        if (!this.handlesKey(e)) {
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
      if (!this.handlesTouch(e)) {
        return;
      }
      if (this.handlers.touch) {
        if (e.type !== 'touchend') {
          e.preventDefault();
        }
        this.handlers.touch.call(this, e.touches, e.type);
      }
    }, this));
    // Window events.
    $(window).on({
      resize: $.proxy(function() {
        var scale = Math.max(1, Math.floor(window.innerHeight / this.height));
        this.zoom(scale);
        handlers.resize && handlers.resize.call(this, scale);
      }, this),
      blur: $.proxy(function() {
        console.log('blur');
        // this.ctx.timeScale = 0;
      }, this),
      focus: $.proxy(function() {
        console.log('focus');
        // this.ctx.timeScale = 1;
        this.time = null;
        this._refocused = true;
      }, this)
    }).trigger('resize');
  },

  handlesKey: function(e) {
    return (document.activeElement === document.body);
  },

  handlesTouch: function(e) {
    if (document.activeElement !== document.body) {
      return false;
    }
    if (e.target === document.body) {
      return true;
    }
    var elem = this.elem();
    if (elem && $.contains(elem.get(0), e.target)) {
      return true;
    }
    // Maybe some overlapped layer is touched.
    return false;
  },

  render: function(deltaFrame) {
    $.each(this.children, $.proxy(function(__, child) {
      child.render(deltaFrame);
    }, this));

    this.renderer.render(this.disp());
  },

  run: function(fps, before, after) {
    var _requestAnimationFrame = window.requestAnimationFrame;
    if (fps !== undefined) {
      _requestAnimationFrame = function(f) {
        setTimeout(function() { f(Date.now()); }, 1000 / fps);
      };
    }
    PIXI.loader.add(this.atlas).load($.proxy(function() {
      var tick = $.proxy(function(time) {
        before && before.call(this, time);
        game.tick(time);
        if (!this._destroyed) {
          _requestAnimationFrame(tick);
        }
        after && after.call(this, time);
      }, this);
      _requestAnimationFrame(tick);
    }, this));
  }

});
