import { useState, useMemo, useEffect } from 'react';
import { useDraft } from '../context/DraftContext';
import { STAT_CATEGORIES } from '../utils/standingsCalc';
import SortTh from './SortTh';

export default function Standings() {
  const { standings, config, picks } = useDraft();
  const [sortCol, setSortCol] = useState('avgStanding');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    setSortCol('avgStanding');
    setSortDir('asc');
  }, [picks.length]);

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const numTeams = config?.numTeams || 12;

  const sorted = useMemo(() => [...standings].sort((a, b) => {
    const av = sortCol === 'avgStanding' ? a.avgStanding : (a.ranks[sortCol] ?? 99);
    const bv = sortCol === 'avgStanding' ? b.avgStanding : (b.ranks[sortCol] ?? 99);
    return sortDir === 'asc' ? av - bv : bv - av;
  }), [standings, sortCol, sortDir]);

  function rankColor(rank) {
    const third = numTeams / 3;
    if (rank <= third) return 'text-pos';
    if (rank <= 2 * third) return 'text-warn';
    return 'text-neg';
  }

  function Th({ col, label }) {
    return (
      <SortTh col={col} label={label}
        active={sortCol === col} sortDir={sortDir} onSort={toggleSort} />
    );
  }

  if (standings.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">Projected Standings</h2>
        <p className="text-sm text-ink-muted">Draft some players to see projected standings.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Projected Standings</h2>
      <p className="text-sm text-ink-muted mb-4">
        Based on drafted starters only. Ties split.
      </p>
      <div className="overflow-x-auto border border-border rounded-lg bg-card">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-card-alt border-b border-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-ink-faint uppercase tracking-wide">Team</th>
              {STAT_CATEGORIES.map(cat => <Th key={cat.key} col={cat.key} label={cat.label} />)}
              <Th col="avgStanding" label="Avg" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.teamName} className="border-b border-border-light hover:bg-card-alt transition-colors">
                <td className="px-3 py-2 font-medium text-ink">{row.teamName}</td>
                {STAT_CATEGORIES.map(cat => {
                  const rank = row.ranks[cat.key];
                  return (
                    <td key={cat.key} className={`px-2 py-2 text-right font-mono text-xs rounded ${rank != null ? rankColor(rank) : ''}`}>
                      {rank != null ? (numTeams + 1 - rank).toFixed(1) : '—'}
                    </td>
                  );
                })}
                <td className={`px-2 py-2 text-right font-mono text-xs font-bold rounded ${rankColor(row.avgStanding)}`}>
                  {(numTeams + 1 - row.avgStanding).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
