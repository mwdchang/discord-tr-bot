import _ from 'lodash';
import { Ref, ActionType } from './types';


/**
 * Calculate defender's resistances
 */
export const calcDamageModifiers = (attackRef: Ref, defendRef: Ref, type: ActionType) => {
  let multiplier = 1.0;

  // Weakness
  let weaknesses = defendRef.abilities.filter(d => d.startsWith('weak'));
  for (const weakness of weaknesses) {
    const weakType = _.last(weakness.split(' ')) as string;
    if (attackRef.primaryTypes.includes(weakType)) {
      multiplier *= 2;
    }
  }

  // Charm only applies to primary and counter
  if (type === 'primary' || type === 'counter') {
    if (defendRef.abilities.includes('charm')) {
      multiplier /= 2;
    }
  }

  if (defendRef.abilities.includes('scales')) {
    multiplier *= 0.75;
  }

  // Racial bonus - attacker side
  const attackerBonus = attackRef.abilities.find(d => d.startsWith('racial enemy')) 
  if (attackerBonus) {
    const [, , race, bonus] = attackerBonus.split(' ');
    if (defendRef.race.includes(race)) {
      multiplier *= (1 + parseFloat(bonus) / 100);
    }
  }

  // Racial bonus - defender side
  const defenderBonus = defendRef.abilities.find(d => d.startsWith('racial enemy')) 
  if (defenderBonus) {
    const [, , race, bonus] = defenderBonus.split(' ');
    if (attackRef.race.includes(race)) {
      multiplier *= 1/(1 + parseFloat(bonus) / 100);
    }
  }
  return multiplier;
};

