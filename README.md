# Discord TR Bot
This is a chat-bot for analyzing the game [The Reincarnation](https://www.the-reincarnation.com/about.php), an online game where one plays the role of an ancient mage. The bot here is used to analyze unit pairings, their strengths/weakness, and other statistical shenanigans.


## Creating a Bot
You need to first apply for a bot-application on Discord [here](https://discord.com/developers/applications)

The bot will need privilege to access guild messages and reply to messages. Once the privileges are enabled the bot will need to be authorized onto specific server(s) via the generated OAuth URL.

We also need to grab the access `TOKEN` that will allow the bot to sign-on.

## Run the Bot
This depends on node-22/24 and `discord.js`. 
- Create a `.env` file and put the discord developer app [TOKEN](https://discordjs.guide/preparations/setting-up-a-bot-application.html#what-is-a-token-anyway) into it

```
TOKEN=<access token>

# optionally to have AI/LLM
AI_TOKEN=<ai_token>
AI_URL=<url>
AI_SERVERS=<list of discord server ids, comma delimited>
```

- Install dependencies: `npm install`
- Build project: `npm run build`
- Run the bot: `npm start`

## Features
- Match up smulation to both prognose and diagnose 
- Pairwise analysis for finding best offensive and defensive pairings
- Language features to allow for short names, spelling variations and mistakes


## Interacting with the Bot
The follow analysis directives are supported
- show match {unit1} vs {unit2}
- show battle {unit1} vs {unit2}
- show pairing {unit}

The following configurations directives are available
- show config
- set server

## Misc.
Get short answers from AI/LLM
- ask {prompt} 



### Head-to-head match up
Runs head-to-head simulation match up between two units

```
@botname show match lich vs dwarven shaman
```

yields

```
### Report
0 wins, 10 losses, 0 draws

Attacker Lich  AP=5500/16000/2000 HP=7500 Enchants=
Defender Dominion  AP=200000/250000/30000 HP=80000 Enchants=

On average:
Lich loss 44.7% = 441/986 (893299 np)
Dominion loss 5.9% = 3/51 (117039 np)
```


### Best unit
Run pairwise simulations to determine the best offensive and defensive units.

```
@botname show paring lich
```

results in

```
### Top damage dealers 
Ascendant: ^Dominion, ^Spirit Warrior, ^Titan
Verdant: Faerie Dragon, Earth Elemental, Phoenix
Eradication: ^Hell Hound, ^Storm Giant, Chimera
Nether: ^Fallen Dominion, Horned Demon, Unholy Reaver
Phantasm: ^Yeti, Medusa, Air Elemental

^ Deals at least 15% damage (good snipers)


### Top defenders 
Ascendant: ^Preacher, ^Knight Templar, ^Naga Queen
Verdant: ^Treant, Werebear, Swanmy
Eradication: ^Dwarven Shaman, Hydra, Efreeti
Nether: ^Bulwark Horror, ^Lich, ^Dark Elf Magician
Phantasm: ^Leviathan, ^Ice Elemental, ^Yeti

^ Receives less than 8% damage (good tanks)


### Top head-to-head viable units:
Ascendant: ^Titan, ^Spirit Warrior, ^High Priest
Verdant: 
Eradication: Dwarven Shaman, Storm Giant
Nether: Horned Demon, Dark Elf Magician, Lich
Phantasm: ^Yeti, Leviathan, Ice Elemental

^ Deals 5% or more damage than it receives (good head-to-head)
```


### Show single battle
Runs a single battle with detailed logs

```
@botname show battle naga vs ebd
```

results in

```
### Battle report 
Naga Queen (740) vs Dwarven Shaman (2000)
Naga Queen=740 power=13000/17600/2500, hp=10500, acc=0.3, enchants=
Dwarven Shaman=2000 power=5000/8000/300, hp=4500, acc=0.3, enchants=

Dwarven Shaman slew 121 Naga Queen > Secondary attack (acc 0.30)
Naga Queen slew 532 Dwarven Shaman > Secondary attack (acc 0.40)
Dwarven Shaman slew 49 Naga Queen > Primary attack (acc 0.30)
  counter: Naga Queen slew 36 Dwarven Shaman
Naga Queen slew 93 Dwarven Shaman > Primary attack (acc 0.40)
  counter: Dwarven Shaman slew 2 Naga Queen
Dwarven Shaman 661 slain
Dwarven Shaman 198 healed

Attacker lost 172 Naga Queen
Defender lost 463 Dwarven Shaman
Attacker loss np 464400
Defender loss np 463000
```
