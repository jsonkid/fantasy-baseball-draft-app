import { useState } from 'react';
import { DraftProvider, useDraft } from './context/DraftContext';
import ConfigPage from './components/ConfigPage';
import PlayerPool from './components/PlayerPool';
import Scarcity from './components/Scarcity';
import TeamSummary from './components/TeamSummary';
import Standings from './components/Standings';

const TABS = [
  { id: 'config',    label: 'Config' },
  { id: 'players',   label: 'Player Pool' },
  { id: 'teams',     label: 'Teams' },
  { id: 'standings', label: 'Standings' },
];

function NavBar() {
  const { config, setActiveTab } = useDraft();
  const current = config?.lastActiveTab;

  return (
    <nav className="bg-card px-6 flex items-stretch gap-1 border-b border-border">
      <span className="font-bold text-base mr-6 flex items-center text-accent tracking-tight">Draft Board</span>
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            current === tab.id
              ? 'text-accent border-b-2 border-accent'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

const PITCHER_POSITIONS = new Set(['SP', 'RP']);

function PlayersTab() {
  const [tierFilter, setTierFilter] = useState(null);
  const { dispatch } = useDraft();

  function handleTierClick(tier) {
    const isToggleOff = tierFilter?.pos === tier.pos && tierFilter?.tierIndex === tier.tierIndex;
    if (isToggleOff) {
      setTierFilter(null);
      dispatch({ type: 'SET_POSITION_FILTER', payload: 'ALL' });
      dispatch({ type: 'SET_TYPE_FILTER', payload: 'ALL' });
    } else {
      setTierFilter(tier);
      dispatch({ type: 'SET_POSITION_FILTER', payload: tier.pos });
      dispatch({ type: 'SET_TYPE_FILTER', payload: PITCHER_POSITIONS.has(tier.pos) ? 'pitchers' : 'batters' });
    }
  }

  function handleClearTierFilter() {
    setTierFilter(null);
    dispatch({ type: 'SET_POSITION_FILTER', payload: 'ALL' });
    dispatch({ type: 'SET_TYPE_FILTER', payload: 'ALL' });
  }

  return (
    <>
      <Scarcity onTierClick={handleTierClick} activeTier={tierFilter} />
      <div className="mt-8">
        <PlayerPool tierFilter={tierFilter} onClearTierFilter={handleClearTierFilter} />
      </div>
    </>
  );
}

function AppContent() {
  const { config, loading, error } = useDraft();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-muted text-sm">
        Loading projections…
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 p-4 bg-card border border-neg/50 rounded text-neg text-sm">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  const tab = config?.lastActiveTab;

  return (
    <div className="min-h-screen bg-surface">
      <NavBar />
      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        {(!tab || tab === 'config') && <ConfigPage />}
        {tab === 'players' && <PlayersTab />}
        {tab === 'teams' && <TeamSummary />}
        {tab === 'standings' && <Standings />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <DraftProvider>
      <AppContent />
    </DraftProvider>
  );
}
