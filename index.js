// https://discord.com/developers/applications
require('dotenv').config()
const fs = require('fs');
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


/*
const content = fs.readFileSync('./units.json', { encoding: 'utf-8' });
const unitData = JSON.parse(content);
const unitMap = new Map();

for (const unit of unitData) {
  unitMap.set(unit.name.toLowerCase(), unit);
}

const replyUnitStat = (unit) => {
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
*/


let botId = 0;
let botTag = '';

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
  botId = client.user.id;
  botTag = client.user.tag;
});

//client.on('message', msg => {
//  const users = msg.mentions.users;
//  if (users.size === 1 && users.has(botId)) {
//    let content = msg.content;
//    content = content.replace(/\<.*\>/, '');
//    content = content.trim();
//
//    // Parse message
//    if (unitMap.has(content)) {
//      const u = unitMap.get(content);
//      msg.reply(replyUnitStat(u));
//    }
//  }
//});
//
//


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

  if (content.startsWith('show match')) {
    const tokens = content.replace('show match', '').split('vs');
    const u1str = tokens[0].trim();
    const u2str = tokens[1].trim();
    const u1 = engine.findUnit(u1str);
    const u2 = engine.findUnit(u2str);
    const N = 10;

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
        Attacker ${attacker.name}  AP=${attacker.primaryPower}/${attacker.secondaryPower}/${attacker.counterPower} HP=${attacker.hp}
        Defender ${defender.name}  AP=${defender.primaryPower}/${defender.secondaryPower}/${defender.counterPower} HP=${defender.hp}

        On average:
        ${attacker.name} loss = ${attackerunit.toFixed(0)}/${attackercount} (${attackerloss.toFixed(0)} np)
        ${defender.name} loss = ${defenderunit.toFixed(0)}/${defendercount} (${defenderloss.toFixed(0)} np)
      `);

      /*
      if (Math.abs(attackerloss - defenderloss) / defenderloss < 0.1) {
        channel.send(`More or less a tie, on average: 
          ${attacker.name} loss = ${attackerunit.toFixed(0)}/${attackercount} (${attackerloss.toFixed(0)} np)
          ${defender.name} loss = ${defenderunit.toFixed(0)}/${defendercount} (${defenderloss.toFixed(0)} np)`);
      } else if (attackerloss < defenderloss) {
        channel.send(`${attacker.name} wins, on average: 
          ${attacker.name} loss = ${attackerunit.toFixed(0)}/${attackercount} (${attackerloss.toFixed(0)} np)
          ${defender.name} loss = ${defenderunit.toFixed(0)}/${defendercount} (${defenderloss.toFixed(0)} np)`);
      } else {
        channel.send(`${defender.name} wins, on avearge: 
          ${attacker.name} loss = ${attackerunit.toFixed(0)}/${attackercount} (${attackerloss.toFixed(0)} np) 
          ${defender.name} loss = ${defenderunit.toFixed(0)}/${defendercount} (${defenderloss.toFixed(0)} np)`);
      }
      */
    }
    return;
  }
  if (content.startsWith('show unit')) {
    msg.channel.send('hello channel')
    return;
  }
});

client.login(process.env.TOKEN);
