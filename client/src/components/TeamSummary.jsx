import { useMemo, useState } from 'react';
import { useDraft } from '../context/DraftContext';
import { ROSTER_POSITIONS } from '../utils/positions';
import SortTh from './SortTh';

export default function TeamSummary() {
  const { config, teamRosters, teamBudgets, teamLineups } = useDraft();
  const [sortCol, setSortCol] = useState('team');
  const [sortDir, setSortDir] = useState('asc');

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir(col === 'team' ? 'asc' : 'desc'); }
  }

  const rows = useMemo(() => {
    if (!config) return [];
    return config.teamNames.map(name => {
      const budget = teamBudgets[name] || { remaining: 0, spent: 0 };
      const roster = teamRosters[name] || [];
      const lineup = teamLineups[name] || { assignments: [], bench: [] };
      const totalSurplus = roster.reduce((s, p) => s + (p.Dollars - p.price), 0);

      const posSurplus = {};
      for (const pos of ROSTER_POSITIONS) {
        const assigned = lineup.assignments.filter(a => a.slot === pos);
        posSurplus[pos] = assigned.reduce((s, a) => s + (a.player.Dollars - a.player.price), 0);
      }

      return { name, budget, rosterCount: roster.length, totalSurplus, posSurplus };
    });
  }, [config, teamRosters, teamBudgets, teamLineups]);

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    let av, bv;
    switch (sortCol) {
      case 'team':    av = a.name; bv = b.name; break;
      case 'budget':  av = a.budget.remaining; bv = b.budget.remaining; break;
      case 'players': av = a.rosterCount; bv = b.rosterCount; break;
      case 'surplus': av = a.totalSurplus; bv = b.totalSurplus; break;
      default:        av = a.posSurplus[sortCol] ?? 0; bv = b.posSurplus[sortCol] ?? 0;
    }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  }), [rows, sortCol, sortDir]);

  function Th({ col, label, left }) {
    return (
      <SortTh col={col} label={label} left={left}
        active={sortCol === col} sortDir={sortDir} onSort={toggleSort} />
    );
  }

  function surplusColor(v) {
    if (v > 5) return 'text-pos';
    if (v > -5) return 'text-warn';
    return 'text-neg';
  }

  function budgetColor(remaining) {
    if (remaining >= 50) return 'text-pos';
    if (remaining >= 10) return 'text-warn';
    return 'text-neg font-bold';
  }

  if (!config) return null;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Team Summary</h2>
      <p className="text-sm text-ink-muted mb-4">Remaining budget, roster size, and projected value (projected $ minus price paid) by team and position.</p>
      <div className="overflow-x-auto border border-border rounded-lg bg-card">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-card-alt border-b border-border">
              <Th col="team"    label="Team"    left />
              <Th col="budget"  label="$ Left"  />
              <Th col="players" label="Players" />
              <Th col="surplus" label="Value" />
              {ROSTER_POSITIONS.map(pos => <Th key={pos} col={pos} label={pos} />)}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.name} className="border-b border-border-light hover:bg-card-alt transition-colors">
                <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                <td className={`px-3 py-2 text-right font-mono ${budgetColor(row.budget.remaining)}`}>
                  ${row.budget.remaining}
                </td>
                <td className="px-3 py-2 text-right font-mono text-ink-muted">{row.rosterCount}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${surplusColor(row.totalSurplus)}`}>
                  {row.totalSurplus >= 0 ? '+' : ''}${row.totalSurplus.toFixed(0)}
                </td>
                {ROSTER_POSITIONS.map(pos => {
                  const v = row.posSurplus[pos];
                  const hasPlayer = row.rosterCount > 0;
                  return (
                    <td key={pos} className={`px-3 py-2 text-right font-mono text-sm ${hasPlayer ? surplusColor(v) : 'text-ink-faint'}`}>
                      {hasPlayer ? `${v >= 0 ? '+' : ''}$${v.toFixed(0)}` : '—'}
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
