type AttackType = "missile" | "fire" | "poison" | "breath" | "magic" | "melee" | "ranged" | "lightning" | "cold" | "paralyse" | "psychic" | "holy"

type Race = "angel" | "animal" | "astral" | "demon" | "dragon" | "dwarf" | "elemental" | "elf" | "giant" | "golem" | "human" | "illusion" | "orc" | "pixie" | "reptile" | "telepath" | "treefolk" | "troll" | "undead"

type Magic = "ascendant" | "verdant" | "eradication" | "nether" | "phantasm"

// export enum Abilities {
//   FLYING = 'flying',
//   SWIFT = 'swfit',
//   BEAUTY = 'beauty',
//   FEAR = 'fear',
//   MARKMANSHIP = 'marksmanship',
//   CLUMSINESS = 'clumsiness'
// }

export interface Unit {
  name: string
  magic: Magic
  race: Race[]
  power: number
  a1_power: number
  a1_type: string
  a1_init: number
  a2_power: number
  a2_type: string
  a2_init: number
  counter: number
  hp: number
  abilities: string[]
  spell_resistance: {
    ascendant: number
    verdant: number
    eradication: number
    nether: number
    phantasm: number
  }
  resistances: {
    missile: number	
    fire:	number
    poison:	number
    breath:	number
    magic: number
    melee: number
    ranged:	number
    lightning: number
    cold:	number
    paralyse:	number
    psychic: number	
    holy:	number
  }
}

export interface Ref {
  name: string
  magic: string
  race: string[]

  efficiency: number
  hp: number
  accuracy: number
  power: number
  numUnits: number
  abilities: string[]

  primaryTypes: string[]
  primaryPower: number
  primaryInit: number
  secondaryTypes: string[]
  secondaryPower: number
  secondaryInit: number
  counterPower: number
  resistances: any
  unitLoss: number
  powerLoss: number
  activeEnchantments: string[]

  base: {
    hp: number
    primaryPower: number
    secondaryPower: number
    counterPower: number
  }
}

export interface SimResult {
  attacker: Ref
  defender: Ref
  
  attackerLoss: number
  attackerUnitCount: number
  attackerUnitLoss: number
  
  defenderLoss: number
  defenderUnitCount: number
  defenderUnitLoss: number
  
  battleLog: string[]
}

