// Greedy roster optimizer — fills most-constrained slots first.
// DH is eligible for UT only (not named position slots).

const SLOT_ORDER = [
  { slot: 'C',  eligible: p => p.type === 'hitter' && p.positions.includes('C') },
  { slot: 'SS', eligible: p => p.type === 'hitter' && p.positions.includes('SS') },
  { slot: '2B', eligible: p => p.type === 'hitter' && p.positions.includes('2B') },
  { slot: '3B', eligible: p => p.type === 'hitter' && p.positions.includes('3B') },
  { slot: '1B', eligible: p => p.type === 'hitter' && p.positions.includes('1B') },
  { slot: 'OF', eligible: p => p.type === 'hitter' && p.positions.includes('OF') },
  { slot: 'SP', eligible: p => p.type === 'pitcher' && p.positions.includes('SP') },
  { slot: 'RP', eligible: p => p.type === 'pitcher' && p.positions.includes('RP') },
  { slot: 'P',  eligible: p => p.type === 'pitcher' && (p.positions.includes('SP') || p.positions.includes('RP')) },
  { slot: 'UT', eligible: p => p.type === 'hitter' }, // any batter, including DH
  { slot: 'BN', eligible: () => true },
];

/**
 * @param {Array<object>} players — rostered players, each with PlayerId, type, positions[], Dollars, price, and stat fields
 * @param {object} rosterSlots — { C:1, '1B':1, ... }
 * @returns {{ assignments: Array<{player, slot}>, bench: Array<{player, slot}>, totalStartingValue: number }}
 */
export function optimizeRoster(players, rosterSlots) {
  // Sort descending by Dollars so best players fill starting slots first
  const sorted = [...players].sort((a, b) => (b.Dollars || 0) - (a.Dollars || 0));
  const assigned = new Set();
  const assignments = [];
  const bench = [];

  for (const slotDef of SLOT_ORDER) {
    const count = rosterSlots[slotDef.slot] ?? 0;
    for (let i = 0; i < count; i++) {
      const player = sorted.find(p => !assigned.has(p.PlayerId) && slotDef.eligible(p));
      if (!player) break;
      assigned.add(player.PlayerId);
      if (slotDef.slot === 'BN') {
        bench.push({ player, slot: 'BN' });
      } else {
        assignments.push({ player, slot: slotDef.slot });
      }
    }
  }

  return {
    assignments,
    bench,
    totalStartingValue: assignments.reduce((sum, { player }) => sum + (player.Dollars || 0), 0),
  };
}
