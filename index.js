// https://discord.com/developers/applications
require('dotenv').config()
const fs = require('fs');
const { Client, Intents } = require('discord.js');
const { engine } = require('./engine');
engine.init('./units.json');

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});


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

  if (content.startsWith('show match')) {
    const tokens = content.replace('show match', '').split('vs');
    const u1str = tokens[0].trim();
    const u2str = tokens[1].trim();
    const u1 = engine.findUnit(u1str);
    const u2 = engine.findUnit(u2str);

    console.log('checking', u1str, u2str);

    if (u1 && u2) {
      const results = engine.simulateX(u1, u2, 10);
      let u1loss = 0;
      let u2loss = 0;
      for (const r of results) {
        u1loss += r.attackerLoss;
        u2loss += r.defenderLoss;
      }
      u1loss /= 10;
      u2loss /= 10;

      if (u1loss < u2loss) {
        msg.reply(`${u1.name} wins on average ${u1.name} np-loss=${u1loss.toFixed(0)} : ${u2.name} np-loss=${u2loss.toFixed(0)} (smaller is better)`);
      } else {
        msg.reply(`${u2.name} wins on average ${u1.name} np-loss=${u1loss.toFixed(0)} : ${u2.name} np-loss=${u2loss.toFixed(0)} (smaller is better)`);
      }
    }
    return;
  }
  if (content.startsWith('show unit')) {
    return;
  }
});

client.login(process.env.TOKEN);
