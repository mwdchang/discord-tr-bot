import { Ref } from './types';
import { ActionType } from './types';


/**
 * Calculate defender's resistances
 */
export const calcResistance = (attackRef: Ref, defendRef: Ref, type: ActionType) => {
  let resist = 0;
  let attackTypes: string[] = [];

  if (type === 'primary' || type === 'counter') {
    attackTypes = attackRef.primaryTypes;
  } else {
    attackTypes = attackRef.secondaryTypes;
  }

  for (const type of attackTypes) {
    resist += defendRef.resistances[type];
  }
  resist /= attackTypes.length;

  // Large shield
  if (attackTypes.includes('ranged') && defendRef.abilities.includes('large shield')) {
    resist += 50;
    resist = Math.min(100, resist);
  }

  // Piercing
  if (attackRef.abilities.includes('piercing')) {
    resist -= 10;
    resist = Math.max(0, resist);
  }
  return resist;
};
