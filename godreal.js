'use strict';

const X      = 0;
const Y      = 1;

const TOP    = 0;
const RIGHT  = 1;
const BOTTOM = 2;
const LEFT   = 3;

const KEYS = {
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
const nextId = (function() {
  let idSeq = 0;
  return function() {
    return idSeq++;
  };
})();

const limit = function(n, min, max) {
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
const normalizePadding = function(padding) {
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

const calcFrame = function(fps, time) {
  return Math.floor(time * fps / 1000);
};

const textureToCanvas = function(texture) {
  let t = texture;
  let r = new PIXI.CanvasRenderer(t.width, t.height, {transparent: true});
  r.render(new PIXI.Sprite(t));
  return r.view;
};

const GameObject = Class.$extend({

  __name__: 'GameObject',

  __init__: function(/* parent or ctx */arg) {
    this.__id__     = nextId();
    this.children   = {};
    this._firstTick = true;
    this._destroyed = false;

    if (arg instanceof GameObject) {
      let parent = arg;
      this.parent = parent;
      this.root = parent.root;
      parent.addChild(this);
      this.ctx = parent.ctx;
    } else {
      this.root = this;
      this.ctx = arg ? arg : {};
    }

    this.innerPadding = normalizePadding(this.innerPadding);

    if (this.animName) {
      this.setAnim(this.animName);
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

    let disp = this.disp();
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
    let disp = this.__disp__();
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
    let anim = this.currentAnim();
    if (!anim || !anim.textureNames) {
      return null;
    }
    let texture = this.getTexture(anim.textureNames[0]);
    return new PIXI.Sprite(texture);
  },

  innerWidth: function() {
    return this.width - this.innerPadding[RIGHT] - this.innerPadding[LEFT];
  },

  innerHeight: function() {
    return this.height - this.innerPadding[TOP] - this.innerPadding[BOTTOM];
  },

  /* Animation */

  anims:    null,
  animName: null,

  currentAnim: function() {
    if (!this.anims || !this.animName) {
      return null;
    }
    return this.anims[this.animName] || null;
  },

  setAnim: function(animName, animFrame) {
    if (this.animName !== animName) {
      this.rebaseAnimFrame(animFrame || 0);
    }
    this.animName = animName;
  },

  animFrame: function(anim) {
    anim = anim || this.currentAnim();
    if (!anim) {
      return 0;
    }
    let fps   = anim.fps * this.timeScale();
    let time  = this.time - this.animBaseTime;
    let frame = calcFrame(fps, time);
    return this.animBaseFrame + frame;
  },

  animIndex: function(anim, frame) {
    let length = anim.textureNames.length;
    if (anim.once) {
      return Math.min(frame, length - 1);
    } else {
      return Math.floor(frame % length);
    }
  },

  hasAnimEnded: function() {
    let anim = this.currentAnim();
    if (!anim) {
      return true;  // never started
    } else if (!anim.once) {
      return false;  // never ends
    }
    return this.animFrame(anim) >= anim.textureNames.length;
  },

  animBaseFrame: 0,
  animBaseTime:  0,

  rebaseAnimFrame: function(animBaseFrame) {
    this.animBaseFrame = animBaseFrame;
    this.animBaseTime  = this.time;
  },

  renderAnim: function(anim, index) {
    let texture = this.getTexture(anim.textureNames[index]);
    this.disp().texture = texture;
  },

  /* Move */

  position:     0,
  speed:        0,
  acceleration: 0,  // per frame
  friction:     0,  // per frame
  maxVelocity:  undefined,  // max velocity

  timeScale: function() {
    return this.ctx.timeScale === undefined ? 1 : this.ctx.timeScale;
  },

  boundary: function() {
    return [-Infinity, +Infinity];
  },

  /* Game loop */

  time:  null,
  lag:   0,
  frame: 0,

  /**
   * An iteration of the game loop.
   *
   * Call this method at each animation frames.
   *
   * The game loop follows the deterministic lockstep style with fixed delta
   * time.  See also: https://gafferongames.com/post/fix_your_timestep
   *
   */
  tick: function(time) {
    // Call setup() at the first tick.
    if (this._firstTick) {
      this._firstTick = false;
      this.setup();
      return;
    }

    // Accumulate lag.
    let prevTime = this.time;
    if (prevTime !== null) {
      let deltaTime = time - prevTime;
      this.lag += deltaTime;
    }
    this.time = time;
    $.each(this.children, function(__, c) { c.time = time; });

    // Game loop settings
    let ts = this.timeScale();
    let FPS       = 60;               // FPS for simulation
    let TIME_STEP = 1000 / FPS / ts;  // ms per frame
    let MAX_STEPS = 6 * ts;           // prevent the spiral of death.

    let i = 0;
    while (this.lag >= TIME_STEP) {
      // Each iteration is one frame.
      this.frame++;

      this._simulate();
      this._update(this.frame);

      this.lag -= TIME_STEP;

      if (++i >= MAX_STEPS) {
        // Reset lag.  Perhaps the window is refocused.
        this.lag = 0;
        break;
      }
    }

    // The rendering time is behind of the simulation time.  The game objects
    // should be predicted to be rendered smoothly.
    if (this.lag > 0) {
      let deltaFrame = this.lag / TIME_STEP;
      this._predict(deltaFrame);
    }

    this._render();
  },

  _simulate: function() {
    // Simulate for the gameplay logic.
    let state = this.simulate(this.state(), 1);

    this.position = state.position;
    this.speed    = state.speed;

    delete this._prediction;

    // Simulate children recursively.
    $.each(this.children, function(__, c) { c._simulate(); });
  },

  _update: function(frame) {
    if (this._destroyed) {
      // Perhaps destroySoon() has been called.  Here calls destroy() multiple
      // times.  So the destroy() method must be idempotent.
      this.destroy();
    } else {
      // Run a tick for the gameplay logic.
      this.update(frame);
    }

    // Update children recursively.
    $.each(this.children, function(__, c) { c._update(frame); });
  },

  _predict: function(deltaFrame) {
    this._prediction = this.simulate(this.state(), deltaFrame);

    // Predict children recursively.
    $.each(this.children, function(__, c) { c._predict(deltaFrame); });
  },

  _render: function() {
    this.render();

    // Render children recursively.
    $.each(this.children, function(__, c) { c._render(); });
  },

  state: function() {
    return {position: this.position, speed: this.speed};
  },

  simulate: function(state, deltaFrame) {
    let impact = deltaFrame;

    let speed = state.speed;
    speed += this.acceleration * impact;
    if (speed !== 0 && this.friction !== 0) {
      let speedIsPositive = speed > 0;
      speed = Math.abs(speed);
      speed -= this.friction * impact;
      speed = Math.max(0, speed) * (speedIsPositive ? +1 : -1);
    }
    if (this.maxVelocity !== undefined) {
      speed = limit(speed, -this.maxVelocity, +this.maxVelocity);
    }

    let position = state.position;
    position += speed * impact;

    let boundary = this.boundary();
    if (position < boundary[0]) {
      position = boundary[0];
      speed = 0;
    } else if (position > boundary[1]) {
      position = boundary[1];
      speed = 0;
    }

    return {position: position, speed: speed};
  },

  render: function() {
    let state = this._prediction || this.state();
    this.visualize(state);

    let anim = this.currentAnim();
    if (anim) {
      let f = this.animFrame(anim);
      let i = this.animIndex(anim, f);
      this.renderAnim(anim, i);
    }
  },

  /* Override */

  visualize: function(state) {
    // Called before rendering.  Make the view reflect the given state.
    // The state argument is {position: Number, speed: Number}.
  },

  setup: function() {
    // Called before the first tick in the game loop.
  },

  update: function(frame) {
    // Called at every ticks in the game loop.
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
    let frameId = this.__name__ + '/' + name;
    let texture;
    try {
      texture = PIXI.Texture.fromFrame(frameId);
    } catch (e) {
      // Draw bounding box.
      let t = this._getTexture(name);
      let canvas = textureToCanvas(t);
      function drawRect(style, x, y, w, h) {
        let c = canvas.getContext('2d');
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
    let t = this._getTexture('palette-' + name);
    let canvas = textureToCanvas(t);
    let pixel = canvas.getContext('2d').getImageData(0, 0, 1, 1).data;
    let color = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
    this._palette[name] = color;  // cache
    return color;
  }

});

const Game = GameObject.$extend({

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
  },

  __disp__: function() {
    return new PIXI.Container();
  },

  __elem__: function() {
    let elem = $('<div>').addClass(this['class']);
    let view = $(this.renderer.view).css('display', 'block');
    elem.css({position: 'relative', imageRendering: 'pixelated'});
    elem.append(view);
    return elem;
  },

  elem: function() {
    /// Gets the cached element.
    let elem = this.__elem__();
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
      let eventType = pressed ? 'keydown' : 'keyup';
      return $.proxy(function(e) {
        let key = KEYS[e.which];
        if (!key) {
          return;
        }
        if (!this.handlesKey(e)) {
          return;
        }
        let handlerName = 'key' + key.charAt(0).toUpperCase() + key.slice(1);
        let handler = this.handlers[handlerName];
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
        let scale = Math.max(1, Math.floor(window.innerHeight / this.height));
        this.zoom(scale);
        handlers.resize && handlers.resize.call(this, scale);
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
    let elem = this.elem();
    if (elem && $.contains(elem.get(0), e.target)) {
      return true;
    }
    // Maybe some overlapped layer is touched.
    return false;
  },

  render: function() {
    this.renderer.render(this.disp());
  },

  run: function(fps, before, after) {
    let _requestAnimationFrame = window.requestAnimationFrame;
    if (fps !== undefined) {
      _requestAnimationFrame = function(f) {
        setTimeout(function() { f(Date.now()); }, 1000 / fps);
      };
    }
    PIXI.loader.add(this.atlas).load($.proxy(function() {
      let tick = $.proxy(function(time) {
        before && before.call(this, time);
        this.tick(time);
        if (!this._destroyed) {
          _requestAnimationFrame(tick);
        }
        after && after.call(this, time);
      }, this);
      _requestAnimationFrame(tick);
    }, this));
  }

});
