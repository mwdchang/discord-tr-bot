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


  _calcAccuracy(attackRef, defendRef) {
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

  _burst(attackRef, defendRef, battleLog) {
    const burst = defendRef.abilities.find(d => d.startsWith('bursting'))
    if (attackRef.primaries.includes('ranged') || attackRef.primaries.includes('magic') || attackRef.primaries.includes('psychic')) {
      return;
    } 
    let damage = 0;
    let unitLoss = 0;
    const [_t, burstType, burstValue] = burst.split(' ');

    // attacker
    const attackRes = attackRef.resistances[burstType];
    const attackWeakness = attackRef.abilities.filter(d => d.startsWith('weakness'));
    damage = +burstValue *
      defendRef.numUnits *
      (defendRef.efficiency / 100)*
      (100 - attackRes) / 100;

    for (const weakness of attackWeakness) {
      const weakType = weakness.split(' ')[1];
      if (weakType === burstType) {
        damage *= 2;
      }
    }

    unitLoss = Math.floor(damage / attackRef.hp);
    attackRef.numUnits -= unitLoss;
    attackRef.unitLoss += unitLoss;
    battleLog.push(`burst (${burstType} ${burstValue}): ${defendRef.name} slew ${unitLoss} ${attackRef.name}`);


    // defender
    const defendRes = defendRef.resistances[burstType];
    const defendWeakness = defendRef.abilities.filter(d => d.startsWith('weakness'));
    damage = +burstValue *
      defendRef.numUnits *
      (defendRef.efficiency / 100) *
      (100 - defendRes) / 100;

    for (const weakness of defendWeakness) {
      const weakType = weakness.split(' ')[1];
      if (weakType === burstType) {
        damage *= 2;
      }
    }
    unitLoss = Math.floor(damage / attackRef.hp);
    defendRef.numUnits -= unitLoss;
    defendRef.unitLoss += unitLoss;
    battleLog.push(`burst (${burstType} ${burstValue}): ${defendRef.name} slew ${unitLoss} ${defendRef.name}`);
  }

  _primaryAttack(attackRef, defendRef, battleLog) {
    const defenderFlying = defendRef.abilities.includes('flying') ? true : false;
    const attackerFlying = attackRef.abilities.includes('flying') ? true : false;

    let accuracy = this._calcAccuracy(attackRef, defendRef);
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
      if (attackerFlying === false && ranged === false) return;
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

    // efficiency
    if (attackRef.abilities.includes('endurance')) {
      attackRef.efficiency -= 10;
    } else {
      attackRef.efficiency -= 15;
    }
    attackRef.efficiency = Math.max(0, attackRef.efficiency);

    // log
    let unitLoss = Math.floor(damage / defendRef.hp);
    defendRef.numUnits -= unitLoss;
    defendRef.unitLoss += unitLoss;
    battleLog.push(`pri attack (acc ${accuracy.toFixed(2)}): ${attackRef.name} slew ${unitLoss} ${defendRef.name}`);
  }


  _counter(attackRef, defendRef, battleLog) {
    let counterAccuracy = this._calcAccuracy(defendRef, attackRef);
    let resist = 0;
    let magicPsychic = false;
    for (const type of defendRef.primaries) {
      if (type === 'magic' || type === 'psychic') magicPsychic = true;
      resist += attackRef.resistances[type];
    }
    resist /= defendRef.primaries.length;

    if (defendRef.primaries.includes('ranged') && attackRef.abilities.includes('larged shield')) {
      resist += 50;
      resist = Math.min(100, resist);
    }

    let damageTypePCT = 100 - resist; 
    let damage = 
      counterAccuracy * 
      (damageTypePCT / 100) * 
      (defendRef.efficiency / 100) * 
      defendRef.numUnits * 
      defendRef.counterPower *
      (magicPsychic === true ? 0.5 : randomBM());

    let weaknesses = attackRef.abilities.filter(d => d.startsWith('weakness'));
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

    // efficiency
    if (defendRef.abilities.includes('endurance')) {
      defendRef.efficiency -= 10;
    } else {
      defendRef.efficiency -= 15;
    }
    defendRef.efficiency = Math.max(0, defendRef.efficiency);

    let unitLoss = Math.floor(damage / attackRef.hp);
    attackRef.numUnits -= unitLoss;
    attackRef.unitLoss += unitLoss;
    battleLog.push(`counter: ${defendRef.name} slew ${unitLoss} ${attackRef.name}`);
  }


  _secondary(attackRef, defendRef, battleLog) {
    const defenderFlying = defendRef.abilities.includes('flying') ? true : false;
    const attackerFlying = attackRef.abilities.includes('flying') ? true : false;

    let accuracy = this._calcAccuracy(attackRef, defendRef);
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
      if (attackerFlying === false && ranged === false) return;
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

    battleLog.push(`sec attack (acc ${accuracy.toFixed(2)}): ${attackRef.name} slew ${unitLoss} ${defendRef.name}`);
  }


  // Main method
  simulate(attacker, defender) {
    // Allocate approximate number of units at equal net power
    const TOTAL_NP = 2000000;

    const [attackerRef, defenderRef] = [attacker, defender].map(ref => {
      return {
        name: ref.name,
        magic: ref.magic,
        race: ref.race,
        efficiency: 100,
        hp: ref.hp,
        accuracy: 0.3,
        power: ref.power,
        numUnits: Math.floor(TOTAL_NP / ref.power),
        abilities: ref.abilities,

        primaries: ref.a1_type.split(' '),
        primaryPower: ref.a1_power,
        secondaries: ref.a2_type.split(' '),
        secondaryPower: ref.a2_power,
        counterPower: ref.counter,
        resistances: ref.resistances,
        unitLoss: 0,
        powerLoss: 0,

        base: {
          hp: ref.hp,
          primaryPower: ref.a1_power,
          secondaryPower: ref.a2_power,
          counterPower: ref.counter
        }

      };
    });

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
          if (ref.race.includes('animal')) {
            ref.primaryPower += ref.base.primaryPower * 0.47;
            ref.counterPower += ref.base.counterPower * 0.47;
            ref.hp += ref.base.hp * 0.47;
          }
          
          // Lore
          if (ref.race.includes('elf')) {
            ref.accuracy += 0.07;
            ref.primaryPower += ref.base.primaryPower * 0.13;
            ref.secondaryPower += ref.base.secondaryPower * 0.13;
            ref.counterPower += ref.base.counterPower * 0.13;
          }
          if (ref.race.includes('animal')) {
            ref.primaryPower += ref.base.primaryPower * 0.25;
            ref.counterPower += ref.base.counterPower * 0.25;
            ref.hp += ref.base.hp * 0.20;
          }

          // PG
          if (ref.race.includes('treefolk')) {
            ref.primaryPower += ref.base.primaryPower * 0.9524;
            ref.counterPower += ref.base.counterPower * 0.9524;
            ref.hp += ref.base.hp * 0.9524;
          }
        }
        if (ref.magic === 'eradication') {
          // BC
        }
        if (ref.magic === 'nether') {
          // BS
        }
      });
    }

    // console.log('');
    // console.log(`### ${attackerRef.name} (${attackerRef.numUnits}) > ${defenderRef.name} (${defenderRef.numUnits}) ###`);

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
    const battleLog = [];
    for (const hit of initOrder) {
      if (hit.role === 'attacker') {
        attackRef = attackerRef;
        defendRef = defenderRef;
      } else {
        attackRef = defenderRef;
        defendRef = attackerRef;
      }

      if (hit.type === 'primary') {
        const burst = defendRef.abilities.find(d => d.startsWith('bursting'))
        if (burst) {
          this._burst(attackRef, defendRef, battleLog)
        } 
        this._primaryAttack(attackRef, defendRef, battleLog);
        if (attackRef.abilities.includes('additional strike')) {
          this._primaryAttack(attackRef, defendRef, battleLog);
        }
        this._counter(attackRef, defendRef, battleLog);
      }

      if (hit.type === 'secondary') {
        this._secondary(attackRef, defendRef, battleLog);
      }
    }

    // Healing + regen
    for (const ref of [attackerRef, defenderRef]) {
      let regen = 0;
      let healing = 0;
      if (ref.abilities.includes('regeneration')) {
        regen = Math.floor(ref.unitLoss * 0.2);
        battleLog.push(`${ref.name} ${regen} regened`);
      }
      if (ref.abilities.includes('healing')) {
        healing = Math.floor(ref.unitLoss * 0.3);
        battleLog.push(`${ref.name} ${healing} healed`);
      }

      ref.unitLoss -= (regen + healing);
      ref.numUnits += (regen + healing);
    }

    battleLog.push(`lost ${attackerRef.unitLoss} ${attackerRef.name}`);
    battleLog.push(`lost ${defenderRef.unitLoss} ${defenderRef.name}`);

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
      defenderUnitLoss: defenderRef.unitLoss,

      battleLog
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

  findPairings(unit) {
    const skipList = ['Devil', 'Shadow Monster', 'Succubus'];

    const bestAttackers = [];
    const bestDefenders = [];

    for (const candidate of this.unitMap.values()) {
      if (skipList.includes(candidate.name)) continue;

      const results = this.simulateX(candidate, unit, 10);
      let attackerLoss = 0;
      let defenderLoss = 0;
      for (const r of results) {
        attackerLoss += r.attackerLoss,
        defenderLoss += r.defenderLoss
      }
      bestAttackers.push({ name: candidate.name, value: defenderLoss, magic: candidate.magic });

      // Dont' evaulate air units against ground unit that cannot reach
      if (!unit.abilities.includes('ranged') && !unit.abilities.includes('flying')) {
        if (!candidate.abilities.includes('flying')) {
          bestDefenders.push({ name: candidate.name, value: attackerLoss, magic: candidate.magic });
        }
      } else {
        bestDefenders.push({ name: candidate.name, value: attackerLoss, magic: candidate.magic });
      }
    }

    return {
      attackers: _.orderBy(bestAttackers, d => -d.value),
      defenders: _.orderBy(bestDefenders, d => d.value)
    };
  }
}


module.exports = {
  engine: new Engine()
};
