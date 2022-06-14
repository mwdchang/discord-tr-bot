const { engine } = require('./engine');

engine.init('./units.json');

/*
console.log(engine.replyMatchUp(
  engine.findUnit('archangel'),
  engine.findUnit('dwarven shaman')
));

console.log(engine.replyMatchUp(
  engine.findUnit('dominion'),
  engine.findUnit('treant')
));

console.log(engine.replyMatchUp(
  engine.findUnit('naga queen'),
  engine.findUnit('dwarven shaman')
));

console.log(engine.replyMatchUp(
  engine.findUnit('archangel'),
  engine.findUnit('water elemental')
));

console.log(engine.replyMatchUp(
  engine.findUnit('treant'),
  engine.findUnit('chimera')
));

console.log(engine.replyMatchUp(
  engine.findUnit('efreeti'),
  engine.findUnit('empyrean inquisitor')
));
*/


/*
console.log(engine.replyMatchUp(
  engine.findUnit('unicorn'),
  engine.findUnit('fire elemental')
));
*/

/*
console.log(engine.replyMatchUp(
  engine.findUnit('dark elf magician'),
  engine.findUnit('chimera')
));



console.log(engine.replyBestAgainst(
  engine.findUnit('dwarven shaman')
));
*/


console.log(engine.simulate(
  engine.findUnit('treant'),
  engine.findUnit('archangel')
));


