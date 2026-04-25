// https://discord.com/developers/applications
import * as dotenv from 'dotenv'
dotenv.config()

import _ from 'lodash';
import { Client, Intents } from 'discord.js';
import { Engine } from './engine.js';
import { Unit } from './types.js';

const engine = new Engine();
engine.init('./data');
// engine.init('./data/blitz/units.json', './data/slangs.json', './data/blitz/enchantments.json');

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES
  ]
});

// Assume default
const DEFAULT_SERVER = 'blitz';

// Allowed enchantments
const allowedEnchantIds = ['bc', 'bs', 'ea', 'hallu', 'lnp', 'lore', 'pg', 'sod', 'thl'];
const allowedMagicSpecialties = ['ascendant', 'verdant', 'eradication', 'nether', 'phantasm'];

const buildDefaultEnchantments = () => ({
  ascendant: ['lnp', 'thl'],
  verdant: ['pg', 'lore', 'ea'],
  eradication: ['bc'],
  nether: ['bs', 'sod'],
  phantasm: ['hallu']
});

const disabledUnitsByServer = new Map<string, string[]>([
  ['lightning', ['Duke', 'Dwarven Defender', 'Minor Elemental', 'Shadow Elemental', 'Treemaster']]
]);

const getDisabledUnitsForServer = (serverName: string) => disabledUnitsByServer.get(serverName) || [];
const isDisabledUnit = (serverName: string, unitName: string) => {
  return getDisabledUnitsForServer(serverName).includes(unitName);
};

let botId = '';
// annel.send('```' + text + '```');
// et botTag = '';

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`)
  botId = client.user?.id as string;
  // botTag = client.user.tag;
});

const userPrefMap = new Map();

const unitQueryStats: Map<string, number> = new Map();
const logUsage = (...args: string[]) => {
  for (const s of args) {
    if (unitQueryStats.has(s)) {
      const v = unitQueryStats.get(s) as number;
      unitQueryStats.set(s, v + 1);
    } else {
      unitQueryStats.set(s, 1);
    }
  }
}

// Grammar
// - show unit <unit>
// - show matchup <unit1> vs <unit2>
client.on('message', msg => {
  const users = msg.mentions.users;
  if (users.size !== 1 || !users.has(botId)) return; 

  // Strip only this bot's mention(s). A greedy /<.*>/ removes from first "<" to last ">"
  // in the whole message and can wipe valid text when Discord adds <#channel>, <:emoji:>, etc.
  let content = msg.content.toLowerCase().trim();
  content = content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();

  const channel = msg.channel;
  const username = msg.author.username;
  const userId = msg.author.id;

  if (userPrefMap.has(userId) === false) {
    userPrefMap.set(userId, {
      attackerEnchants: [],
      defenderEnchants: [],
      serverName: DEFAULT_SERVER,
      defaultEnchantments: buildDefaultEnchantments(),
      allowDisabledUnits: false
    });
  }

  const userPref = userPrefMap.get(userId);
  const serverName = userPref.serverName || DEFAULT_SERVER;

  if (content.startsWith('help')) {
    const cmd = (text: string) => `\u001b[0;33m${text}\u001b[0m`;
    const arg = (text: string) => `\u001b[0;36m${text}\u001b[0m`;

    const helpText = `
### Anansi commands

${cmd('show config')} - Shows your configuration
${cmd('set enchant')} [${arg('<e1>')} ${arg('<e2>')} ${cmd('vs')} ${arg('<e1>')} ${arg('<e2>')}] - Set enchantments
${cmd('set default enchant')} ${arg('<specialty>')} ${arg('<e1>')} ${arg('<e2>')} - Set default enchants for magic specialty
${cmd('show default enchant')} - Show default enchants per specialty
${cmd('set disabled units')} ${cmd('on|off')} - Include units disabled on selected server (default off)
  default: set enchant default
  specify: set enchant none vs ${arg('<enchant>')} ${arg('<enchant>')}
  clear all: set enchant
${cmd('set server')} ${arg('<server>')} - Select server, e.g. blitz, guild, beta, arch, lightning
${cmd('show match')} ${arg('<unit1>')} ${cmd('vs')} ${arg('<unit2>')} - Evaluate head-to-head match up
${cmd('show pairing')} ${arg('<unit>')} ${cmd('-v')} - Evaluate top pairings (default: head-to-head only, ${cmd('-v')}: full report)
${cmd('show battle')} ${arg('<uni1>')} ${cmd('vs')} ${arg('<unit2>')} - Single battle with logs
${cmd('show eq')} ${arg('<casterNP>')} ${arg('<targetNP>')} ${arg('<targetMana>')} - Earthquake: how much mana you need to zero the target
  ${arg('<casterNP>')} your net power, ${arg('<targetNP>')} their net power, ${arg('<targetMana>')} their current mana (three integers, in that order)
  reply lists mana by your magic line: eradication, verdant, nether, ascendant, phantasm (pick the line that matches your caster)
  example: ${cmd('show eq')} 50000 60000 120000


    `;

    channel.send("```ansi" + helpText + "```");
    return;
  }

  if (content.startsWith('show usage')) {
    const listing = _.take([...unitQueryStats.entries()].sort((a, b) => b[1] - a[1]), 20);
    const usageText = listing.map(d => `${d[0]} : ${d[1]}`).join('\n');
    const usageReport = `
### Top 20 queried units
${usageText}
    `;

    channel.send('```' + usageReport+ '```');
    return;
  }
  
  if (content.startsWith('show eq')) {
    const tokens = content.replace('show eq', '').trim().split(' ');
    if (tokens.length !== 3) {
      return;
    }
    const casterNP = +tokens[0];
    const targetNP = +tokens[1];
    const targetMana = +tokens[2];
    const r = engine.calculateEQ(casterNP, targetNP, targetMana);

    const reportText = `
### Report - ${serverName}
Earthquake calculation

Eradication: ${r.eradication}
Verdant: ${r.verdant}
Nether: ${r.nether}
Ascendant: ${r.ascendant}
Phantasm: ${r.phantasm}
   `;
    channel.send("```" + 'md\n' + reportText + "```");
    return;
  }

  if (content.startsWith('set server')) {
    const server = content.replace('set server', '').trim();
    if (server !== 'blitz' && server !== 'guild' && server !== 'beta' && server !== 'arch' && server !== 'lightning') {
      channel.send(`Server ${server} is not currently supported`);
      return;
    }
    userPrefMap.get(userId).serverName = server;
    const text = `Set server to ${server} for ${username}`;
    channel.send('```' + text + '```');
    return;
  }

  if (content.startsWith('set enchant')) {
    const tokens = content.replace('set enchant', '').split('vs');

    // Use default enchantments
    if (!tokens || (tokens.length === 1 && tokens[0].includes('default'))) {
      userPrefMap.get(userId).attackerEnchants = ['default'];
      userPrefMap.get(userId).defenderEnchants = ['default'];
      channel.send(`${username} using default enchantments`); 
      return;
    }

    // Clear enchantments
    if (tokens.length !== 2) {
      userPrefMap.get(userId).attackerEnchants = [];
      userPrefMap.get(userId).defenderEnchants = [];
      channel.send(`${username} cleared enchantments`); 
      return;
    }

    // Set custom enchantments
    const attackerEnchants = tokens[0].split(/[\s,]/).filter(d => d != '');
    const defenderEnchants = tokens[1].split(/[\s,]/).filter(d => d != '');
    
    // Filter out any enchantments that don't exist
    const filteredAttackerEnchants: string[] = attackerEnchants
      .filter(element => allowedEnchantIds.includes(element.toLowerCase()));
    const filteredDefenderEnchants: string[] = defenderEnchants
      .filter(element => allowedEnchantIds.includes(element.toLowerCase()));

    userPrefMap.get(userId).attackerEnchants = filteredAttackerEnchants;
    userPrefMap.get(userId).defenderEnchants = filteredDefenderEnchants;

    channel.send(`${username}: attacker=${filteredAttackerEnchants.join(' ')} defender=${filteredDefenderEnchants.join(' ')}`);
    return;
  }

  if (content.startsWith('set disabled units')) {
    const value = content.replace('set disabled units', '').trim();
    if (value !== 'on' && value !== 'off') {
      channel.send('Usage: set disabled units <on|off>');
      return;
    }
    userPrefMap.get(userId).allowDisabledUnits = value === 'on';
    channel.send(`${username}: disabled units ${value === 'on' ? 'enabled' : 'disabled'}`);
    return;
  }

  if (content.startsWith('show default enchant')) {
    const defaults = userPrefMap.get(userId).defaultEnchantments;
    const text = `
### Default enchantments (${username})
ascendant = ${defaults.ascendant.join(' ')}
verdant = ${defaults.verdant.join(' ')}
eradication = ${defaults.eradication.join(' ')}
nether = ${defaults.nether.join(' ')}
phantasm = ${defaults.phantasm.join(' ')}
    `;
    channel.send('```' + text + '```');
    return;
  }

  if (content.startsWith('set default enchant')) {
    const rest = content.replace('set default enchant', '').trim();
    const tokens = rest.split(/[\s,]+/).filter(t => t !== '');
    const specialty = tokens[0];
    if (!specialty || !allowedMagicSpecialties.includes(specialty)) {
      channel.send(`Usage: set default enchant <${allowedMagicSpecialties.join('|')}> <none|default|${allowedEnchantIds.join('|')}>...`);
      return;
    }

    const defaults = userPrefMap.get(userId).defaultEnchantments;
    const values = tokens.slice(1).map(t => t.toLowerCase());
    if (values.length === 0 || values.includes('none')) {
      defaults[specialty] = [];
      channel.send(`${username}: default ${specialty} enchantments cleared`);
      return;
    }
    if (values.includes('default')) {
      defaults[specialty] = buildDefaultEnchantments()[specialty];
      channel.send(`${username}: default ${specialty} enchantments reset to system default (${defaults[specialty].join(' ')})`);
      return;
    }

    const filtered = values.filter(element => allowedEnchantIds.includes(element));
    defaults[specialty] = [...new Set(filtered)];
    channel.send(`${username}: default ${specialty} enchantments=${defaults[specialty].join(' ')}`);
    return;
  }

  if (content.startsWith('show config')) {
    const configText = `
### Configuration for ${username}
attacker enchantments = ${userPref.attackerEnchants.join(', ')}
defender enchantments = ${userPref.defenderEnchants.join(', ')}
server = ${userPref.serverName}
include disabled units = ${userPref.allowDisabledUnits ? 'on' : 'off'}
    `;
    channel.send('```' + configText + '```');
    return;
  }

  if (content.startsWith('show pairing')) {
    const rawPairingArg = content.replace('show pairing', '').trim();
    const verbose = rawPairingArg.includes(' -v');
    const uStr = rawPairingArg.replace(' -v', '').trim();
    const u = engine.findUnit(uStr, serverName);


    if (!u) {
      channel.send(`I cannot find "${uStr}"`);
      return;
    }
    if (!userPref.allowDisabledUnits && isDisabledUnit(serverName, u.name)) {
      channel.send(`"${u.name}" is disabled on ${serverName}. Use "set disabled units on" to include disabled units.`);
      return;
    }

    logUsage(u.name);

    const attackerEnchants = userPrefMap.get(userId).attackerEnchants;
    const defenderEnchants = userPrefMap.get(userId).defenderEnchants;
    const defaultEnchantments = userPrefMap.get(userId).defaultEnchantments;
    const excludedUnits = userPref.allowDisabledUnits ? [] : getDisabledUnitsForServer(serverName);
    const r = engine.findPairings(u, serverName, attackerEnchants, defenderEnchants, defaultEnchantments, excludedUnits);

    if (!r) return;

    const TOP = 5;

    const topAttackerAscendant = _.take(r.attackers.filter(d => d.magic === 'ascendant'), TOP);
    const topAttackerVerdant = _.take(r.attackers.filter(d => d.magic === 'verdant'), TOP);
    const topAttackerEradication = _.take(r.attackers.filter(d => d.magic === 'eradication'), TOP);
    const topAttackerNether = _.take(r.attackers.filter(d => d.magic === 'nether'), TOP);
    const topAttackerPhantasm = _.take(r.attackers.filter(d => d.magic === 'phantasm'), TOP);

    const topViableAscendant = _.take(r.viables.filter(d => d.magic === 'ascendant'), TOP);
    const topViableVerdant = _.take(r.viables.filter(d => d.magic === 'verdant'), TOP);
    const topViableEradication = _.take(r.viables.filter(d => d.magic === 'eradication'), TOP);
    const topViableNether = _.take(r.viables.filter(d => d.magic === 'nether'), TOP);
    const topViablePhantasm = _.take(r.viables.filter(d => d.magic === 'phantasm'), TOP);


    const topDefenderAscendant = _.take(r.defenders.filter(d => d.magic === 'ascendant'), TOP);
    const topDefenderVerdant = _.take(r.defenders.filter(d => d.magic === 'verdant'), TOP);
    const topDefenderEradication = _.take(r.defenders.filter(d => d.magic === 'eradication'), TOP);
    const topDefenderNether = _.take(r.defenders.filter(d => d.magic === 'nether'), TOP);
    const topDefenderPhantasm = _.take(r.defenders.filter(d => d.magic === 'phantasm'), TOP);


    const T_attack = 2000000 * 0.15;
    const T_defend = 2000000 * 0.08;
    const T_viable = 2000000 * 0.05;

    [
      topAttackerAscendant, 
      topAttackerVerdant,
      topAttackerEradication,
      topAttackerNether,
      topAttackerPhantasm,
    ].forEach(list => {
      list.forEach(d => {
        if (d.value >= T_attack) d.name = `^${d.name}`;
      });
    });


    [
      topViableAscendant, 
      topViableVerdant,
      topViableEradication,
      topViableNether,
      topViablePhantasm,
    ].forEach(list => {
      list.forEach(d => {
        if (d.value >= T_viable && d.value2 > T_attack) d.name = `^${d.name}`;
      });
    });

    [
      topDefenderAscendant, 
      topDefenderVerdant,
      topDefenderEradication,
      topDefenderNether,
      topDefenderPhantasm
    ].forEach(list => {
      list.forEach(d => {
        if (d.value <= T_defend) d.name = `^${d.name}`;
      });
    });

    const reportText = `
### Report - ${serverName}

#### Top damage dealers 
Ascendant: ${topAttackerAscendant.map(d => d.name).join(', ')}
Verdant: ${topAttackerVerdant.map(d => d.name).join(', ')}
Eradication: ${topAttackerEradication.map(d => d.name).join(', ')}
Nether: ${topAttackerNether.map(d => d.name).join(', ')}
Phantasm: ${topAttackerPhantasm.map(d => d.name).join(', ')}

^ Deals at least 15% damage (good snipers)


#### Top defenders 
Ascendant: ${topDefenderAscendant.map(d => d.name).join(', ')}
Verdant: ${topDefenderVerdant.map(d => d.name).join(', ')}
Eradication: ${topDefenderEradication.map(d => d.name).join(', ')}
Nether: ${topDefenderNether.map(d => d.name).join(', ')}
Phantasm: ${topDefenderPhantasm.map(d => d.name).join(', ')}

^ Receives less than 8% damage (good tanks)


#### Top head-to-head viable units:
Ascendant: ${topViableAscendant.map(d => d.name).join(', ')}
Verdant: ${topViableVerdant.map(d => d.name).join(', ')}
Eradication: ${topViableEradication.map(d => d.name).join(', ')}
Nether: ${topViableNether.map(d => d.name).join(', ')}
Phantasm: ${topViablePhantasm.map(d => d.name).join(', ')}

^ Deals 5% or more damage than it receives (good head-to-head)
    `;

    const conciseReportText = `
### Report - ${serverName}

#### Top head-to-head viable units:
Ascendant: ${topViableAscendant.map(d => d.name).join(', ')}
Verdant: ${topViableVerdant.map(d => d.name).join(', ')}
Eradication: ${topViableEradication.map(d => d.name).join(', ')}
Nether: ${topViableNether.map(d => d.name).join(', ')}
Phantasm: ${topViablePhantasm.map(d => d.name).join(', ')}

^ Deals 5% or more damage than it receives (good head-to-head)
    `;

    const header = `Pairing against ${u.name} - **${serverName}**`;
    channel.send(header + "```" + 'md\n' + (verbose ? reportText : conciseReportText) + "```");
    return;
  }


  if (content.startsWith('show battle')) {
    const tokens = content.replace('show battle', '').split('vs');

    let u1str = '';
    let u2str = '';
    let u1: Unit | null | undefined = null;
    let u2: Unit | null | undefined = null;
    try {
      u1str = tokens[0].trim();
      u2str = tokens[1].trim();
      u1 = engine.findUnit(u1str, serverName);
      u2 = engine.findUnit(u2str, serverName);
    } catch (error) {
      console.error(`Parsing error: ${content}`);
      channel.send('Parsing error');
      return;
    }

    if (!u1) {
      channel.send(`I cannot find "${tokens[0]}"`);
      return;
    }
    if (!userPref.allowDisabledUnits && isDisabledUnit(serverName, u1.name)) {
      channel.send(`"${u1.name}" is disabled on ${serverName}. Use "set disabled units on" to include disabled units.`);
      return;
    }
    if (!u2) {
      channel.send(`I cannot find "${tokens[1]}"`);
      return;
    }
    if (!userPref.allowDisabledUnits && isDisabledUnit(serverName, u2.name)) {
      channel.send(`"${u2.name}" is disabled on ${serverName}. Use "set disabled units on" to include disabled units.`);
      return;
    }

    if (u1 && u2) {
      logUsage(u1.name, u2.name);

      const attackerEnchants = userPrefMap.get(userId).attackerEnchants;
      const defenderEnchants = userPrefMap.get(userId).defenderEnchants;
      const defaultEnchantments = userPrefMap.get(userId).defaultEnchantments;

      const r = engine.simulate(u1, u2, serverName, attackerEnchants, defenderEnchants, defaultEnchantments);
      const battleLog = r.battleLog;

      let attackercount = r.attackerUnitCount;
      let defendercount = r.defenderUnitCount;

      const battleText = `
### Report - ${serverName}
${u1.name} (${attackercount}) vs ${u2.name} (${defendercount})
${battleLog.join('\n')}
      `;

      channel.send('```' + battleText + '```');
    }
    return;
  }

  if (content.startsWith('show match')) {
    const tokens = content.replace('show match', '').split('vs');

    let u1str = '';
    let u2str = '';
    let u1: Unit | null | undefined = null;
    let u2: Unit | null | undefined = null;
    try {
      u1str = tokens[0].trim();
      u2str = tokens[1].trim();
      u1 = engine.findUnit(u1str, serverName);
      u2 = engine.findUnit(u2str, serverName);
    } catch (error) {
      console.error(`Parsing error: ${content}`);
      channel.send('Parsing error');
      return;
    }
    const N = 10;

    if (!u1) {
      channel.send(`I cannot find "${tokens[0]}"`);
      return;
    }
    if (!userPref.allowDisabledUnits && isDisabledUnit(serverName, u1.name)) {
      channel.send(`"${u1.name}" is disabled on ${serverName}. Use "set disabled units on" to include disabled units.`);
      return;
    }
    if (!u2) {
      channel.send(`I cannot find "${tokens[1]}"`);
      return;
    }
    if (!userPref.allowDisabledUnits && isDisabledUnit(serverName, u2.name)) {
      channel.send(`"${u2.name}" is disabled on ${serverName}. Use "set disabled units on" to include disabled units.`);
      return;
    }

    const noNeg = (v: number) => Math.max(1, v);

    if (u1 && u2) {
      logUsage(u1.name, u2.name);

      const attackerEnchants = userPrefMap.get(userId).attackerEnchants;
      const defenderEnchants = userPrefMap.get(userId).defenderEnchants;
      const defaultEnchantments = userPrefMap.get(userId).defaultEnchantments;

      const results = engine.simulateX(u1, u2, serverName, attackerEnchants, defenderEnchants, N, defaultEnchantments);
      let attackerloss = 0;
      let attackerunit = 0;
      let defenderloss = 0;
      let defenderunit = 0;

      // FIXME: what is a win?
      let wins = 0;
      let losses = 0;
      for (const r of results) {
        attackerloss += r.attackerLoss;
        attackerunit += r.attackerUnitLoss;
        defenderloss += r.defenderLoss;
        defenderunit += r.defenderUnitLoss;

        if (noNeg(r.defenderLoss) / noNeg(r.attackerLoss) > 1.1) {
          wins ++;
        } else if (noNeg(r.attackerLoss) / noNeg(r.defenderLoss) > 1.1) {
          losses ++;
        }
      }
      let ties = N - wins - losses;

      attackerloss /= N;
      attackerunit /= N;
      defenderloss /= N;
      defenderunit /= N;
      
      let attackercount = results[0].attackerUnitCount;
      let defendercount = results[0].defenderUnitCount;
      const attacker = results[0].attacker;
      const defender = results[0].defender;

      const reportText = `
### Report - ${serverName}
${wins} wins, ${losses} losses, ${ties} draws

Attacker ${attacker.name}  AP=${attacker.primaryPower}/${attacker.secondaryPower}/${attacker.counterPower} HP=${attacker.hp} Enchants=${attacker.activeEnchantments}
Defender ${defender.name}  AP=${defender.primaryPower}/${defender.secondaryPower}/${defender.counterPower} HP=${defender.hp} Enchants=${defender.activeEnchantments}

On average:
${attacker.name} loss ${(100 * attackerloss / 2000000).toFixed(1)}% = ${attackerunit.toFixed(0)}/${attackercount} (${attackerloss.toFixed(0)} np)
${defender.name} loss ${(100 * defenderloss / 2000000).toFixed(1)}% = ${defenderunit.toFixed(0)}/${defendercount} (${defenderloss.toFixed(0)} np)
      `;

      channel.send('```' + reportText + '```');
    }
    return;
  }

  // Last
  channel.send(`Hey ${username} use **help** to see available options`);
});

client.login(process.env.TOKEN);
