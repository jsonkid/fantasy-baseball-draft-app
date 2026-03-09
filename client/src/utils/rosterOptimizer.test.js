import { describe, it, expect } from 'vitest';
import { optimizeRoster } from './rosterOptimizer.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function hitter(id, positions, dollars = 10) {
  return { PlayerId: id, type: 'hitter', positions, Dollars: dollars };
}

function pitcher(id, positions, dollars = 10) {
  return { PlayerId: id, type: 'pitcher', positions, Dollars: dollars };
}

const STD_SLOTS = {
  C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1,
  OF: 3, UT: 2, SP: 3, RP: 2, P: 2, BN: 6,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('optimizeRoster', () => {

  // ── Empty / degenerate inputs ──────────────────────────────────────────────

  describe('empty inputs', () => {
    it('returns empty result when no players and no slots', () => {
      const result = optimizeRoster([], {});
      expect(result.assignments).toHaveLength(0);
      expect(result.bench).toHaveLength(0);
      expect(result.totalStartingValue).toBe(0);
    });

    it('returns empty result when players exist but no roster slots defined', () => {
      const result = optimizeRoster([hitter('p1', ['C'], 20)], {});
      expect(result.assignments).toHaveLength(0);
      expect(result.bench).toHaveLength(0);
    });

    it('returns empty result when no players but slots exist', () => {
      const result = optimizeRoster([], { C: 1, '1B': 1 });
      expect(result.assignments).toHaveLength(0);
      expect(result.bench).toHaveLength(0);
      expect(result.totalStartingValue).toBe(0);
    });
  });

  // ── Basic slot assignment ──────────────────────────────────────────────────

  describe('basic slot assignment', () => {
    it('places a catcher in the C slot', () => {
      const result = optimizeRoster([hitter('p1', ['C'], 20)], { C: 1 });
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].slot).toBe('C');
      expect(result.assignments[0].player.PlayerId).toBe('p1');
    });

    it('places an SP in the SP slot', () => {
      const result = optimizeRoster([pitcher('p1', ['SP'], 20)], { SP: 1 });
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].slot).toBe('SP');
    });

    it('places an RP in the RP slot', () => {
      const result = optimizeRoster([pitcher('p1', ['RP'], 20)], { RP: 1 });
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].slot).toBe('RP');
    });

    it('does not place a pitcher in a hitter slot', () => {
      const result = optimizeRoster([pitcher('p1', ['SP'], 20)], { C: 1 });
      expect(result.assignments).toHaveLength(0);
    });

    it('does not place a hitter in a pitcher slot', () => {
      const result = optimizeRoster([hitter('p1', ['C'], 20)], { SP: 1 });
      expect(result.assignments).toHaveLength(0);
    });

    it('fills multiple OF slots', () => {
      const players = [hitter('o1', ['OF'], 30), hitter('o2', ['OF'], 20), hitter('o3', ['OF'], 10)];
      const result = optimizeRoster(players, { OF: 3 });
      expect(result.assignments).toHaveLength(3);
      expect(result.assignments.every(a => a.slot === 'OF')).toBe(true);
    });
  });

  // ── DH eligibility ────────────────────────────────────────────────────────

  describe('DH eligibility', () => {
    it('DH-only player fills UT slot', () => {
      const result = optimizeRoster([hitter('p1', ['DH'], 20)], { UT: 1 });
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].slot).toBe('UT');
    });

    it('DH-only player does NOT fill named position slots (C, 1B, 2B, 3B, SS, OF)', () => {
      const slots = { C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 1 };
      const result = optimizeRoster([hitter('p1', ['DH'], 20)], slots);
      expect(result.assignments).toHaveLength(0);
    });

    it('DH-only player falls through to BN when no UT slot exists', () => {
      const result = optimizeRoster([hitter('p1', ['DH'], 20)], { BN: 1 });
      expect(result.bench).toHaveLength(1);
      expect(result.bench[0].slot).toBe('BN');
      expect(result.assignments).toHaveLength(0);
    });

    it('DH-only player is unplaced when neither UT nor BN slots exist', () => {
      const result = optimizeRoster([hitter('p1', ['DH'], 20)], { OF: 1 });
      expect(result.assignments).toHaveLength(0);
      expect(result.bench).toHaveLength(0);
    });

    it('DH prefers UT over BN when both are available', () => {
      const result = optimizeRoster([hitter('p1', ['DH'], 20)], { UT: 1, BN: 1 });
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].slot).toBe('UT');
      expect(result.bench).toHaveLength(0);
    });
  });

  // ── Dollar-based sorting ──────────────────────────────────────────────────

  describe('highest Dollars player wins contested slot', () => {
    it('places higher-value catcher when two compete for one C slot', () => {
      const players = [hitter('cheap', ['C'], 10), hitter('expensive', ['C'], 30)];
      const result = optimizeRoster(players, { C: 1 });
      expect(result.assignments[0].player.PlayerId).toBe('expensive');
    });

    it('fills slots in Dollars-descending order across multiple slots', () => {
      const players = [
        hitter('low', ['OF'], 5),
        hitter('mid', ['OF'], 20),
        hitter('high', ['OF'], 35),
      ];
      const result = optimizeRoster(players, { OF: 3 });
      const ids = result.assignments.map(a => a.player.PlayerId);
      expect(ids).toContain('high');
      expect(ids).toContain('mid');
      expect(ids).toContain('low');
    });
  });

  // ── SLOT_ORDER priority (most-constrained first) ──────────────────────────

  describe('slot ordering', () => {
    it('SS fills before 2B when player is 2B/SS multi-eligible', () => {
      // SS is more constrained → processed before 2B in SLOT_ORDER
      const p = hitter('p1', ['2B', 'SS'], 20);
      const result = optimizeRoster([p], { SS: 1, '2B': 1 });
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].slot).toBe('SS');
    });

    it('3B fills before 1B when player is 1B/3B multi-eligible', () => {
      const p = hitter('p1', ['1B', '3B'], 20);
      const result = optimizeRoster([p], { '1B': 1, '3B': 1 });
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].slot).toBe('3B');
    });

    it('named hitter slot fills before UT', () => {
      // p1 (1B-eligible) should fill 1B; p2 (OF-only) should fill UT
      const players = [hitter('p1', ['1B'], 20), hitter('p2', ['OF'], 10)];
      const result = optimizeRoster(players, { '1B': 1, UT: 1 });
      const slotFor = id => result.assignments.find(a => a.player.PlayerId === id)?.slot;
      expect(slotFor('p1')).toBe('1B');
      expect(slotFor('p2')).toBe('UT');
    });

    it('SP is processed before RP in SLOT_ORDER', () => {
      // An SP/RP player should land in SP when both slots exist
      const p = pitcher('p1', ['SP', 'RP'], 20);
      const result = optimizeRoster([p], { SP: 1, RP: 1 });
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].slot).toBe('SP');
    });
  });

  // ── Pitcher P-slot overflow ───────────────────────────────────────────────

  describe('pitcher overflow to P slot', () => {
    it('SP players overflow into P slot after SP slots are full', () => {
      const players = [
        pitcher('sp1', ['SP'], 40),
        pitcher('sp2', ['SP'], 30),
        pitcher('sp3', ['SP'], 20),
        pitcher('sp4', ['SP'], 10), // 4th SP: no SP slot left, goes to P
      ];
      const result = optimizeRoster(players, { SP: 3, P: 1 });
      const spSlots = result.assignments.filter(a => a.slot === 'SP');
      const pSlots  = result.assignments.filter(a => a.slot === 'P');
      expect(spSlots).toHaveLength(3);
      expect(pSlots).toHaveLength(1);
      expect(pSlots[0].player.PlayerId).toBe('sp4');
    });

    it('RP players overflow into P slot after RP slots are full', () => {
      const players = [
        pitcher('rp1', ['RP'], 40),
        pitcher('rp2', ['RP'], 30),
        pitcher('rp3', ['RP'], 20), // 3rd RP: overflows to P
      ];
      const result = optimizeRoster(players, { RP: 2, P: 1 });
      const rpSlots = result.assignments.filter(a => a.slot === 'RP');
      const pSlots  = result.assignments.filter(a => a.slot === 'P');
      expect(rpSlots).toHaveLength(2);
      expect(pSlots).toHaveLength(1);
      expect(pSlots[0].player.PlayerId).toBe('rp3');
    });

    it('P slot is filled by the best unassigned pitcher (SP or RP)', () => {
      const players = [
        pitcher('sp1', ['SP'], 40),
        pitcher('sp2', ['SP'], 35),
        pitcher('sp3', ['SP'], 30),
        pitcher('rp1', ['RP'], 25),
        pitcher('rp2', ['RP'], 20),
        pitcher('sp4', ['SP'], 15), // best unassigned pitcher for P
        pitcher('rp3', ['RP'], 10),
      ];
      const result = optimizeRoster(players, { SP: 3, RP: 2, P: 1 });
      const pSlot = result.assignments.find(a => a.slot === 'P');
      expect(pSlot?.player.PlayerId).toBe('sp4');
    });

    it('hitter cannot fill the P slot', () => {
      const players = [hitter('h1', ['1B'], 50), pitcher('p1', ['SP'], 10)];
      const result = optimizeRoster(players, { P: 1 });
      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].player.PlayerId).toBe('p1');
    });
  });

  // ── Bench ─────────────────────────────────────────────────────────────────

  describe('bench (BN slot)', () => {
    it('overflow players go to bench', () => {
      const players = [hitter('p1', ['OF'], 20), hitter('p2', ['OF'], 10)];
      const result = optimizeRoster(players, { OF: 1, BN: 1 });
      expect(result.assignments).toHaveLength(1);
      expect(result.bench).toHaveLength(1);
      expect(result.bench[0].slot).toBe('BN');
    });

    it('bench player is the lower-value overflow player', () => {
      const players = [hitter('high', ['OF'], 30), hitter('low', ['OF'], 10)];
      const result = optimizeRoster(players, { OF: 1, BN: 1 });
      expect(result.bench[0].player.PlayerId).toBe('low');
    });

    it('BN accepts any player type (hitter or pitcher)', () => {
      const players = [pitcher('p1', ['SP'], 20)];
      const result = optimizeRoster(players, { BN: 1 });
      expect(result.bench).toHaveLength(1);
    });

    it('bench players are excluded from totalStartingValue', () => {
      const players = [hitter('p1', ['OF'], 20), hitter('p2', ['OF'], 10)];
      const result = optimizeRoster(players, { OF: 1, BN: 1 });
      expect(result.totalStartingValue).toBe(20);
    });
  });

  // ── No double-placement ───────────────────────────────────────────────────

  describe('no double placement', () => {
    it('multi-eligible player occupies exactly one slot', () => {
      const p = hitter('p1', ['1B', '3B'], 20);
      const result = optimizeRoster([p], { '1B': 1, '3B': 1, UT: 1 });
      const totalPlaced = result.assignments.length + result.bench.length;
      expect(totalPlaced).toBe(1);
    });

    it('player assigned to SS is not also assigned to 2B', () => {
      const p = hitter('p1', ['2B', 'SS'], 20);
      const result = optimizeRoster([p], { SS: 1, '2B': 1 });
      expect(result.assignments).toHaveLength(1); // only one slot filled
    });

    it('player appears in assignments OR bench, never both', () => {
      const p = hitter('p1', ['OF'], 20);
      const result = optimizeRoster([p], { OF: 1, BN: 1 });
      const inAssignments = result.assignments.some(a => a.player.PlayerId === 'p1');
      const inBench = result.bench.some(b => b.player.PlayerId === 'p1');
      // exactly one of the two should be true
      expect(inAssignments !== inBench).toBe(true);
    });
  });

  // ── totalStartingValue ────────────────────────────────────────────────────

  describe('totalStartingValue', () => {
    it('sums Dollars of all non-bench starters', () => {
      const players = [hitter('p1', ['C'], 15), hitter('p2', ['1B'], 10)];
      const result = optimizeRoster(players, { C: 1, '1B': 1 });
      expect(result.totalStartingValue).toBeCloseTo(25);
    });

    it('treats missing Dollars field as 0', () => {
      const p = { PlayerId: 'p1', type: 'hitter', positions: ['C'] }; // no Dollars
      const result = optimizeRoster([p], { C: 1 });
      expect(result.totalStartingValue).toBe(0);
    });

    it('is 0 when all players are on the bench', () => {
      const result = optimizeRoster([hitter('p1', ['C'], 20)], { BN: 1 });
      expect(result.totalStartingValue).toBe(0);
      expect(result.bench).toHaveLength(1);
    });

    it('handles negative Dollars values', () => {
      const players = [hitter('p1', ['C'], 10), hitter('p2', ['1B'], -5)];
      const result = optimizeRoster(players, { C: 1, '1B': 1 });
      expect(result.totalStartingValue).toBeCloseTo(5);
    });
  });

  // ── Full standard roster ──────────────────────────────────────────────────

  describe('full standard roster', () => {
    it('fills all standard slot counts correctly with a complete roster', () => {
      const players = [
        hitter('c1',   ['C'],       35),
        hitter('ss1',  ['SS'],      32),
        hitter('2b1',  ['2B'],      28),
        hitter('3b1',  ['3B'],      25),
        hitter('1b1',  ['1B'],      22),
        hitter('of1',  ['OF'],      30),
        hitter('of2',  ['OF'],      27),
        hitter('of3',  ['OF'],      24),
        hitter('ut1',  ['1B'],      18), // fills UT (1B already taken)
        hitter('ut2',  ['OF'],      15), // fills UT (OF slots taken)
        hitter('bn1',  ['OF'],      12),
        hitter('bn2',  ['2B'],      10),
        hitter('bn3',  ['C'],        8),
        hitter('bn4',  ['SS'],       6),
        hitter('bn5',  ['DH'],       5),
        hitter('bn6',  ['3B'],       4),
        pitcher('sp1', ['SP'],      40),
        pitcher('sp2', ['SP'],      36),
        pitcher('sp3', ['SP'],      31),
        pitcher('rp1', ['RP'],      20),
        pitcher('rp2', ['RP'],      18),
        pitcher('p1',  ['SP'],      14), // overflows to P
        pitcher('p2',  ['RP'],      12), // overflows to P
        pitcher('bp1', ['SP'],      10),
        pitcher('bp2', ['SP'],       8),
        pitcher('bp3', ['RP'],       6),
      ];

      const result = optimizeRoster(players, STD_SLOTS);
      const slotNames = result.assignments.map(a => a.slot);

      expect(slotNames.filter(s => s === 'C')).toHaveLength(1);
      expect(slotNames.filter(s => s === 'SS')).toHaveLength(1);
      expect(slotNames.filter(s => s === '2B')).toHaveLength(1);
      expect(slotNames.filter(s => s === '3B')).toHaveLength(1);
      expect(slotNames.filter(s => s === '1B')).toHaveLength(1);
      expect(slotNames.filter(s => s === 'OF')).toHaveLength(3);
      expect(slotNames.filter(s => s === 'UT')).toHaveLength(2);
      expect(slotNames.filter(s => s === 'SP')).toHaveLength(3);
      expect(slotNames.filter(s => s === 'RP')).toHaveLength(2);
      expect(slotNames.filter(s => s === 'P')).toHaveLength(2);
      expect(result.bench.filter(b => b.slot === 'BN')).toHaveLength(6);
    });

    it('highest-value players fill starting slots, lowest go to bench', () => {
      // Three OF players competing for 3 OF slots + 1 BN slot
      const players = [
        hitter('of_high', ['OF'], 30),
        hitter('of_mid',  ['OF'], 20),
        hitter('of_low',  ['OF'], 10),
        hitter('of_bench',['OF'],  5), // lowest, should be benched
      ];
      const result = optimizeRoster(players, { OF: 3, BN: 1 });
      const starterIds = result.assignments.map(a => a.player.PlayerId);
      const benchIds   = result.bench.map(b => b.player.PlayerId);
      expect(starterIds).toContain('of_high');
      expect(starterIds).toContain('of_mid');
      expect(starterIds).toContain('of_low');
      expect(benchIds).toContain('of_bench');
    });
  });
});
