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
    let inputs = words.map(function(word) {
      let deltaFrameAndInput = word.split('.');
      var deltaFrameHex      = deltaFrameAndInput[0];
      var inputHex           = deltaFrameAndInput[1];

      let deltaFrame = parseInt(deltaFrameHex, 16);
      let input      = parseInt(inputHex, 16);

      return {deltaFrame: deltaFrame, input: input};
    });
    extendArray(stream, inputs);
  }

  var score  = 0;
  var tried  = 0;

  while (score < goalScore && tried < maxTries) {
    ++tried;

    let beforeLength = stream.length;
    let lastRecord = stream[stream.length - 1];

    let streamTail = generateStream(STREAM_SIZE, lastRecord);
    extendArray(stream, streamTail);

    let result = REPLAY_RESULT(stream);
    score = result.score;

    console.log(result);

    // Discard records after death.
    stream.splice(result.replayedInputs);

    console.log({
      tried: tried,
      score: result.score,
      inputs: stream.length,
      increased: stream.length - beforeLength
    });
    console.log(ENCODE_REPLAY(stream));

    // Shake to avoid stillness.
    if (stream.length === beforeLength) {
      stream.pop();
    }

    yield;
  }

  return {
    replay: ENCODE_REPLAY(stream),
    score:  score,
    tried:  tried
  };
}
