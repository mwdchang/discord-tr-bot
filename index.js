// https://discord.com/developers/applications
require('dotenv').config()
const fs = require('fs');
const _ = require('lodash');
const { Client, Intents } = require('discord.js');
const { engine } = require('./engine');
engine.init('./units.json', './slangs.json');

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES
  ]
});


let botId = 0;
let botTag = '';

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
  botId = client.user.id;
  botTag = client.user.tag;
});

const GENERAL_ERROR = 'Cannot understand ???. Please use **help** to see a list of available options.';


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

  if (content.startsWith('help')) {
    channel.send(`I can do these analyses:
    **show match <unit1> vs <unit2>** - Evaluate head-to-head match up
    **show pairing <unit>** - Evaluate top pairings
    **show battle <uni1> vs <unit2>** - Single battle with logs

if you'd like to contribute or access to the source, see
\`https://github.com/mwdchang/discord-tr-bot/\`
    `);
    return;
  }

  if (content.startsWith('settings')) {
    let str = content.replace('settings', '').trim();
    let role = '';

    if (str.startsWith('attacker')) {
      str = str.replace('attacker', '').trim();
      role = 'attacker';
    } else if (str.startsWith('defender')) {
      str = str.replace('defender', '').trim();
      role = 'defender';
    } else if (str.startsWith('reset')) {
      role = 'reset';
    } else {
      role = '';
    }

    if (role === 'reset') {
    } else if (role === 'attacker') {
    } else if (role === 'defender') {
    }
  }

  if (content.startsWith('show pairing')) {
    const uStr = content.replace('show pairing', '').trim();
    const u = engine.findUnit(uStr);

    if (!u) {
      channel.send(`I cannot find "${uStr}". ${GENERAL_ERROR}`);
      return;
    }

    const r = engine.findPairings(u);
    const topAttackerAscendant = _.take(r.attackers.filter(d => d.magic === 'ascendant'), 3);
    const topAttackerVerdant = _.take(r.attackers.filter(d => d.magic === 'verdant'), 3);
    const topAttackerEradication = _.take(r.attackers.filter(d => d.magic === 'eradication'), 3);
    const topAttackerNether = _.take(r.attackers.filter(d => d.magic === 'nether'), 3);
    const topAttackerPhantasm = _.take(r.attackers.filter(d => d.magic === 'phantasm'), 3);

    const topDefenderAscendant = _.take(r.defenders.filter(d => d.magic === 'ascendant'), 3);
    const topDefenderVerdant = _.take(r.defenders.filter(d => d.magic === 'verdant'), 3);
    const topDefenderEradication = _.take(r.defenders.filter(d => d.magic === 'eradication'), 3);
    const topDefenderNether = _.take(r.defenders.filter(d => d.magic === 'nether'), 3);
    const topDefenderPhantasm = _.take(r.defenders.filter(d => d.magic === 'phantasm'), 3);

    channel.send(`Report: pairing against ${u.name}
      Top attackers: 
         Acendant: ${topAttackerAscendant.map(d => d.name).join(', ')}
         Verdant: ${topAttackerVerdant.map(d => d.name).join(', ')}
         Eradication: ${topAttackerEradication.map(d => d.name).join(', ')}
         Nether: ${topAttackerNether.map(d => d.name).join(', ')}
         Phantasm: ${topAttackerPhantasm.map(d => d.name).join(', ')}
      Top defenders: 
         Acendant: ${topDefenderAscendant.map(d => d.name).join(', ')}
         Verdant: ${topDefenderVerdant.map(d => d.name).join(', ')}
         Eradication: ${topDefenderEradication.map(d => d.name).join(', ')}
         Nether: ${topDefenderNether.map(d => d.name).join(', ')}
         Phantasm: ${topDefenderPhantasm.map(d => d.name).join(', ')}
    `);
    return;
  }


  if (content.startsWith('show battle')) {
    const tokens = content.replace('show battle', '').split('vs');
    const u1str = tokens[0].trim();
    const u2str = tokens[1].trim();
    const u1 = engine.findUnit(u1str);
    const u2 = engine.findUnit(u2str);

    if (!u1) {
      channel.send(`I cannot find "${tokens[0]}". ${GENERAL_ERROR}`);
      return;
    }
    if (!u2) {
      channel.send(`I cannot find "${tokens[1]}". ${GENERAL_ERROR}`);
      return;
    }

    if (u1 && u2) {
      const r = engine.simulate(u1, u2);
      const battleLog = r.battleLog;

      let attackercount = r.attackerUnitCount;
      let defendercount = r.defenderUnitCount;

      channel.send(`Report: ${u1.name} (${attackercount}) vs ${u2.name} (${defendercount})
${battleLog.join('\n')}
      `);
    }
  }

  if (content.startsWith('show match')) {
    const tokens = content.replace('show match', '').split('vs');
    const u1str = tokens[0].trim();
    const u2str = tokens[1].trim();
    const u1 = engine.findUnit(u1str);
    const u2 = engine.findUnit(u2str);
    const N = 10;

    if (!u1) {
      channel.send(`I cannot find "${tokens[0]}". ${GENERAL_ERROR}`);
      return;
    }
    if (!u2) {
      channel.send(`I cannot find "${tokens[1]}". ${GENERAL_ERROR}`);
      return;
    }

    if (u1 && u2) {
      const results = engine.simulateX(u1, u2, N);
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

      channel.send(`Report: **${wins} wins, ${losses} losses, ${ties} draws**
        Attacker ${attacker.name}  AP=${attacker.primaryPower}/${attacker.secondaryPower}/${attacker.counterPower} HP=${attacker.hp} Enchants=${attacker.activeEnchantments}
        Defender ${defender.name}  AP=${defender.primaryPower}/${defender.secondaryPower}/${defender.counterPower} HP=${defender.hp} Enchants=${defender.activeEnchantments}

        On average:
        ${attacker.name} loss ${(100 * attackerloss / 2000000).toFixed(1)}% = ${attackerunit.toFixed(0)}/${attackercount} (${attackerloss.toFixed(0)} np)
        ${defender.name} loss ${(100 * defenderloss / 2000000).toFixed(1)}% = ${defenderunit.toFixed(0)}/${defendercount} (${defenderloss.toFixed(0)} np)
      `);
    }
    return;
  }

  // last
  channel.send('??? use **help** to see available options');
});

client.login(process.env.TOKEN);
