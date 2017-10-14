function randInt(stop) {
  return Math.floor(Math.random() * stop);
}

function generateStream(length) {
  var stream = [];
  for (var i = 0; i < length; ++i) {
    var control = generateControl();
    stream.push(control);
  }
  return stream;
}

function generateControl() {
  var deltaFrame = randInt(30);
  var input      = randInt(3);
  return deltaFrame.toString(16) + '.' + input;
}

function encodeAsReplay(randomSeed, stream) {
  return '2!' + randomSeed.toString(16) + '!' + stream.join('!');
}

function extendArray(arr, tail) {
  Array.prototype.push.apply(arr, tail);
}

function* solve(randomSeedOrEncodedReplay, goalScore, maxTries) {
  var STREAM_SIZE = 10;

  function ENCODE_REPLAY(stream) {
    return encodeAsReplay(randomSeed, stream);
  }
  function DETERMINE_SCORE(stream) {
    return determineScore(ENCODE_REPLAY(stream));
  }

  goalScore = goalScore || 0;
  maxTries  = maxTries  || 50;

  let randomSeed;
  let stream = [];

  if (typeof randomSeedOrEncodedReplay === 'number') {
    randomSeed = randomSeedOrEncodedReplay;
  } else {
    let words = randomSeedOrEncodedReplay.split('!');
    words.shift();  // Discard version.  But it should be 2.
    randomSeed = parseInt(words.shift(), 16);
    extendArray(stream, words);
  }

  var score  = 0;
  var tried  = 0;

  while (score < goalScore && tried < maxTries) {
    var beforeLength = stream.length;

    var streamTail = generateStream(STREAM_SIZE);
    extendArray(stream, streamTail);

    score = DETERMINE_SCORE(stream);

    // Find the final control and discard controls after death.
    let i;
    for (i = stream.length - 1; i > 0; --i) {
      console.log(i);
      let testingStream = stream.slice(0, i);
      let testingScore = DETERMINE_SCORE(testingStream);

      if (testingScore !== score) {
        break;
      }

      yield;
    }
    stream.splice(i + 1);

    // while (true) {
    //   var control = stream.pop();
    //   if (control === undefined) {
    //     break;
    //   }

    //   let testingScore = DETERMINE_SCORE(stream);

    //   if (testingScore !== score) {
    //     // Rollback last pop.
    //     stream.push(control);
    //     break;
    //   }
    // }

    // How many inputs effected.
    console.log(stream.length - beforeLength);

    // Shake to avoid stillness.
    if (stream.length === beforeLength) {
      stream.pop();
    }

    ++tried;

    console.log([tried, score, stream.length, ENCODE_REPLAY(stream)]);
  }

  return {
    replay: ENCODE_REPLAY(stream),
    score:  score,
    tried:  tried
  };
}
