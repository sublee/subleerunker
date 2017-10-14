'use strict';

const IS_MOBILE   = (typeof window.orientation !== 'undefined');
const FONT_FAMILY = '"Share Tech Mono", monospace';

const LEFT_PRESSED  = 0;
const RIGHT_PRESSED = 1;
const RIGHT_PRIOR   = 2;

const makeRandomSeed = function() {
  return Math.floor(Math.random() * 4294967295);
};

const rgb = function(color) {
  return '#' + ('000000' + color.toString(16)).slice(-6);
};

const Subleerunker = Game.$extend({

  __name__: 'Subleerunker',

  'class': 'subleerunker',

  width: 320,
  height: 480,
  atlas: 'atlas.json',

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
    let $$ = $('<div class="records">').css({
      position: 'absolute',
      right: 5,
      top: 3,
      textAlign: 'right',
      fontSize: 12,
      fontFamily: FONT_FAMILY,
      cursor: 'default'
    }).appendTo(this.hudElem());

    let nameStyle = {
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
    let $$$ = {
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
    let inSubmit = false;
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
    let elem = this.elem();
    let hudElem = elem.find('>.ui:eq(0)');
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
    let Logo = GameObject.$extend({
      width: 148, height: 66,
      anchor: [0.5, 0],
      offset: [this.width / 2, 156],
      anims: {
        'default': {fps: 0, textureNames: ['logo']}
      },
      animName: 'default',
    });
    this.logo = new Logo(this);

    let control = {};
    if (IS_MOBILE) {
      $.extend(control, {
        width: 33, height: 35, animTextureNames: ['touch-0', 'touch-1']
      });
    } else {
      $.extend(control, {
        width: 65, height: 14, animTextureNames: ['key-0', 'key-1']
      });
    }
    let Control = GameObject.$extend({
      width: control.width,
      height: control.height,
      anchor: [0.5, 1],
      offset: [this.width / 2, -31],
      anims: {
        'blink': {fps: 1, textureNames: control.animTextureNames}
      },
      animName: 'blink'
    });
    this.control = new Control(this);

    let disp = this.disp();
    disp.addChild(this.logo.disp());
    disp.addChild(this.control.disp());
  },

  hideSplash: function() {
    this.logo.destroy();
    this.control.destroy();
    delete this.logo, this.control;
  },

  isPlaying: function() {
    return Boolean(this.player);
  },

  setInputBit: function(offset, value) {
    // bits = bits & ~(1 << n) | (x << n); for change the n-th bit to x.
    // See also: https://stackoverflow.com/questions/47981
    this.input = this.input & ~(1 << offset) | ((value ? 1 : 0) << offset);
  },

  getInputBit: function(offset) {
    return Boolean(this.input & (1 << offset));
  },

  handlers: {
    keyLeft: function(press) {
      this.setInputBit(LEFT_PRESSED, press);
      this.setInputBit(RIGHT_PRIOR, false);
      if (press && !this.isPlaying()) {
        this.shouldPlay = true;
      }
    },
    keyRight: function(press) {
      this.setInputBit(RIGHT_PRESSED, press);
      this.setInputBit(RIGHT_PRIOR, true);
      if (press && !this.isPlaying()) {
        this.shouldPlay = true;
      }
    },
    keyShift: function(press, lock) {
      this.shiftPressed = press;
      this.shiftLocked = !!lock;
      if (press && lock && !this.isPlaying()) {
        this.shouldPlay = true;
      }
    },
    blur: function() {
      this.input = 0;
      this.shiftPressed = false;
      this.shiftLocked = false;
    },
    touch: function(touches, eventType) {
      if (eventType === 'start' && touches.length === 3) {
        // Toggle shift by 3 fingers.
        this.handlers.keyShift.call(this, !this.shiftPressed, true);
        return;
      }
      let pressLeft = false;
      let pressRight = false;
      if (touches.length) {
        let lastTouch = touches[touches.length - 1];
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
    let elem = this.recordElems.authorizedChampion.container;
    return !$.contains(elem.get(0), e.target);
  },

  releaseLockedShift: function() {
    if (this.shiftLocked) {
      this.shiftPressed = false;
      this.shiftLocked = false;
    }
  },

  reset: function() {
    this.input = 0;

    this.releaseLockedShift();
    this.showSplash();

    delete this.difficulty;
    delete this.direction;
  },

  loadReplay: function(replay) {
    this.replay     = replay;
    this.replaying  = true;
    this.shouldPlay = true;
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
    let $$$ = this.recordElems;
    let r = this.records;
    $$$.current.text(r.current);
    if (r.prime <= r.current ||
        r.prime <= r.champion.score && r.champion.authorized) {
      $$$.prime.hide();
    } else {
      $$$.prime.show().text(r.prime);
    }
  },

  renderChampion: function() {
    let $$$ = this.recordElems;
    let r = this.records;
    let champions = [$$$.champion, $$$.authorizedChampion];
    if (r.champion.score <= 0) {
      $.each(champions, function() { this.container.hide(); });
      return;
    }
    let i = Number(r.champion.authorized);
    let j = Number(!r.champion.authorized);
    champions[i].container.show();
    champions[i].score.text(r.champion.score);
    champions[i].name.val(r.champion.name);
    champions[j].container.hide();
  },

  _championReceived: function(data) {
    let score = Number(data.score);
    let name = String(data.name);

    this.records.champion.score = score;
    this.records.champion.name = name;

    let justBeaten = Boolean(data.token);

    if (justBeaten) {
      let token = String(data.token);
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

    let cachedName = Cookies('champion-name');
    if (this.records.champion.authorized) {
      Cookies('champion-name', name, {expires: Infinity});
    }

    this.renderRecords();
    this.renderChampion();

    if (justBeaten && !cachedName) {
      // Suggest renaming.
      let input = this.recordElems.authorizedChampion.name;
      input.focus();
    }
  },

  _authChampion: function(headers) {
    headers = $.extend({}, headers);
    let championToken = Cookies('champion-token');
    if (championToken) {
      headers['Authorization'] = 'Basic ' + btoa(':' + championToken);
    }
    return headers;
  },

  loadChampion: function() {
    if (!this.ctx.championURL) {
      return {then: $.noop};
    }
    return $.ajax(this.ctx.championURL, {
      method: 'GET',
      dataType: 'json',
      headers: this._authChampion(),
      success: $.proxy(this._championReceived, this)
    });
  },

  beatChampion: function() {
    // Gameplay duration should not be calculated in an Ajax callback.
    let duration = this.time - this.startedAt;

    this.loadChampion().then($.proxy(function() {
      if (this.records.champion.score === null) {
        return;
      } else if (this.records.current <= this.records.champion.score) {
        return;
      }

      // Predict a success.
      let name = Cookies('champion-name') || '';
      this._championReceived({
        score: this.records.current,
        name: name,
        token: this.records.champion.token,
        authorized: true
      });

      // Don't beat champion in these special modes.
      if (this.replaying) {
        return;
      } else if (this.ctx.debug) {
        return;
      }

      let durationSeconds = duration / 1000;
      let encodedReplay = Replay.encode(this.replay);

      $.ajax(this.ctx.championURL, {
        method: 'PUT',
        data: {
          score:    this.records.current,
          name:     name,
          replay:   encodedReplay,
          duration: durationSeconds
        },
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

    let actuallyPlayed = !this.replaying;
    if (actuallyPlayed) {
      if (this.records.prime < this.records.current) {
        this.records.prime = this.records.current;
        // Remember new prime score.
        Cookies('prime-score', this.records.prime, {
          expires: 2592000  // expires in 30 days.
        });
      }

      this.beatChampion();
    }

    if (this.ctx.triggerEvents) {
      // Trigger custom event to track the score by outside.
      let args  = [this.records.current, Replay.clone(this.replay)];
      $(window).trigger('gameOver', args);
    }
  },

  update: function(frame) {
    this.ctx.timeScale = (this.ctx.debug && this.shiftPressed) ? 0.5 : 1;

    if (!this.isPlaying()) {
      if (this.shouldPlay) {
        this.startGameplay();
        this.shouldPlay = false;
      }
      return;
    }

    this.updateGameplay(frame);
  },

  startGameplay: function() {
    // Reset frame because the flame spawner depends on frame numbers.
    this.frame = 0;

    this.player = new Subleerunker.Player(this);
    if (this.shiftPressed) {
      // Hommarju for SUBERUNKER's shift-enter easter egg.
      this.player.force *= 0.25;
      this.releaseLockedShift();
    }
    this.disp().addChild(this.player.disp());

    this.records.current = 0;
    this.updateScore();
    this.hideSplash();
    this.loadChampion();
    this.direction = 0;
    this.startedAt = this.time;

    if (this.replaying) {
      this.replay.rewind();
      this.ctx.random = new Math.seedrandom(this.replay.randomSeed);
    } else {
      let randomSeed = this.ctx.randomSeed || makeRandomSeed();
      this.ctx.random = new Math.seedrandom(randomSeed);
      this.replay = new Replay(randomSeed);
    }
  },

  updateGameplay: function(frame) {
    // Wait for all objects destroyed when the player is dead.
    if (this.player.dead) {
      let done = true;
      $.each(this.children, function() {
        done = false;
        return false;
      });
      if (done) {
        delete this.player;
        this.replaying = false;
        this.reset();
      }
      return;
    }

    // Spawn flames when the player is alive.
    if (frame % 2 === 0) {
      if (this.random() < this.difficulty) {
        let flame = new Subleerunker.Flame(this, frame);
        flame.render();
        this.disp().addChild(flame.disp());
      }
      this.difficulty *= 1.001;
    }

    // Record or replay input.
    if (this.replaying) {
      this.input = this.replay.nextInput(frame);
    } else {
      this.replay.recordInput(frame, this.input);
    }

    // Handle input.
    let movements = [
      {pressed: this.getInputBit(LEFT_PRESSED),  handler: this.player.left},
      {pressed: this.getInputBit(RIGHT_PRESSED), handler: this.player.right}
    ];
    let rightPrior = this.getInputBit(RIGHT_PRIOR);
    let pressed = false;
    for (let i = 0; i < 2; ++i) {
      let mov = movements[rightPrior ? 1 - i : i];
      if (mov.pressed) {
        mov.handler.call(this.player);
        pressed = true;
        break;
      }
    }
    if (!pressed) {
      this.player.rest();
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

    update: function(frame) {
      // Decide a blink.
      let BLINK_CONTINUANCE = 4;
      if (frame - this.blink.frame < BLINK_CONTINUANCE) {
        // A blink decision is not changed for 4 frames.
        // To avoid too quick blink.
      } else {
        this.blink = {frame: frame, active: null};

        if (this.blink.active) {
          // Don't close eyes for too long term.
          this.blink.active = false;
        } else {
          // Blinking is not required to be deterministic.
          this.blink.active = (Math.random() < 0.02);
        }
      }

      if (this.dead && this.hasAnimEnded()) {
        this.destroySoon();
      }
    },

    /* Animation */

    anims: {
      idle: {
        fps: 12,
        textureNames: [
          'player-idle-0', 'player-idle-1', 'player-idle-2', 'player-idle-3',
          'player-idle-4', 'player-idle-5', 'player-idle-6'
        ]
      },
      run: {
        fps: 12,
        textureNames: [
          'player-run-0', 'player-run-1', 'player-run-2', 'player-run-3',
          'player-run-4', 'player-run-5', 'player-run-6', 'player-run-7'
        ]
      },
      die: {
        fps: 12,
        once: true,
        textureNames: [
          'player-die-0', 'player-die-1', 'player-die-2', 'player-die-3',
          'player-die-4', 'player-die-5', 'player-die-6', 'player-die-7'
        ]
      }
    },
    animName: 'idle',

    // frame:  the frame decided to blink or not.
    // active: if true, eyes are closed for a short term.
    blink: {frame: 0, active: false},

    renderAnim: function(anim, index) {
      this.overlapEyelids(anim, index);
      this.$super.apply(this, arguments);
    },

    overlapEyelids: function(anim, index) {
      if (this._eyelids) {
        this._eyelids.visible = false;
      }
      if (this.animName === 'die') {
        // There's no eyelids for "die" animation.
        return;
      }
      if (this.blink.active) {
        let disp = this.disp();
        let textureName = anim.textureNames[index] + '-eyelids';
        let eyelidsTexture = this._getTexture(textureName);
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

    setRunAnim: function(direction) {
      let prevAnimName = this.animName;
      switch (prevAnimName) {
        case 'idle':
          this.rebaseAnimFrame(0);
          break;
        case 'run':
          if (direction !== this.direction) {
            let flippedAnimFrame = this.animFrame() + 4;
            this.rebaseAnimFrame(flippedAnimFrame);
          }
          break;
      }
      this.direction = direction;
      this.setAnim('run');
    },

    left: function() {
      this.acceleration = -this.force;
      this.friction = 0;
      this.setRunAnim(-1);
    },

    right: function() {
      this.acceleration = +this.force;
      this.friction = 0;
      this.setRunAnim(+1);
    },

    rest: function() {
      this.acceleration = 0;
      this.friction = this.force;
      this.setAnim('idle');
    },

    boundary: function() {
      return [0, this.parent.width - this.width];
    },

    visualize: function(state) {
      let disp = this.disp();
      if (disp && !disp._destroyed) {
        disp.x = state.position;
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
    },

    /* Own */

    die: function() {
      this.dead = true;
      this.speed = 0;
      this.acceleration = 0;
      this.friction = 0;
      this.setAnim('die');
      this.left = this.right = this.rest = $.noop;
    }

  }),

  Flame: GameObject.$extend({

    __name__: 'Flame',

    __init__: function(parent, id) {
      this.id = id;
      this.$super.apply(this, arguments);
      let W = parent.width;
      let w = this.width;
      this.xPosition = (W - w * 2) * this.random() + w / 2;
      this.position = -this.height;
    },

    update: function(frame) {
      if (this.landed) {
        // Already landed.  Destroy when the landing animation is done.
        if (this.hasAnimEnded()) {
          this.destroy();
        }
        return;
      }

      let player = this.parent.player;

      // Ignore if it didn't enter into the hitbox.
      let hitboxMin = this.parent.height - player.height;
      if (this.position < hitboxMin) {
        return;
      }

      // Check if just landed.
      let hitboxMax = this.boundary()[1];
      if (this.position >= hitboxMax) {
        this.landed = true;
        this.setAnim('land');

        if (!player.dead) {
          this.parent.upScore();
        }
        return;
      }

      // If it kills the player, the game is over.
      if (!player.dead && this.hits(player, this.position)) {
        this.destroy();
        this.parent.gameOver();
      }
    },

    /* View */

    width: 24,
    height: 16,
    innerPadding: [8, 8, 2],
    landingMargin: 2,

    /* Animation */

    anims: {
      burn: {
        fps: 12,
        textureNames: [
          'flame-burn-0', 'flame-burn-1', 'flame-burn-2', 'flame-burn-3',
          'flame-burn-4', 'flame-burn-5', 'flame-burn-6'
        ]
      },
      land: {
        fps: 24,
        once: true,
        textureNames: [
          'flame-land-0', 'flame-land-1', 'flame-land-2'
        ]
      }
    },
    animName: 'burn',

    /* Move */

    acceleration: 0.1,
    maxVelocity: 10,

    boundary: function() {
      return [
        -Infinity,
        this.parent.height - this.height - this.landingMargin
      ];
    },

    visualize: function(state) {
      let disp = this.disp();
      if (disp && !disp._destroyed) {
        disp.x = this.xPosition;
        disp.y = state.position;
      }
    },

    /* Own */

    hits: function(player, prevPosition) {
      let H = this.parent.height;

      let top = prevPosition + this.innerPadding[TOP];
      let bottom = this.position + this.height - this.innerPadding[2];
      let left = this.xPosition + this.innerPadding[3];
      let right = left + this.innerWidth();

      let pTop = player.height - player.innerPadding[0];
      let pBottom = player.innerPadding[2];
      let pLeft = player.position + player.innerPadding[3];
      let pRight = pLeft + player.innerWidth();

      pTop = H - pTop;
      pBottom = H - pBottom;

      let checkAltitude = top <= pBottom && pTop <= bottom;
      let checkLeft = pLeft <= left && left <= pRight;
      let checkRight = pLeft <= right && right <= pRight;

      return checkAltitude && (checkLeft || checkRight);
    }

  })

});

const Replay = Class.$extend({

  __init__: function(randomSeed) {
    this.randomSeed = randomSeed;
    this.inputHistory = {};
    this.lastRecordedInput = 0;
    this.rewind();
  },

  recordInput: function(frame, input) {
    if (input === this.lastRecordedInput) {
      return;
    }
    this.inputHistory[frame] = input;
    this.lastRecordedInput   = input;
  },

  nextInput: function(expectedFrame) {
    let frame = ++this._replayingFrame;
    if (this._replayingBaseFrame + frame !== expectedFrame) {
      throw new Error('replaying frame and expected frame not same');
    }
    let input = this.inputHistory[frame];

    if (input !== undefined) {
      this._lastReplayingInput = input;
      return input;
    }

    return this._lastReplayingInput;
  },

  /**
   * Resets the cursor for nextInput().
   */
  rewind: function(baseFrame) {
    this._replayingBaseFrame = baseFrame || 0;
    this._replayingFrame     = 0;
    this._lastReplayingInput = 0;
  },

  __classvars__: {

    /**
     * Encodes a replay into a string.
     *
     * Structure:
     *
     *   VERSION!RANDOM_SEED!DELTA_FRAME1.INPUT1!DELTA_FRAME2.INPUT2;...
     *
     * All numbers are encoded in hexadecimal to reduce the size of result
     * strings.
     *
     * The encoded string can be decoded by Replay.decode().
     *
     */
    encode: function(replay) {
      let words = [];

      let version = 2;
      words.push(version.toString(10));

      let randomSeedHex = replay.randomSeed.toString(16);
      words.push(randomSeedHex);

      // Sort input history by frame.
      let sortedInputHistory = [];
      $.each(replay.inputHistory, function(frame, input) {
        sortedInputHistory.push({frame: frame, input: input});
      });
      sortedInputHistory.sort(function(a, b) {
        return a.frame - b.frame;
      });

      let frame = 0;
      for (let i = 0; i < sortedInputHistory.length; ++i) {
        // Use delta frame instead of raw frame to reduce result size.
        let deltaFrame = sortedInputHistory[i].frame - frame;
        frame          = sortedInputHistory[i].frame;

        let input      = sortedInputHistory[i].input;

        let deltaFrameHex = deltaFrame.toString(16);
        let inputHex      = input.toString(16);
        words.push(deltaFrameHex + '.' + inputHex);
      }

      return words.join('!');
    },

    /**
     * Decodes an encoded replay string.
     *
     * A replay can be encoded by Replay.encode().
     *
     */
    decode: function(encodedReplay) {
      // The version number is at ahead of the encoded replay.
      // parseInt() can detect first digits of a string.
      // So parseInt() of the encoded replay returns the version number.
      let version = parseInt(encodedReplay, 10);

      switch (version) {
        case 2:
          return Replay._decodeV2(encodedReplay);
        case 1:
          return Replay._decodeV1(encodedReplay);
      }

      return null;
    },

    /**
     * Decodes an encoded replay string at version-2.  Version-2 changed
     * delimiters for URI awareness.
     *
     * Structure:
     *
     *   VERSION!RANDOM_SEED!DELTA_FRAME1.INPUT1!DELTA_FRAME2.INPUT2;...
     *
     * Use Replay.decode() instead.  The version is automatically resolved.
     *
     */
    _decodeV2: function(encodedReplay) {
      let words = encodedReplay.split('!');
      words.shift();  // discard version

      let randomSeedHex = words.shift();
      let randomSeed    = parseInt(randomSeedHex, 16);

      let replay = new Replay(randomSeed);

      // Read input history.
      let frame = 0;
      let input = 0;
      while (words.length !== 0) {
        let control = words.shift();

        let deltaFrameAndInput = control.split('.');
        let deltaFrameHex      = deltaFrameAndInput[0];
        let inputHex           = deltaFrameAndInput[1];

        let deltaFrame = parseInt(deltaFrameHex, 16);
        input          = parseInt(inputHex, 16);

        frame += deltaFrame;
        replay.recordInput(frame, input);
      }
      replay.lastRecordedInput = input;

      return replay;
    },

    /**
     * Decodes an encoded replay string at version-1.
     *
     * Structure:
     *
     *   VERSION;RANDOM_SEED;DELTA_FRAME1:INPUT1;DELTA_FRAME2:INPUT2;...
     *
     * Use Replay.decode() instead.  The version is automatically resolved.
     *
     */
    _decodeV1: function(encodedReplay) {
      let words = encodedReplay.split(';');
      words.shift();  // discard version

      let randomSeedHex = words.shift();
      let randomSeed    = parseInt(randomSeedHex, 16);

      let replay = new Replay(randomSeed);

      // Read input history.
      let frame = 0;
      let input = 0;
      while (words.length !== 0) {
        let control = words.shift();

        let deltaFrameAndInput = control.split(':');
        let deltaFrameHex      = deltaFrameAndInput[0];
        let inputHex           = deltaFrameAndInput[1];

        let deltaFrame = parseInt(deltaFrameHex, 16);
        input          = parseInt(inputHex, 16);

        frame += deltaFrame;
        replay.recordInput(frame, input);
      }
      replay.lastRecordedInput = input;

      return replay;
    },

    clone: function(replay) {
      let replayClone = new Replay(replay.randomSeed);
      $.extend(replayClone.inputHistory, replay.inputHistory);
      replayClone.lastRecordedInput = replay.lastRecordedInput;
      return replayClone;
    }

  }

});

/**
 * A helper function to simulate a replay to get the result score.  It runs the
 * game in headless mode.  So the result can be determined very quickly.
 */
const determineScore = function(encodedReplay) {
  let game   = Subleerunker();
  let replay = Replay.decode(encodedReplay);
  game.loadReplay(replay);

  let time = 0;
  let dt   = (1000 / 60) * 6;  // (second / fps) * max_steps

  // play the game
  game.shouldPlay = true;
  while (!game.isPlaying()) {
    game.tick(time);
    time += dt;
  }

  // replay until game over
  while (game.isPlaying()) {
    game.tick(time);
    time += dt;
  }

  let score = game.records.current;
  return score;
}
