// https://discord.com/developers/applications
require('dotenv').config()
const fs = require('fs');
const { Client, Intents } = require('discord.js');

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

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`)
  botId = client.user.id;
  botTag = client.user.tag;
});

client.on("message", msg => {
  const users = msg.mentions.users;
  if (users.size === 1 && users.has(botId)) {
    let content = msg.content;
    content = content.replace(/\<.*\>/, '');
    content = content.trim();

    // Parse message
    if (unitMap.has(content)) {
      const u = unitMap.get(content);
      msg.reply(replyUnitStat(u));
    }
  }
});

client.login(process.env.TOKEN);
