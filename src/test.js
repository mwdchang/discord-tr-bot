import _ from 'lodash';
import { Engine }  from './engine';

const engine = new Engine();
engine.init('data/blitz/units.json', 'data/slangs.json', 'data/blitz/enchantments.json');

// console.log(engine.bestAgainst(
//   engine.findUnit('phoenix')
// ));

console.log(engine.simulate(
  engine.findUnit('phantom'),
  engine.findUnit('bulwark horror')
).battleLog);


// console.log(engine.simulate(
//   engine.findUnit('venus flytrap'),
//   engine.findUnit('aa')
// ).battleLog.join('\n'));


// engine.ratios();

// console.log(_.take(engine.findPairings(engine.findUnit('lich')).attackers, 3));



