import { Ref } from './types';

/**
 * Calculates attacker's accuracy
 */
export const calcAccuracy = (attackRef: Ref, defendRef: Ref) => {
  let accuracy = attackRef.accuracy;
  if (defendRef.abilities.includes('swift')) {
    accuracy -= 0.10;
  }
  if (defendRef.abilities.includes('beauty')) {
    accuracy -= 0.05;
  }
  if (defendRef.abilities.includes('fear') && !attackRef.abilities.includes('fear')) {
    accuracy -= 0.15;
  }
  if (attackRef.abilities.includes('marksmanship')) {
    accuracy += 0.10;
  }
  if (attackRef.abilities.includes('clumsiness')) {
    accuracy -= 0.10;
  }
  return accuracy;
}
