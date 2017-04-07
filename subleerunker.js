var limit = function(n, min, max) {
  return Math.max(min, Math.min(max, n));
};

var GameObject = Class.$extend({

  __classvars__: {
    debug: false,
    keys: {
      backspace: 8, tab: 9, enter: 13, shift: 16, ctrl: 17, alt: 18,
      pause: 19, capsLock: 20, esc: 27, pageUp: 33, pageDown: 34,
      end: 35, home: 36, left: 37, up: 38, right: 39, down: 40,
      insert: 45, 'delete': 46
    }
  },

  'class': null,
  chipset: null,

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

    if (this.defaultScene) {
      this.scene(this.defaultScene);
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
        backgroundImage: 'url(' + this.chipset + ')',
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

  /* Events */

  captureKeys: function(window) {
    function keyName(which) {
      var name;
      $.each(GameObject.keys, function(n, v) {
        if (which === v) {
          name = n;
          return false;
        }
      });
      return name;
    }
    var self = this;

    $(window).on('keydown', function(e) {
      var handler = self.keyEvents[keyName(e.which)];
      if ($.isFunction(handler)) {
        handler.call(self, e, true, false);
      }
    }).on('keyup', function(e) {
      var handler = self.keyEvents[keyName(e.which)];
      if ($.isFunction(handler)) {
        handler.call(self, e, false, true);
      }
    });

    $(document).on('touchstart touchmove touchend', function(e) {
      var pressed;
      if (!e.touches.length) {
        // pass
      } else if (e.touches[0].pageX / window.innerWidth < 0.5) {
        pressed = 'l';
      } else {
        pressed = 'r';
      }
      self.keyEvents.left.call(self, e, pressed == 'l', pressed != 'l');
      self.keyEvents.right.call(self, e, pressed == 'r', pressed != 'r');
    });

    $(window).on('resize', function(e) {
      self.adjustZoom();
    });
  },

  /* Animation */

  fps: 30,
  frameRate: 1,
  animations: null,
  defaultScene: null,

  cell: function(x, y) {
    x *= -this.outerWidth();
    y *= -this.outerHeight();
    var pos = x + 'px ' + y + 'px';
    this.elem().css('background-position', pos);
  },

  frame: null,

  scene: function(sceneName, keepFrame) {
    this._animation = this.animations[sceneName];
    if (!keepFrame) {
      this.frame = 0;
    }
  },

  isLastFrame: function() {
    return this.frame >= this._animation.length;
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

  slow: false,

  resist: function() {
    var cur = this;
    while (cur.parent) {
      cur = cur.parent;
    }
    return cur.slow ? 0.25 : 1;
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

    if (this._animation) {
      var i = Math.floor(this.frame % this._animation.length),
        point = this._animation[i];
      this.frame += this.frameRate * this.resist();
      this.cell.apply(this, point);
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

  leftPressed: false,
  rightPressed: false,
  shiftPressed: false,

  __init__: function() {
    this.$super.apply(this, arguments);

    this.css = {
      left: '50%',
      top: '50%',
      marginLeft: this.outerWidth() / -2,
      marginTop: this.outerHeight() / -2,
      outline: '1px solid #222',
      backgroundColor: '#000',
      backgroundImage: 'url(beginning.gif)',
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
    var el = this.$super(),
      score = $('<div class="score"></div>').css({
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
     ].join('')),
      preload = $('<div class="preload"></div>').css({
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
    $.each([Subleerunker.Player, Subleerunker.Flame], function(i, cls) {
      var img = $('<img />').attr('src', cls.prototype.chipset);
      img.appendTo(preload);
    });

    return el;
  },

  keyEvents: {
    left: function(e, down, up) {
      this.leftPressed = down;
    },
    right: function(e, down, up) {
      this.rightPressed = down;
    },
    shift: function(e, down, up) {
      this.shiftPressed = down;
      this.slow = GameObject.debug && down;
    }
  },

  reset: function() {
    this.difficulty = 0.25;
    this.elem().css('background-position', '0 0');
  },

  play: function() {
    this.player = new Subleerunker.Player(this);
    if (this.shiftPressed) {
      this.player.friction *= 0.25;
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

    var greaterThanCurrentScore = this.score.high > this.score.current,
      greaterThanMyBestScore = this.score.high > this.score.myBest;

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
      // Save high score
      cookie = 'high_score=' + this.score.current + '; path=/';
      document.cookie = cookie;

      this.challengeHighScore();
    }
  },

  loop: function() {
    if (this.player) {
      if (this.leftPressed) {
        this.player.left();
      } else if (this.rightPressed) {
        this.player.right();
      }
      if (this.leftPressed || this.rightPressed) {
        this.player.forward();
      } else {
        this.player.rest();
      }
    } else {
      if (this.leftPressed || this.rightPressed) {
        this.play();
      }
      return;
    }

    if (!this.player.dead) {
      if (Math.random() < this.difficulty * this.resist()) {
        var flame = new Subleerunker.Flame(this);
        flame.elem().appendTo(this.elem());
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

    this.difficulty *= 1.001;

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
    chipset: 'player.gif',

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

    frameRate: 0.33,
    animations: {
      rightWait: [[0,0], [1,0], [2,0], [3,0], [4,0], [5,0], [6,0]],
      leftWait: [[0,1], [1,1], [2,1], [3,1], [4,1], [5,1], [6,1]],
      rightRun: [[0,2], [1,2], [2,2], [3,2], [4,2], [5,2]],
      leftRun: [[0,3], [1,3], [2,3], [3,3], [4,3], [5,3]],
      die: [[0,4], [1,4], [2,4], [3,4], [4,4], [5,4], [6,4], [7,4]]
    },
    defaultScene: 'rightWait',

    /* Move */

    speed: 0,
    duration: 1,
    friction: 0.2,
    step: 10,

    left: function() {
      this.$super();
      this.scene('leftRun', true);
    },

    right: function() {
      this.$super();
      this.scene('rightRun', true);
    },

    rest: function() {
      this.$super();
      var prefix = {'-1': 'left', '1': 'right'}[this.duration];
      this.scene(prefix + 'Wait', true);
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
      this.frameRate = 0.5;
      this.scene('die');
      this.left = this.right = this.forward = this.rest = $.noop;
    }

  }),

  Flame: GameObject.$extend({

    'class': 'flame',
    chipset: 'flame.gif',

    __init__: function(parent) {
      this.$super.apply(this, arguments);

      var W = parent.outerWidth(),
        w = this.outerWidth();
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

        var max = this.parent.height - this.outerHeight(),
          min = this.parent.height - player.outerHeight();

        if (this.position > max) {
          this.position = max;
          this.speed = 0;
          this.updatePosition();
          this.scene('land');
          this.frameRate = 1;
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
    padding: [9, 8, 2],

    /* Animation */

    frameRate: 0.33,
    animations: {
      burn: [[0,0], [0,1], [1,1], [2,1], [3,1], [4,1], [5,1]],
      land: [[2,0], [3,0], [4,0]]
    },
    defaultScene: 'burn',

    /* Move */

    speed: 0,
    duration: 1,
    friction: 0.02,
    step: 20,

    updatePosition: function() {
      this.$super();

      this.elem().css({
        left: this.xPosition,
        top: this.position
      });
    },

    /* Own */

    hitted: function(player) {
      var prevPosition = this.position - this.speed * this.step,
        H = this.parent.outerHeight(),

        top = prevPosition + this.padding[0],
        bottom = this.position + this.outerHeight() - this.padding[2],
        left = this.xPosition + this.padding[3],
        right = left + this.width,

        pTop = player.outerHeight() - player.padding[0],
        pBottom = player.padding[2],
        pLeft = player.position + player.padding[3],
        pRight = pLeft + player.width;

      pTop = H - pTop;
      pBottom = H - pBottom;

      var checkAltitude = top <= pBottom && pTop <= bottom,
        checkLeft = pLeft <= left && left <= pRight,
        checkRight = pLeft <= right && right <= pRight;

      return checkAltitude && (checkLeft || checkRight);
    }

  })

});
