import { useState, useMemo } from 'react';
import { useDraft } from '../context/DraftContext';
import { ROSTER_POSITIONS } from '../utils/positions';

function getPlayersForPosition(allPlayers, pos) {
  if (pos === 'SP' || pos === 'RP') {
    return allPlayers.filter(p => p.type === 'pitcher' && p.positions.includes(pos));
  }
  return allPlayers.filter(p => p.type === 'hitter' && p.positions.includes(pos));
}

const GREEN = 'var(--color-pos)';
const AMBER = 'var(--color-warn)';

function startersColor(startersLeft) {
  return startersLeft === 0 ? AMBER : GREEN;
}

function pressureColor(valueDelta) {
  if (Math.abs(valueDelta) < 0.5) return null; // neutral
  return valueDelta > 0 ? GREEN : AMBER;
}

function pricePressureText(d) {
  if (d.draftedCount === 0) return 'no picks yet';
  if (d.pct === null || Math.abs(d.pct) < 1) return 'roughly at expected value';
  if (d.pct < 0) return `going for ${Math.abs(d.pct)}% over expected`;
  return `${d.pct}% below expected`;
}

export default function Scarcity() {
  const { config, allPlayers, picks, draftedPlayerIds } = useDraft();
  const [hoveredPos, setHoveredPos] = useState(null);

  const picksMap = useMemo(() => {
    const map = new Map();
    picks.forEach(p => map.set(p.playerId, p));
    return map;
  }, [picks]);

  const data = useMemo(() => {
    if (!config) return [];
    return ROSTER_POSITIONS.map(pos => {
      const threshold = config.numTeams * (config.rosterSlots[pos] || 0);
      const posPlayers = getPlayersForPosition(allPlayers, pos);
      const startable = [...posPlayers].sort((a, b) => b.Dollars - a.Dollars).slice(0, threshold);
      const undrafted = startable.filter(p => !draftedPlayerIds.has(p.PlayerId));
      const drafted = startable.filter(p => draftedPlayerIds.has(p.PlayerId));
      const estDollarsDrafted = drafted.reduce((s, p) => s + p.Dollars, 0);
      const paidSoFar = drafted.reduce((s, p) => {
        const pick = picksMap.get(p.PlayerId);
        return s + (pick ? pick.price : 0);
      }, 0);
      const valueDelta = estDollarsDrafted - paidSoFar;
      const pct = estDollarsDrafted > 0 ? Math.round((valueDelta / estDollarsDrafted) * 100) : null;
      return {
        pos,
        startersLeft: undrafted.length,
        total: threshold,
        valueDelta,
        pct,
        draftedCount: drafted.length,
      };
    });
  }, [config, allPlayers, picks, draftedPlayerIds, picksMap]);

  if (!config) return null;

  const hoveredIdx = hoveredPos != null ? ROSTER_POSITIONS.indexOf(hoveredPos) : -1;
  const hovered = hoveredIdx >= 0 ? data[hoveredIdx] : null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 text-ink">Position Overview</h2>
      <div className="bg-card border border-border rounded-lg p-4">

        <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(8, 1fr)', gap: '3px' }}>

          {/* Header */}
          <div />
          {data.map(d => (
            <div key={d.pos} className="text-center text-xs font-mono font-medium text-ink-faint pb-1">
              {d.pos}
            </div>
          ))}

          {/* Starters Left */}
          <div className="flex items-center pr-4 text-xs text-ink-muted whitespace-nowrap">
            Starters Left
          </div>
          {data.map(d => (
            <div
              key={d.pos}
              className="h-10 rounded flex items-center justify-center cursor-default transition-opacity"
              style={{
                backgroundColor: startersColor(d.startersLeft),
                opacity: hoveredPos && hoveredPos !== d.pos ? 0.35 : 1,
              }}
              onMouseEnter={() => setHoveredPos(d.pos)}
              onMouseLeave={() => setHoveredPos(null)}
            >
              <span className="text-xs font-mono font-semibold" style={{ color: 'rgba(0,0,0,0.7)' }}>
                {d.startersLeft}
              </span>
            </div>
          ))}

          {/* Price Pressure */}
          <div className="flex items-center pr-4 text-xs text-ink-muted whitespace-nowrap">
            Value
          </div>
          {data.map(d => {
            const bg = d.draftedCount > 0 ? pressureColor(d.valueDelta) : null;
            const hasColor = bg !== null;
            return (
              <div
                key={d.pos}
                className="h-10 rounded flex items-center justify-center cursor-default transition-opacity"
                style={{
                  backgroundColor: bg ?? 'var(--color-card-alt)',
                  opacity: hoveredPos && hoveredPos !== d.pos ? 0.35 : 1,
                }}
                onMouseEnter={() => setHoveredPos(d.pos)}
                onMouseLeave={() => setHoveredPos(null)}
              >
                {d.draftedCount > 0 && d.pct !== null ? (
                  <span
                    className="text-xs font-mono font-semibold"
                    style={{ color: hasColor ? 'rgba(0,0,0,0.7)' : undefined }}
                  >
                    {(d.pct >= 0 ? '+' : '') + d.pct}%
                  </span>
                ) : (
                  <span className="text-xs font-mono font-semibold text-ink-faint">—</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Detail strip */}
        <div className="mt-3 h-9">
          {hovered ? (
            <div className="h-full bg-card-alt border border-border-light rounded px-4 flex items-center gap-6">
              <span className="text-sm font-semibold text-ink w-8 shrink-0">{hovered.pos}</span>
              <span className="text-xs text-ink-muted">
                {hovered.startersLeft} of {hovered.total} starters remain
              </span>
              <span className="text-xs text-ink-muted">
                {pricePressureText(hovered)}
              </span>
            </div>
          ) : (
            <div className="h-full flex items-center">
              <span className="text-xs text-ink-faint">Hover a position for details</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
