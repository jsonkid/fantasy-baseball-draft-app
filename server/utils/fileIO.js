const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CONFIG_PATH = path.join(__dirname, '../config.json');

const DEFAULT_CONFIG = {
  hitterFile: './data/batters.csv',
  pitcherFile: './data/pitchers.csv',
  prevDraftFile: '',
  numTeams: 12,
  teamNames: Array.from({ length: 12 }, (_, i) => `Team ${i + 1}`),
  budget: 260,
  rosterSlots: {
    C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1,
    OF: 3, UT: 2, SP: 3, RP: 2, P: 2, BN: 6,
  },
  lastActiveTab: null,
};

function readConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function parseCSV(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(resolved, 'utf-8');
  return parse(raw, { columns: true, trim: true, cast: true });
}

module.exports = { readConfig, writeConfig, parseCSV, DEFAULT_CONFIG, CONFIG_PATH };
