/**
 * Cancellation calculator, to zero mana
**/
/*
export const calcEQ = (
  targetNP: number, targetMana: number, casterNP: number) => {

  let rangeMultiplier = 1.0;
  if (casterNP <= targetNP) {
    rangeMultiplier = casterNP / targetNP;
  } else {
    rangeMultiplier = (targetNP / casterNP) * 2;
  }
  rangeMultiplier = Math.min(1.0, rangeMultiplier);

  const castCost = 100000;
  const onColour = castCost + targetMana / rangeMultiplier;
  const adjacent = (castCost * 1.5) + (targetMana / (0.8 * rangeMultiplier));
  const opposite = (castCost * 2.0) + (targetMana / (0.7 * rangeMultiplier));
  return { onColour, adjacent, opposite };
}
*/


export const calcEQ = (
  casterNP: number, 
  targetNP: number, 
  targetMana: number
) => {
  // Mana needed
  let value: number = 0;
  if (casterNP > targetNP) {
    if (targetNP / casterNP > 0.5) {
      value = targetMana;
    } else {
      value = targetMana / ((targetNP / casterNP) * 2);
    }
  } else {
    value = targetMana / (casterNP / targetNP);
  }
  value = Math.ceil(value);

  return {
    eradication: value,
    verdant: Math.ceil(value / 0.8),
    nether: Math.ceil(value / 0.8),
    ascendant: Math.ceil(value / 0.7),
    phantasm: Math.ceil(value / 0.7)
  }
}
