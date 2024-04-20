/**
 * Cancellation calculator, to zero mana
**/
export const calcEQ = (
  targetNP: number, targetMana: number, casterNP: number) => {

  let rangeMultiplier = 1.0;
  if (targetNP <= casterNP) {
    rangeMultiplier = casterNP / targetNP;
  } else {
    rangeMultiplier = (targetNP / casterNP) * 2;
  }

  const castCost = 100000;
  const onColour = castCost + targetMana * rangeMultiplier;
  const adjacent = (castCost * 1.5) + 0.8 * targetMana * rangeMultiplier;
  const opposite = (castCost * 2.0) + 0.7 * targetMana * rangeMultiplier;
  return { onColour, adjacent, opposite };
}
