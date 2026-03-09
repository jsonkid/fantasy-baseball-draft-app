import React, { createContext, useContext, useReducer, useMemo, useEffect } from 'react';
import { optimizeRoster } from '../utils/rosterOptimizer';
import { calculateStandings } from '../utils/standingsCalc';

const DraftContext = createContext(null);

const initialState = {
  config: null,
  hitters: [],
  pitchers: [],
  picks: [],
  keeperWarnings: [],
  loading: true,
  error: null,
  // Player pool UI state
  searchTerm: '',
  positionFilter: 'ALL',
  typeFilter: 'ALL',
  sortColumn: 'Dollars',
  sortDirection: 'desc',
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: action.payload };
    case 'SET_ACTIVE_TAB':
      return { ...state, config: state.config ? { ...state.config, lastActiveTab: action.payload } : state.config };
    case 'SET_PLAYERS':
      return { ...state, hitters: action.payload.hitters || [], pitchers: action.payload.pitchers || [] };
    case 'SET_PICKS':
      return { ...state, picks: action.payload };
    case 'SET_KEEPER_WARNINGS':
      return { ...state, keeperWarnings: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SEARCH':
      return { ...state, searchTerm: action.payload };
    case 'SET_POSITION_FILTER':
      return { ...state, positionFilter: action.payload };
    case 'SET_TYPE_FILTER':
      return { ...state, typeFilter: action.payload };
    case 'SET_SORT':
      return {
        ...state,
        sortColumn: action.payload,
        sortDirection: state.sortColumn === action.payload && state.sortDirection === 'desc' ? 'asc' : 'desc',
      };
    default:
      return state;
  }
}

export function DraftProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Derived state ─────────────────────────────────────────────────────────

  const draftedPlayerIds = useMemo(
    () => new Set(state.picks.map(p => p.playerId)),
    [state.picks]
  );

  const allPlayers = useMemo(
    () => [...state.hitters, ...state.pitchers],
    [state.hitters, state.pitchers]
  );

  const playerById = useMemo(() => {
    const map = new Map();
    allPlayers.forEach(p => map.set(p.PlayerId, p));
    return map;
  }, [allPlayers]);

  const teamRosters = useMemo(() => {
    if (!state.config) return {};
    const rosters = {};
    state.config.teamNames.forEach(name => { rosters[name] = []; });
    state.picks.forEach(pick => {
      const playerData = playerById.get(pick.playerId);
      if (playerData && rosters[pick.team] !== undefined) {
        rosters[pick.team].push({ ...playerData, price: pick.price });
      }
    });
    return rosters;
  }, [state.picks, state.config, playerById]);

  const teamBudgets = useMemo(() => {
    if (!state.config) return {};
    const budgets = {};
    state.config.teamNames.forEach(name => {
      const spent = state.picks
        .filter(p => p.team === name)
        .reduce((sum, p) => sum + p.price, 0);
      budgets[name] = { total: state.config.budget, spent, remaining: state.config.budget - spent };
    });
    return budgets;
  }, [state.picks, state.config]);

  const totalRosterSlots = useMemo(() => {
    if (!state.config) return 25;
    return Object.values(state.config.rosterSlots).reduce((a, b) => a + b, 0);
  }, [state.config]);

  const teamLineups = useMemo(() => {
    if (!state.config) return {};
    const lineups = {};
    Object.entries(teamRosters).forEach(([teamName, roster]) => {
      lineups[teamName] = optimizeRoster(roster, state.config.rosterSlots);
    });
    return lineups;
  }, [teamRosters, state.config]);

  const standings = useMemo(() => {
    if (!state.config) return [];
    return calculateStandings(teamLineups);
  }, [teamLineups, state.config]);

  // ── API functions ─────────────────────────────────────────────────────────

  async function saveConfig(newConfig) {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    });
    const config = await res.json();
    dispatch({ type: 'SET_CONFIG', payload: config });
    return config;
  }

  async function setActiveTab(tab) {
    await fetch('/api/config/tab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastActiveTab: tab }),
    });
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  }

  async function reloadPlayers() {
    const res = await fetch('/api/players');
    if (!res.ok) throw new Error('Failed to load players');
    const data = await res.json();
    dispatch({ type: 'SET_PLAYERS', payload: data });
  }

  async function draftPlayer(playerId, playerName, type, team, price) {
    const res = await fetch('/api/draft/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, playerName, type, team, price }),
    });
    const data = await res.json();
    dispatch({ type: 'SET_PICKS', payload: data.picks });
  }

  async function undoLastPick() {
    const res = await fetch('/api/draft/pick', { method: 'DELETE' });
    const data = await res.json();
    dispatch({ type: 'SET_PICKS', payload: data.picks });
  }

  // ── Initialization ────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const configRes = await fetch('/api/config');
        if (!configRes.ok) throw new Error(`Server error ${configRes.status} — is the backend running?`);
        const config = await configRes.json();
        dispatch({ type: 'SET_CONFIG', payload: config });

        const safeJson = async r => {
          if (!r.ok) throw new Error(`Server error ${r.status}`);
          return r.json();
        };
        const [playersData, draftData] = await Promise.all([
          fetch('/api/players').then(safeJson),
          fetch('/api/draft').then(safeJson),
        ]);
        dispatch({ type: 'SET_PLAYERS', payload: playersData });
        dispatch({ type: 'SET_PICKS', payload: draftData.picks });

        // Auto-load keepers on first launch
        if (config.prevDraftFile && draftData.picks.length === 0) {
          const keepersData = await fetch('/api/draft/load-keepers', { method: 'POST' }).then(safeJson);
          if (keepersData.unmatched?.length > 0) {
            dispatch({ type: 'SET_KEEPER_WARNINGS', payload: keepersData.unmatched });
          }
          if (keepersData.matched?.length > 0) {
            const newDraft = await fetch('/api/draft').then(safeJson);
            dispatch({ type: 'SET_PICKS', payload: newDraft.picks });
          }
        }
      } catch (err) {
        dispatch({ type: 'SET_ERROR', payload: err.message });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DraftContext.Provider value={{
      ...state,
      draftedPlayerIds,
      allPlayers,
      playerById,
      teamRosters,
      teamBudgets,
      totalRosterSlots,
      teamLineups,
      standings,
      // Actions
      saveConfig,
      setActiveTab,
      reloadPlayers,
      draftPlayer,
      undoLastPick,
      dispatch,
    }}>
      {children}
    </DraftContext.Provider>
  );
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraft must be used within DraftProvider');
  return ctx;
}
