var limit = function(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
    if (p.length === 1) {
      this.padding = [p[0], p[0], p[0], p[0]];
    } else if (p.length === 2) {
      this.padding = [p[0], p[1], p[0], p[1]];
    } else if (p.length === 3) {
      this.padding = [p[0], p[1], p[2], p[1]];
    }

    if (parent) {
      this.jobs = parent.jobs;
      this.jobIndex = parent.jobs.length;
      parent.jobs.push($.proxy(this.loop, this));
    } else {
      this.jobs = [];
    }

    if (this.sceneName) {
      this.scene(this.sceneName);
    }

    this.killed = false;
  },

  /* Destruct */

  kill: function() {
    this.killed = true;
  },

  destroy: function() {
    this.elem().remove();
    delete this.parent.jobs[this.jobIndex];
  },

  /* DOM */

  width: null,
  height: null,
  padding: [],
  css: null,

  elem: function() {
    var css = $.extend({
      position: 'absolute',
      overflow: 'hidden',
      width: this.width,
      height: this.height,
      padding: this.padding.join('px ') + 'px',
      backgroundImage: 'url(' + this.atlas + ')',
      backgroundRepeat: 'no-repeat'
    }, this.css);

    if (GameObject.debug) {
      css.outline = '1px dashed rgba(255, 255, 255, 0.25)';
    }

    var el = $('<div class="' + this['class'] + '"></div>').css(css);

    if (GameObject.debug) {
      el.append($('<div></div>').css({
        height: '100%',
        outline: '1px solid #fff'
      }));
    }

    this.elem = function() {
      return el;
    };
    return el;
  },

  outerWidth: function() {
    return this.width + this.padding[1] + this.padding[3];
  },

  outerHeight: function() {
    return this.height + this.padding[0] + this.padding[2];
  },

  /* Animation */

  atlas: null,
  atlasStarts: [0, 0],
  atlasMargin: 0,
  fps: 60,
  frameRate: 1,
  animations: null,
  sceneName: null,

  cell: function(x, y) {
    x *= -(this.outerWidth() + this.atlasMargin);
    y *= -(this.outerHeight() + this.atlasMargin);
    x -= this.atlasStarts[0];
    y -= this.atlasStarts[1];
    var pos = x + 'px ' + y + 'px';
    this.elem().css('background-position', pos);
  },

  frame: null,

  scene: function(sceneName, keepFrame) {
    this.sceneName = sceneName;
    this._animation = this.animations[sceneName];
    if (!keepFrame) {
      this.frame = 0;
    }
  },

  isLastFrame: function() {
    return this.frame >= this._animation.offsets.length;
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

  loop: function() {
    var self = this;

    if (this.parent === undefined) {
      $.each(this.jobs, function(i, job) {
        if (job !== undefined) {
          job();
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

    var anim = this._animation;
    if (anim) {
      var i = Math.floor(this.frame % anim.offsets.length);
      var offset = anim.offsets[i];
      var frameRate = anim.frameRate || this.frameRate;
      this.frame += frameRate * this.resist();
      this.cell.apply(this, offset);
    }
  },

  start: function() {
    var delay = 1000 / this.fps;
    this.process = setInterval($.proxy(this.loop, this), delay);
  },

  stop: function() {
    clearInterval(this.process);
    delete this.process;
  }

});

var Subleerunker = GameObject.$extend({

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

  __init__: function() {
    this.$super.apply(this, arguments);

    this.css = {
      left: '50%',
      top: '50%',
      marginLeft: this.outerWidth() / -2,
      marginTop: this.outerHeight() / -2,
      outline: '1px solid #222',
      backgroundColor: '#000',
      backgroundImage: 'url(splash.gif)',
      backgroundRepeat: 'no-repeat'
    };

    var m = /my_best_score=(\d+)/.exec(document.cookie);
    this.score = {
      current: 0,
      myBest: m ? m[1] : 0,
      high: 0
    };

    this.updateScore();
    this.reset();
    this.adjustZoom();
  },

  adjustZoom: function() {
    this.elem().css('zoom', Math.floor(window.innerHeight / this.height));
  },

  elem: function() {
    var el = this.$super();
    var score = $('<div class="score"></div>').css({
      position: 'absolute',
      right: 2,
      top: 2,
      textAlign: 'right',
      color: '#fff',
      fontSize: 11,
      fontFamily: 'monospace'
    }).html([
      '<div class="high"></div>',
      '<div class="mybest"></div>',
      '<div class="current"></div>'
    ].join(''));
    var preload = $('<div class="preload"></div>').css({
      position: 'absolute',
      top: -9999,
      left: -9999
    });

    // Score Display
    el.append(score);
    el.currentScore = score.find('>.current').text(this.score.current);
    el.myBestScore = score.find('>.mybest').css('color', '#ccc');
    el.highScore = score.find('>.high').css('color', '#999');

    // Preload
    el.append(preload);
    var atlases = [];
    $.each([Subleerunker.Player, Subleerunker.Flame], function(i, cls) {
      if (atlases.indexOf(cls.prototype.atlas) === -1) {
        atlases.push(cls.prototype.atlas);
      }
    });
    $.each(atlases, function(i, atlas) {
      $('<img />').attr('src', atlas).appendTo(preload);
    });

    return el;
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

    $(window).on('resize', function(e) {
      self.adjustZoom();
    });
  },

  slow: function() {
    return GameObject.debug && this.shiftPressed;
  },

  reset: function() {
    this.shouldPlay = false;
    this.releaseLockedShift();
    this.elem().css('background-position', '0 0');
  },

  play: function() {
    this.count = 0;
    this.player = new Subleerunker.Player(this);
    if (this.shiftPressed) {
      // Hommarju for SUBERUNKER's shift-enter easter egg.
      this.player.friction *= 0.25;
      this.releaseLockedShift();
    }
    this.player.elem().appendTo(this.elem());
    this.score.current = 0;
    this.updateScore();
    this.elem().css('background-position', '-9999px 0');
  },

  upScore: function() {
    this.score.current++;
    this.updateScore();
  },

  updateScore: function(score) {
    if (score !== undefined) {
      this.score.current = score;
    }
    this.updateMyBestScore();
    this.updateHighScore();
    this.elem().currentScore.text(this.score.current);
  },

  updateMyBestScore: function(score) {
    if (score !== undefined) {
      this.score.myBest = score;
    }
    if (this.score.myBest <= this.score.current) {
      this.elem().myBestScore.text('');
    } else {
      this.elem().myBestScore.text(this.score.myBest);
    }
  },

  updateHighScore: function(score) {
    if (score !== undefined) {
      this.score.high = score;
    }

    var greaterThanCurrentScore = this.score.high > this.score.current;
    var greaterThanMyBestScore = this.score.high > this.score.myBest;

    if (!greaterThanCurrentScore || !greaterThanMyBestScore) {
      this.elem().highScore.text('');
    } else {
      this.elem().highScore.text(this.score.high);
    }
  },

  fetchHighScore: function() {
    // Not Implemented.
    /*
    $.getJSON('/high-score', $.proxy(function(highScore) {
      this.updateHighScore(highScore);
      if (!this.killed) {
        setTimeout($.proxy(this.fetchHighScore, this), 10 * 1000);
      }
    }, this));
    */
  },

  challengeHighScore: function() {
    this.updateHighScore(this.score.current);
    if (GameObject.debug) {
      return;
    }
    // Not Implemented.
    /*
    $.post('/high-score', {
      my_score: this.score.current
    });
    */
  },

  gameOver: function() {
    this.player.die();

    var cookie;
    if (this.score.myBest < this.score.current) {
      // Save my best score
      var expires = new Date();
      expires.setMonth(expires.getMonth() + 1);

      cookie = 'my_best_score=' + this.score.current + '; '
      cookie += 'expires=' + expires.toUTCString() + '; ';
      cookie += 'path=/';
      document.cookie = cookie;

      this.updateMyBestScore(this.score.current);
    }
    if (this.score.high < this.score.current) {
      this.challengeHighScore();
    }

    // Trigger custom event to track the score by outside.
    $(window).trigger('score', [this.score.current]);
  },

  loop: function() {
    if (this.player) {
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
    } else {
      if (this.shouldPlay) {
        this.play();
        this.shouldPlay = false;
      }
      return;
    }

    if (!this.player.dead) {
      if ((this.count * this.resist()) % 2 == 0) {
        var difficulty = 0.25 + (this.count / 1000);
        if (Math.random() < difficulty) {
          var flame = new Subleerunker.Flame(this);
          flame.elem().appendTo(this.elem());
        }
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

    ++this.count;

    this.$super();
  },

  start: function() {
    this.$super();
    this.fetchHighScore();
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

    loop: function() {
      this.$super();

      if (this.dead) {
        if (this.isLastFrame()) {
          this.kill();
        }
      } else if (this.speed) {
        this.updatePosition();
      }
    },

    /* DOM */

    width: 12,
    height: 12,
    padding: [10, 18, 50],
    css: {bottom: 0 },

    /* Animation */

    atlas: 'atlas.gif',
    frameRate: 0.2,
    animations: {
      rightIdle: {
        offsets: [[0,0], [1,0], [2,0], [3,0], [4,0], [5,0], [6,0]]
      },
      leftIdle: {
        offsets: [[0,1], [1,1], [2,1], [3,1], [4,1], [5,1], [6,1]]
      },
      rightRun: {
        offsets: [[0,2], [1,2], [2,2], [3,2], [4,2], [5,2], [6,2], [7,2]]
      },
      leftRun: {
        offsets: [[0,3], [1,3], [2,3], [3,3], [4,3], [5,3], [6,3], [7,3]]
      },
      die: {
        offsets: [[0,4], [1,4], [2,4], [3,4], [4,4], [5,4], [6,4], [7,4]]
      }
    },
    sceneName: 'rightIdle',

    /* Move */

    speed: 0,
    duration: 1,
    friction: 0.1,
    step: 5,

    runScene: function(direction) {
      var sceneName = direction + 'Run';
      if (this.sceneName == sceneName) {
        return;
      }
      if (/Idle$/.exec(this.sceneName)) {
        this.frame = 0;
      } else if (/Run$/.exec(this.sceneName)) {
        // Inverse same pose.
        this.frame += 4;
      }
      this.scene(sceneName, /* keepFrame */ true);
    },

    left: function() {
      this.$super();
      this.runScene('left');
    },

    right: function() {
      this.$super();
      this.runScene('right');
    },

    rest: function() {
      this.$super();
      var prefix = {'-1': 'left', '1': 'right'}[this.duration];
      this.scene(prefix + 'Idle', true);
    },

    updatePosition: function() {
      this.$super();

      var position = this.position;
      var max = this.parent.outerWidth() - this.outerWidth();
      this.position = limit(this.position, 0, max);

      if (position !== this.position) {
        this.speed = 0;
      }

      this.elem().css('left', this.position);
    },

    /* Own */

    die: function() {
      this.dead = true;
      this.speed = 0;
      this.scene('die');
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

    loop: function() {
      this.$super();
      var player = this.parent.player;

      if (this.landed) {
        if (this.isLastFrame()) {
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
          this.scene('land');
          this.landed = true;
        } else if (this.position < min) {
          return;
        }

        if (!player.dead && this.hitted(player)) {
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

    atlas: 'atlas.gif',
    atlasStarts: [337, 1],
    atlasMargin: 2,
    animations: {
      burn: {
        frameRate: 0.2,
        offsets: [[0,0], [0,2], [1,2], [0,3], [1,3], [0,4], [1,4]]
      },
      land: {
        frameRate: 0.4,
        offsets: [[1,0], [0,1], [1,1]]
      }
    },
    sceneName: 'burn',

    /* Move */

    speed: 0,
    duration: 1,
    friction: 0.01,
    step: 10,

    updatePosition: function() {
      this.$super();

      this.elem().css({
        left: this.xPosition,
        top: this.position
      });
    },

    /* Own */

    hitted: function(player) {
      var prevPosition = this.position - this.speed * this.step;
      var H = this.parent.outerHeight();

      var top = prevPosition + this.padding[0];
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
