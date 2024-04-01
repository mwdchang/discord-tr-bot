import _ from 'lodash';
import { Engine }  from '../src/engine';

const engine = new Engine();
engine.init('./data');

// console.log(engine.bestAgainst(
//   engine.findUnit('phoenix')
// ));

// console.log(engine.simulate(
//   engine.findUnit('phantom'),
//   engine.findUnit('dark elemental')
// ).battleLog);

const ignoreList = [
  'Devil',
  'Succubus',
  'Militia',
  'Pikeman',
  'Phalanx',
  'Cavalry',
  'Archer',

  'Crusader',
  'Paladin',
  'Knight',

  'Druid',
  'Elven Archer',

  'Troglodyte',
  'Lizard Man',
  'Dwarven Warrior',
  'Dwarven Elite',
  'Ogre',

  'Cave Troll',
  'Imp',
  'Gargoyle',
  'Orc Raider',
  'Orcish Archer',
  
  'Fanatic',
  'War Hound',
  'Trained Elephant',
  'Capsule Monster',
  'Sheep',
  'Frog',
  'Squirrel',
  'Werewolf',
  'Stone Golem',
  'Mercenary',
  'Bounty Hunter',
  'Renegade Wizard',
  'Venomesse',
  'Starving Peasant',
  'Falcon'
];
// engine.resistanceReport('blitz', ignoreList);


console.log(engine.simulate(
  engine.findUnit('Goblin', 'blitz'),
  engine.findUnit('Kt', 'blitz'),
  'blitz',
  [],
  []
).battleLog.join('\n'));


// engine.ratios();

// console.log(_.take(engine.findPairings(engine.findUnit('lich')).attackers, 3));



