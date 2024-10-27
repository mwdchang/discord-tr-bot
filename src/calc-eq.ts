/**
 * Cancellation calculator, to zero mana
**/
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

