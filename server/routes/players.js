const express = require('express');
const router = express.Router();
const { readConfig, parseCSV } = require('../utils/fileIO');

function mapPlayer(type) {
  return row => ({
    ...row,
    Name: String(row.Name || '').trim(),
    NameASCII: String(row.NameASCII || '').trim(),
    Team: String(row.Team || '').trim(),
    PlayerId: String(row.PlayerId),
    positions: String(row.POS || '').trim().split('/').map(p => p.trim()),
    type,
  });
}

// GET /api/players
router.get('/', (req, res) => {
  try {
    const config = readConfig();
    const hitters = parseCSV(config.hitterFile).map(mapPlayer('hitter'));
    const pitchers = parseCSV(config.pitcherFile).map(mapPlayer('pitcher'));
    res.json({ hitters, pitchers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
