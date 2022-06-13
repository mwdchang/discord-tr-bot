const _ = require('lodash');
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


  simulate(attacker, defender) {
    // Allocate approximate number of units at equal net power
    const TOTAL_NP = 2000000;
    console.log('[', attacker.name, ' attacking ', defender.name, ']');

    const attackerRef = {
      name: attacker.name,
      efficiency: 100,
      hp: attacker.hp,
      power: attacker.power,
      numUnits: Math.floor(TOTAL_NP / attacker.power),
      abilities: attacker.abilities,

      primaries: attacker.a1_type.split(' '),
      primaryPower: attacker.a1_power,
      secondaries: attacker.a2_type.split(' '),
      secondaryPower: attacker.a2_power,
      counterPower: attacker.counter,
      resistances: attacker.resistances,
      powerLoss: 0
    };

    const defenderRef = {
      name: defender.name,
      efficiency: 100,
      hp: defender.hp,
      power: attacker.power,
      numUnits: Math.floor(TOTAL_NP / defender.power),
      abilities: defender.abilities,

      primaries: defender.a1_type.split(' '),
      primaryPower: defender.a1_power,
      secondaries: defender.a2_type.split(' '),
      secondaryPower: defender.a2_power,
      counterPower: defender.counter,
      resistances: defender.resistances,
      powerLoss: 0
    };

    // temp
    let attackRef = null;
    let defendRef = null;


    // Allocate init order
    const initList = [];
    initList.push({ 
      role: 'attacker',
      type: 'primary',
      init: attacker.a1_init ,
    });
    if (attacker.a2_init > 0) {
      initList.push({ 
        role: 'attacker', 
        type: 'secondary',
        init: attacker.a1_init ,
      });
    }
    initList.push({ 
      role: 'defender',
      type: 'primary',
      init: defender.a1_init ,
    });
    if (defender.a2_init > 0) {
      initList.push({ 
        role: 'defender', 
        type: 'secondary',
        init: defender.a1_init ,
      });
    }
    const initOrder = _.shuffle(initList);
    initOrder.sort((a, b) => b.init - a.init);


    // Simulate actual attacks
    for (const hit of initOrder) {

      if (hit.role === 'attacker') {
        attackRef = attackerRef;
        defendRef = defenderRef;
      } else {
        attackRef = defenderRef;
        defendRef = attackerRef;
      }

      let accuracy = 0.30;
      if (defendRef.abilities.includes('swift')) {
        accuracy -= 0.10;
      }
      if (defendRef.abilities.includes('beauty')) {
        accuracy -= 0.05;
      }
      if (attackRef.abilities.includes('marksmanship')) {
        accuracy += 0.10;
      }

      // Primary attack
      if (hit.type === 'primary') {
        let resist = 0;
        for (const type of attackRef.primaries) {
          resist += defendRef.resistances[type];
        }
        let damageTypePCT = 100 - resist / attackRef.primaries.length;
        let damage = accuracy * (damageTypePCT / 100) * (attackRef.efficiency / 100) * attackRef.numUnits * attackRef.primaryPower;

        let unitLoss = Math.floor(damage / defendRef.hp);
        defendRef.numUnits -= unitLoss;
        defendRef.powerLoss += unitLoss * defenderRef.power;

        // attack penalty
        attackRef.efficiency -= 10;

        if (attackRef.abilities.includes('additional strike')) {
          damage = accuracy * (damageTypePCT / 100) * (attackRef.efficiency / 100) * attackRef.numUnits * attackRef.primaryPower;
          attackRef.efficiency -= 10;

          let unitLoss = Math.floor(damage / defendRef.hp);
          defendRef.numUnits -= unitLoss;
          defendRef.powerLoss += unitLoss * defenderRef.power;
        }

        // defend penalty
        defendRef.efficiency -= 10;
        console.log(attackRef.name, `slew ${unitLoss}`, defendRef.name);
      }

      if (hit.type === 'secondary') {
        let resist = 0;
        for (const type of attackRef.secondaries) {
          resist += defendRef.resistances[type];
        }
        let damageTypePCT = 100 - resist / attackRef.secondaries.length;
        let damage = accuracy * (damageTypePCT / 100) * attackRef.numUnits * attackRef.secondaryPower;;

        let unitLoss = Math.floor(damage / defendRef.hp);
        defendRef.numUnits -= unitLoss;
        defendRef.powerLoss += unitLoss * defenderRef.power;

        console.log(attackRef.name, `slew ${unitLoss}`, defendRef.name);
      }
    }

    console.log('attacker loss', attackerRef.powerLoss);
    console.log('defender loss', defenderRef.powerLoss);
    return '';
  }


  vsScore(attacker, defender) {
    const primaries = attacker.a1_type.split(' ');
    const secondaries = attacker.a2_type === "" ? [] : attacker.a2_type.split(' ');
    const abilities = attacker.abilities;

    const resistances = defender.resistances;
    const defenderAbilities = defender.abilities;

    const toughnessRating = defender.hp / defender.power;
    const powerRating = (attacker.a1_power + attacker.a1_power) / attacker.power;

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

    // counter
    let counterDamage = 0;
    if (defender.a1_type.includes('ranged') === false && defender.a1_type.includes('paralyse') === false) {
      const counterPower = attacker.counter / attacker.a1_power; 
      counterDamage = primaryDamage * counterPower;
    }
    counterDamage *= 0.5;

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

    // bursting: todo
    // steal-life: todo
    // race bonus: todo


    // healing, regen bonus
    let mod = 1;
    if (defenderAbilities.includes('healing')) {
      mod = 0.7
    } else if (defenderAbilities.includes('regeneration')) {
      mod = 0.8
    }

    if (defenderAbilities.includes('scales')) {
      mod *= 0.75;
    }

    return mod * acc * (primaryDamage + secondaryDamage + counterDamage) * powerRating / toughnessRating;
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
    const top5 = result.splice(0, 8);
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
