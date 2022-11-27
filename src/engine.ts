import _ from 'lodash';
import fs from 'fs';
import { randomBM, levenshteinDistance } from './util';
import { calcAccuracy } from './calc-accuracy';
import { calcResistance } from './calc-resistance';
import { calcDamageModifiers } from './calc-damage-modifiers';
import { Unit, Ref, SimResult } from './types';

// TODO
// - Abilities: steal life
// - Enchant: hallu
export const Engine = class {
  // class vars
  unitMap: Map<string, Map<string, Unit>>
  enchantmentMap: Map<string, Map<string, any>>
  slangMap: Map<string, string>

  constructor() {
    this.unitMap = new Map();
    this.slangMap = new Map();
    this.enchantmentMap = new Map();
  }

  /**
   * Initializes datasets. It is exptected that the folder layout to be
   *
   * /data
   *   slangs.json
   *   /<server>
   *     enchantments.json
   *     unit.json
   *   
   */
  init(dataPath: string) {
    const serverListing = fs.readdirSync(dataPath, { withFileTypes: true }).filter(d => d.isDirectory());

    // Read slangs file
    let content = fs.readFileSync(`${dataPath}/slangs.json`, { encoding: 'utf-8' });
    const slangData = JSON.parse(content);
    Object.keys(slangData).forEach(k => {
      this.slangMap.set(k, slangData[k]);
    });

    // Loop over server-listing
    for (const server of serverListing) {
      const uMap: Map<string, Unit> = new Map();
      const eMap: Map<string, any> = new Map();

      console.log('server', server.name);
      content = fs.readFileSync(`${dataPath}/${server.name}/units.json`, { encoding: 'utf-8' });
      const unitData = JSON.parse(content);
      for (const unit of unitData) {
        uMap.set(unit.name.toLowerCase(), unit);
      }

      content = fs.readFileSync(`${dataPath}/${server.name}/enchantments.json`, { encoding: 'utf-8' });
      const enchantments = JSON.parse(content);
      for (const e of enchantments) {
        eMap.set(e.id, e);
      }

      this.unitMap.set(server.name, uMap);
      this.enchantmentMap.set(server.name, eMap);
    }
  }

  findUnit(name: string, serverName: string) {
    const str = name.toLowerCase().replaceAll('*', '');
    const unitMap = this.unitMap.get(serverName);

    if (unitMap?.has(str)) {
      return unitMap?.get(str);
    }
    if (this.slangMap.has(str)) {
      return unitMap?.get(this.slangMap.get(str) || '');
    }

    if (str.length > 4 && unitMap) {
      for (const u of unitMap.values()) {
        if (levenshteinDistance(str, u.name.toLowerCase() || '') < 2) {
          return u;
        }
      }
    }
    return null;
  }

  _applyEnchantment(enchant: any, ref: Ref) {
    enchant.effects.forEach((effect: any) => {
      const filters = effect.filters;
      const action = effect.action;
      let canApply = false;

      if (filters !== null) {
        for (const filter of filters) {
          let match = true;
          for (const [k, v] of Object.entries(filter)) {
            if (_.isArray(v)) {
              if (_.difference(v, ref[k]).length !== 0) match = false; 
            } else {
              if (ref[k] !== v) match = false;
            }
          }
          if (match === true) {
            canApply = true;
            break;
          }
        }
      } else {
        canApply = true;
      }

      if (canApply === false) return;

      if (ref.activeEnchantments.includes(enchant.id) === false) {
        ref.activeEnchantments.push(enchant.id);
      }
      if (action.type === 'add attack type') {
        for (const attr of action.attributes) {
          if (ref[attr].includes(action.value) === false) {
            ref[attr].push(action.value);
          }
        }
        return;
      }

      if (action.type === 'change value') {
        for (const attr of action.attributes) {
          const delta = action.value * action.base ? 
            action.base * action.value : 
            ref.base[attr] * action.value;

          if (attr.includes('.')) {
            const [a1, a2] = attr.split('.');
            ref[a1][a2] += delta;
          } else {
            ref[attr] += delta;
          }
        }
      }
    });
  }

  _calcEnchantments(attackRef: Ref, defendRef: Ref, serverName: string, attackerEnchants: any, defenderEnchants: any) {
    let attackEnchant: string[] = [];
    let defendEnchant: string[] = [];

    if (!attackerEnchants || attackerEnchants.length === 0) {
      if (attackRef.magic === 'ascendant') attackEnchant = ['thl', 'lnp'];
      if (attackRef.magic === 'verdant') attackEnchant = ['ea', 'pg', 'lore'];
      if (attackRef.magic === 'eradication') attackEnchant = ['bc'];
      if (attackRef.magic === 'nether') attackEnchant = ['bs'];
      if (attackRef.magic === 'phantasm') attackEnchant = ['hallu'];
    } else {
      attackEnchant = attackerEnchants;
    }

    if (!defenderEnchants || defenderEnchants.length === 0) {
      if (defendRef.magic === 'ascendant') defendEnchant = ['thl', 'lnp'];
      if (defendRef.magic === 'verdant') defendEnchant = ['ea', 'pg', 'lore'];
      if (defendRef.magic === 'eradication') defendEnchant = ['bc'];
      if (defendRef.magic === 'nether') defendEnchant = ['bs'];
      if (defendRef.magic === 'phantasm') defendEnchant = ['hallu'];
    } else {
      defendEnchant = defenderEnchants; 
    }

    const enchantmentMap = this.enchantmentMap.get(serverName);
    if (!enchantmentMap) {
      throw `Cannot find enchantment for ${serverName}`;
    }

    for (const e of attackEnchant) {
      this._applyEnchantment(enchantmentMap.get(e), attackRef);
    }

    for (const e of defendEnchant) {
      if (e === 'hallu') {
        this._applyEnchantment(enchantmentMap.get(e), attackRef);
      } else {
        this._applyEnchantment(enchantmentMap.get(e), defendRef);
      }
    }
  }

  _burst(attackRef: Ref, defendRef: Ref, battleLog: string[]) {
    const burst = defendRef.abilities.find(d => d.startsWith('bursting'))
    if (attackRef.primaryTypes.includes('ranged') || attackRef.primaryTypes.includes('magic') || attackRef.primaryTypes.includes('psychic')) {
      return;
    } 
    if (defendRef.abilities.includes('flying') && !attackRef.abilities.includes('flying')) {
      return;
    }

    let damage = 0;
    let unitLoss = 0;
    const [_t, burstType, burstValue] = (burst as string).split(' ');

    // attacker
    const attackRes = attackRef.resistances[burstType];
    const attackWeakness = attackRef.abilities.filter(d => d.startsWith('weak'));
    damage = +burstValue *
      defendRef.numUnits *
      (defendRef.efficiency / 100)*
      (100 - attackRes) / 100;

    for (const weakness of attackWeakness) {
      const weakType = _.last(weakness.split(' ')) as string;
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
    const defendWeakness = defendRef.abilities.filter(d => d.startsWith('weak'));
    damage = +burstValue *
      defendRef.numUnits *
      (defendRef.efficiency / 100) *
      (100 - defendRes) / 100;

    for (const weakness of defendWeakness) {
      const weakType = _.last(weakness.split(' ')) as string;
      if (weakType === burstType) {
        damage *= 2;
      }
    }
    unitLoss = Math.floor(damage / attackRef.hp);
    defendRef.numUnits -= unitLoss;
    defendRef.unitLoss += unitLoss;
    battleLog.push(`burst (${burstType} ${burstValue}): ${defendRef.name} slew ${unitLoss} ${defendRef.name}`);
  }

  _primaryAttack(attackRef: Ref, defendRef: Ref, battleLog: string[]) {
    const defenderFlying = defendRef.abilities.includes('flying') ? true : false;
    const attackerFlying = attackRef.abilities.includes('flying') ? true : false;

    let magicPsychic = attackRef.primaryTypes.includes('magic') || attackRef.primaryTypes.includes('psychic');
    let ranged = attackRef.primaryTypes.includes('ranged');

    const resist = calcResistance(attackRef, defendRef, 'primary');
    const accuracy = calcAccuracy(attackRef, defendRef);

    if (defenderFlying) {
      if (attackerFlying === false && ranged === false) return false;
    }

    // Raw damage
    let damageTypePCT = 100 - resist; 
    let damage = 
      accuracy * 
      (damageTypePCT / 100) * 
      (attackRef.efficiency / 100) * 
      attackRef.numUnits * 
      attackRef.primaryPower *
      (magicPsychic === true ? 0.5 : randomBM());

    // Damage modifier
    damage *= calcDamageModifiers(attackRef, defendRef, 'primary');

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
    battleLog.push(`${attackRef.name} slew ${unitLoss} ${defendRef.name} > Primary attack (acc ${accuracy.toFixed(2)})`);

    return true;
  }


  _counter(attackRef: Ref, defendRef: Ref, battleLog: string[]) {
    const counterAccuracy = calcAccuracy(defendRef, attackRef);
    const resist = calcResistance(defendRef, attackRef, 'primary');
    const magicPsychic = defendRef.primaryTypes.includes('magic') || defendRef.primaryTypes.includes('psychic');

    // Raw damage
    let damageTypePCT = 100 - resist; 
    let damage = 
      counterAccuracy * 
      (damageTypePCT / 100) * 
      (defendRef.efficiency / 100) * 
      defendRef.numUnits * 
      defendRef.counterPower *
      (magicPsychic === true ? 0.5 : randomBM());

    // Damage modifiers
    damage *= calcDamageModifiers(defendRef, attackRef, 'counter');

    // ranged
    if (attackRef.primaryTypes.includes('ranged')) {
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
    battleLog.push(`  counter: ${defendRef.name} slew ${unitLoss} ${attackRef.name}`);
  }


  _secondary(attackRef: Ref, defendRef: Ref, battleLog: string[]) {
    const defenderFlying = defendRef.abilities.includes('flying') ? true : false;
    const attackerFlying = attackRef.abilities.includes('flying') ? true : false;

    const accuracy = calcAccuracy(attackRef, defendRef);
    const resist = calcResistance(attackRef, defendRef, 'secondary');
    const magicPsychic = attackRef.secondaryTypes.includes('magic') || attackRef.secondaryTypes.includes('psychic');
    const ranged = attackRef.secondaryTypes.includes('ranged');

    if (defenderFlying) {
      if (attackerFlying === false && ranged === false) return;
    }

    // Raw damage
    let damageTypePCT = 100 - resist; 
    let damage = 
      accuracy * 
      (damageTypePCT / 100) * 
      attackRef.numUnits * 
      attackRef.secondaryPower *
      (magicPsychic === true ? 0.5 : randomBM());

    // Damage modifiers
    damage *= calcDamageModifiers(attackRef, defendRef, 'secondary');

    let unitLoss = Math.floor(damage / defendRef.hp);
    defendRef.numUnits -= unitLoss;
    defendRef.unitLoss += unitLoss;

    battleLog.push(`${attackRef.name} slew ${unitLoss} ${defendRef.name} > Secondary attack (acc ${accuracy.toFixed(2)})`);
  }


  // Main method
  simulate(attacker: Unit, defender: Unit, serverName: string, attackerEnchants: any , defenderEnchants: any) {
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

        primaryTypes: ref.a1_type.split(' '),
        primaryPower: ref.a1_power,
        primaryInit: ref.a1_init,
        secondaryTypes: ref.a2_type.split(' '),
        secondaryPower: ref.a2_power,
        secondaryInit: ref.a2_init,
        counterPower: ref.counter,
        resistances: _.cloneDeep(ref.resistances),
        unitLoss: 0,
        powerLoss: 0,
        activeEnchantments: [],

        base: {
          hp: ref.hp,
          primaryPower: ref.a1_power,
          secondaryPower: ref.a2_power,
          counterPower: ref.counter
        }
      } as Ref;
    });

    // Annoying PIKE ability
    if (attackerRef.abilities.includes('pike')) {
      if (defenderRef.primaryInit === 2) defenderRef.primaryInit = 1;
      if (defenderRef.secondaryInit === 2) defenderRef.secondaryInit = 1;
    }
    if (defenderRef.abilities.includes('pike')) {
      if (attackerRef.primaryInit === 2) attackerRef.primaryInit = 1
      if (attackerRef.secondaryInit === 2) attackerRef.secondaryInit = 1;
    }

    this._calcEnchantments(attackerRef, defenderRef, serverName, attackerEnchants, defenderEnchants);

    // temp
    let attackRef: Ref | null = null;
    let defendRef: Ref | null = null;

    // Allocate init order
    const initList :any[] = [];
    initList.push({ 
      role: 'attacker',
      type: 'primary',
      init: attackerRef.primaryInit
    });
    if (attacker.a2_init > 0) {
      initList.push({ 
        role: 'attacker', 
        type: 'secondary',
        init: attackerRef.secondaryInit
      });
    }
    initList.push({ 
      role: 'defender',
      type: 'primary',
      init: defenderRef.primaryInit
    });
    if (defender.a2_init > 0) {
      initList.push({ 
        role: 'defender', 
        type: 'secondary',
        init: defenderRef.secondaryInit
      });
    }
    const initOrder = _.shuffle(initList);
    initOrder.sort((a, b) => b.init - a.init);

    // Simulate actual attacks
    const battleLog: string[] = [];
    [attackerRef, defenderRef].forEach(ref => {
      battleLog.push(`${ref.name}=${ref.numUnits} power=${ref.primaryPower}/${ref.secondaryPower}/${ref.counterPower}, hp=${ref.hp}, acc=${ref.accuracy}, enchants=${ref.activeEnchantments}`);
    });
    battleLog.push("");

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
        const canCounter = this._primaryAttack(attackRef, defendRef, battleLog);

        if (attackRef.abilities.includes('additional strike')) {
          this._primaryAttack(attackRef, defendRef, battleLog);
        }

        if (canCounter) {
          if (attackRef.primaryTypes.includes('ranged') || attackRef.primaryTypes.includes('paralyse')) {
            continue;
          }
          this._counter(attackRef, defendRef, battleLog);
        }
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
        battleLog.push(`${ref.name} ${ref.unitLoss} slain`);
        battleLog.push(`${ref.name} ${regen} regened`);
      }
      if (ref.abilities.includes('healing')) {
        healing = Math.floor(ref.unitLoss * 0.3);
        battleLog.push(`${ref.name} ${ref.unitLoss} slain`);
        battleLog.push(`${ref.name} ${healing} healed`);
      }

      ref.unitLoss -= (regen + healing);
      ref.numUnits += (regen + healing);
    }

    battleLog.push('');
    battleLog.push(`Attacker lost ${attackerRef.unitLoss} ${attackerRef.name}`);
    battleLog.push(`Defender lost ${defenderRef.unitLoss} ${defenderRef.name}`);

    battleLog.push('Attacker loss np ' + attackerRef.unitLoss * attackerRef.power);
    battleLog.push('Defender loss np ' + defenderRef.unitLoss * defenderRef.power);

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
    } as SimResult;
  }

  // Run a series of simulations
  simulateX(attacker: Unit, defender: Unit, serverName: string, attackerEnchants: any, defenderEnchants: any, n: number) {
    const r: SimResult[] = [];
    for (let i = 0; i < n; i++) {
      r.push(
        this.simulate(attacker, defender, serverName, attackerEnchants, defenderEnchants)
      );
    }
    return r;
  }

  findPairings(unit: Unit, serverName: string, attackerEnchants: any, defenderEnchants: any) {
    const skipList = ['Devil', 'Shadow Monster', 'Succubus'];

    const bestAttackers: any[] = [];
    const bestDefenders: any[] = [];
    const viableAttacker: any[] = [];

    const N = 20;
    const unitMap = this.unitMap.get(serverName);
    if (!unitMap) return

    for (const candidate of unitMap.values()) {
      if (skipList.includes(candidate.name)) continue;

      const results = this.simulateX(candidate, unit, serverName, attackerEnchants, defenderEnchants, N);
      let attackerLoss = 0;
      let defenderLoss = 0;
      for (const r of results) {
        attackerLoss += r.attackerLoss,
        defenderLoss += r.defenderLoss
      }
      bestAttackers.push({ name: candidate.name, value: defenderLoss/N, magic: candidate.magic });


      // Dont' evaulate air units against ground unit that cannot reach
      if (!unit.abilities.includes('ranged') && !unit.abilities.includes('flying')) {
        if (!candidate.abilities.includes('flying')) {
          bestDefenders.push({ name: candidate.name, value: attackerLoss/N, magic: candidate.magic });
          
          if (defenderLoss > attackerLoss) { 
            viableAttacker.push({ name: candidate.name, value: (defenderLoss - attackerLoss)/N, magic: candidate.magic, value2: defenderLoss / N });
          }
        }
      } else {
        bestDefenders.push({ name: candidate.name, value: attackerLoss/N, magic: candidate.magic });

        if (defenderLoss > attackerLoss) { 
          viableAttacker.push({ name: candidate.name, value: (defenderLoss - attackerLoss)/N, magic: candidate.magic, value2: defenderLoss / N });
        }
      }
    }

    return {
      attackers: _.orderBy(bestAttackers, d => -d.value),
      defenders: _.orderBy(bestDefenders, d => d.value),
      viables: _.orderBy(viableAttacker, d => -d.value)
    };
  }

  resistanceReport(serverName: string, blackList: string[]) {
    const unitMap = this.unitMap.get(serverName) || new Map<string, Unit>();
    let c = 0;

    let resist = {
      missile: 0,
      fire: 0,
      poison: 0,
      breath: 0,
      magic: 0,
      melee: 0,
      ranged: 0,
      lightning: 0,
      cold: 0,
      paralyse: 0,
      psychic: 0,
      holy: 0
    };

    for (const unit of unitMap.values()) {
      if (blackList.includes(unit.name)) continue;

      resist.missile += unit.resistances.missile;
      resist.fire += unit.resistances.fire;
      resist.poison += unit.resistances.poison;
      resist.breath += unit.resistances.breath;
      resist.magic += unit.resistances.magic;
      resist.melee += unit.resistances.melee;
      resist.ranged += unit.resistances.ranged;
      resist.lightning += unit.resistances.lightning;
      resist.cold += unit.resistances.cold;
      resist.paralyse += unit.resistances.paralyse;
      resist.psychic += unit.resistances.psychic;
      resist.holy += unit.resistances.holy;
      c++;
    }

    Object.entries(resist).sort((a, b) => b[1] - a[1]).forEach(k => {
      console.log(k[0], +(k[1]/c).toFixed(2));
    });
  }
}
