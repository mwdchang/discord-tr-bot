# Discord TR Bot
This is a chat-bot for analyzing the game [The Reincarnation](https://www.the-reincarnation.com/about.php), an online game where one plays the role of an ancient mage. The bot here is used to analyze unit pairings, their strengths/weakness, and other statistical shenanigans.


## Creating a Bot
You need to first apply for a bot-application on Discord [here](https://discord.com/developers/applications)

The bot will need privilege to access guild messages and reply to messages. Once the privileges are enabled the bot will need to be authorized onto specific server(s) via the generated OAuth URL.

We also need to grab the access `TOKEN` that will allow the bot to sign-on.

## Run the Bot
This depends on node-16/18 and `discord.js`. 
- Put the TOKEN into the `.env` file

```
TOKEN=<access token>
```

- Install dependencies: `npm install`
- Install and run the bot: `node index.js`

## Features
- Match up smulation to both prognose and diagnose 
- Pairwise analysis for finding best offensive and defensive pairings
- Language features to allow for short names, spelling variations and mistakes


## Interacting with the Bot
Support the following queries


### Head-to-head match up
Runs head-to-head simulation match up between two units

```
@botname show match lich vs dwarven shaman
```

yields

```
Dwarven Shaman wins on average Lich np-loss=190943 : Dwarven Shaman np-loss=137836 (smaller is better)
```


### Best unit
Run pairwise simulations to determine the best offensive and defensive units.

```
@botname show paring lich
```

yields

```
Report: pairing against Yeti
      Top attackers: 
         Acendant: Naga Queen, Titan, Astral Magician
         Verdant: Phoenix, Treant, Mandrake
         Eradication: Fire Elemental, Chimera, Hell Hound
         Nether: Unholy Reaver, Dark Elf Magician, Horned Demon
         Phantasm: Siren, Mind Ripper, Phantom
      Top defenders: 
         Acendant: Preacher, Naga Queen, Titan
         Verdant: Treant, Werebear, Mandrake
         Eradication: Dwarven Shaman, Storm Giant, Efreeti
         Nether: Wolf Raider, Lich, Unholy Reaver
         Phantasm: Yeti, Leviathan, Ice Elemental
```


### Show single battle
Runs a single battle with detailed logs

```
@botname show battle naga vs ebd
```

yields 

```
Report: Naga Queen (740) vs Elven Blade Dancer (1081)
pri attack (0.37): Elven Blade Dancer slew 5 Naga Queen
add attack (0.37): Elven Blade Dancer slew 4 Naga Queen
counter: Naga Queen slew 20 Elven Blade Dancer
sec attack (0.31): Naga Queen slew 232 Elven Blade Dancer
burst (melee 3000): Elven Blade Dancer, slew 6 Naga Queen
burst (melee 3000): Elven Blade Dancer, slew 0 Elven Blade Dancer
pri attack (0.31): Naga Queen slew 110 Elven Blade Dancer
counter: Elven Blade Dancer slew 0 Naga Queen
sec attack (0.37): Elven Blade Dancer slew 22 Naga Queen
lost 37 Naga Queen
lost 362 Elven Blade Dancer
```
