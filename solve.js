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
  var input      = randInt(2) ? randInt(8) : 0;
  return deltaFrame.toString(16) + '.' + input;
}

function encodeAsReplay(randomSeed, stream) {
  return '2!' + randomSeed.toString(16) + '!' + stream.join('!');
}

function solve(randomSeed, goalScore, maxTries) {
  var STREAM_SIZE = 50;

  function ENCODE_REPLAY(stream) {
    return encodeAsReplay(randomSeed, stream);
  }
  function DETERMINE_SCORE(stream) {
    return determineScore(ENCODE_REPLAY(stream));
  }

  goalScore = goalScore || 0;
  maxTries  = maxTries  || 50;

  var stream = [];
  var score  = 0;
  var tried  = 0;

  while (score < goalScore && tried < maxTries) {
    var beforeLength = stream.length;

    var streamTail = generateStream(STREAM_SIZE);
    Array.prototype.push.apply(stream, streamTail);

    score = DETERMINE_SCORE(stream);

    // Discard regardless controls.
    var testingScore = score;
    while (true) {
      var control = stream.pop();
      if (control === undefined) {
        break;
      }

      testingScore = DETERMINE_SCORE(stream);

      if (testingScore !== score) {
        // Rollback last pop.
        stream.push(control);
        break;
      }
    }

    // Shake to avoid stillness.
    if (stream.length === beforeLength) {
      var control = stream.pop();
      if (control !== undefined) {
        score = DETERMINE_SCORE(stream);
      }
    }

    ++tried;

    console.log([tried, score, ENCODE_REPLAY(stream)]);
  }

  return {
    replay: ENCODE_REPLAY(stream),
    score:  score,
    tried:  tried
  };
}
