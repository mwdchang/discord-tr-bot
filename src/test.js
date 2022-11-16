import _ from 'lodash';
import { Engine }  from './engine';

const engine = new Engine();
engine.init('data/beta/units.json', 'data/slangs.json', 'data/beta/enchantments.json');

// console.log(engine.bestAgainst(
//   engine.findUnit('phoenix')
// ));

console.log(engine.simulate(
  engine.findUnit('phantom'),
  engine.findUnit('dark elemental')
).battleLog);


// console.log(engine.simulate(
//   engine.findUnit('venus flytrap'),
//   engine.findUnit('aa')
// ).battleLog.join('\n'));


// engine.ratios();

// console.log(_.take(engine.findPairings(engine.findUnit('lich')).attackers, 3));



