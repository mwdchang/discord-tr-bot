// https://discord.com/developers/applications
import * as dotenv from 'dotenv'
dotenv.config()

const fs = require('fs');
const _ = require('lodash');
const { Client, Intents } = require('discord.js');
const { Engine } = require('./engine');

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


let botId = 0;
let botTag = '';

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
  botId = client.user.id;
  botTag = client.user.tag;
});

const userPrefMap = new Map();


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
show match <unit1> vs <unit2> - Evaluate head-to-head match up
show pairing <unit> - Evaluate top pairings
show battle <uni1> vs <unit2> - Single battle with logs
set enchants [<e1> <e2> vs <e1> <e2>] - Set enchantments
set server <server> - Select server, e.g. blitz, beta
show config - Shows your configuration


if you'd like to contribute or access to the source, see https://github.com/mwdchang/discord-tr-bot
    `;

    channel.send("```md" + helpText + "```");
    return;
  }

  if (content.startsWith('set server')) {
    const server = content.replace('set server', '').trim();
    if (server !== 'blitz' && server !== 'beta') {
      channel.send(`Server ${server} is not currently supported`);
      return;
    }
    userPrefMap.get(username).serverName = server;
    channel.send(`Selecting ${server} is for ${username}`);
    return;
  }

  if (content.startsWith('set enchant')) {
    const tokens = content.replace('set enchant', '').split('vs');

    // Reset
    if (!tokens || tokens.length !== 2) {
      userPrefMap.get(username).attackerEnchants = [];
      userPrefMap.get(username).defenderEnchants = [];
      channel.send(`${username} reset enchantments to default`); 
      return;
    }

    // Set enchants
    const attackerEnchants = tokens[0].split(/[\s,]/).filter(d => d != '');
    const defenderEnchants = tokens[1].split(/[\s,]/).filter(d => d != '');


    userPrefMap.get(username).attackerEnchants = attackerEnchants;
    userPrefMap.get(username).defenderEnchants = defenderEnchants;

    console.log(userPrefMap.get(username));

    channel.send(`${username}: attacker=${attackerEnchants.join(' ')} defender=${defenderEnchants.join(' ')}`);
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

    const attackerEnchants = userPrefMap.get(username).attackerEnchants;
    const defenderEnchants = userPrefMap.get(username).defenderEnchants;
    const r = engine.findPairings(u, serverName, attackerEnchants, defenderEnchants);

    const topAttackerAscendant = _.take(r.attackers.filter(d => d.magic === 'ascendant'), 3);
    const topAttackerVerdant = _.take(r.attackers.filter(d => d.magic === 'verdant'), 3);
    const topAttackerEradication = _.take(r.attackers.filter(d => d.magic === 'eradication'), 3);
    const topAttackerNether = _.take(r.attackers.filter(d => d.magic === 'nether'), 3);
    const topAttackerPhantasm = _.take(r.attackers.filter(d => d.magic === 'phantasm'), 3);

    const topViableAscendant = _.take(r.viables.filter(d => d.magic === 'ascendant'), 3);
    const topViableVerdant = _.take(r.viables.filter(d => d.magic === 'verdant'), 3);
    const topViableEradication = _.take(r.viables.filter(d => d.magic === 'eradication'), 3);
    const topViableNether = _.take(r.viables.filter(d => d.magic === 'nether'), 3);
    const topViablePhantasm = _.take(r.viables.filter(d => d.magic === 'phantasm'), 3);


    const topDefenderAscendant = _.take(r.defenders.filter(d => d.magic === 'ascendant'), 3);
    const topDefenderVerdant = _.take(r.defenders.filter(d => d.magic === 'verdant'), 3);
    const topDefenderEradication = _.take(r.defenders.filter(d => d.magic === 'eradication'), 3);
    const topDefenderNether = _.take(r.defenders.filter(d => d.magic === 'nether'), 3);
    const topDefenderPhantasm = _.take(r.defenders.filter(d => d.magic === 'phantasm'), 3);


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
### Top damage dealers 
Ascendant: ${topAttackerAscendant.map(d => d.name).join(', ')}
Verdant: ${topAttackerVerdant.map(d => d.name).join(', ')}
Eradication: ${topAttackerEradication.map(d => d.name).join(', ')}
Nether: ${topAttackerNether.map(d => d.name).join(', ')}
Phantasm: ${topAttackerPhantasm.map(d => d.name).join(', ')}

^ Deals at least 15% damage (good snipers)


### Top defenders 
Ascendant: ${topDefenderAscendant.map(d => d.name).join(', ')}
Verdant: ${topDefenderVerdant.map(d => d.name).join(', ')}
Eradication: ${topDefenderEradication.map(d => d.name).join(', ')}
Nether: ${topDefenderNether.map(d => d.name).join(', ')}
Phantasm: ${topDefenderPhantasm.map(d => d.name).join(', ')}

^ Receives less than 8% damage (good tanks)


### Top head-to-head viable units:
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

    let u1str = null;
    let u2str = null;
    let u1 = null;
    let u2 = null;
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

    console.log(serverName, u1);

    if (!u1) {
      channel.send(`I cannot find "${tokens[0]}"`);
      return;
    }
    if (!u2) {
      channel.send(`I cannot find "${tokens[1]}"`);
      return;
    }

    if (u1 && u2) {
      const attackerEnchants = userPrefMap.get(username).attackerEnchants;
      const defenderEnchants = userPrefMap.get(username).defenderEnchants;

      const r = engine.simulate(u1, u2, serverName, attackerEnchants, defenderEnchants);
      const battleLog = r.battleLog;

      let attackercount = r.attackerUnitCount;
      let defendercount = r.defenderUnitCount;

      const battleText = `
### Battle report 
${u1.name} (${attackercount}) vs ${u2.name} (${defendercount})
${battleLog.join('\n')}
      `;

      channel.send('```' + battleText + '```');
    }
    return;
  }

  if (content.startsWith('show match')) {
    const tokens = content.replace('show match', '').split('vs');

    let u1str = null;
    let u2str = null;
    let u1 = null;
    let u2 = null;
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

    if (u1 && u2) {
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

        if (r.defenderLoss / r.attackerLoss > 1.1) {
          wins ++;
        } else if (r.attackerLoss / r.defenderLoss > 1.1) {
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
### Report
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
