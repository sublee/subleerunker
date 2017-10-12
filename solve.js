function solve(randomSeed, goalScore) {
  var POP_SIZE        = 50;
  var CHROMOSOME_SIZE = 10;

  // 1. Prepare a population.
  var pop = {};
  for (var id = 0; id < POP_SIZE; ++id) {
    pop[id] = generateChromosome(CHROMOSOME_SIZE);
  }

  var gen = 0;
  while (gen < 10) {

    // 2. Simulate to calculate fitness.
    var ranking = determineRanking(randomSeed, pop);

    var best = ranking[0];
    if (best.score >= goalScore) {
      var encodedReplay = encodeAsReplay(randomSeed, pop[best.id]);
      return {gen: gen, score: best.score, encodedReplay: encodedReplay};
    }

    console.log([gen, best.score, encodeAsReplay(randomSeed, pop[best.id])]);
    console.log(pop);

    // 3. Select top 2 chromosomes.
    var parent1 = pop[ranking[0].id];
    var parent2 = pop[ranking[1].id];

    // 4. Do crossover.
    var offsprings = crossover(parent1, parent2);
    console.log([parent1, parent2, offsprings[0], offsprings[1]]);

    // pop[ranking[0].id] = offsprings[0];
    // pop[ranking[1].id] = offsprings[1];

    // 5. Do mutation.
    if (Math.random() < 0.2) {
      var id = randInt(POP_SIZE);
      pop[id] = mutate(pop[id]);
    }

    // 6. Replace the worst with an offspring.
    var offspringRanking = determineRanking(randomSeed, offsprings);
    var bestOffspring    = offsprings[offspringRanking[0].id];

    var worstId  = ranking[ranking.length - 1].id;
    pop[worstId] = bestOffspring;

    pop[ranking[ranking.length - 2].id] = generateChromosome(CHROMOSOME_SIZE);

    ++gen;
  }
}

function determineRanking(randomSeed, pop) {
  var ranking = [];

  $.each(pop, function(id, chromosome) {
    var encodedReplay = encodeAsReplay(randomSeed, chromosome);
    var score = determineScore(encodedReplay);
    ranking.push({score: score, id: id});
  });

  ranking.sort(function(a, b) { return b.score - a.score; });

  return ranking;
}

function randInt(stop) {
  return Math.floor(Math.random() * stop);
}

/**
 * A chromosome is a stream of user inputs sized by the given length.  Each
 * input is called "gene".  Gene is an encoded delta frame and input bit flags,
 * such as "4c.7".
 */
function generateChromosome(length) {
  var chromosome = [];
  for (var i = 0; i < length; ++i) {
    var gene = generateGene();
    chromosome.push(gene);
  }
  return chromosome;
}

function generateGene() {
  var deltaFrame = randInt(100);
  var input      = randInt(8);
  return deltaFrame.toString(16) + '.' + input;
}

function encodeAsReplay(randomSeed, chromosome) {
  return '2!' + randomSeed.toString(16) + '!' + chromosome.join('!');
}

function crossover(chromosome1, chromosome2) {
  var length = Math.min(chromosome1.length, chromosome2.length);
  var crossoverPoint = 1 + randInt(length - 1);

  var newChromosome1 = [];
  var newChromosome2 = [];

  for (var i = 0; i < crossoverPoint + 1; ++i) {
    newChromosome1.push(chromosome2[i]);
    newChromosome2.push(chromosome1[i]);
  }
  for (var i = crossoverPoint + 1; i < chromosome1.length; ++i) {
    newChromosome1.push(chromosome1[i]);
  }
  for (var i = crossoverPoint + 1; i < chromosome2.length; ++i) {
    newChromosome2.push(chromosome2[i]);
  }

  return [newChromosome1, newChromosome2];
}

function mutate(chromosome) {
  var newChromosome = chromosome.slice();
  var i = randInt(chromosome.length);
  newChromosome[i] = generateGene();
  return newChromosome;
}
