import { useMemo } from 'react';
import { useDraft } from '../context/DraftContext';
import { ROSTER_POSITIONS } from '../utils/positions';

const RELATIVE       = 0.20; // for computeTiers (PlayerPool badges) — vs lower player's value
const RANGE_RELATIVE = 0.10; // for buildPositionTiers (Scarcity) — vs position's dollar range
const MIN_ABS        = 1;

export function getPlayersForPosition(allPlayers, pos) {
  if (pos === 'SP' || pos === 'RP') {
    return allPlayers.filter(p => p.type === 'pitcher' && p.positions.includes(pos));
  }
  return allPlayers.filter(p => p.type === 'hitter' && p.positions.includes(pos));
}

// For PlayerPool tier badges — compares each gap to the lower player's value.
function findBreakpoints(sorted) {
  const pts = [];
  for (let i = 1; i < sorted.length; i++) {
    const absDrop = sorted[i - 1].Dollars - sorted[i].Dollars;
    const relDrop  = absDrop / Math.max(1, sorted[i].Dollars);
    if (absDrop > MIN_ABS && relDrop > RELATIVE) {
      pts.push((sorted[i - 1].Dollars + sorted[i].Dollars) / 2);
    }
  }
  return pts;
}

// For Scarcity position tiers — compares each gap to the position's total dollar range,
// so the threshold scales correctly whether a position has 12 or 60 starters.
export function findPositionBreakpoints(sorted) {
  if (sorted.length < 2) return [];
  const totalRange = Math.max(1, sorted[0].Dollars - sorted[sorted.length - 1].Dollars);
  const pts = [];
  for (let i = 1; i < sorted.length; i++) {
    const absDrop = sorted[i - 1].Dollars - sorted[i].Dollars;
    if (absDrop > MIN_ABS && absDrop / totalRange > RANGE_RELATIVE) {
      pts.push((sorted[i - 1].Dollars + sorted[i].Dollars) / 2);
    }
  }
  return pts;
}

// Splits a sorted startable list into labeled tiers with available/total counts.
function buildPositionTiers(startable, draftedPlayerIds) {
  const sorted = [...startable].sort((a, b) => b.Dollars - a.Dollars);
  const breakpoints = findPositionBreakpoints(sorted);
  const numTiers = breakpoints.length + 1;

  return Array.from({ length: numTiers }, (_, i) => {
    const high = i === 0               ? Infinity  : breakpoints[i - 1];
    const low  = i === numTiers - 1    ? -Infinity : breakpoints[i];
    const players = sorted.filter(p =>
      (high === Infinity || p.Dollars <= high) && (low === -Infinity || p.Dollars > low)
    );
    const available = players.filter(p => !draftedPlayerIds.has(p.PlayerId)).length;
    const total     = players.length;
    const maxD = Math.round(Math.max(...players.map(p => p.Dollars)));
    const minD = Math.round(Math.min(...players.map(p => p.Dollars)));
    const label = i === 0 ? `$${minD}+` : `$${minD}–$${maxD}`;
    return { available, total, label, maxDollars: high, minDollars: low };
  });
}

// Used by PlayerPool for per-player tier badges.
export function computeTiers(players) {
  const sorted = [...players].sort((a, b) => b.Dollars - a.Dollars);
  const breakpoints = findBreakpoints(sorted);
  const tierOf = new Map();
  for (const p of sorted) {
    tierOf.set(p.PlayerId, breakpoints.filter(bp => p.Dollars <= bp).length);
  }
  return { tierOf };
}

const GREEN = 'var(--color-pos)';
const AMBER = 'var(--color-warn)';
const RED   = 'var(--color-neg)';

function pressureColor(valueDelta) {
  if (Math.abs(valueDelta) < 0.5) return null;
  return valueDelta < 0 ? GREEN : AMBER;
}

export default function Scarcity({ onTierClick, activeTier }) {
  const { config, allPlayers, picks, draftedPlayerIds } = useDraft();

  const picksMap = useMemo(() => {
    const map = new Map();
    picks.forEach(p => map.set(p.playerId, p));
    return map;
  }, [picks]);

  const cols = useMemo(() => {
    if (!config) return [];
    return ROSTER_POSITIONS.map(pos => {
      const threshold = config.numTeams * (config.rosterSlots[pos] || 0);
      const posPlayers = getPlayersForPosition(allPlayers, pos);
      const startable  = [...posPlayers].sort((a, b) => b.Dollars - a.Dollars).slice(0, threshold);
      const drafted    = startable.filter(p => draftedPlayerIds.has(p.PlayerId));

      const estDollarsDrafted = drafted.reduce((s, p) => s + p.Dollars, 0);
      const paidSoFar = drafted.reduce((s, p) => {
        const pick = picksMap.get(p.PlayerId);
        return s + (pick ? pick.price : 0);
      }, 0);
      const valueDelta = paidSoFar - estDollarsDrafted;
      const pct        = estDollarsDrafted > 0 ? Math.round((valueDelta / estDollarsDrafted) * 100) : null;
      const tiers      = threshold > 0 ? buildPositionTiers(startable, draftedPlayerIds) : [];

      return { pos, tiers, valueDelta, pct, draftedCount: drafted.length };
    });
  }, [config, allPlayers, picks, draftedPlayerIds, picksMap]);

  const maxTiers = Math.max(...cols.map(c => c.tiers.length), 0);

  if (!config) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 text-ink">Position Overview</h2>
      <div className="bg-card border border-border rounded-lg p-4 overflow-x-auto">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr>
              <th className="text-left text-ink-faint font-medium pr-4 pb-2 w-16" />
              {cols.map(col => (
                <th key={col.pos} className="text-center text-ink-faint font-medium pb-2 px-1">
                  {col.pos}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-ink-faint pr-4 pb-2 whitespace-nowrap">Market</td>
              {cols.map(col => {
                const bg = col.draftedCount > 0 ? pressureColor(col.valueDelta) : null;
                const hasColor = bg !== null;
                return (
                  <td key={col.pos} className="px-1 pb-2 text-center">
                    {col.draftedCount > 0 && col.pct !== null ? (
                      <span
                        className="px-1.5 py-0.5 rounded font-semibold"
                        style={{ backgroundColor: bg ?? 'transparent', color: hasColor ? 'rgba(0,0,0,0.75)' : 'var(--color-ink-muted)' }}
                      >
                        {(col.pct >= 0 ? '+' : '') + col.pct}%
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
            {Array.from({ length: maxTiers }, (_, i) => (
              <tr key={i}>
                <td className="text-ink-faint pr-4 py-1 whitespace-nowrap">Tier {i + 1}</td>
                {cols.map(col => {
                  const tier = col.tiers[i];
                  if (!tier) return <td key={col.pos} className="px-1 py-1" />;
                  const tierColor = tier.available === 0
                    ? RED
                    : tier.available < tier.total / 2
                      ? AMBER
                      : GREEN;
                  const isActive = activeTier?.pos === col.pos && activeTier?.tierIndex === i;
                  return (
                    <td key={col.pos} className="px-1 py-1">
                      <div
                        className="flex flex-col items-center justify-center rounded px-1 py-0.5 cursor-pointer"
                        style={{
                          backgroundColor: tierColor,
                          outline: isActive ? '2px solid white' : 'none',
                          outlineOffset: '1px',
                        }}
                        onClick={() => onTierClick?.({ pos: col.pos, tierIndex: i, maxDollars: tier.maxDollars, minDollars: tier.minDollars })}
                      >
                        <span className="font-bold leading-tight" style={{ color: 'rgba(0,0,0,0.75)' }}>
                          {tier.available}/{tier.total}
                        </span>
                        <span className="leading-tight" style={{ fontSize: '9px', color: 'rgba(0,0,0,0.55)' }}>
                          {tier.label}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
