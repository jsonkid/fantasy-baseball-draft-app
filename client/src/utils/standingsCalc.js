export const STAT_CATEGORIES = [
  { key: 'mR',     label: 'R',    higherIsBetter: true,  playerType: 'hitter' },
  { key: 'mHR',    label: 'HR',   higherIsBetter: true,  playerType: 'hitter' },
  { key: 'mRBI',   label: 'RBI',  higherIsBetter: true,  playerType: 'hitter' },
  { key: 'mSB',    label: 'SB',   higherIsBetter: true,  playerType: 'hitter' },
  { key: 'mOBP',   label: 'OBP',  higherIsBetter: true,  playerType: 'hitter' },
  { key: 'mSO',    label: 'K',    higherIsBetter: true,  playerType: 'pitcher' },
  { key: 'mW',     label: 'W',    higherIsBetter: true,  playerType: 'pitcher' },
  { key: 'mQS',    label: 'QS',   higherIsBetter: true,  playerType: 'pitcher' },
  { key: 'mSVHLD', label: 'SVHD', higherIsBetter: true,  playerType: 'pitcher' },
  { key: 'mERA',   label: 'ERA',  higherIsBetter: false, playerType: 'pitcher' },
  { key: 'mWHIP',  label: 'WHIP', higherIsBetter: false, playerType: 'pitcher' },
];

function rankWithTies(entries, higherIsBetter) {
  // entries: [{ name, value }, ...]
  const sorted = [...entries].sort((a, b) =>
    higherIsBetter ? b.value - a.value : a.value - b.value
  );
  const result = {};
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length && sorted[j].value === sorted[i].value) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) result[sorted[k].name] = avgRank;
    i = j;
  }
  return result;
}

/**
 * @param {object} teamLineups — { [teamName]: { assignments: [{player, slot}], bench: [] } }
 * @returns {Array<{ teamName, stats, ranks, avgStanding }>}
 */
export function calculateStandings(teamLineups) {
  const teamNames = Object.keys(teamLineups);
  if (teamNames.length === 0) return [];

  // Step 1: sum stats per team (starters only)
  const teamStats = {};
  for (const teamName of teamNames) {
    const lineup = teamLineups[teamName] || { assignments: [] };
    teamStats[teamName] = {};
    for (const cat of STAT_CATEGORIES) {
      teamStats[teamName][cat.key] = lineup.assignments
        .filter(({ player }) => player.type === cat.playerType)
        .reduce((sum, { player }) => sum + (Number(player[cat.key]) || 0), 0);
    }
  }

  // Step 2: rank with tie-splitting
  const teamRanks = {};
  teamNames.forEach(name => { teamRanks[name] = {}; });
  for (const cat of STAT_CATEGORIES) {
    const entries = teamNames.map(name => ({ name, value: teamStats[name][cat.key] }));
    const ranks = rankWithTies(entries, cat.higherIsBetter);
    for (const name of teamNames) {
      teamRanks[name][cat.key] = ranks[name];
    }
  }

  // Step 3: average standing
  return teamNames.map(name => ({
    teamName: name,
    stats: teamStats[name],
    ranks: teamRanks[name],
    avgStanding: STAT_CATEGORIES.reduce((sum, cat) => sum + teamRanks[name][cat.key], 0) / STAT_CATEGORIES.length,
  }));
}
