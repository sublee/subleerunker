function randInt(stop) {
  return Math.floor(Math.random() * stop);
}

function generateStream(length, prevRecord) {
  let stream = [];

  for (let i = 0; i < length; ++i) {
    let record = generateRecord(prevRecord);
    prevRecord = record;

    stream.push(record);
  }

  return stream;
}

function generateRecord(prevRecord) {
  let deltaFrame = 1 + randInt(30);

  // Randomize input but not samw with the previous input.
  let prevInput = prevRecord ? prevRecord.input : 0;
  let input     = prevInput;
  while (input === prevInput) {
    input = randInt(3);
  }

  return {deltaFrame: deltaFrame, input: input};
}

function encodeAsReplay(randomSeed, stream) {
  let streamWords = stream.map(function(record) {
     return record.deltaFrame.toString(16) + '.' + record.input.toString(16);
  });
  return '2!' + randomSeed.toString(16) + '!' + streamWords.join('!');
}

function extendArray(arr, tail) {
  Array.prototype.push.apply(arr, tail);
}

function* solve(randomSeedOrEncodedReplay, goalScore, maxTries) {
  var STREAM_SIZE = 10;

  function ENCODE_REPLAY(stream) {
    return encodeAsReplay(randomSeed, stream);
  }
  function REPLAY_RESULT(stream) {
    return replayResult(ENCODE_REPLAY(stream));
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

  while (score < goalScore && tried <= maxTries) {
    ++tried;

    var beforeLength = stream.length;
    let lastRecord = stream[stream.length - 1];

    var streamTail = generateStream(STREAM_SIZE, lastRecord);
    extendArray(stream, streamTail);

    console.log(ENCODE_REPLAY(stream))
    let result = REPLAY_RESULT(stream);
    console.log(ENCODE_REPLAY(stream))
    stream.splice(result.replayedInputs);
    console.log(ENCODE_REPLAY(stream))
    console.log(result)

    // while (true) {
    //   var control = stream.pop();
    //   if (control === undefined) {
    //     break;
    //   }

    //   let testingScore = REPLAY_RESULT(stream);

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

    console.log([tried, result.score, stream.length, ENCODE_REPLAY(stream)]);

    yield;
  }

  return {
    replay: ENCODE_REPLAY(stream),
    score:  score,
    tried:  tried
  };
}
