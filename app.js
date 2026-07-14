const STORAGE_KEY = "sixAsideFootballManager:quarter:2026-05";
const PREVIOUS_RANKS_KEY = "sixAsideFootballManager:previousRanks";
const API_BASE = "/api";
const ADMIN_PASSWORD = "thursfooty";
const PROTECTED_VIEWS = new Set(["admin", "leaderboard"]);
const ATHLETIC_BALANCE_PLAYERS = new Set([
  "gary",
  "kadan",
  "josh",
  "bailey",
  "charlton",
  "louis",
  "frank",
  "ethan",
]);
const TIER_ONE_PLAYERS = new Set([
  "gary",
  "kadan",
  "charlton",
  "josh",
  "bukola",
  "bailey",
  "strikey",
  "frank",
  "owen",
  "brandon",
  "stephen",
]);
const TIER_THREE_PLAYERS = new Set([
  "simon",
  "bruno",
  "jez",
  "nathan",
  "nedved",
  "segun",
  "adedoyin",
  "will",
  "jacob",
  "aaron",
]);
const REPEAT_TEAMMATE_TARGET = 2;
const REPEAT_TEAMMATE_LIMIT = 3;
const THIRD_QUARTER_START = "2026-07-01";
const FOURTH_QUARTER_START = "2026-10-01";

const demoPlayers = [
  ["Josh", 5, 19],
  ["Gary", 4, 19],
  ["Gaz", 5, 18],
  ["Ndy", 4, 18],
  ["Akeem", 3, 18],
  ["Bukola", 3, 16],
  ["Gass", 3, 15],
  ["Matt", 1, 15],
  ["Strikey", 4, 14],
  ["Ethan", 3, 11],
  ["James", 5, 10],
  ["Seb", 2, 8],
  ["Ronny", 1, 8],
  ["Jacob", 2, 5],
  ["Kadan", 2, 1],
  ["Stephen", 1, 1],
  ["Frank", 2, -2],
  ["Layton", 5, -3],
  ["Brandon", 2, -3],
  ["Owen", 2, -3],
  ["Will", 3, -4],
  ["Aaron", 4, -5],
  ["Charlton", 2, -9],
  ["Bailey", 4, -12],
  ["Jez", 1, -14],
  ["Maundy", 3, -25],
  ["Nathan", 2, -25],
  ["Nedved", 4, -26],
  ["Bruno", 4, -29],
  ["Si", 3, -40],
];

const state = {
  players: [],
  nights: [],
  previousRanks: loadPreviousRanks(),
};
let selectedPlayerIds = [];
let generatedTeams = [];
let activeNightId = null;
let activeLeagueView = "q3";
let activeLeagueSort = null;

const views = document.querySelectorAll(".view");
const navButtons = document.querySelectorAll("[data-view]");
const leaderboardBody = document.getElementById("leaderboard-body");
const podium = document.getElementById("podium");
const leagueNote = document.getElementById("league-note");
const leagueTabs = document.querySelectorAll("[data-league-view]");
const leagueSortButtons = document.querySelectorAll("[data-league-sort]");
const playerSelector = document.getElementById("player-selector");
const selectionCount = document.getElementById("selection-count");
const teamWarning = document.getElementById("team-warning");
const teamsOutput = document.getElementById("teams-output");
const resultsInputs = document.getElementById("results-inputs");
const adminList = document.getElementById("admin-list");
const historyList = document.getElementById("history-list");
const playerForm = document.getElementById("player-form");
const playerId = document.getElementById("player-id");
const playerName = document.getElementById("player-name");
const playerGames = document.getElementById("player-games");
const playerGoalDiff = document.getElementById("player-goal-diff");
const nightDate = document.getElementById("night-date");

nightDate.valueAsDate = new Date();

navButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});
leagueTabs.forEach((button) => {
  button.addEventListener("click", () => {
    activeLeagueView = button.dataset.leagueView;
    activeLeagueSort = null;
    renderLeaderboard();
  });
});
leagueSortButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeLeagueSort = activeLeagueSort === button.dataset.leagueSort ? null : button.dataset.leagueSort;
    renderLeaderboard();
  });
});

document.getElementById("generate-teams").addEventListener("click", () => {
  if (ensureAdminAccess("generate teams")) generateTeams();
});
document.getElementById("save-teams").addEventListener("click", saveTeamsForNight);
document.getElementById("save-results").addEventListener("click", saveResults);
document.getElementById("cancel-edit").addEventListener("click", resetPlayerForm);
document.getElementById("reset-demo").addEventListener("click", loadRemoteData);
playerForm.addEventListener("submit", savePlayer);

initApp();

function calculateScore(player) {
  return Number(player.goalDifference) + Number(player.gamesPlayed) * 5;
}

function rankedPlayers(players = state.players) {
  const sorted = [...players].sort((a, b) => {
    const scoreDiff = calculateScore(b) - calculateScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const gdDiff = b.goalDifference - a.goalDifference;
    if (gdDiff !== 0) return gdDiff;
    const gamesDiff = b.gamesPlayed - a.gamesPlayed;
    if (gamesDiff !== 0) return gamesDiff;
    return a.name.localeCompare(b.name);
  });

  let lastKey = "";
  let lastRank = 0;
  return sorted.map((player, index) => {
    const key = `${calculateScore(player)}:${player.goalDifference}:${player.gamesPlayed}`;
    const rank = key === lastKey ? lastRank : index + 1;
    lastKey = key;
    lastRank = rank;
    return { ...player, score: calculateScore(player), rank };
  });
}

function setView(viewId) {
  if (PROTECTED_VIEWS.has(viewId) && !ensureAdminAccess(`open ${viewId}`)) return;

  views.forEach((view) => view.classList.toggle("is-active", view.id === viewId));
  navButtons.forEach((button) =>
    button.classList.toggle("is-active", button.dataset.view === viewId),
  );
}

async function initApp() {
  renderLoading();
  await loadRemoteData();
}

function renderLoading() {
  playerSelector.innerHTML = '<p class="muted">Loading players...</p>';
  adminList.innerHTML = '<p class="muted">Loading players...</p>';
  historyList.innerHTML = '<p class="muted">Loading history...</p>';
  leaderboardBody.innerHTML = "";
}

async function loadRemoteData() {
  try {
    const [players, nights] = await Promise.all([fetchPlayers(), fetchMatchNights()]);
    state.players = players;
    state.nights = nights;
    hydratePendingNight();
    saveLocalSnapshot();
    renderAll();
  } catch (error) {
    console.error(error);
    loadLocalFallback();
    renderAll();
    showWarning(
      `Live data could not be loaded. Showing the last saved copy on this device. ${error.message}`,
    );
  }
}

function loadPreviousRanks() {
  return JSON.parse(localStorage.getItem(PREVIOUS_RANKS_KEY) || "{}");
}

function persistPreviousRanks() {
  localStorage.setItem(PREVIOUS_RANKS_KEY, JSON.stringify(state.previousRanks));
}

function saveLocalSnapshot() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      players: state.players,
      nights: state.nights,
    }),
  );
}

function loadLocalFallback() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (saved) {
    state.players = saved.players || [];
    state.nights = correctHistoricalNightDate(saved.nights || []);
    return;
  }

  const now = new Date().toISOString();
  state.players = demoPlayers.map(([name, gamesPlayed, goalDifference]) => ({
    id: crypto.randomUUID(),
    name,
    gamesPlayed,
    goalDifference,
    createdAt: now,
    updatedAt: now,
  }));
  state.nights = [];
}

function correctHistoricalNightDate(nights) {
  return nights.map((night) =>
    night.date === "2026-05-11"
      ? {
          ...night,
          date: "2026-05-08",
          updatedAt: new Date().toISOString(),
        }
      : night,
  );
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed with ${response.status}`);
  }

  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

async function fetchPlayers() {
  const rows = await supabaseFetch("players?select=*&order=name.asc");
  return rows.map(fromDbPlayer);
}

async function fetchMatchNights() {
  const rows = await supabaseFetch("match_nights?select=*&order=date.desc,created_at.desc");
  return correctHistoricalNightDate(rows.map(fromDbNight));
}

function fromDbPlayer(row) {
  return {
    id: row.id,
    name: row.name,
    gamesPlayed: row.games_played,
    goalDifference: row.goal_difference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDbPlayer(player) {
  return {
    name: player.name,
    games_played: player.gamesPlayed,
    goal_difference: player.goalDifference,
    updated_at: new Date().toISOString(),
  };
}

function fromDbNight(row) {
  return {
    id: row.id,
    date: row.date,
    selectedPlayers: row.selected_players || [],
    teams: row.teams || [],
    teamResults: row.team_results || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isCompletedNight(night) {
  return Array.isArray(night.teamResults) && night.teamResults.length > 0;
}

function hydratePendingNight() {
  if (generatedTeams.length) return;

  const pendingNight = state.nights.find((night) => !isCompletedNight(night));
  if (!pendingNight) {
    activeNightId = null;
    return;
  }

  activeNightId = pendingNight.id;
  selectedPlayerIds = pendingNight.selectedPlayers || [];
  generatedTeams = (pendingNight.teams || []).map((team) => ({
    ...team,
    goalDifferenceForNight: Number(team.goalDifferenceForNight || 0),
  }));
  if (pendingNight.date) nightDate.value = pendingNight.date;
}

function toDbNight(night) {
  return {
    date: night.date,
    selected_players: night.selectedPlayers,
    teams: night.teams,
    team_results: night.teamResults,
    updated_at: night.updatedAt,
  };
}

function ensureAdminAccess(action) {
  if (sessionStorage.getItem("tnfAdminUnlocked") === "true") return true;

  const enteredPassword = window.prompt(`Enter the admin password to ${action}.`);
  if (enteredPassword === ADMIN_PASSWORD) {
    sessionStorage.setItem("tnfAdminUnlocked", "true");
    return true;
  }

  if (enteredPassword !== null) {
    window.alert("Incorrect password.");
  }
  return false;
}

function renderAll() {
  renderLeaderboard();
  renderSelector();
  renderTeams();
  renderAdmin();
  renderHistory();
}

function renderLeaderboard() {
  const league = getLeagueView(activeLeagueView);
  const players = sortLeaguePlayers(rankedPlayers(league.players));
  const showMovement = activeLeagueView === "year";
  leagueTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.leagueView === activeLeagueView);
  });
  leagueSortButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.leagueSort === activeLeagueSort);
  });
  leagueNote.textContent = league.note;

  if (!players.length) {
    podium.innerHTML = "";
    leaderboardBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-cell">${league.emptyMessage}</td>
      </tr>
    `;
    return;
  }

  leaderboardBody.innerHTML = players
    .map((player) => {
      const previous = state.previousRanks[player.id];
      const movement = showMovement ? getMovement(player.rank, previous) : '<span class="muted">-</span>';
      return `
        <tr>
          <td class="rank-cell">#${player.rank}</td>
          <td><strong>${escapeHtml(player.name)}</strong></td>
          <td>${player.gamesPlayed}</td>
          <td>${formatSigned(player.goalDifference)}</td>
          <td><strong>${player.score}</strong></td>
          <td>${movement}</td>
        </tr>
      `;
    })
    .join("");

  podium.innerHTML = players
    .slice(0, 3)
    .map(
      (player) => `
        <article class="podium-card">
          <span class="podium-rank">#${player.rank}</span>
          <h3>${escapeHtml(player.name)}</h3>
          <div class="score-big">${player.score}</div>
          <p class="muted">${player.gamesPlayed} games, ${formatSigned(player.goalDifference)} GD</p>
        </article>
      `,
    )
    .join("");
}

function sortLeaguePlayers(players) {
  if (!activeLeagueSort) return players;

  return [...players].sort((a, b) => {
    const statDiff = Number(b[activeLeagueSort]) - Number(a[activeLeagueSort]);
    if (statDiff !== 0) return statDiff;
    const rankDiff = a.rank - b.rank;
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

function getLeagueView(view) {
  const q3Adjustments = getQuarterAdjustments(THIRD_QUARTER_START, FOURTH_QUARTER_START);

  if (view === "q1") {
    return {
      players: [],
      note: "1st quarter league to be uploaded.",
      emptyMessage: "1st quarter league to be uploaded.",
    };
  }

  if (view === "q2") {
    return {
      players: state.players.map((player) => {
        const adjustment = q3Adjustments.get(player.id) || { gamesPlayed: 0, goalDifference: 0 };
        return {
          ...player,
          gamesPlayed: Math.max(0, player.gamesPlayed - adjustment.gamesPlayed),
          goalDifference: player.goalDifference - adjustment.goalDifference,
        };
      }),
      note: "2nd quarter league, excluding results from 2 July 2026 onward.",
      emptyMessage: "No 2nd quarter data found.",
    };
  }

  if (view === "year") {
    return {
      players: state.players,
      note: "Year total combines all uploaded quarter data currently held in the live league table.",
      emptyMessage: "No year total data found.",
    };
  }

  return {
    players: buildPlayersFromAdjustments(q3Adjustments),
    note: "3rd quarter league from 2 July 2026 to 30 September 2026.",
    emptyMessage: "No 3rd quarter results have been saved yet.",
  };
}

function getQuarterAdjustments(startDate, endDate) {
  const adjustments = new Map();
  state.nights
    .filter((night) => isCompletedNight(night) && night.date >= startDate && night.date < endDate)
    .forEach((night) => {
      night.teams.forEach((team) => {
        const goalDifference = Number(team.goalDifferenceForNight || 0);
        team.players.forEach((teamPlayer) => {
          const current = adjustments.get(teamPlayer.id) || { gamesPlayed: 0, goalDifference: 0 };
          adjustments.set(teamPlayer.id, {
            gamesPlayed: current.gamesPlayed + 1,
            goalDifference: current.goalDifference + goalDifference,
          });
        });
      });
    });
  return adjustments;
}

function buildPlayersFromAdjustments(adjustments) {
  return state.players
    .map((player) => {
      const adjustment = adjustments.get(player.id) || { gamesPlayed: 0, goalDifference: 0 };
      return {
        ...player,
        gamesPlayed: adjustment.gamesPlayed,
        goalDifference: adjustment.goalDifference,
      };
    })
    .filter((player) => player.gamesPlayed > 0);
}

function getMovement(rank, previousRank) {
  if (!previousRank) return '<span class="muted">New</span>';
  if (rank === previousRank) return '<span class="muted">-</span>';
  if (rank < previousRank) return `<span class="move-up">+${previousRank - rank}</span>`;
  return `<span class="move-down">-${rank - previousRank}</span>`;
}

function teamSelectionRankings() {
  return rankedPlayers(state.players);
}

function renderSelector() {
  const players = [...teamSelectionRankings()].sort((a, b) => a.name.localeCompare(b.name));
  selectionCount.textContent = `${selectedPlayerIds.length} / 18`;
  selectionCount.style.color = selectedPlayerIds.length === 18 ? "var(--green-dark)" : "var(--danger)";

  playerSelector.innerHTML = players
    .map((player) => {
      const checked = selectedPlayerIds.includes(player.id) ? "checked" : "";
      const disabled = !checked && selectedPlayerIds.length >= 18 ? "disabled" : "";
      return `
        <label class="selector-row">
          <input type="checkbox" value="${player.id}" ${checked} ${disabled} />
          <strong>${escapeHtml(player.name)}</strong>
        </label>
      `;
    })
    .join("");

  playerSelector.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", (event) => {
      const id = event.target.value;
      if (event.target.checked) {
        selectedPlayerIds = [...selectedPlayerIds, id];
      } else {
        selectedPlayerIds = selectedPlayerIds.filter((playerIdValue) => playerIdValue !== id);
      }
      generatedTeams = [];
      renderSelector();
      renderTeams();
    });
  });
}

function generateTeams() {
  if (selectedPlayerIds.length !== 18) {
    showWarning("Select exactly 18 players before generating teams.");
    generatedTeams = [];
    renderTeams();
    return;
  }

  const selected = teamSelectionRankings().filter((player) => selectedPlayerIds.includes(player.id));
  const byId = new Map(selected.map((player) => [player.id, player]));
  const seeds = selectedPlayerIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      const gdDiff = b.goalDifference - a.goalDifference;
      if (gdDiff !== 0) return gdDiff;
      const gamesDiff = b.gamesPlayed - a.gamesPlayed;
      if (gamesDiff !== 0) return gamesDiff;
      return a.name.localeCompare(b.name);
    });

  generatedTeams = buildBalancedTeams(seeds);
  activeNightId = null;

  showWarning("");
  renderTeams();
}

function buildBalancedTeams(seeds) {
  const teamNames = ["Black team", "White team", "Red team"];
  const recentTeammates = getRecentTeammates();
  const selectedTierCounts = getTierCounts(seeds);
  const selectedAthleticCount = seeds.filter((player) =>
    ATHLETIC_BALANCE_PLAYERS.has(player.name.trim().toLowerCase()),
  ).length;
  const athleticLimit = Math.max(2, Math.ceil(selectedAthleticCount / 3));
  const pots = [];
  for (let index = 0; index < seeds.length; index += 3) {
    pots.push(seeds.slice(index, index + 3).map((player, offset) => ({ ...player, seed: index + offset + 1 })));
  }

  const permutations = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  let bestTeams = null;
  let bestScore = Infinity;
  let bestSpread = Infinity;

  function search(potIndex, teams) {
    if (potIndex === pots.length) {
      const totals = teams.map((team) => team.reduce((sum, player) => sum + player.score, 0));
      const tierBalance = calculateTierBalance(teams, selectedTierCounts);
      const athleticOverflow = teams.reduce((sum, team) => {
        const count = team.filter((player) =>
          ATHLETIC_BALANCE_PLAYERS.has(player.name.trim().toLowerCase()),
        ).length;
        return sum + Math.max(0, count - athleticLimit);
      }, 0);
      const teammateRepeat = calculateTeammateRepeat(teams, recentTeammates);
      const spread = Math.max(...totals) - Math.min(...totals);
      const average = totals.reduce((sum, total) => sum + total, 0) / totals.length;
      const variance = totals.reduce((sum, total) => sum + (total - average) ** 2, 0);
      const score =
        tierBalance.hardOverflow * 10000000000000000 +
        tierBalance.sameTierPairs * 100000000000000 +
        tierBalance.spread * 10000000000000 +
        athleticOverflow * 1000000000000 +
        teammateRepeat.hardOverflow * 10000000000 +
        teammateRepeat.softOverflow * 100000000 +
        teammateRepeat.repeatPairs * 10000 +
        spread * 1000 +
        variance;

      if (score < bestScore) {
        bestScore = score;
        bestSpread = spread;
        bestTeams = teams.map((team) => [...team]);
      }
      return;
    }

    permutations.forEach((permutation) => {
      const nextTeams = teams.map((team, teamIndex) => [...team, pots[potIndex][permutation[teamIndex]]]);
      search(potIndex + 1, nextTeams);
    });
  }

  search(0, [[], [], []]);

  return bestTeams.map((players, index) => buildTeam(teamNames[index], players, bestSpread));
}

function getPlayerTier(player) {
  const name = player.name.trim().toLowerCase();
  if (TIER_ONE_PLAYERS.has(name)) return 1;
  if (TIER_THREE_PLAYERS.has(name)) return 3;
  return 2;
}

function getTierCounts(players) {
  return players.reduce(
    (counts, player) => {
      const tier = getPlayerTier(player);
      counts[tier] += 1;
      return counts;
    },
    { 1: 0, 2: 0, 3: 0 },
  );
}

function calculateTierBalance(teams, selectedTierCounts) {
  const tierOneLimit = Math.ceil(selectedTierCounts[1] / 3);
  const tierThreeLimit = Math.ceil(selectedTierCounts[3] / 3);
  let hardOverflow = 0;
  let sameTierPairs = 0;
  const tierOneCounts = [];
  const tierThreeCounts = [];

  teams.forEach((team) => {
    const counts = getTierCounts(team);
    tierOneCounts.push(counts[1]);
    tierThreeCounts.push(counts[3]);
    hardOverflow += Math.max(0, counts[1] - tierOneLimit);
    hardOverflow += Math.max(0, counts[3] - tierThreeLimit);
    sameTierPairs += (counts[1] * (counts[1] - 1)) / 2;
    sameTierPairs += (counts[3] * (counts[3] - 1)) / 2;
  });

  const tierOneSpread = Math.max(...tierOneCounts) - Math.min(...tierOneCounts);
  const tierThreeSpread = Math.max(...tierThreeCounts) - Math.min(...tierThreeCounts);

  return {
    hardOverflow,
    sameTierPairs,
    spread: tierOneSpread + tierThreeSpread,
  };
}

function getRecentTeammates() {
  const lastCompletedNight = state.nights.find((night) => isCompletedNight(night));
  const teammateMap = new Map();
  if (!lastCompletedNight) return teammateMap;

  lastCompletedNight.teams.forEach((team) => {
    const playerIds = team.players.map((player) => player.id);
    playerIds.forEach((playerId) => {
      const teammates = teammateMap.get(playerId) || new Set();
      playerIds.forEach((teammateId) => {
        if (teammateId !== playerId) teammates.add(teammateId);
      });
      teammateMap.set(playerId, teammates);
    });
  });

  return teammateMap;
}

function calculateTeammateRepeat(teams, recentTeammates) {
  if (!recentTeammates.size) {
    return { hardOverflow: 0, softOverflow: 0, repeatPairs: 0 };
  }

  let hardOverflow = 0;
  let softOverflow = 0;
  let repeatPairs = 0;

  teams.forEach((team) => {
    team.forEach((player) => {
      const previousTeammates = recentTeammates.get(player.id);
      if (!previousTeammates) return;

      const repeatedCount = team.filter(
        (teammate) => teammate.id !== player.id && previousTeammates.has(teammate.id),
      ).length;

      repeatPairs += repeatedCount;
      hardOverflow += Math.max(0, repeatedCount - REPEAT_TEAMMATE_LIMIT);
      softOverflow += Math.max(0, repeatedCount - REPEAT_TEAMMATE_TARGET);
    });
  });

  return {
    hardOverflow,
    softOverflow,
    repeatPairs: repeatPairs / 2,
  };
}

function buildTeam(name, players, balanceSpread = 0) {
  return {
    id: crypto.randomUUID(),
    name,
    players,
    ...calculateTeamStats(players),
    balanceSpread,
    goalDifferenceForNight: 0,
  };
}

function calculateTeamStats(players) {
  const totalScore = players.reduce((sum, player) => sum + player.score, 0);
  return {
    totalScore,
    averageScore: players.length ? totalScore / players.length : 0,
  };
}

function refreshTeamStats() {
  generatedTeams = generatedTeams.map((team) => ({
    ...team,
    ...calculateTeamStats(team.players),
  }));
  const totals = generatedTeams.map((team) => team.totalScore);
  const spread = totals.length ? Math.max(...totals) - Math.min(...totals) : 0;
  generatedTeams = generatedTeams.map((team) => ({
    ...team,
    balanceSpread: spread,
  }));
}

function renderTeams() {
  if (!generatedTeams.length) {
    teamsOutput.innerHTML = "";
    resultsInputs.innerHTML = '<p class="muted">Generate teams to enter results.</p>';
    return;
  }

  captureResultInputs();
  refreshTeamStats();
  const swapOptions = generatedTeams.flatMap((team) =>
    team.players.map((player) => ({
      teamId: team.id,
      playerId: player.id,
      label: `${player.name} (${team.name})`,
    })),
  );
  const selectedSet = new Set(selectedPlayerIds);
  const replacementOptions = teamSelectionRankings()
    .filter((player) => !selectedSet.has(player.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  teamsOutput.innerHTML = generatedTeams
    .map(
      (team) => `
        <article class="team-card">
          <div class="team-heading">
            <h3>${team.name}</h3>
            <span class="count-pill">${team.players.length} players</span>
          </div>
          <div class="team-stats">
            <div class="stat-box"><span class="muted">Total</span><strong>${team.totalScore}</strong></div>
            <div class="stat-box"><span class="muted">Average</span><strong>${team.averageScore.toFixed(1)}</strong></div>
          </div>
          <p class="override-note">Manual override: swap players across teams or replace a player from the main pool.</p>
          <div class="team-list">
            ${team.players
              .map(
                (player) => `
                  <div class="team-player">
                    <strong class="team-player-name">${escapeHtml(player.name)}</strong>
                    <label class="swap-control">
                      <span>Swap</span>
                      <select data-swap-player="${player.id}">
                        <option value="">Choose player</option>
                        ${swapOptions
                          .filter((option) => option.teamId !== team.id)
                          .map(
                            (option) =>
                              `<option value="${option.playerId}">${escapeHtml(option.label)}</option>`,
                          )
                          .join("")}
                      </select>
                    </label>
                    <label class="swap-control">
                      <span>Replace</span>
                      <select data-replace-player="${player.id}">
                        <option value="">Choose player</option>
                        ${replacementOptions
                          .map(
                            (option) =>
                              `<option value="${option.id}">${escapeHtml(option.name)}</option>`,
                          )
                          .join("")}
                      </select>
                    </label>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");

  teamsOutput.querySelectorAll("[data-swap-player]").forEach((select) => {
    select.addEventListener("change", (event) => {
      if (!event.target.value) return;
      swapPlayers(event.target.dataset.swapPlayer, event.target.value);
    });
  });
  teamsOutput.querySelectorAll("[data-replace-player]").forEach((select) => {
    select.addEventListener("change", (event) => {
      if (!event.target.value) return;
      replacePlayer(event.target.dataset.replacePlayer, event.target.value);
    });
  });

  resultsInputs.innerHTML = generatedTeams
    .map(
      (team) => `
        <label>
          <span>${team.name} goal difference</span>
          <input type="number" step="1" value="${team.goalDifferenceForNight}" data-team-id="${team.id}" />
        </label>
      `,
    )
    .join("");
}

function buildNightPayload(teamResults = []) {
  const now = new Date().toISOString();
  return {
    id: activeNightId || crypto.randomUUID(),
    date: nightDate.value || new Date().toISOString().slice(0, 10),
    selectedPlayers: selectedPlayerIds,
    teams: generatedTeams.map((team) => ({
      ...team,
      players: team.players.map((player) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        seed: player.seed,
      })),
    })),
    teamResults,
    createdAt: now,
    updatedAt: now,
  };
}

async function saveTeamsForNight() {
  if (!ensureAdminAccess("save teams for the night")) return;

  if (selectedPlayerIds.length !== 18 || generatedTeams.length !== 3) {
    showWarning("Generate teams from exactly 18 selected players before saving them.");
    return;
  }

  captureResultInputs();
  refreshTeamStats();
  const night = buildNightPayload([]);

  try {
    if (activeNightId) {
      await supabaseFetch(`match_nights?id=eq.${activeNightId}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(toDbNight(night)),
      });
      state.nights = state.nights.map((item) => (item.id === activeNightId ? night : item));
    } else {
      const [savedNight] = await supabaseFetch("match_nights?select=*", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(toDbNight(night)),
      });
      const saved = fromDbNight(savedNight);
      activeNightId = saved.id;
      state.nights.unshift(saved);
    }

    saveLocalSnapshot();
    showWarning("Teams saved for the night. Results can be entered later from any device.", "success");
    renderHistory();
  } catch (error) {
    console.error(error);
    showWarning(`Teams could not be saved to the live database. ${error.message}`);
  }
}

function captureResultInputs() {
  resultsInputs.querySelectorAll("input").forEach((input) => {
    const team = generatedTeams.find((item) => item.id === input.dataset.teamId);
    if (team) team.goalDifferenceForNight = Number(input.value || 0);
  });
}

function swapPlayers(firstPlayerId, secondPlayerId) {
  const first = findTeamSlot(firstPlayerId);
  const second = findTeamSlot(secondPlayerId);
  if (!first || !second || first.team.id === second.team.id) {
    renderTeams();
    return;
  }

  const firstPlayer = first.team.players[first.playerIndex];
  first.team.players[first.playerIndex] = second.team.players[second.playerIndex];
  second.team.players[second.playerIndex] = firstPlayer;
  showWarning("");
  renderTeams();
}

function replacePlayer(outgoingPlayerId, incomingPlayerId) {
  const slot = findTeamSlot(outgoingPlayerId);
  const incomingPlayer = teamSelectionRankings().find((player) => player.id === incomingPlayerId);
  if (!slot || !incomingPlayer || selectedPlayerIds.includes(incomingPlayerId)) {
    renderTeams();
    return;
  }

  const outgoingPlayer = slot.team.players[slot.playerIndex];
  slot.team.players[slot.playerIndex] = {
    ...incomingPlayer,
    seed: outgoingPlayer.seed,
  };
  selectedPlayerIds = selectedPlayerIds.map((id) =>
    id === outgoingPlayerId ? incomingPlayerId : id,
  );
  activeNightId = null;
  showWarning("");
  renderSelector();
  renderTeams();
}

function findTeamSlot(playerId) {
  for (const team of generatedTeams) {
    const playerIndex = team.players.findIndex((player) => player.id === playerId);
    if (playerIndex !== -1) return { team, playerIndex };
  }
  return null;
}

async function saveResults() {
  if (!ensureAdminAccess("save results")) return;

  if (selectedPlayerIds.length !== 18 || generatedTeams.length !== 3) {
    showWarning("Generate teams from exactly 18 selected players before saving results.");
    return;
  }
  if (!activeNightId) {
    showWarning("Save the teams for the night before entering final results.");
    return;
  }

  const currentRanks = Object.fromEntries(rankedPlayers().map((player) => [player.id, player.rank]));
  state.previousRanks = currentRanks;
  persistPreviousRanks();

  const resultInputs = [...resultsInputs.querySelectorAll("input")];
  const resultsByTeam = Object.fromEntries(
    resultInputs.map((input) => [input.dataset.teamId, Number(input.value || 0)]),
  );
  const now = new Date().toISOString();
  const updatedPlayers = [];

  generatedTeams.forEach((team) => {
    const teamGoalDifference = resultsByTeam[team.id] || 0;
    team.goalDifferenceForNight = teamGoalDifference;
    team.players.forEach((teamPlayer) => {
      const player = state.players.find((item) => item.id === teamPlayer.id);
      player.gamesPlayed += 1;
      player.goalDifference += teamGoalDifference;
      player.updatedAt = now;
      updatedPlayers.push(player);
    });
  });

  const teamResults = generatedTeams.map((team) => ({
      teamId: team.id,
      name: team.name,
      goalDifferenceForNight: team.goalDifferenceForNight,
    }));
  const night = buildNightPayload(teamResults);

  try {
    await Promise.all(
      updatedPlayers.map((player) =>
        supabaseFetch(`players?id=eq.${player.id}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(toDbPlayer(player)),
        }),
      ),
    );
    await supabaseFetch(`match_nights?id=eq.${activeNightId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(toDbNight(night)),
    });
    state.nights = state.nights.map((item) => (item.id === activeNightId ? night : item));
  } catch (error) {
    console.error(error);
    showWarning(`Results could not be saved to the live database. ${error.message}`);
    await loadRemoteData();
    return;
  }

  selectedPlayerIds = [];
  generatedTeams = [];
  activeNightId = null;
  saveLocalSnapshot();
  renderAll();
  setView("night");
}

function renderAdmin() {
  adminList.innerHTML = rankedPlayers()
    .map(
      (player) => `
        <article class="admin-row">
          <strong>${escapeHtml(player.name)}</strong>
          <span>${player.gamesPlayed} games</span>
          <span>${formatSigned(player.goalDifference)} GD</span>
          <span><strong>${player.score}</strong> pts</span>
          <div class="admin-actions">
            <button class="small-button" data-edit="${player.id}">Edit</button>
            <button class="small-button danger-button" data-delete="${player.id}">Remove</button>
          </div>
        </article>
      `,
    )
    .join("");

  adminList.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editPlayer(button.dataset.edit));
  });
  adminList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deletePlayer(button.dataset.delete));
  });
}

async function savePlayer(event) {
  event.preventDefault();
  if (!ensureAdminAccess("manage players")) return;

  const now = new Date().toISOString();
  const payload = {
    name: playerName.value.trim(),
    gamesPlayed: Math.max(0, Number(playerGames.value || 0)),
    goalDifference: Number(playerGoalDiff.value || 0),
  };

  if (!payload.name) return;

  try {
    if (playerId.value) {
      const player = state.players.find((item) => item.id === playerId.value);
      const updatedPlayer = { ...player, ...payload, updatedAt: now };
      const [savedPlayer] = await supabaseFetch(`players?id=eq.${playerId.value}&select=*`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(toDbPlayer(updatedPlayer)),
      });
      Object.assign(player, fromDbPlayer(savedPlayer));
    } else {
      const [savedPlayer] = await supabaseFetch("players?select=*", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(
          toDbPlayer({
            ...payload,
            updatedAt: now,
          }),
        ),
      });
      state.players.push(fromDbPlayer(savedPlayer));
    }
  } catch (error) {
    console.error(error);
    window.alert("Player could not be saved to the live database. Please try again.");
    return;
  }

  resetPlayerForm();
  saveLocalSnapshot();
  renderAll();
}

function editPlayer(id) {
  const player = state.players.find((item) => item.id === id);
  if (!player) return;
  playerId.value = player.id;
  playerName.value = player.name;
  playerGames.value = player.gamesPlayed;
  playerGoalDiff.value = player.goalDifference;
  playerName.focus();
}

async function deletePlayer(id) {
  if (!ensureAdminAccess("remove players")) return;

  try {
    await supabaseFetch(`players?id=eq.${id}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
  } catch (error) {
    console.error(error);
    window.alert("Player could not be removed from the live database. Please try again.");
    return;
  }

  state.players = state.players.filter((player) => player.id !== id);
  selectedPlayerIds = selectedPlayerIds.filter((playerIdValue) => playerIdValue !== id);
  generatedTeams = [];
  saveLocalSnapshot();
  renderAll();
}

function resetPlayerForm() {
  playerId.value = "";
  playerName.value = "";
  playerGames.value = 0;
  playerGoalDiff.value = 0;
}

function renderHistory() {
  if (!state.nights.length) {
    historyList.innerHTML = '<p class="muted">Saved football nights will appear here.</p>';
    return;
  }

  historyList.innerHTML = state.nights
    .map(
      (night) => {
        const completed = isCompletedNight(night);
        return `
          <article class="history-card">
          <div class="history-card-heading">
            <div>
              <h3>${formatDate(night.date)}</h3>
              <p class="muted">${night.selectedPlayers.length} players | ${completed ? "Results saved" : "Teams saved, results pending"}</p>
            </div>
            <button class="small-button danger-button" data-delete-night="${night.id}">Remove night</button>
          </div>
          <div class="history-teams">
            ${night.teams
              .map(
                (team) => `
                  <section class="history-team">
                    <strong>${team.name}${completed ? `: ${formatSigned(team.goalDifferenceForNight)} GD` : ""}</strong>
                    <p class="muted">Total ${team.totalScore} | Avg ${team.averageScore.toFixed(1)}</p>
                    <ul>
                      ${team.players
                        .map((player) => `<li>${escapeHtml(player.name)}</li>`)
                        .join("")}
                    </ul>
                  </section>
                `,
              )
              .join("")}
          </div>
        </article>
      `;
      },
    )
    .join("");

  historyList.querySelectorAll("[data-delete-night]").forEach((button) => {
    button.addEventListener("click", () => deleteNight(button.dataset.deleteNight));
  });
}

async function deleteNight(id) {
  if (!ensureAdminAccess("remove a historical night")) return;

  const night = state.nights.find((item) => item.id === id);
  const label = night ? formatDate(night.date) : "this night";
  const completed = night ? isCompletedNight(night) : true;
  const shouldDelete = window.confirm(
    completed
      ? `Remove ${label}? This will subtract that night's games and goal differences from the players.`
      : `Remove the saved teams for ${label}? No player stats will be changed.`,
  );
  if (!shouldDelete) return;

  try {
    await supabaseFetch("rpc/remove_match_night_and_reverse", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ target_night_id: id }),
    });
    selectedPlayerIds = [];
    generatedTeams = [];
    await loadRemoteData();
  } catch (error) {
    console.error(error);
    window.alert(`Historical night could not be removed. ${error.message}`);
  }
}

function showWarning(message, type = "error") {
  teamWarning.textContent = message;
  teamWarning.classList.toggle("is-visible", Boolean(message));
  teamWarning.classList.toggle("is-success", type === "success");
}

async function resetDemoData() {
  if (!ensureAdminAccess("reload live data")) return;
  selectedPlayerIds = [];
  generatedTeams = [];
  await loadRemoteData();
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : String(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
