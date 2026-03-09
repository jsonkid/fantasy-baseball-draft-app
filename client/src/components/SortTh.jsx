/**
 * Reusable sortable table header cell.
 *
 * Props:
 *   col      — the column key this header represents
 *   label    — display text
 *   left     — left-align text (default: right-align)
 *   active   — whether this column is the current sort column
 *   sortDir  — 'asc' | 'desc'
 *   onSort   — called with `col` when the header is clicked
 */
export default function SortTh({ col, label, left = false, active, sortDir, onSort }) {
  return (
    <th
      className={`px-2 py-2 ${left ? 'text-left' : 'text-right'} cursor-pointer select-none hover:bg-card-alt whitespace-nowrap text-xs font-medium text-ink-faint uppercase tracking-wide`}
      onClick={() => onSort(col)}
    >
      {label}
      {active && <span className="ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
}
