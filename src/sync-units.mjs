import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT_PATH = path.join(ROOT_DIR, 'data', 'guild', 'units.json');
const WIKI_API = 'https://wiki.the-reincarnation.org/api.php';
const DATASETS = {
  guild: {
    categoryTitle: 'Category:Units_(Guildwar)',
    titlePrefix: 'Guildwar',
    defaultOutputPath: path.join(ROOT_DIR, 'data', 'guild', 'units.json'),
    ignoredUnits: new Set(['Assassin', 'Capsule Monster', 'Iron Golem'])
  },
  beta: {
    categoryTitle: 'Category:Units_(Beta)',
    titlePrefix: 'Beta',
    defaultOutputPath: path.join(ROOT_DIR, 'data', 'beta', 'units.json'),
    ignoredUnits: new Set(['Capsule Monster', 'Call Venus Flytraps'])
  },
  blitz: {
    categoryTitle: 'Category:Units_(Blitz)',
    titlePrefix: 'Blitz',
    defaultOutputPath: path.join(ROOT_DIR, 'data', 'blitz', 'units.json'),
    ignoredUnits: new Set(['Assassin', 'Capsule Monster', 'Iron Golem'])
  },
  arch: {
    categoryTitle: 'Category:Units_(Arch)',
    titlePrefix: 'Arch',
    defaultOutputPath: path.join(ROOT_DIR, 'data', 'arch', 'units.json'),
    ignoredUnits: new Set(['Capsule Monster', 'Unholy Reaver', 'Elven Blade Dancer', 'Phantom'])
  },
  lightning: {
    categoryTitle: 'Category:Units_(Lightning)',
    titlePrefix: 'Lightning',
    defaultOutputPath: path.join(ROOT_DIR, 'data', 'lightning', 'units.json'),
    ignoredUnits: new Set(['Assassin', 'Capsule Monster', 'Call Venus Flytraps', 'Iron Golem'])
  }
};

const MAGIC_MAP = {
  ascendant: 'ascendant',
  verdant: 'verdant',
  eradication: 'eradication',
  nether: 'nether',
  phantasm: 'phantasm',
  plain: 'plain'
};

const RACE_MAP = {
  angel: 'angel',
  animal: 'animal',
  astral: 'astral',
  demon: 'demon',
  dragon: 'dragon',
  dwarf: 'dwarf',
  elemental: 'elemental',
  elf: 'elf',
  giant: 'giant',
  golem: 'golem',
  human: 'human',
  illusion: 'illusion',
  orc: 'orc',
  pixie: 'pixie',
  reptile: 'reptile',
  telepath: 'telepath',
  treefolk: 'treefolk',
  troll: 'troll',
  undead: 'undead'
};

const TYPE_MAP = {
  melee: 'melee',
  missile: 'missile',
  ranged: 'ranged',
  magic: 'magic',
  fire: 'fire',
  poison: 'poison',
  breath: 'breath',
  lightning: 'lightning',
  cold: 'cold',
  paralyse: 'paralyse',
  paralyze: 'paralyse',
  psychic: 'psychic',
  holy: 'holy'
};

const RESISTANCE_KEYS = ['missile', 'fire', 'poison', 'breath', 'magic', 'melee', 'ranged', 'lightning', 'cold', 'paralyse', 'psychic', 'holy'];

const SPELL_RESIST_MAP = {
  white: 'ascendant',
  green: 'verdant',
  red: 'eradication',
  black: 'nether',
  blue: 'phantasm'
};

class DisabledUnitError extends Error {
  constructor(unitName, titlePrefix) {
    super(`Unit is disabled on ${titlePrefix} server`);
    this.name = 'DisabledUnitError';
    this.unitName = unitName;
    this.titlePrefix = titlePrefix;
  }
}

async function fetchHistoricalStatsRaw(statsTitle) {
  const historyUrl = `${WIKI_API}?${new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    titles: statsTitle,
    rvprop: 'ids|timestamp|content',
    rvlimit: '50',
    format: 'json'
  }).toString()}`;
  const body = await httpGet(historyUrl);
  const payload = JSON.parse(body);
  const pages = payload?.query?.pages || {};
  const page = Object.values(pages)[0];
  const revisions = page?.revisions || [];

  for (const revision of revisions) {
    const content = revision['*'] || '';
    if (typeof content === 'string' && content.includes('UnitBaseStats')) {
      return content;
    }
  }
  return null;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve(body));
      })
      .on('error', reject);
  });
}

function toApiUrl(params) {
  const p = new URLSearchParams(params);
  return `${WIKI_API}?${p.toString()}`;
}

function parseNumber(value, fallback = 0) {
  if (!value) return fallback;
  const cleaned = value.replaceAll(',', '').replaceAll('%', '').trim();
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) return fallback;
  return Number(match[0]);
}

function stripWikiMarkup(value) {
  if (!value) return '';
  let s = value;
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
  s = s.replace(/\[\[([^\]]+)\]\]/g, '$1');
  s = s.replace(/\{\{[^{}]*\}\}/g, '');
  s = s.replace(/'''?/g, '');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function normalizeAttackTypes(value) {
  const tokens = stripWikiMarkup(value)
    .toLowerCase()
    .split(/[\s,/]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const mapped = [];
  for (const token of tokens) {
    const mappedToken = TYPE_MAP[token];
    if (mappedToken && !mapped.includes(mappedToken)) {
      mapped.push(mappedToken);
    }
  }
  return mapped.join(' ');
}

function normalizeAbility(value) {
  return stripWikiMarkup(value).toLowerCase();
}

function parseTemplateFields(raw) {
  const lines = raw.split('\n');
  const fields = {};
  for (const line of lines) {
    const m = line.match(/^\|\s*([^=]+?)\s*=\s*(.*)$/);
    if (!m) continue;
    fields[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return fields;
}

function parseAbilities(rawAbility) {
  if (!rawAbility) return [];
  return rawAbility
    .split(',')
    .map((part) => normalizeAbility(part))
    .filter(Boolean);
}

function parseRace(rawRace) {
  const races = stripWikiMarkup(rawRace)
    .toLowerCase()
    .split(/[\s,/]+/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => RACE_MAP[r])
    .filter(Boolean);

  if (races.length > 0) return [...new Set(races)];
  return ['human'];
}

function parseMagic(rawColor) {
  const normalized = stripWikiMarkup(rawColor).toLowerCase();
  return MAGIC_MAP[normalized] || 'plain';
}

function toUnitName(title, titlePrefix) {
  const n = title.replace(`${titlePrefix}:`, '').replace(' (Unit)', '').trim();
  return n;
}

function toStatsTitle(unitName, titlePrefix) {
  return `${titlePrefix}:${unitName.replaceAll(' ', '_')}_(Stats)`;
}

function parseUnitFromFields(fields, fallbackName) {
  const name = stripWikiMarkup(fields.name) || fallbackName;
  const unit = {
    name,
    magic: parseMagic(fields.color || ''),
    race: parseRace(fields.race || ''),
    power: parseNumber(fields.power),
    hp: parseNumber(fields.hp),
    a1_power: parseNumber(fields.ap),
    a1_type: normalizeAttackTypes(fields.type || ''),
    a1_init: parseNumber(fields.init),
    counter: parseNumber(fields.counter),
    a2_power: parseNumber(fields.xap),
    a2_type: normalizeAttackTypes(fields.xtype || ''),
    a2_init: parseNumber(fields.xinit),
    spell_resistance: {
      ascendant: 0,
      verdant: 0,
      eradication: 0,
      nether: 0,
      phantasm: 0
    },
    resistances: {
      missile: 0,
      fire: 0,
      poison: 0,
      breath: 0,
      magic: 0,
      melee: 0,
      ranged: 0,
      lightning: 0,
      cold: 0,
      paralyse: 0,
      psychic: 0,
      holy: 0
    },
    abilities: parseAbilities(fields.ability || '')
  };

  for (const [wikiKey, targetKey] of Object.entries(SPELL_RESIST_MAP)) {
    unit.spell_resistance[targetKey] = parseNumber(fields[wikiKey], 0);
  }

  for (const rk of RESISTANCE_KEYS) {
    unit.resistances[rk] = parseNumber(fields[rk], 0);
  }

  return unit;
}

function stableStringify(value) {
  return JSON.stringify(value);
}

function buildDiff(oldUnit, newUnit) {
  const diffs = [];
  for (const k of Object.keys(newUnit)) {
    const before = stableStringify(oldUnit[k]);
    const after = stableStringify(newUnit[k]);
    if (before !== after) {
      diffs.push(k);
    }
  }
  return diffs;
}

async function fetchUnitNames(categoryTitle, titlePrefix) {
  const names = new Set();
  let cmcontinue = null;

  do {
    const url = toApiUrl({
      action: 'query',
      list: 'categorymembers',
      cmtitle: categoryTitle,
      cmlimit: 'max',
      format: 'json',
      ...(cmcontinue ? { cmcontinue } : {})
    });
    const body = await httpGet(url);
    const payload = JSON.parse(body);
    const members = payload?.query?.categorymembers || [];
    for (const member of members) {
      if (!String(member.title).startsWith(`${titlePrefix}:`)) continue;
      names.add(toUnitName(member.title, titlePrefix));
    }
    cmcontinue = payload?.continue?.cmcontinue || null;
  } while (cmcontinue);

  return [...names].sort((a, b) => a.localeCompare(b));
}

async function fetchUnitStats(unitName, titlePrefix) {
  const statsTitle = toStatsTitle(unitName, titlePrefix);
  const url = `https://wiki.the-reincarnation.org/index.php?title=${encodeURIComponent(statsTitle)}&action=raw`;
  let raw = await httpGet(url);
  if (raw.toLowerCase().includes(`disable on ${titlePrefix.toLowerCase()} server`)) {
    const historicalRaw = await fetchHistoricalStatsRaw(statsTitle);
    if (historicalRaw) {
      raw = historicalRaw;
    } else {
      throw new DisabledUnitError(unitName, titlePrefix);
    }
  }
  if (!raw.includes('UnitBaseStats')) {
    throw new Error(`No UnitBaseStats template found for ${unitName}`);
  }
  const fields = parseTemplateFields(raw);
  return parseUnitFromFields(fields, unitName);
}

async function main() {
  const datasetArg = process.argv.find((arg) => arg.startsWith('--dataset='));
  const datasetName = datasetArg ? datasetArg.replace('--dataset=', '') : 'guild';
  const dataset = DATASETS[datasetName];
  if (!dataset) {
    throw new Error(`Unknown dataset "${datasetName}". Valid options: ${Object.keys(DATASETS).join(', ')}`);
  }

  const outputPathArg = process.argv.find((arg) => arg.startsWith('--output='));
  const outputPath = outputPathArg
    ? path.resolve(ROOT_DIR, outputPathArg.replace('--output=', ''))
    : dataset.defaultOutputPath;

  const rawJson = fs.readFileSync(outputPath, 'utf8');
  const existingUnits = JSON.parse(rawJson);
  const existingByName = new Map(existingUnits.map((u) => [u.name, u]));

  console.log(`Loaded ${existingUnits.length} local units from ${outputPath}`);
  const unitNames = (await fetchUnitNames(dataset.categoryTitle, dataset.titlePrefix))
    .filter((name) => !dataset.ignoredUnits.has(name));
  console.log(`Fetched ${unitNames.length} ${dataset.titlePrefix} unit titles from wiki (after ignore list)`);

  const fetchedUnits = [];
  const fetchErrors = [];
  const disabledUnits = [];
  for (const unitName of unitNames) {
    try {
      const unit = await fetchUnitStats(unitName, dataset.titlePrefix);
      fetchedUnits.push(unit);
    } catch (error) {
      if (error instanceof DisabledUnitError) {
        disabledUnits.push(unitName);
      } else {
        fetchErrors.push({ unitName, error: String(error) });
      }
    }
  }

  if (fetchErrors.length > 0) {
    console.log(`Warnings: failed to parse ${fetchErrors.length} unit stats pages`);
    for (const e of fetchErrors.slice(0, 30)) {
      console.log(`  - ${e.unitName}: ${e.error}`);
    }
  }
  if (disabledUnits.length > 0) {
    console.log(`Skipped ${disabledUnits.length} disabled units on ${dataset.titlePrefix}: ${disabledUnits.join(', ')}`);
  }

  const fetchedByName = new Map(fetchedUnits.map((u) => [u.name, u]));
  const missingInLocal = fetchedUnits.filter((u) => !existingByName.has(u.name)).map((u) => u.name);
  const missingOnWiki = existingUnits
    .filter((u) => !fetchedByName.has(u.name) && !dataset.ignoredUnits.has(u.name))
    .map((u) => u.name);

  const changed = [];
  for (const unit of fetchedUnits) {
    if (!existingByName.has(unit.name)) continue;
    const oldUnit = existingByName.get(unit.name);
    const diffFields = buildDiff(oldUnit, unit);
    if (diffFields.length > 0) {
      changed.push({ name: unit.name, diffFields });
    }
  }

  const mergedByName = new Map(
    existingUnits
      .filter((u) => unitNames.includes(u.name) || dataset.ignoredUnits.has(u.name))
      .map((u) => [u.name, u])
  );
  for (const unit of fetchedUnits) {
    mergedByName.set(unit.name, unit);
  }

  const updatedUnits = [...mergedByName.values()].sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(outputPath, `${JSON.stringify(updatedUnits, null, 4)}\n`, 'utf8');

  console.log(`\nSync report`);
  console.log(`- Wiki units parsed: ${fetchedUnits.length}`);
  console.log(`- Added locally: ${missingInLocal.length}`);
  console.log(`- Updated locally: ${changed.length}`);
  console.log(`- Local-only units (not on wiki list): ${missingOnWiki.length}`);

  if (missingInLocal.length > 0) {
    console.log('\nAdded units:');
    for (const n of missingInLocal) console.log(`  - ${n}`);
  }
  if (changed.length > 0) {
    console.log('\nUpdated units (fields changed):');
    for (const c of changed.slice(0, 60)) {
      console.log(`  - ${c.name}: ${c.diffFields.join(', ')}`);
    }
    if (changed.length > 60) {
      console.log(`  ... and ${changed.length - 60} more`);
    }
  }
  if (missingOnWiki.length > 0) {
    console.log('\nLocal-only units:');
    for (const n of missingOnWiki) console.log(`  - ${n}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
