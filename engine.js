const _ = require('lodash');
const fs = require('fs');
const { randomBM, levenshteinDistance } = require('./util.js');

class Engine {
  constructor() {
    this.unitMap = new Map();
    this.slangMap = new Map();
    this.enchantments = true;
  }

  init(unitFile, slangFile) {
    let content = fs.readFileSync(unitFile, { encoding: 'utf-8' });
    const unitData = JSON.parse(content);
    for (const unit of unitData) {
      this.unitMap.set(unit.name.toLowerCase(), unit);
    }

    if (slangFile) {
      content = fs.readFileSync(slangFile, { encoding: 'utf-8' });
      const slangData = JSON.parse(content);
      Object.keys(slangData).forEach(k => {
        this.slangMap.set(k, slangData[k]);
      });
    }

  }

  findUnit(name) {
    const str = name.toLowerCase().replaceAll('*', '');
    if (this.unitMap.has(str)) {
      return this.unitMap.get(str);
    }
    if (this.slangMap.has(str)) {
      return this.unitMap.get(this.slangMap.get(str));
    }

    if (str.length > 4) {
      for (const u of this.unitMap.values()) {
        if (levenshteinDistance(str, u.name.toLowerCase()) < 2) {
          return u;
        }
      }
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


  bestAgainst(unit) {
    const skipList = ['Devil', 'Fallen Dominion', 'Fallen Archangel', 'Fallen Angel', 'Shadow Monster', 'Succubus'];
    const matches = [];
    for (const candidate of this.unitMap.values()) {
      if (skipList.includes(candidate.name)) continue;

      const result = this.simulateX(candidate, unit, 10);

      let aloss = 0;
      let dloss = 0;
      for (const battle of result) {
        aloss += battle.attackerLoss;
        dloss += battle.defenderLoss;
      }
      aloss /= 10;
      dloss /= 10;
      matches.push({
        attacker: candidate.name,
        defender: unit.name,
        attackerLoss: aloss,
        defenderLoss: dloss
      });
    }

    const bestAttackers = _.orderBy(matches, r => {
      return -r.defenderLoss;
    });

    const bestDefenders = _.orderBy(matches, r => {
      return r.attackerLoss;
    });

    const overall = _.orderBy(matches, r => {
      return -(r.defenderLoss - r.attackerLoss);
    });

    return {
      bestDefenders: _.take(bestDefenders, 10),
      bestAttackers: _.take(bestAttackers, 10),
      overall: _.take(overall, 10)
    };
  }


  simulateX(attacker, defender, n) {
    const r = [];
    for (let i = 0; i < n; i++) {
      r.push(
        this.simulate(attacker, defender)
      );
    }
    return r;
  }

  simulate(attacker, defender) {
    // Allocate approximate number of units at equal net power
    const TOTAL_NP = 2000000;

    const attackerRef = {
      name: attacker.name,
      magic: attacker.magic,
      race: attacker.race,
      efficiency: 100,
      hp: attacker.hp,
      accuracy: 0.3,
      power: attacker.power,
      numUnits: Math.floor(TOTAL_NP / attacker.power),
      abilities: attacker.abilities,

      primaries: attacker.a1_type.split(' '),
      primaryPower: attacker.a1_power,
      secondaries: attacker.a2_type.split(' '),
      secondaryPower: attacker.a2_power,
      counterPower: attacker.counter,
      resistances: attacker.resistances,
      unitLoss: 0,
      powerLoss: 0,

      base: {
        hp: attacker.hp,
        primaryPower: attacker.a1_power,
        secondaryPower: attacker.a2_power,
        counterPower: attacker.counter
      }
    };

    const defenderRef = {
      name: defender.name,
      magic: defender.magic,
      race: defender.race,
      efficiency: 100,
      hp: defender.hp,
      accuracy: 0.3,
      power: defender.power,
      numUnits: Math.floor(TOTAL_NP / defender.power),
      abilities: defender.abilities,

      primaries: defender.a1_type.split(' '),
      primaryPower: defender.a1_power,
      secondaries: defender.a2_type.split(' '),
      secondaryPower: defender.a2_power,
      counterPower: defender.counter,
      resistances: defender.resistances,
      unitLoss: 0,
      powerLoss: 0,

      base: {
        hp: defender.hp,
        primaryPower: defender.a1_power,
        secondaryPower: defender.a2_power,
        counterPower: defender.counter
      }
    };

    // Expected enchantments
    if (this.enchantments === true) {
      [defenderRef, attackerRef].forEach(ref => {
        if (ref.magic === 'ascendant') {
          // LnP
          ref.hp += ref.base.hp * 0.25;
          ref.primaryPower -= ref.base.primaryPower * 0.2;
          ref.secondaryPower -= ref.base.secondaryPower * 0.2;
          ref.counterPower -= ref.base.counterPower * 0.2;

          // THL
          ref.primaryPower += ref.base.primaryPower * 0.1263;
          ref.secondaryPower += ref.base.secondaryPower * 0.1263;
          ref.counterPower += ref.base.counterPower * 0.1263;
          ref.accuracy += 0.06315;

          if (ref.primaries.includes('melee') || ref.secondaries.includes('melee')) {
            if (!ref.primaries.includes('holy')) {
              ref.primaries.push('holy');
            }
          }
        }
        if (ref.magic === 'verdant') {
          // EA
          // Lore
          // PG
          if (ref.race === 'treefolk') {
            ref.primaryPower += ref.base.primaryPower * 0.9524;
            ref.counterPower += ref.base.counterPower * 0.9524;
            ref.hp += ref.base.hp * 0.9524;
          }
        }
        if (ref.magic === 'eradication') {
          // BC
        }
      });
    }
    

    console.log('');
    console.log(`### ${attackerRef.name} (${attackerRef.numUnits}) > ${defenderRef.name} (${defenderRef.numUnits}) ###`);

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
        init: attacker.a2_init ,
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
        init: defender.a2_init ,
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

      const defenderFlying = defendRef.abilities.includes('flying') ? true : false;
      const attackerFlying = attackRef.abilities.includes('flying') ? true : false;


      // Primary attack
      // TODO:
      //  - bursting
      //  - steal life
      if (hit.type === 'primary') {
        let resist = 0;
        let magicPsychic = false;
        let ranged = false;
        for (const type of attackRef.primaries) {
          if (type === 'magic' || type === 'psychic') magicPsychic = true;
          if (type === 'ranged') ranged = true; 
          resist += defendRef.resistances[type];
        }
        resist /= attackRef.primaries.length;

        if (attackRef.primaries.includes('ranged') && defendRef.abilities.includes('large shield')) {
          resist += 50;
          resist = Math.min(100, resist);
        }

        if (defenderFlying) {
          if (attackerFlying === false && ranged === false) continue;
        }

        let damageTypePCT = 100 - resist; 
        let damage = 
          accuracy * 
          (damageTypePCT / 100) * 
          (attackRef.efficiency / 100) * 
          attackRef.numUnits * 
          attackRef.primaryPower *
          (magicPsychic === true ? 0.5 : randomBM());


        // weakness
        let weaknesses = defendRef.abilities.filter(d => d.startsWith('weakness'));
        for (const weakness of weaknesses) {
          const weakType = weakness.split(' ')[1];
          if (attackRef.primaries.includes(weakType)) {
            damage *= 2;
          }
        }

        // charm
        if (defendRef.abilities.includes('charm')) {
          damage /= 2;
        }

        if (defendRef.abilities.includes('scales')) {
          damage *= 0.75;
        }


        let unitLoss = Math.floor(damage / defendRef.hp);
        defendRef.numUnits -= unitLoss;
        defendRef.unitLoss += unitLoss;
        console.log(`pri attack (${accuracy.toFixed(2)}):`, attackRef.name, `slew ${unitLoss}`, defendRef.name);

        // efficiency
        if (attackRef.abilities.includes('endurance')) {
          attackRef.efficiency -= 10;
        } else {
          attackRef.efficiency -= 15;
        }
        attackRef.efficiency = Math.max(0, attackRef.efficiency);

        if (attackRef.abilities.includes('additional strike')) {
          damage = 
            accuracy * 
            (damageTypePCT / 100) * 
            (attackRef.efficiency / 100) * 
            attackRef.numUnits * 
            attackRef.primaryPower *
            (magicPsychic === true ? 0.5 : randomBM());

          // weakness
          let weaknesses = defendRef.abilities.filter(d => d.startsWith('weakness'));
          for (const weakness of weaknesses) {
            const weakType = weakness.split(' ')[1];
            if (attackRef.primaries.includes(weakType)) {
              damage *= 2;
            }
          }

          // charm
          if (defendRef.abilities.includes('charm')) {
            damage /= 2;
          }

          if (defendRef.abilities.includes('scales')) {
            damage *= 0.75;
          }


          let unitLoss = Math.floor(damage / defendRef.hp);
          defendRef.numUnits -= unitLoss;
          defendRef.unitLoss += unitLoss;
          console.log(`add attack (${accuracy.toFixed(2)}):`, attackRef.name, `slew ${unitLoss}`, defendRef.name);

          // efficiency
          if (attackRef.abilities.includes('endurance')) {
            attackRef.efficiency -= 10;
          } else {
            attackRef.efficiency -= 15;
          }
          attackRef.efficiency = Math.max(0, attackRef.efficiency);
        }


        //////////////////////////////////////////////////////////////////////////////// 
        // counter
        //////////////////////////////////////////////////////////////////////////////// 
        let counterAccuracy = defendRef.accuracy;
        if (attackRef.abilities.includes('swift')) {
          counterAccuracy -= 0.10;
        }
        if (attackRef.abilities.includes('beauty')) {
          counterAccuracy -= 0.05;
        }
        if (attackRef.abilities.includes('fear') && !defendRef.abilities.includes('fear')) {
          counterAccuracy -= 0.15;
        }
        if (defendRef.abilities.includes('marksmanship')) {
          counterAccuracy += 0.10;
        }
        if (defendRef.abilities.includes('clumsiness')) {
          counterAccuracy -= 0.10;
        }

        resist = 0;
        magicPsychic = false;
        for (const type of defendRef.primaries) {
          if (type === 'magic' || type === 'psychic') magicPsychic = true;
          resist += attackRef.resistances[type];
        }
        resist /= defendRef.primaries.length;

        if (defendRef.primaries.includes('ranged') && attackRef.abilities.includes('larged shield')) {
          resist += 50;
          resist = Math.min(100, resist);
        }

        damageTypePCT = 100 - resist; 
        damage = 
          counterAccuracy * 
          (damageTypePCT / 100) * 
          (defendRef.efficiency / 100) * 
          defendRef.numUnits * 
          defendRef.counterPower *
          (magicPsychic === true ? 0.5 : randomBM());

        weaknesses = attackRef.abilities.filter(d => d.startsWith('weakness'));
        for (const weakness of weaknesses) {
          const weakType = weakness.split(' ')[1];
          if (defendRef.primaries.includes(weakType)) {
            damage *= 2;
          }
        }

        // charm
        if (attackRef.abilities.includes('charm')) {
          damage /= 2;
        }

        if (attackRef.abilities.includes('scales')) {
          damage *= 0.75;
        }

        // ranged
        if (attackRef.primaries.includes('ranged')) {
          damage = 0;
        }

        unitLoss = Math.floor(damage / attackRef.hp);
        attackRef.numUnits -= unitLoss;
        attackRef.unitLoss += unitLoss;
        console.log('counter:', defendRef.name, `slew ${unitLoss}`, attackRef.name);
        
        // efficiency
        if (defendRef.abilities.includes('endurance')) {
          defendRef.efficiency -= 10;
        } else {
          defendRef.efficiency -= 15;
        }
        defendRef.efficiency = Math.max(0, defendRef.efficiency);
      }

      if (hit.type === 'secondary') {
        let resist = 0;
        let magicPsychic = false;
        let ranged = false;
        for (const type of attackRef.secondaries) {
          if (type === 'magic' || type === 'psychic') magicPsychic = true;
          if (type === 'ranged') ranged = true;
          resist += defendRef.resistances[type];
        }
        resist /= attackRef.secondaries.length;

        if (attackRef.secondaries.includes('ranged') && defendRef.abilities.includes('larged shield')) {
          resist += 50;
          resist = Math.min(100, resist);
        }

        if (defenderFlying) {
          if (attackerFlying === false && ranged === false) continue;
        }

        let damageTypePCT = 100 - resist; 
        let damage = 
          accuracy * 
          (damageTypePCT / 100) * 
          attackRef.numUnits * 
          attackRef.secondaryPower *
          (magicPsychic === true ? 0.5 : randomBM());

        let weaknesses = defendRef.abilities.filter(d => d.startsWith('weakness'));
        for (const weakness of weaknesses) {
          const weakType = weakness.split(' ')[1];
          if (attackRef.secondaries.includes(weakType)) {
            damage *= 2;
          }
        }

        if (defendRef.abilities.includes('scales')) {
          damage *= 0.75;
        }

        let unitLoss = Math.floor(damage / defendRef.hp);
        defendRef.numUnits -= unitLoss;
        defendRef.unitLoss += unitLoss;

        console.log(`sec attack (${accuracy.toFixed(2)}):`, attackRef.name, `slew ${unitLoss}`, defendRef.name);
      }
    }

    // Healing + regen
    for (const ref of [attackerRef, defenderRef]) {
      let regen = 0;
      let healing = 0;
      if (ref.abilities.includes('regeneration')) {
        regen = Math.floor(ref.unitLoss * 0.2);
      }
      if (ref.abilities.includes('healing')) {
        healing = Math.floor(ref.unitLoss * 0.3);
      }

      ref.unitLoss -= (regen + healing);
      ref.numUnits += (regen + healing);
    }

    // console.log('Attacker loss np', attackerRef.unitLoss * attackerRef.power);
    // console.log('Defender loss np', defenderRef.unitLoss * defenderRef.power);
    return {
      attacker: attackerRef,
      defender: defenderRef,

      attackerLoss: attackerRef.unitLoss * attackerRef.power,
      attackerUnitCount: Math.floor(TOTAL_NP / attacker.power),
      attackerUnitLoss: attackerRef.unitLoss,

      defenderLoss: defenderRef.unitLoss * defenderRef.power,
      defenderUnitCount: Math.floor(TOTAL_NP / defender.power),
      defenderUnitLoss: defenderRef.unitLoss
    };
  }


  /*
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
  */


  replyBestAgainst(unit) {
    // Too rare to be useful
    const skipList = ['Devil', 'Fallen Dominion', 'Fallen Archangel', 'Fallen Angel', 'Shadow Monster', 'Succubus'];
    
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
