const { engine } = require('./engine');

engine.init('./units.json');

console.log(engine.replyMatchUp(
  engine.findUnit('arch angel'),
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
  engine.findUnit('arch angel'),
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

console.log(engine.replyMatchUp(
  engine.findUnit('fire elemental'),
  engine.findUnit('mind ripper')
));
