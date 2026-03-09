const express = require('express');
const router = express.Router();
const { readConfig, writeConfig } = require('../utils/fileIO');

// GET /api/config
router.get('/', (req, res) => {
  res.json(readConfig());
});

// POST /api/config — save full config
router.post('/', (req, res) => {
  const current = readConfig();
  const updated = { ...current, ...req.body };
  writeConfig(updated);
  res.json(updated);
});

// POST /api/config/tab — update only lastActiveTab
router.post('/tab', (req, res) => {
  const { lastActiveTab } = req.body;
  const config = readConfig();
  config.lastActiveTab = lastActiveTab;
  writeConfig(config);
  res.json({ ok: true });
});

module.exports = router;
