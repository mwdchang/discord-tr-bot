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
      attackerEnchants: null,
      defenderEnchants: null 
    });
    return;
  }

  if (content.startsWith('help')) {
    channel.send(`I can do these analyses:
    **show match <unit1> vs <unit2>** - Evaluate head-to-head match up
    **show pairing <unit>** - Evaluate top pairings
    **show battle <uni1> vs <unit2>** - Single battle with logs
    **set enchants [<e1> <e2> vs <e1> <e2>]** - Set enchantments

if you'd like to contribute or access to the source, see
\`https://github.com/mwdchang/discord-tr-bot/\`
    `);
    return;
  }

  if (content.startsWith('set enchant')) {
    const tokens = content.replace('set enchant', '').split('vs');

    // Reset
    if (!tokens || tokens.length !== 2) {
      userPrefMap.get(username).attackerEnchants = null;
      userPrefMap.get(username).defenderEnchants = null;
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

  if (content.startsWith('show prefs')) {
    const userPref = userPrefMap.get(username);
    channel.send(`${username}'s setup
    attacker enchantments = ${userPref.attackerEnchants.join(', ')}
    defender enchantments = ${userPref.defenderEnchants.join(', ')}
    `);
    return;
  }

  if (content.startsWith('show pairing')) {
    const uStr = content.replace('show pairing', '').trim();
    const u = engine.findUnit(uStr);

    if (!u) {
      channel.send(`I cannot find "${uStr}". ${GENERAL_ERROR}`);
      return;
    }

    const attackerEnchants = userPrefMap.get(username).attackerEnchants;
    const defenderEnchants = userPrefMap.get(username).defenderEnchants;
    const r = engine.findPairings(u, attackerEnchants, defenderEnchants);

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
        if (d.value >= T_attack) d.name = `**${d.name}**`;
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
        if (d.value >= T_viable && d.value2 > T_attack) d.name = `**${d.name}**`;
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
        if (d.value <= T_defend) d.name = `**${d.name}**`;
      });
    });

    channel.send(`Report: pairing against ${u.name}
      Top damage dealer: 
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
      Top head-to-head viable units: 
         Acendant: ${topViableAscendant.map(d => d.name).join(', ')}
         Verdant: ${topViableVerdant.map(d => d.name).join(', ')}
         Eradication: ${topViableEradication.map(d => d.name).join(', ')}
         Nether: ${topViableNether.map(d => d.name).join(', ')}
         Phantasm: ${topViablePhantasm.map(d => d.name).join(', ')}

      Bolded attackers deal more than > 15% damage. Bolded defenders suffer < 8% loss.
      Bolded viable units deal 5% more dmanage than they suffer.
    `);
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
      u1 = engine.findUnit(u1str);
      u2 = engine.findUnit(u2str);
    } catch (error) {
      console.error(`Parsing error: ${content}`);
      channel.send('Parsing error');
      return;
    }

    if (!u1) {
      channel.send(`I cannot find "${tokens[0]}". ${GENERAL_ERROR}`);
      return;
    }
    if (!u2) {
      channel.send(`I cannot find "${tokens[1]}". ${GENERAL_ERROR}`);
      return;
    }

    if (u1 && u2) {
      const attackerEnchants = userPrefMap.get(username).attackerEnchants;
      const defenderEnchants = userPrefMap.get(username).defenderEnchants;

      const r = engine.simulate(u1, u2, attackerEnchants, defenderEnchants);
      const battleLog = r.battleLog;

      let attackercount = r.attackerUnitCount;
      let defendercount = r.defenderUnitCount;

      channel.send(`Report: ${u1.name} (${attackercount}) vs ${u2.name} (${defendercount})
${battleLog.join('\n')}
      `);
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
      u1 = engine.findUnit(u1str);
      u2 = engine.findUnit(u2str);
    } catch (error) {
      console.error(`Parsing error: ${content}`);
      channel.send('Parsing error');
      return;
    }
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
      const attackerEnchants = userPrefMap.get(username).attackerEnchants;
      const defenderEnchants = userPrefMap.get(username).defenderEnchants;

      const results = engine.simulateX(u1, u2, attackerEnchants, defenderEnchants, N);
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
  channel.send(`Hey ${username} use **help** to see available options`);
});

client.login(process.env.TOKEN);
