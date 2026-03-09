import { useState, useMemo } from 'react';
import { useDraft } from '../context/DraftContext';
import { STAT_CATEGORIES } from '../utils/standingsCalc';
import SortTh from './SortTh';

// 7-step value label: 3 overvalued + neutral + 3 undervalued, opacity increases away from neutral.
// Returns { label, bg } or null for neutral.
function valuePill(diff) {
  if (diff <= -25) return { label: 'overvalued',  bg: 'rgba(251,191,36,0.90)' };
  if (diff <= -15) return { label: 'overvalued',  bg: 'rgba(251,191,36,0.60)' };
  if (diff <=  -5) return { label: 'overvalued',  bg: 'rgba(251,191,36,0.30)' };
  if (diff <    5) return null; // neutral
  if (diff <   15) return { label: 'undervalued', bg: 'rgba(52,211,153,0.30)' };
  if (diff <   25) return { label: 'undervalued', bg: 'rgba(52,211,153,0.60)' };
                   return { label: 'undervalued', bg: 'rgba(52,211,153,0.90)' };
}

const HITTER_STAT_COLS  = STAT_CATEGORIES.filter(c => c.playerType === 'hitter');
const PITCHER_STAT_COLS = STAT_CATEGORIES.filter(c => c.playerType === 'pitcher');

const HITTER_POSITIONS = ['ALL', 'C', '1B', '2B', '3B', 'SS', 'OF', 'DH'];
const PITCHER_POSITIONS = ['ALL', 'SP', 'RP'];
const ALL_POSITIONS     = ['ALL', 'C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'SP', 'RP'];

function positionsForType(typeFilter) {
  if (typeFilter === 'batters')  return HITTER_POSITIONS;
  if (typeFilter === 'pitchers') return PITCHER_POSITIONS;
  return ALL_POSITIONS;
}

// ── Draft Modal ────────────────────────────────────────────────────────────

function DraftModal({ player, onClose }) {
  const { config, teamBudgets, teamRosters, totalRosterSlots, draftPlayer } = useDraft();
  const [selectedTeam, setSelectedTeam] = useState(config.teamNames[0]);
  const [price, setPrice] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const teamInfo = config.teamNames.map(name => {
    const budget = teamBudgets[name] || { remaining: 0 };
    const rosterCount = (teamRosters[name] || []).length;
    const emptySlots = totalRosterSlots - rosterCount;
    // Max bid: keep $1 for each remaining empty slot after this pick
    const maxBid = emptySlots <= 1 ? budget.remaining : budget.remaining - (emptySlots - 1);
    return { name, remaining: budget.remaining, rosterCount, emptySlots, maxBid };
  });

  const sel = teamInfo.find(t => t.name === selectedTeam) || teamInfo[0];
  const maxBid = Math.max(1, sel.maxBid);
  const priceErr = price < 1 ? 'Minimum $1' : price > maxBid ? `Maximum $${maxBid}` : null;

  async function handleDraft() {
    if (priceErr || submitting) return;
    setSubmitting(true);
    try {
      await draftPlayer(player.PlayerId, player.Name, player.type, selectedTeam, price);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-ink">{player.Name}</h2>
          <p className="text-sm text-ink-muted">
            {player.positions.join('/')} · {player.Team || 'FA'} · Est.&nbsp;
            <span className={player.Dollars >= 0 ? 'text-pos' : 'text-neg'}>
              ${player.Dollars.toFixed(1)}
            </span>
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-ink">Team</span>
            <select
              className="mt-1 block w-full border border-border bg-card-alt text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              value={selectedTeam}
              onChange={e => { setSelectedTeam(e.target.value); setPrice(1); }}
            >
              {teamInfo.map(t => (
                <option key={t.name} value={t.name} disabled={t.emptySlots === 0 || t.remaining < 1}>
                  {t.name} (${t.remaining} left{t.emptySlots === 0 ? ' — FULL' : ''})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink">Price</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-ink-muted">$</span>
              <input
                type="number" min={1} max={maxBid}
                className={`block w-full border rounded-lg px-3 py-2 text-sm bg-card-alt text-ink focus:outline-none focus:ring-1 focus:ring-accent ${priceErr ? 'border-neg' : 'border-border'}`}
                value={price}
                onChange={e => setPrice(Number(e.target.value))}
                onKeyDown={e => e.key === 'Enter' && handleDraft()}
              />
            </div>
            {priceErr
              ? <p className="text-neg text-xs mt-1">{priceErr}</p>
              : <p className="text-ink-muted text-xs mt-1">Max bid: ${maxBid}</p>
            }
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleDraft}
            disabled={!!priceErr || submitting}
            className="flex-1 bg-accent text-surface py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? 'Drafting…' : 'Draft'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-border text-ink-muted py-2 rounded-lg font-medium hover:bg-card-alt transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PlayerPool ─────────────────────────────────────────────────────────────

export default function PlayerPool() {
  const {
    hitters, pitchers, draftedPlayerIds, picks,
    undoLastPick,
    searchTerm, positionFilter, typeFilter, sortColumn, sortDirection,
    dispatch,
  } = useDraft();

  const [draftTarget, setDraftTarget] = useState(null);

  // Rank all players by Dollars descending (stable — from full pool, not filtered).
  // Deduplicate by PlayerId first (e.g. two-way players appear in both lists) keeping
  // the higher-Dollars entry so their rank reflects their best projection.
  const dollarRanks = useMemo(() => {
    const best = new Map();
    [...hitters, ...pitchers].forEach(p => {
      if (!best.has(p.PlayerId) || p.Dollars > best.get(p.PlayerId).Dollars) {
        best.set(p.PlayerId, p);
      }
    });
    const sorted = [...best.values()].sort((a, b) => b.Dollars - a.Dollars);
    const map = new Map();
    sorted.forEach((p, i) => map.set(p.PlayerId, i + 1));
    return map;
  }, [hitters, pitchers]);

  const showHitterCols = typeFilter !== 'pitchers';
  const showPitcherCols = typeFilter !== 'batters';
  const statCols = [...(showHitterCols ? HITTER_STAT_COLS : []), ...(showPitcherCols ? PITCHER_STAT_COLS : [])];

  const availablePlayers = useMemo(() => {
    let players = [...hitters, ...pitchers].filter(p => !draftedPlayerIds.has(p.PlayerId));

    if (typeFilter === 'batters') players = players.filter(p => p.type === 'hitter');
    if (typeFilter === 'pitchers') players = players.filter(p => p.type === 'pitcher');
    if (positionFilter !== 'ALL') players = players.filter(p => p.positions.includes(positionFilter));

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      players = players.filter(p =>
        p.Name.toLowerCase().includes(term) || p.NameASCII.toLowerCase().includes(term)
      );
    }

    players.sort((a, b) => {
      const av = a[sortColumn] ?? '';
      const bv = b[sortColumn] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDirection === 'desc' ? bv - av : av - bv;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDirection === 'desc' ? -cmp : cmp;
    });

    return players;
  }, [hitters, pitchers, draftedPlayerIds, typeFilter, positionFilter, searchTerm, sortColumn, sortDirection]);

  const lastPick = picks[picks.length - 1];

  function Th({ col, label, left }) {
    return (
      <SortTh col={col} label={label} left={left}
        active={sortColumn === col} sortDir={sortDirection}
        onSort={col => dispatch({ type: 'SET_SORT', payload: col })} />
    );
  }

  return (
    <div>
      {draftTarget && <DraftModal player={draftTarget} onClose={() => setDraftTarget(null)} />}

      <h2 className="text-lg font-semibold mb-3 text-ink">Available Players</h2>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Search players…"
          className="border border-border bg-card text-ink placeholder:text-ink-faint rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-1 focus:ring-accent"
          value={searchTerm}
          onChange={e => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
        />
        <select
          className="border border-border bg-card text-ink rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          value={typeFilter}
          onChange={e => {
            const next = e.target.value;
            dispatch({ type: 'SET_TYPE_FILTER', payload: next });
            // Reset position if it's no longer valid for the new type
            if (!positionsForType(next).includes(positionFilter)) {
              dispatch({ type: 'SET_POSITION_FILTER', payload: 'ALL' });
            }
          }}
        >
          <option value="ALL">All players</option>
          <option value="batters">Batters only</option>
          <option value="pitchers">Pitchers only</option>
        </select>
        <select
          className="border border-border bg-card text-ink rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          value={positionFilter}
          onChange={e => dispatch({ type: 'SET_POSITION_FILTER', payload: e.target.value })}
        >
          {positionsForType(typeFilter).map(p => (
            <option key={p} value={p}>{p === 'ALL' ? 'All positions' : p}</option>
          ))}
        </select>
        <span className="text-sm text-ink-muted ml-auto">{availablePlayers.length} available</span>
        {lastPick && (
          <button
            onClick={undoLastPick}
            className="text-sm border border-warn text-warn px-3 py-1.5 rounded-lg hover:bg-card-alt transition-colors"
            title="Undo last pick"
          >
            ↩ Undo: {lastPick.playerName} ({lastPick.team}, ${lastPick.price})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[calc(100vh-18rem)] border border-border rounded-lg bg-card">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-card-alt border-b border-border">
              <Th col="Name" label="Name" left />
              <Th col="Team" label="Team" left />
              <th className="px-2 py-2 text-left text-xs font-medium text-ink-faint uppercase tracking-wide">POS</th>
              <Th col="Dollars" label="$" />
              <th className="px-2 py-2 text-left text-xs font-medium text-ink-faint uppercase tracking-wide">Value</th>
              {statCols.map(c => <Th key={c.key} col={c.key} label={c.label} />)}
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {availablePlayers.map((player, i) => (
              <tr
                key={player.PlayerId}
                className={`border-b border-border-light hover:bg-[#1e2a3a] transition-colors ${i % 2 === 1 ? 'bg-card-alt' : 'bg-card'}`}
              >
                <td className="px-2 py-1.5 font-medium whitespace-nowrap text-ink">
                  {player.Name}
                  <span className={`ml-1.5 text-xs px-1 py-0.5 rounded font-normal ${
                    player.type === 'hitter' ? 'bg-[#162036] text-accent' : 'bg-[#0d2318] text-pos'
                  }`}>
                    {player.type === 'hitter' ? 'H' : 'P'}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-ink-muted text-sm">{player.Team || '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {player.positions.map(pos => (
                    <span key={pos} className="inline-block mr-0.5 px-1.5 py-0.5 text-xs rounded bg-card-alt text-ink-muted border border-border-light">
                      {pos}
                    </span>
                  ))}
                </td>
                <td className={`px-2 py-1.5 text-right font-mono font-semibold ${
                  player.Dollars >= 0 ? 'text-pos' : 'text-neg'
                }`}>
                  ${player.Dollars.toFixed(1)}
                </td>
                <td className="px-2 py-1.5">
                  {(() => {
                    const dollarRank = dollarRanks.get(player.PlayerId);
                    const adp = player.ADP;
                    if (!adp || !dollarRank) return null;
                    const pill = valuePill(adp - dollarRank);
                    if (!pill) return null;
                    return (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                        style={{ backgroundColor: pill.bg, color: 'rgba(0,0,0,0.7)' }}>
                        {pill.label}
                      </span>
                    );
                  })()}
                </td>
                {statCols.map(c => (
                  <td key={c.key} className="px-2 py-1.5 text-right font-mono text-ink-muted text-sm">
                    {player[c.key] != null ? Number(player[c.key]).toFixed(1) : <span className="text-ink-faint">—</span>}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right">
                  <button
                    onClick={() => setDraftTarget(player)}
                    className="px-2.5 py-0.5 text-xs bg-accent text-surface rounded hover:opacity-90 transition-opacity font-semibold"
                  >
                    Draft
                  </button>
                </td>
              </tr>
            ))}
            {availablePlayers.length === 0 && (
              <tr>
                <td colSpan={5 + statCols.length + 1} className="px-4 py-8 text-center text-ink-muted text-sm">
                  No players match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
