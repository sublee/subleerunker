var IS_MOBILE = (typeof window.orientation !== 'undefined');
var RESOLUTION = (window.devicePixelRatio || 1);
var FONT_FAMILY = '"Share Tech Mono", monospace';

var Subleerunker = Game.$extend({

  __name__: 'Subleerunker',

  'class': 'subleerunker',

  width: 320,
  height: 480,
  atlas: 'atlas.json',

  fps: 30,
  difficulty: 0.25,

  setup: function() {
    // Set background color.
    this.renderer.backgroundColor = this.pickColor('background');

    // Reset game state.
    this.reset();

    // Init records.
    this.records = {
      current: 0,
      prime: Number(
        // Fallback with deprecated cookie names.
        Cookies('prime-score') ||
        Cookies('best-score') ||
        Cookies('my_best_score') ||
      0),
      champion: {
        score: null,
        name: null,
        token: null,
        authorized: false
      }
    };

    // Render records.
    this.setupHUD();
    this.renderRecords();
    this.loadChampion();
  },

  setupHUD: function() {
    var $$ = $('<div class="records">').css({
      position: 'absolute',
      right: 5,
      top: 3,
      textAlign: 'right',
      fontSize: 12,
      fontFamily: FONT_FAMILY,
      cursor: 'default'
    }).appendTo(this.hudElem());

    var nameStyle = {
      display: 'inline',
      textAlign: 'right',
      fontSize: 12,
      fontFamily: FONT_FAMILY,
      backgroundColor: 'transparent',
      width: '4ex',
      border: 'none',
      outline: 'none',
      borderRadius: 0,
      padding: 0,
      margin: 0,
      marginRight: '0.5ex',
      textTransform: 'uppercase'
    };

    $$ // Here's a jQuery chain to build HUD.

    .html([
      '<form class="authorized-champion">',
        '<label>',
          '<input class="name" name="name" maxlength="3" tabindex="0" />',
          '<span class="score"></span>',
        '</label>',
      '</form>',
      '<div class="champion">',
        '<input class="name" readonly />',
        '<span class="score"></span>',
      '</div>',
      '<div class="prime"></div>',
      '<div class="current"></div>'
    ].join(''))

    .find('>.authorized-champion')
      .css('color', rgb(this.pickColor('authorized-champion')))
      .find('.name')
        .css(nameStyle)
        .css('color', rgb(this.pickColor('authorized-champion')))
        .on('focus', function() { $(this).select(); })
      .end()
      .hide()
    .end()

    .find('>.champion')
      .css('color', rgb(this.pickColor('champion')))
      .find('.name')
        .css(nameStyle)
        .css('color', rgb(this.pickColor('champion')))
        .css('user-select', 'none')
      .end()
      .hide()
    .end()

    .find('>.prime')
      .css('color', rgb(this.pickColor('prime')))
    .end()

    .find('>.current')
      .css('color', rgb(this.pickColor('current')))
    .end()

    ; // End of HUD building.

    // Cache elements for fast access.
    var $$$ = {
      authorizedChampion: {
        container: $$.find('>.authorized-champion'),
        name: $$.find('>.authorized-champion .name'),
        score: $$.find('>.authorized-champion .score')
      },
      champion: {
        container: $$.find('>.champion'),
        name: $$.find('>.champion .name'),
        score: $$.find('>.champion .score')
      },
      prime: $$.find('>.prime'),
      current: $$.find('>.current')
    };
    this.recordElems = $$$;

    // Champion renaming events.
    var inSubmit = false;
    $$$.authorizedChampion.container.on('submit', $.proxy(function(e) {
      e.preventDefault();
      this.renameChampion($$$.authorizedChampion.name.val());
      inSubmit = true;
      $$$.authorizedChampion.name.blur();
      inSubmit = false;
    }, this));
    $$$.authorizedChampion.name.on('blur', $.proxy(function() {
      if (!inSubmit) {
        $$$.authorizedChampion.container.submit();
      }
    }));

    // Prevent useless input mode in mobile.
    $$$.champion.name.on('focus', function(e) {
      e.preventDefault();
      $$$.champion.name.blur();
    });
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
      this.leftPressed = press;
      this.rightPrior = false;  // evaluate left first
      if (press) {
        this.shouldPlay = true;
      }
    },
    keyRight: function(press) {
      this.rightPressed = press;
      this.rightPrior = true;  // evaluate right first
      if (press) {
        this.shouldPlay = true;
      }
    },
    keyShift: function(press, lock) {
      this.shiftPressed = press;
      this.shiftLocked = !!lock;
      if (press && lock) {
        this.shouldPlay = true;
      }
    },
    blur: function() {
      this.leftPressed = false;
      this.rightPressed = false;
      this.shiftPressed = false;
      this.shiftLocked = false;
    },
    touch: function(touches, eventType) {
      if (eventType === 'start' && touches.length === 3) {
        // Toggle shift by 3 fingers.
        this.handlers.keyShift.call(this, !this.shiftPressed, true);
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
    }
  },

  handlesTouch: function(e) {
    if (!this.$super.apply(this, arguments)) {
      return false;
    }
    // Touch on authorized champion elements is necessary.
    var elem = this.recordElems.authorizedChampion.container;
    return !$.contains(elem.get(0), e.target);
  },

  releaseLockedShift: function() {
    if (this.shiftLocked) {
      this.shiftPressed = false;
      this.shiftLocked = false;
    }
  },

  reset: function() {
    this.shouldPlay = false;
    this.releaseLockedShift();
    this.showSplash();
    delete this.difficulty;
    delete this.direction;
  },

  play: function() {
    this.player = new Subleerunker.Player(this);
    if (this.shiftPressed) {
      // Hommarju for SUBERUNKER's shift-enter easter egg.
      this.player.force *= 0.25;
      this.releaseLockedShift();
    }
    this.disp().addChild(this.player.disp());
    this.ctx.random = new Math.seedrandom(this.ctx.randomSeed);
    this.records.current = 0;
    this.updateScore();
    this.hideSplash();
    this.loadChampion();
    this.direction = 0;
  },

  upScore: function() {
    this.records.current++;
    this.updateScore();
  },

  updateScore: function(score) {
    if (score !== undefined) {
      this.records.current = score;
    }
    this.renderRecords();
  },

  renderRecords: function() {
    var $$$ = this.recordElems;
    var r = this.records;
    $$$.current.text(r.current);
    if (r.prime <= r.current ||
        r.prime <= r.champion.score && r.champion.authorized) {
      $$$.prime.hide();
    } else {
      $$$.prime.show().text(r.prime);
    }
  },

  renderChampion: function() {
    var $$$ = this.recordElems;
    var r = this.records;
    var champions = [$$$.champion, $$$.authorizedChampion];
    if (r.champion.score <= 0) {
      $.each(champions, function() { this.container.hide(); });
      return;
    }
    var i = Number(r.champion.authorized);
    var j = Number(!r.champion.authorized);
    champions[i].container.show();
    champions[i].score.text(r.champion.score);
    champions[i].name.val(r.champion.name);
    champions[j].container.hide();
  },

  _championReceived: function(data) {
    var score = Number(data.score);
    var name = String(data.name);
    this.records.champion.score = score;
    this.records.champion.name = name;
    if (data.token) {
      // Just beated.
      var token = String(data.token);
      this.records.champion.token = token;
      this.records.champion.authorized = true;
      if (data.expiresAt && Cookies('champion-token') !== token) {
        Cookies('champion-token', token, {
          expires: new Date(data.expiresAt),
        });
      }
    } else {
      this.records.champion.authorized = Boolean(data.authorized);
    }
    if (this.records.champion.authorized) {
      Cookies('champion-name', name, {expires: Infinity});
    }
    this.renderRecords();
    this.renderChampion();
    if (data.token && !name) {
      // Suggest renaming.
      var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXWZ';
      var letter = letters[Math.floor(Math.random() * letters.length)];
      var input = this.recordElems.authorizedChampion.name;
      input.val(letter + letter + letter).focus();
    }
  },

  _authChampion: function(headers) {
    headers = $.extend({}, headers);
    var championToken = Cookies('champion-token');
    if (championToken) {
      headers['Authorization'] = 'Basic ' + btoa(':' + championToken);
    }
    return headers;
  },

  loadChampion: function() {
    if (!this.ctx.championURL) {
      return;
    }
    return $.ajax(this.ctx.championURL, {
      method: 'GET',
      dataType: 'json',
      headers: this._authChampion(),
      success: $.proxy(this._championReceived, this)
    });
  },

  beatChampion: function() {
    var direction = this.direction / 1000;  // in second
    this.loadChampion().then($.proxy(function() {
      if (this.records.champion.score === null) {
        return;
      } else if (this.records.current <= this.records.champion.score) {
        return;
      }
      // Predict a success.
      var name = Cookies('champion-name') || '';
      this._championReceived({
        score: this.records.current,
        name: name,
        token: this.records.champion.token,
        authorized: true
      });
      if (this.ctx.debug) {
        return;
      }
      $.ajax(this.ctx.championURL, {
        method: 'PUT',
        data: {score: this.records.current, name: name, direction: direction},
        dataType: 'json',
        success: $.proxy(this._championReceived, this)
      });
    }, this));
  },

  renameChampion: function(name) {
    if (name === this.records.champion.name) {
      return;
    }
    $.ajax(this.ctx.championURL, {
      method: 'PUT',
      dataType: 'json',
      headers: this._authChampion(),
      data: {name: name},
      success: $.proxy(this._championReceived, this)
    });
  },

  gameOver: function() {
    this.player.die();

    if (this.records.prime < this.records.current) {
      this.records.prime = this.records.current;
      // Remember new prime score.
      Cookies('prime-score', this.records.prime, {
        expires: 2592000  // expires in 30 days.
      });
    }

    this.beatChampion();

    // Trigger custom event to track the score by outside.
    $(window).trigger('score', [this.records.current, !!this.ctx.debug]);
  },

  __update__: function(frame) {
    this.$super.apply(this, arguments);

    this.ctx.timeScale = (this.ctx.debug && this.shiftPressed) ? 0.25 : 1;

    // if (this.direction !== undefined) {
    //   this.direction += deltaTime;
    // }

    if (!this.player) {
      if (this.shouldPlay) {
        this.play();
        this.shouldPlay = false;
        this.rebaseFrame(0);
      }
      return;
    }

    var movements = [[this.leftPressed, this.player.left],
                     [this.rightPressed, this.player.right]];
    var pressed = false;
    for (var i = 0; i < 2; ++i) {
      var mov = movements[this.rightPrior ? 1 - i : i];
      pressed = mov[0];
      if (pressed) {
        var handler = mov[1];
        handler.call(this.player);
        break;
      }
    }
    if (!pressed) {
      this.player.rest();
    }

    if (!this.player.dead) {
      if (frame % 2 === 0) {
        if (this.random() < this.difficulty) {
          var flame = new Subleerunker.Flame(this);
          flame.render();
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
    },

    __update__: function(frame) {
      this.$super.apply(this, arguments);
      if (this.blink.frame !== frame) {
        this.blink = {frame: frame, active: Math.random() < 0.02};
      }
      if (this.dead && this.animationEnds()) {
        this.kill();
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

    renderAnimation: function(anim, index) {
      this.overlapEyelids(anim, index);
      this.$super.apply(this, arguments);
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
        var textureName = anim.textureNames[index] + '-eyelids';
        var eyelidsTexture = this._getTexture(textureName);
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

    acceleration: 0,
    force: 1,
    friction: 1,
    maxVelocity: 5,
    direction: +1,

    setRunAnimation: function(direction) {
      var frame;
      if (this.animationName === 'idle') {
        frame = 0;
      } else if (this.animationName === 'run' && direction !== this.direction) {
        frame = this.animationFrame() + 4;
      }
      this.direction = direction;
      this.setAnimation('run', frame);
    },

    left: function() {
      this.acceleration = -this.force;
      this.friction = 0;
      this.setRunAnimation(-1);
    },

    right: function() {
      this.acceleration = +this.force;
      this.friction = 0;
      this.setRunAnimation(+1);
    },

    rest: function() {
      this.acceleration = 0;
      this.friction = this.force;
      this.setAnimation('idle');
    },

    boundary: function() {
      return [0, this.parent.width - this.width];
    },

    render: function(deltaFrame) {
      var disp = this.disp();
      if (disp && !disp._destroyed) {
        disp.x = this.simulate(deltaFrame).position;
        switch (this.direction) {
          case -1:
            disp.scale.x = -1;
            disp.anchor.x = 1;
            break;
          case +1:
            disp.scale.x = +1;
            disp.anchor.x = 0;
            break;
        }
      }
      this.$super.apply(this, arguments);
    },

    /* Own */

    die: function() {
      this.dead = true;
      this.speed = 0;
      this.acceleration = 0;
      this.friction = 0;
      this.setAnimation('die');
      this.left = this.right = this.rest = $.noop;
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

    __update__: function(frame) {
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

        var max = this.parent.height - this.height - this.landingMargin;
        var min = this.parent.height - player.height;

        if (this.position > max) {
          this.position = max;
          this.speed = 0;
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

    acceleration: 0.1,
    maxVelocity: 10,

    render: function(deltaFrame) {
      this.$super.apply(this, arguments);
      var disp = this.disp();
      if (disp && !disp._destroyed) {
        disp.x = this.xPosition;
        disp.y = this.simulate(deltaFrame).position;
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
