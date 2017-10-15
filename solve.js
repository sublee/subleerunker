/**
 * A SUBLEERUNKER solver.  It generates a replay to beat the goal score.
 *
 * Usage:
 *
 *   let s = solve(randomSeed or encodedReplay, score the goal, max tries);
 *   let t = setInterval(function() {
 *     let x = s.next();
 *     if (x.done) clearInterval(t)
 *   }, 10);
 *
 */
function randInt(stop) {
  return Math.floor(Math.random() * stop);
}

function extendArray(arr, tail) {
  Array.prototype.push.apply(arr, tail);
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

function parseEncodedReplay(encodedReplay) {
  let words = encodedReplay.split('!');

  let version = words.shift();
  if (version !== '2') {
    throw new Error('only version 2 supported');
  }

  let randomSeed = parseInt(words.shift(), 16);

  let stream = words.map(function(word) {
    let deltaFrameAndInput = word.split('.');
    let deltaFrameHex      = deltaFrameAndInput[0];
    let inputHex           = deltaFrameAndInput[1];

    let deltaFrame = parseInt(deltaFrameHex, 16);
    let input      = parseInt(inputHex, 16);

    return {deltaFrame: deltaFrame, input: input};
  });

  return {randomSeed: randomSeed, stream: stream};
}

/**
 * @param {number|string} randomSeedOrEncodedReplay
 * @param {number} goalScore -
 *   The score as the goal.  The solver works until it achieved the goal.
 * @param {boolean} [goalType='gte'] -
 *   The solving strategy.  It determines when to stop solving.
 *   `gte` for `>=goalScore` or `eq` for `==goalScore`.
 * @param {number} [maxTries=100]
 */
function* solve(randomSeedOrEncodedReplay, goalScore, goalType, maxTries) {
  const CHUNK_SIZE = 10;

  function ENCODE_REPLAY(stream) {
    return encodeAsReplay(randomSeed, stream);
  }
  function REPLAY_RESULT(stream) {
    return replayResult(ENCODE_REPLAY(stream));
  }

  // Default arguments.
  goalScore = goalScore || 0;
  goalType  = goalType  || 'gte';
  maxTries  = maxTries  || 100;

  // Resolve the first argument.  It can be a random seed or encoded replay.
  let randomSeed;
  let stream = [];
  if (typeof randomSeedOrEncodedReplay === 'number') {
    randomSeed = randomSeedOrEncodedReplay;
  } else {
    let info = parseEncodedReplay(randomSeedOrEncodedReplay);
    randomSeed = info.randomSeed;
    extendArray(stream, info.stream);
  }

  // Define a success function.
  // The solver will works while success() returns false.
  let success;
  switch (goalType) {
    case 'gte':
      success = () => score >= goalScore;
      break;
    case 'eq':
      success = () => score === goalScore;
      break;
    default:
      throw new Error('goalType should be "gte" or "eq"')
  }

  let score = 0;
  let tried = 0;
  let startedAt = new Date();

  while (true) {
    ++tried;

    let beforeLength = stream.length;
    let result;

    if (score < goalScore) {
      // Grow the stream to find greater score.
      let lastRecord = stream[stream.length - 1];
      let streamTail = generateStream(CHUNK_SIZE, lastRecord);
      extendArray(stream, streamTail);

      // Evaluate the found score.
      result = REPLAY_RESULT(stream);
      score = result.score;

      // Discard records after death.
      stream.splice(result.replayedInputs);
    } else {
      // Rewind to find less score.
      stream.splice(stream.length - CHUNK_SIZE);

      // Evaluate the found score.
      result = REPLAY_RESULT(stream);
      score = result.score;
    }

    // Report the stats of this iteration.
    let report = {
      tried:     tried,
      score:     result.score,
      replay:    ENCODE_REPLAY(stream),

      inputs:    stream.length,
      increased: stream.length - beforeLength,

      elapsed:   new Date() - startedAt
    };

    if (score < goalScore) {
      // Shake to avoid stillness.
      if (stream.length === beforeLength) {
        stream.pop();
      }
    }

    if (success() || tried >= maxTries) {
      return report;
    } else {
      yield report;
    }
  }
}
