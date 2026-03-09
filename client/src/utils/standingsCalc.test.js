import { describe, it, expect } from 'vitest';
import { calculateStandings, STAT_CATEGORIES } from './standingsCalc.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a hitter player object with default zeroes for all hitter stats */
function hitterPlayer(id, stats = {}) {
  return {
    PlayerId: id,
    type: 'hitter',
    mR: 0, mHR: 0, mRBI: 0, mSB: 0, mOBP: 0,
    ...stats,
  };
}

/** Create a pitcher player object with default zeroes for all pitcher stats */
function pitcherPlayer(id, stats = {}) {
  return {
    PlayerId: id,
    type: 'pitcher',
    mSO: 0, mW: 0, mQS: 0, mSVHLD: 0, mERA: 0, mWHIP: 0,
    ...stats,
  };
}

/** Wrap player objects into a lineup with assignments (bench omitted) */
function lineup(...players) {
  return {
    assignments: players.map((player, i) => ({ player, slot: `SLOT${i}` })),
  };
}

/** Full-stat hitter — useful for single-team "all ranks = 1" assertions */
const FULL_HITTER = hitterPlayer('fh', { mR: 100, mHR: 30, mRBI: 80, mSB: 15, mOBP: 50 });
/** Full-stat pitcher — useful for single-team "all ranks = 1" assertions */
const FULL_PITCHER = pitcherPlayer('fp', { mSO: 180, mW: 14, mQS: 20, mSVHLD: 8, mERA: 3.2, mWHIP: 1.1 });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('calculateStandings', () => {

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns an empty array when no teams are provided', () => {
      expect(calculateStandings({})).toEqual([]);
    });

    it('single team receives rank 1 for all categories', () => {
      const result = calculateStandings({ 'Team A': lineup(FULL_HITTER, FULL_PITCHER) });
      expect(result).toHaveLength(1);
      for (const cat of STAT_CATEGORIES) {
        expect(result[0].ranks[cat.key]).toBe(1);
      }
    });

    it('single team has avgStanding of 1', () => {
      const result = calculateStandings({ 'Team A': lineup(FULL_HITTER, FULL_PITCHER) });
      expect(result[0].avgStanding).toBe(1);
    });

    it('team with no players gets 0 for all stats', () => {
      const result = calculateStandings({ Empty: { assignments: [] } });
      for (const cat of STAT_CATEGORIES) {
        expect(result[0].stats[cat.key]).toBe(0);
      }
    });
  });

  // ── Higher-is-better categories ────────────────────────────────────────────

  describe('ranking — higher is better (R, HR, RBI, SB, OBP, K, W, QS, SVHD)', () => {
    it('team with more R gets rank 1', () => {
      const lineups = {
        A: lineup(hitterPlayer('h1', { mR: 120 })),
        B: lineup(hitterPlayer('h2', { mR: 80 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mR).toBe(1);
      expect(result.find(r => r.teamName === 'B').ranks.mR).toBe(2);
    });

    it('team with more HR gets rank 1', () => {
      const lineups = {
        A: lineup(hitterPlayer('h1', { mHR: 45 })),
        B: lineup(hitterPlayer('h2', { mHR: 22 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mHR).toBe(1);
      expect(result.find(r => r.teamName === 'B').ranks.mHR).toBe(2);
    });

    it('team with more SB gets rank 1', () => {
      const lineups = {
        A: lineup(hitterPlayer('h1', { mSB: 40 })),
        B: lineup(hitterPlayer('h2', { mSB: 10 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mSB).toBe(1);
    });

    it('team with more strikeouts (mSO) gets rank 1', () => {
      const lineups = {
        A: lineup(pitcherPlayer('p1', { mSO: 220 })),
        B: lineup(pitcherPlayer('p2', { mSO: 150 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mSO).toBe(1);
    });

    it('three teams ranked correctly (no ties)', () => {
      const lineups = {
        A: lineup(hitterPlayer('h1', { mR: 150 })),
        B: lineup(hitterPlayer('h2', { mR: 100 })),
        C: lineup(hitterPlayer('h3', { mR: 50 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mR).toBe(1);
      expect(result.find(r => r.teamName === 'B').ranks.mR).toBe(2);
      expect(result.find(r => r.teamName === 'C').ranks.mR).toBe(3);
    });
  });

  // ── Lower-is-better categories ─────────────────────────────────────────────

  describe('ranking — lower is better (ERA, WHIP)', () => {
    it('team with lower ERA gets rank 1', () => {
      const lineups = {
        A: lineup(pitcherPlayer('p1', { mERA: 3.0 })),
        B: lineup(pitcherPlayer('p2', { mERA: 4.5 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mERA).toBe(1);
      expect(result.find(r => r.teamName === 'B').ranks.mERA).toBe(2);
    });

    it('team with lower WHIP gets rank 1', () => {
      const lineups = {
        A: lineup(pitcherPlayer('p1', { mWHIP: 1.0 })),
        B: lineup(pitcherPlayer('p2', { mWHIP: 1.5 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mWHIP).toBe(1);
      expect(result.find(r => r.teamName === 'B').ranks.mWHIP).toBe(2);
    });

    it('three teams ranked in ERA ascending order', () => {
      const lineups = {
        A: lineup(pitcherPlayer('p1', { mERA: 2.5 })),
        B: lineup(pitcherPlayer('p2', { mERA: 3.5 })),
        C: lineup(pitcherPlayer('p3', { mERA: 5.0 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mERA).toBe(1);
      expect(result.find(r => r.teamName === 'B').ranks.mERA).toBe(2);
      expect(result.find(r => r.teamName === 'C').ranks.mERA).toBe(3);
    });
  });

  // ── Tie-splitting ──────────────────────────────────────────────────────────

  describe('tie-splitting', () => {
    it('two-way tie: both teams share rank 1.5', () => {
      const lineups = {
        A: lineup(hitterPlayer('h1', { mR: 100 })),
        B: lineup(hitterPlayer('h2', { mR: 100 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mR).toBe(1.5);
      expect(result.find(r => r.teamName === 'B').ranks.mR).toBe(1.5);
    });

    it('three-way tie: all teams share rank 2  (avg of 1+2+3)', () => {
      const lineups = {
        A: lineup(hitterPlayer('h1', { mR: 100 })),
        B: lineup(hitterPlayer('h2', { mR: 100 })),
        C: lineup(hitterPlayer('h3', { mR: 100 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mR).toBe(2);
      expect(result.find(r => r.teamName === 'B').ranks.mR).toBe(2);
      expect(result.find(r => r.teamName === 'C').ranks.mR).toBe(2);
    });

    it('top two tied, clear third: tied pair gets 1.5, third gets 3', () => {
      const lineups = {
        A: lineup(hitterPlayer('h1', { mR: 100 })),
        B: lineup(hitterPlayer('h2', { mR: 100 })),
        C: lineup(hitterPlayer('h3', { mR: 50 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mR).toBe(1.5);
      expect(result.find(r => r.teamName === 'B').ranks.mR).toBe(1.5);
      expect(result.find(r => r.teamName === 'C').ranks.mR).toBe(3);
    });

    it('clear first, bottom two tied: leader gets 1, tied pair gets 2.5', () => {
      const lineups = {
        A: lineup(hitterPlayer('h1', { mR: 150 })),
        B: lineup(hitterPlayer('h2', { mR: 100 })),
        C: lineup(hitterPlayer('h3', { mR: 100 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mR).toBe(1);
      expect(result.find(r => r.teamName === 'B').ranks.mR).toBe(2.5);
      expect(result.find(r => r.teamName === 'C').ranks.mR).toBe(2.5);
    });

    it('two-way tie in ERA (lower is better): both share rank 1.5', () => {
      const lineups = {
        A: lineup(pitcherPlayer('p1', { mERA: 3.0 })),
        B: lineup(pitcherPlayer('p2', { mERA: 3.0 })),
        C: lineup(pitcherPlayer('p3', { mERA: 4.5 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').ranks.mERA).toBe(1.5);
      expect(result.find(r => r.teamName === 'B').ranks.mERA).toBe(1.5);
      expect(result.find(r => r.teamName === 'C').ranks.mERA).toBe(3);
    });
  });

  // ── Stat accumulation ──────────────────────────────────────────────────────

  describe('stat accumulation', () => {
    it('sums R across multiple hitters on the same team', () => {
      const lineups = {
        A: lineup(
          hitterPlayer('h1', { mR: 80 }),
          hitterPlayer('h2', { mR: 70 }),
        ),
        B: lineup(hitterPlayer('h3', { mR: 100 })),
      };
      const result = calculateStandings(lineups);
      const a = result.find(r => r.teamName === 'A');
      expect(a.stats.mR).toBe(150); // 80 + 70
      expect(a.ranks.mR).toBe(1);   // 150 > 100 → rank 1
    });

    it('sums SO across multiple pitchers on the same team', () => {
      const lineups = {
        A: lineup(
          pitcherPlayer('p1', { mSO: 120 }),
          pitcherPlayer('p2', { mSO: 80 }),
        ),
        B: lineup(pitcherPlayer('p3', { mSO: 150 })),
      };
      const result = calculateStandings(lineups);
      const a = result.find(r => r.teamName === 'A');
      expect(a.stats.mSO).toBe(200); // 120 + 80
      expect(a.ranks.mSO).toBe(1);   // 200 > 150 → rank 1
    });

    it('hitter stats do not count toward pitcher categories', () => {
      // A hitter with mSO set should be filtered out for pitcher-category ranking
      const lineups = {
        A: lineup(hitterPlayer('h1', { mSO: 9999 })), // mSO on a hitter — ignored
        B: lineup(pitcherPlayer('p1', { mSO: 100 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').stats.mSO).toBe(0);
      expect(result.find(r => r.teamName === 'B').stats.mSO).toBe(100);
    });

    it('pitcher stats do not count toward hitter categories', () => {
      const lineups = {
        A: lineup(pitcherPlayer('p1', { mR: 9999 })), // mR on a pitcher — ignored
        B: lineup(hitterPlayer('h1', { mR: 100 })),
      };
      const result = calculateStandings(lineups);
      expect(result.find(r => r.teamName === 'A').stats.mR).toBe(0);
    });

    it('missing stat fields default to 0', () => {
      const playerNoStats = { PlayerId: 'px', type: 'hitter', positions: ['C'] };
      const result = calculateStandings({ A: lineup(playerNoStats) });
      expect(result[0].stats.mR).toBe(0);
    });
  });

  // ── Bench exclusion ────────────────────────────────────────────────────────

  describe('bench exclusion', () => {
    it('bench players do not contribute to team stats', () => {
      const starterH = hitterPlayer('starter', { mR: 80 });
      const benchH   = hitterPlayer('bench',   { mR: 9999 }); // bench — must be ignored
      const lineups = {
        A: {
          assignments: [{ player: starterH, slot: 'OF' }],
          bench:       [{ player: benchH,   slot: 'BN' }],
        },
        B: lineup(hitterPlayer('h_b', { mR: 100 })),
      };
      const result = calculateStandings(lineups);
      // Team A's mR should be 80 (starter only), not 9999+80 from bench
      expect(result.find(r => r.teamName === 'A').stats.mR).toBe(80);
    });

    it('bench pitcher does not inflate pitcher stats', () => {
      const starterP = pitcherPlayer('sp', { mSO: 150 });
      const benchP   = pitcherPlayer('bp', { mSO: 9999 });
      const lineups = {
        A: {
          assignments: [{ player: starterP, slot: 'SP' }],
          bench:       [{ player: benchP,   slot: 'BN' }],
        },
      };
      const result = calculateStandings(lineups);
      expect(result[0].stats.mSO).toBe(150);
    });
  });

  // ── avgStanding ────────────────────────────────────────────────────────────

  describe('avgStanding', () => {
    it('equals exactly 1 when there is only one team', () => {
      const result = calculateStandings({ A: lineup(FULL_HITTER, FULL_PITCHER) });
      expect(result[0].avgStanding).toBe(1);
    });

    it('is the mean of all 11 category ranks', () => {
      const lineups = {
        A: lineup(FULL_HITTER, FULL_PITCHER),
        B: lineup(FULL_HITTER, FULL_PITCHER), // identical stats → all ties → all rank 1.5
      };
      const result = calculateStandings(lineups);
      for (const row of result) {
        const expectedAvg =
          STAT_CATEGORIES.reduce((sum, cat) => sum + row.ranks[cat.key], 0) /
          STAT_CATEGORIES.length;
        expect(row.avgStanding).toBeCloseTo(expectedAvg);
      }
    });

    it('lower avgStanding reflects better overall ranking', () => {
      // A dominates every hitter and pitcher category
      const lineups = {
        A: lineup(
          hitterPlayer('ah', { mR: 200, mHR: 50, mRBI: 150, mSB: 40, mOBP: 80 }),
          pitcherPlayer('ap', { mSO: 300, mW: 20, mQS: 30, mSVHLD: 15, mERA: 2.0, mWHIP: 0.9 }),
        ),
        B: lineup(
          hitterPlayer('bh', { mR: 50, mHR: 10, mRBI: 40, mSB: 5, mOBP: 20 }),
          pitcherPlayer('bp', { mSO: 80, mW: 5, mQS: 8, mSVHLD: 3, mERA: 5.5, mWHIP: 1.6 }),
        ),
      };
      const result = calculateStandings(lineups);
      const avgA = result.find(r => r.teamName === 'A').avgStanding;
      const avgB = result.find(r => r.teamName === 'B').avgStanding;
      expect(avgA).toBeLessThan(avgB);
    });
  });

  // ── Result structure ───────────────────────────────────────────────────────

  describe('result structure', () => {
    it('returns one entry per team', () => {
      const lineups = {
        A: lineup(FULL_HITTER),
        B: lineup(FULL_HITTER),
        C: lineup(FULL_HITTER),
      };
      const result = calculateStandings(lineups);
      expect(result).toHaveLength(3);
      const names = result.map(r => r.teamName).sort();
      expect(names).toEqual(['A', 'B', 'C']);
    });

    it('each entry has teamName, stats, ranks, and avgStanding properties', () => {
      const result = calculateStandings({ A: lineup(FULL_HITTER) });
      expect(result[0]).toHaveProperty('teamName');
      expect(result[0]).toHaveProperty('stats');
      expect(result[0]).toHaveProperty('ranks');
      expect(result[0]).toHaveProperty('avgStanding');
    });

    it('ranks object has a key for every STAT_CATEGORY', () => {
      const result = calculateStandings({ A: lineup(FULL_HITTER, FULL_PITCHER) });
      for (const cat of STAT_CATEGORIES) {
        expect(result[0].ranks).toHaveProperty(cat.key);
        expect(typeof result[0].ranks[cat.key]).toBe('number');
      }
    });

    it('stats object has a key for every STAT_CATEGORY', () => {
      const result = calculateStandings({ A: lineup(FULL_HITTER, FULL_PITCHER) });
      for (const cat of STAT_CATEGORIES) {
        expect(result[0].stats).toHaveProperty(cat.key);
      }
    });

    it('teamName matches the key provided in teamLineups', () => {
      const result = calculateStandings({ 'My Awesome Team': lineup(FULL_HITTER) });
      expect(result[0].teamName).toBe('My Awesome Team');
    });
  });

  // ── STAT_CATEGORIES export ─────────────────────────────────────────────────

  describe('STAT_CATEGORIES export', () => {
    it('exports exactly 11 categories', () => {
      expect(STAT_CATEGORIES).toHaveLength(11);
    });

    it('includes the expected category keys', () => {
      const keys = STAT_CATEGORIES.map(c => c.key);
      expect(keys).toContain('mR');
      expect(keys).toContain('mHR');
      expect(keys).toContain('mRBI');
      expect(keys).toContain('mSB');
      expect(keys).toContain('mOBP');
      expect(keys).toContain('mSO');
      expect(keys).toContain('mW');
      expect(keys).toContain('mQS');
      expect(keys).toContain('mSVHLD');
      expect(keys).toContain('mERA');
      expect(keys).toContain('mWHIP');
    });

    it('ERA and WHIP have higherIsBetter = false', () => {
      const era  = STAT_CATEGORIES.find(c => c.key === 'mERA');
      const whip = STAT_CATEGORIES.find(c => c.key === 'mWHIP');
      expect(era.higherIsBetter).toBe(false);
      expect(whip.higherIsBetter).toBe(false);
    });

    it('all non-ERA/WHIP categories have higherIsBetter = true', () => {
      const offensive = STAT_CATEGORIES.filter(c => !['mERA', 'mWHIP'].includes(c.key));
      expect(offensive.every(c => c.higherIsBetter === true)).toBe(true);
    });
  });
});
