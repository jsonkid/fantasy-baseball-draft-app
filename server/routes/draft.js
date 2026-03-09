const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
const { readConfig, parseCSV } = require('../utils/fileIO');

const STATE_PATH = path.join(__dirname, '../draft_state.json');
const RESULTS_PATH = path.resolve(process.cwd(), './data/draft_results.csv');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { picks: [] };
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

function writeDraftResults(picks) {
  const dir = path.dirname(RESULTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const csv = stringify(picks, {
    header: true,
    columns: ['Name', 'Type', 'Team', 'Price', 'Timestamp'],
  });
  fs.writeFileSync(RESULTS_PATH, csv, 'utf-8');
}

function picksToCSVRows(picks) {
  return picks.map(p => ({
    Name: p.playerName,
    Type: p.type,
    Team: p.team,
    Price: p.price,
    Timestamp: p.timestamp,
  }));
}

// GET /api/draft
router.get('/', (req, res) => {
  res.json(readState());
});

// POST /api/draft/pick
router.post('/pick', (req, res) => {
  const { playerId, playerName, type, team, price } = req.body;
  const state = readState();
  state.picks.push({
    playerId: String(playerId),
    playerName: String(playerName),
    type: String(type),
    team: String(team),
    price: Number(price),
    timestamp: new Date().toISOString(),
  });
  writeState(state);
  writeDraftResults(picksToCSVRows(state.picks));
  res.json(state);
});

// DELETE /api/draft/pick — undo last pick
router.delete('/pick', (req, res) => {
  const state = readState();
  if (state.picks.length > 0) {
    state.picks.pop();
    writeState(state);
    writeDraftResults(picksToCSVRows(state.picks));
  }
  res.json(state);
});

// POST /api/draft/load-keepers
router.post('/load-keepers', (req, res) => {
  try {
    const config = readConfig();
    if (!config.prevDraftFile) {
      return res.json({ matched: [], unmatched: [] });
    }

    // Build name lookup from current projections
    const allPlayers = [];
    try {
      const hitters = parseCSV(config.hitterFile).map(r => ({
        PlayerId: String(r.PlayerId),
        Name: String(r.Name || '').trim(),
        NameASCII: String(r.NameASCII || '').trim(),
        type: 'hitter',
      }));
      allPlayers.push(...hitters);
    } catch { /* hitter file may not exist */ }

    try {
      const pitchers = parseCSV(config.pitcherFile).map(r => ({
        PlayerId: String(r.PlayerId),
        Name: String(r.Name || '').trim(),
        NameASCII: String(r.NameASCII || '').trim(),
        type: 'pitcher',
      }));
      allPlayers.push(...pitchers);
    } catch { /* pitcher file may not exist */ }

    // Build normalized name → player map (try both Name and NameASCII)
    const nameToPlayer = new Map();
    allPlayers.forEach(p => {
      nameToPlayer.set(p.Name.toLowerCase(), p);
      nameToPlayer.set(p.NameASCII.toLowerCase(), p);
    });

    // Parse previous draft CSV
    const prevPicks = parseCSV(config.prevDraftFile);
    const matched = [];
    const unmatched = [];

    prevPicks.forEach(row => {
      const name = String(row.Name || '').trim();
      const found = nameToPlayer.get(name.toLowerCase());
      if (found) {
        matched.push({
          playerId: found.PlayerId,
          playerName: found.Name,
          type: found.type,
          team: String(row.Team || '').trim(),
          price: Number(row.Price) || 1,
          timestamp: row.Timestamp || new Date().toISOString(),
        });
      } else {
        unmatched.push(name);
      }
    });

    // Merge matched keepers into draft state (avoid duplicates by playerId)
    if (matched.length > 0) {
      const state = readState();
      const existingIds = new Set(state.picks.map(p => p.playerId));
      const newKeepers = matched.filter(m => !existingIds.has(m.playerId));
      state.picks = [...newKeepers, ...state.picks];
      writeState(state);
      writeDraftResults(picksToCSVRows(state.picks));
    }

    res.json({ matched, unmatched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
