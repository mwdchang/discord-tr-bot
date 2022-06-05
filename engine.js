const fs = require('fs');

class Engine {
  constructor() {
    this.unitMap = new Map();
  }

  init(unitFile) {
    const content = fs.readFileSync(unitFile, { encoding: 'utf-8' });
    const unitData = JSON.parse(content);
    for (const unit of unitData) {
      this.unitMap.set(unit.name.toLowerCase(), unit);
    }
  }

  findUnit(name) {
    if (this.unitMap.has(name.toLowerCase())) {
      return this.unitMap.get(name.toLowerCase());
    }
    return null;
  }

  replyUnitStat(unit) {
    return `
Unit: ${unit.name}
Primary: ${unit.a1_power}
Type: ${unit.a1_type}
init: ${unit.a1_init}
Secondary: ${unit.a1_power}
Type: ${unit.a1_type}
init: ${unit.a1_init}
Abilities: ${unit.abilities.join(', ')}
   `;
  };


  vsScore(unit1, unit2) {
    const primaries = unit1.a1_type.split(' ');
    const secondaries = unit1.a2_type === "" ? [] : unit1.a2_type.split(' ');
    const abilities = unit1.abilities;

    const resistances = unit2.resistances;
    const defenderAbilities = unit2.abilities;

    const toughnessRating = unit2.hp / unit2.power;
    const powerRating = (unit1.a1_power + unit1.a1_power) / unit1.power;

    let acc = 30;
    let resist = 0;
    let primaryDamage = 0;
    let secondaryDamage = 0;

    // accuracy
    if (abilities.includes('marksmanship')) {
      acc += 10;
    }
    if (abilities.includes('clumsiness')) {
      acc -= 10;
    }
    if (defenderAbilities.includes('beauty')) {
      acc -= 5;
    }
    if (defenderAbilities.includes('swift')) {
      acc -= 10;
    }
    if (defenderAbilities.includes('fear') && !abilities.includes('fear')) {
      acc -= 15;
    }

    const weaknesses = defenderAbilities.filter(d => d.startsWith('weakness'));

    // primary
    resist = 0;
    for (const type of primaries) {
      resist += resistances[type];
    }
    primaryDamage = 100 - resist / primaries.length;

    if (defenderAbilities.includes('charm')) {
      primaryDamage /= 2;
    }
    if (abilities.includes('additional strike')) {
      primaryDamage *= 2;
    }
    for (const weakness of weaknesses) {
      const weakType = weakness.split(' ')[1];
      if (primaries.includes(weakType)) {
        primaryDamage *= 2;
      }
    }

    // secondary
    if (secondaries.length > 0) {
      resist = 0;
      for (const type of secondaries) {
        resist += resistances[type];
      }
      secondaryDamage = 100 - resist / secondaries.length;

      for (const weakness of weaknesses) {
        const weakType = weakness.split(' ')[1];
        if (secondaries.includes(weakType)) {
          secondaryDamage *= 2;
        }
      }
    }

    // healing, regen
    let mod = 1;
    if (defenderAbilities.includes('healing')) {
      mod = 0.7
    } else if (defenderAbilities.includes('regeneration')) {
      mod = 0.8
    }

    if (defenderAbilities.includes('scales')) {
      mod *= 0.75;
    }

    return mod * acc * (primaryDamage + secondaryDamage) * powerRating / toughnessRating;
  }


  replyBestAgainst(unit) {
    // Too rare to be useful
    const skipList = ['Devil', 'Fallen Dominion', 'Fallen Archangel', 'Fallen Angel', 'Shadow Monster'];
    
    const result = [];
    for (const candidate of this.unitMap.values()) {
      const defendScore = this.vsScore(unit, candidate);
      const attackScore = this.vsScore(candidate, unit);

      if (skipList.includes(candidate.name)) continue;

      result.push({
        name: candidate.name,
        score: +((attackScore / defendScore).toFixed(2))
      });
    }
    result.sort((a, b) => b.score - a.score);
    const top5 = result.splice(0, 5);
    // console.log(result);
    console.log(`Top units against ${unit.name} are:`, top5.map(d => `${d.name} ${d.score}`).join(',  '));
  }


  replyMatchUp(a, b) {
    const aScore = this.vsScore(a, b);
    const bScore = this.vsScore(b, a);

    console.log(`${a.name} =`, +aScore.toFixed(2),' ', `${b.name} =`, +bScore.toFixed(2));
    if (aScore > bScore && aScore / bScore > 1.25) {
      console.log(`[${a.name}] beats [${b.name}]`);
    } else if (bScore > aScore && bScore / aScore > 1.25) {
      console.log(`[${b.name}] beats [${a.name}]`);
    } else {
      console.log('toss up???');
    }
  }
}


module.exports = {
  engine: new Engine()
};
