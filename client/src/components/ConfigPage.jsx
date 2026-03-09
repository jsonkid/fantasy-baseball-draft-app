import { useState, useEffect } from 'react';
import { useDraft } from '../context/DraftContext';
import { SLOT_KEYS } from '../utils/positions';

export default function ConfigPage() {
  const { config, keeperWarnings, saveConfig, reloadPlayers, setActiveTab } = useDraft();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config && !form) setForm({ ...config, rosterSlots: { ...config.rosterSlots } });
  }, [config]);

  if (!form) return null;

  function handleTeamCountChange(n) {
    const count = Math.max(1, Math.min(30, Number(n)));
    const newNames = Array.from({ length: count }, (_, i) => form.teamNames[i] ?? `Team ${i + 1}`);
    setForm(f => ({ ...f, numTeams: count, teamNames: newNames }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const pathsChanged =
        form.hitterFile !== config.hitterFile ||
        form.pitcherFile !== config.pitcherFile;
      await saveConfig(form);
      if (pathsChanged) await reloadPlayers();
      setSaved(true);
      // Navigate to player pool if this was first launch (config was null-tabbed)
      if (!config.lastActiveTab) await setActiveTab('players');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-ink">Configuration</h1>

      {keeperWarnings?.length > 0 && (
        <div className="bg-accent-dim border border-accent/40 rounded-lg p-4 mb-6">
          <p className="font-semibold text-warn mb-1">Keeper Warning</p>
          <p className="text-ink-muted text-sm mb-2">
            The following players from the previous draft file could not be matched to current projections:
          </p>
          <ul className="list-disc list-inside text-ink-muted text-sm space-y-0.5">
            {keeperWarnings.map(name => <li key={name}>{name}</li>)}
          </ul>
        </div>
      )}

      {/* Data Files */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold mb-3 text-ink-faint uppercase tracking-wide">Data Files</h2>
        <div className="space-y-3 bg-card border border-border rounded-lg p-4">
          {[
            { label: 'Batter projections', key: 'hitterFile' },
            { label: 'Pitcher projections', key: 'pitcherFile' },
            { label: 'Keepers (optional)', key: 'prevDraftFile' },
          ].map(({ label, key }) => (
            <label key={key} className="block">
              <span className="text-sm text-ink-muted">{label}</span>
              <input
                className="mt-1 block w-full border border-border bg-card-alt text-ink rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
      </section>

      {/* League Settings */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold mb-3 text-ink-faint uppercase tracking-wide">League Settings</h2>
        <div className="grid grid-cols-2 gap-4 bg-card border border-border rounded-lg p-4">
          <label className="block">
            <span className="text-sm text-ink-muted">Number of teams</span>
            <input
              type="number" min={1} max={30}
              className="mt-1 block w-full border border-border bg-card-alt text-ink rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              value={form.numTeams}
              onChange={e => handleTeamCountChange(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink-muted">Budget per team ($)</span>
            <input
              type="number" min={1}
              className="mt-1 block w-full border border-border bg-card-alt text-ink rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              value={form.budget}
              onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))}
            />
          </label>
        </div>
      </section>

      {/* Team Names */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold mb-3 text-ink-faint uppercase tracking-wide">Team Names</h2>
        <div className="grid grid-cols-2 gap-2 bg-card border border-border rounded-lg p-4">
          {form.teamNames.map((name, i) => (
            <input
              key={i}
              className="border border-border bg-card-alt text-ink rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              value={name}
              onChange={e => {
                const newNames = [...form.teamNames];
                newNames[i] = e.target.value;
                setForm(f => ({ ...f, teamNames: newNames }));
              }}
            />
          ))}
        </div>
      </section>

      {/* Roster Slots */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold mb-3 text-ink-faint uppercase tracking-wide">Roster Slots</h2>
        <div className="grid grid-cols-4 gap-3 bg-card border border-border rounded-lg p-4">
          {SLOT_KEYS.map(slot => (
            <label key={slot} className="block">
              <span className="text-sm text-ink-muted">{slot}</span>
              <input
                type="number" min={0}
                className="mt-1 block w-full border border-border bg-card-alt text-ink rounded px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                value={form.rosterSlots[slot] ?? 0}
                onChange={e => setForm(f => ({
                  ...f,
                  rosterSlots: { ...f.rosterSlots, [slot]: Number(e.target.value) },
                }))}
              />
            </label>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-accent text-surface px-6 py-2 rounded font-medium hover:bg-amber-400 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Configuration'}
        </button>
        {saved && <span className="text-pos text-sm">Saved ✓</span>}
      </div>
    </div>
  );
}
