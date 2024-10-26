// https://discord.com/developers/applications
import * as dotenv from 'dotenv'
dotenv.config()

import _ from 'lodash';
import { Client, Intents } from 'discord.js';
import { Engine } from './engine';
import { Unit } from './types';

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
const allowedEnchantIds = ['bc', 'bs', 'ea', 'hallu', 'lnp', 'lore', 'pg', 'thl'];

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

  let content = msg.content;
  content = content.replace(/\<.*\>/, '');
  content = content.toLowerCase().trim();

  const channel = msg.channel;
  const username = msg.author.username;

  if (userPrefMap.has(username) === false) {
    userPrefMap.set(username, {
      attackerEnchants: [],
      defenderEnchants: [],
      serverName: DEFAULT_SERVER
    });
  }

  const serverName = userPrefMap.get(username).serverName || DEFAULT_SERVER;

  if (content.startsWith('help')) {

    const helpText = `
### Anansi commands
show config - Shows your configuration
set enchant [<e1> <e2> vs <e1> <e2>] - Set enchantments
  default: set enchant default
  specify: set enchant none vs <enchant> <enchant>
  clear all: set enchant
set server <server> - Select server, e.g. blitz, beta
show match <unit1> vs <unit2> - Evaluate head-to-head match up
show pairing <unit> - Evaluate top pairings
show battle <uni1> vs <unit2> - Single battle with logs
show eq <targetNP> <targetMP> <casterNP>

if you'd like to contribute or access to the source, see https://github.com/mwdchang/discord-tr-bot
    `;

    channel.send("```md" + helpText + "```");
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
    // const targetNP = +tokens[0];
    // const targetMana = +tokens[1];
    // const casterNP = +tokens[2];

    let targetNP = +tokens[0];
    let targetMana = +tokens[1];
    let casterNP = +tokens[2];
    let temp = '';
    
    temp = tokens[0].toLowerCase();
    if (temp.endsWith('m')) {
      targetNP = parseFloat(tokens[0]) * 1000000;
    } else if (temp.endsWith('k')) {
      targetNP = parseFloat(tokens[0]) * 1000;
    }

    temp = tokens[1].toLowerCase();
    if (temp.endsWith('m')) {
      targetMana  = parseFloat(tokens[1]) * 1000000;
    } else if (temp.endsWith('k')) {
      targetMana = parseFloat(tokens[1]) * 1000;
    }

    temp = tokens[2].toLowerCase();
    if (temp.endsWith('m')) {
      casterNP = parseFloat(tokens[2]) * 1000000;
    } else if (temp.endsWith('k')) {
      casterNP = parseFloat(tokens[2]) * 1000;
    }

    const r = engine.calculateEQ(targetNP, targetMana, casterNP);

    // round to 1000s, easer to read
    const round1000 = (v: number) => Math.round(v / 1000) * 1000;

    const reportText = `
### Report - ${serverName}
Earthquake calculation (includes casting)

Target NP: ${targetNP}
Target Mana: ${targetMana}
Caster NP: ${casterNP}

On-colour: ${round1000(r.onColour)}
Adjacent: ${round1000(r.adjacent)}
Opposite: ${round1000(r.opposite)}
   `;
    channel.send("```" + 'md\n' + reportText + "```");
    return;
  }

  if (content.startsWith('set server')) {
    const server = content.replace('set server', '').trim();
    if (server !== 'blitz' && server !== 'beta') {
      channel.send(`Server ${server} is not currently supported`);
      return;
    }
    userPrefMap.get(username).serverName = server;
    const text = `Set server to ${server} for ${username}`;
    channel.send('```' + text + '```');
    return;
  }

  if (content.startsWith('set enchant')) {
    const tokens = content.replace('set enchant', '').split('vs');

    // Use default enchantments
    if (!tokens || (tokens.length === 1 && tokens[0].includes('default'))) {
      userPrefMap.get(username).attackerEnchants = ['default'];
      userPrefMap.get(username).defenderEnchants = ['default'];
      channel.send(`${username} using default enchantments`); 
      return;
    }

    // Clear enchantments
    if (tokens.length !== 2) {
      userPrefMap.get(username).attackerEnchants = [];
      userPrefMap.get(username).defenderEnchants = [];
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

    userPrefMap.get(username).attackerEnchants = filteredAttackerEnchants;
    userPrefMap.get(username).defenderEnchants = filteredDefenderEnchants;

    channel.send(`${username}: attacker=${filteredAttackerEnchants.join(' ')} defender=${filteredDefenderEnchants.join(' ')}`);
    return;
  }

  if (content.startsWith('show config')) {
    const userPref = userPrefMap.get(username);
    const configText = `
### Configuration for ${username}
attacker enchantments = ${userPref.attackerEnchants.join(', ')}
defender enchantments = ${userPref.defenderEnchants.join(', ')}
server = ${userPref.serverName}
    `;
    channel.send('```' + configText + '```');
    return;
  }

  if (content.startsWith('show pairing')) {
    const uStr = content.replace('show pairing', '').trim();
    const u = engine.findUnit(uStr, serverName);


    if (!u) {
      channel.send(`I cannot find "${uStr}"`);
      return;
    }

    logUsage(u.name);

    const attackerEnchants = userPrefMap.get(username).attackerEnchants;
    const defenderEnchants = userPrefMap.get(username).defenderEnchants;
    const r = engine.findPairings(u, serverName, attackerEnchants, defenderEnchants);

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

    const header = `Pairing against ${u.name} - **${serverName}**`;
    channel.send(header + "```" + 'md\n' + reportText + "```");
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
    if (!u2) {
      channel.send(`I cannot find "${tokens[1]}"`);
      return;
    }

    if (u1 && u2) {
      logUsage(u1.name, u2.name);

      const attackerEnchants = userPrefMap.get(username).attackerEnchants;
      const defenderEnchants = userPrefMap.get(username).defenderEnchants;

      const r = engine.simulate(u1, u2, serverName, attackerEnchants, defenderEnchants);
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
    if (!u2) {
      channel.send(`I cannot find "${tokens[1]}"`);
      return;
    }

    const noNeg = (v: number) => Math.max(1, v);

    if (u1 && u2) {
      logUsage(u1.name, u2.name);

      const attackerEnchants = userPrefMap.get(username).attackerEnchants;
      const defenderEnchants = userPrefMap.get(username).defenderEnchants;

      const results = engine.simulateX(u1, u2, serverName, attackerEnchants, defenderEnchants, N);
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
