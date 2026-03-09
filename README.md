# Fantasy Baseball Draft App

A real-time auction draft assistant for rotisserie fantasy baseball. Tracks picks, budgets, projected standings, and position scarcity as your draft unfolds.

---

## Requirements

- [Node.js](https://nodejs.org/) v18 or later
- npm

---

## Setup

**1. Install dependencies**

```bash
npm install
npm install --prefix client
```

**2. Add your projection files**

Place your batter and pitcher projection CSV files in the `data/` directory. It expects column formats as exported by the [Fangraphs Auction Calculator](https://www.fangraphs.com/fantasy-tools/auction-calculator). The expected column formats are:

- **Batters:** `Name, Team, POS, ADP, PA, mRBI, mR, mSB, mHR, mOBP, PTS, aPOS, Dollars, NameASCII, PlayerId, MLBAMID`
- **Pitchers:** `Name, Team, POS, ADP, IP, mW, mERA, mWHIP, mSO, mQS, mSVHLD, PTS, aPOS, Dollars, NameASCII, PlayerId, MLBAMID`

**3. Start the app**

```bash
npm run dev
```

This starts both the API server (port 3001) and the frontend (port 5173). Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## First Launch

On first launch you'll land on the **Config** tab. Fill in:

- **Batter projections** — path to your batters CSV (e.g. `./data/batters.csv`)
- **Pitcher projections** — path to your pitchers CSV (e.g. `./data/pitchers.csv`)
- **Keepers** *(optional)* — path to your keepers CSV (e.g. `.data/keepers.csv`) if your league carries over keepers (see [Keepers](#keepers))
- **Number of teams** and **team names**
- **Budget per team** (default $260)
- **Roster slots** — edit counts to match your league's roster structure

Click **Save Configuration**. The app will load your player data and take you to the Player Pool.

---

## Tabs

### Player Pool

The main draft interface. Shows all undrafted players sorted by projected dollar value.

- **Search** by player name
- **Filter** by player type (All / Batters / Pitchers) and position
- **Sort** by any column
- **Value pill** on each player — green if the player's ADP suggests the market undervalues them relative to their projected dollar rank; amber if overvalued
- Click **Draft** on any row to open the draft modal — select a team and enter the price paid

The **Position Overview** panel above the table shows:
- **Starters Left** — how many startable players at each position are still available (green = some remain, amber = none left)
- **Value** — whether drafted players at each position have gone for more or less than their projections, expressed as a percentage

### Teams

One row per team showing remaining budget, players rostered, total value (projected dollar value minus price paid), and a per-position breakdown. Sortable by any column.

### Standings

Projected rotisserie standings based on each team's current roster. Stats are summed across each team's optimized starting lineup and ranked across all teams. Points are awarded as `(number of teams + 1 - rank)` per category — higher is better. Sortable by any column.

---

## Drafting a Player

1. Click **Draft** on a player row
2. Select the team that won the player
3. Enter the price paid
4. Click **Draft** to confirm

The player is removed from the available pool, the team's budget is updated, and all standings and scarcity data refresh immediately.

**Undo** — the toolbar shows an undo button after each pick that reverses the most recent draft action.

**Budget enforcement** — the maximum bid for a team is their remaining budget minus the number of empty roster slots still to fill (so they can always afford $1 per remaining open slot).

---

## Keepers

If your league carries over players from a previous season, you can seed the draft with keeper picks:

1. Point the **Keepers** field in Config to a `keepers.csv` with Team, Type, Name, Price (or just draft your keepers ahead of time and point config to a static copy of `draft_results.csv`)
2. Save the config — keepers are loaded automatically on startup

Keepers are treated identically to live draft picks: removed from the available pool and applied to team rosters and budgets at their keeper price. If any keeper name can't be matched to the current projection file, a warning is shown on the Config page.

---

## Persistence

All draft state is saved server-side in `server/draft_state.json` after every pick. The app fully survives server restarts — your draft picks, team budgets, and last active tab are all restored automatically.

A human-readable copy of all picks is also written to `data/draft_results.csv` after every pick.

> **Note:** If you need to manually correct a pick (wrong team, wrong price), edit `server/draft_state.json` directly — it's plain JSON. Changes take effect on the next page load without a server restart. `draft_results.csv` is output-only and is not read by the app.
