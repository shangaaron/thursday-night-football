const STORAGE_KEY = "sixAsideFootballManager:quarter:2026-05";
const PREVIOUS_RANKS_KEY = "sixAsideFootballManager:previousRanks";
const API_BASE = "/api";
const ADMIN_PASSWORD = "thursdayfootball196!";
const PROTECTED_VIEWS = new Set(["admin", "leaderboard"]);

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

const views = document.querySelectorAll(".view");
const navButtons = document.querySelectorAll("[data-view]");
const leaderboardBody = document.getElementById("leaderboard-body");
const podium = document.getElementById("podium");
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

document.getElementById("generate-teams").addEventListener("click", () => {
  if (ensureAdminAccess("generate teams")) generateTeams();
});
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
  const players = rankedPlayers();
  leaderboardBody.innerHTML = players
    .map((player) => {
      const previous = state.previousRanks[player.id];
      const movement = getMovement(player.rank, previous);
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

function getMovement(rank, previousRank) {
  if (!previousRank) return '<span class="muted">New</span>';
  if (rank === previousRank) return '<span class="muted">-</span>';
  if (rank < previousRank) return `<span class="move-up">+${previousRank - rank}</span>`;
  return `<span class="move-down">-${rank - previousRank}</span>`;
}

function renderSelector() {
  const players = [...rankedPlayers()].sort((a, b) => a.name.localeCompare(b.name));
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

  const selected = rankedPlayers().filter((player) => selectedPlayerIds.includes(player.id));
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

  generatedTeams = [
    buildTeam("Black team", [0, 17, 5, 12, 6, 11], seeds),
    buildTeam("White team", [1, 16, 4, 13, 7, 10], seeds),
    buildTeam("Red team", [2, 15, 3, 14, 8, 9], seeds),
  ];

  showWarning("");
  renderTeams();
}

function buildTeam(name, seedIndexes, seeds) {
  const players = seedIndexes.map((index) => ({ ...seeds[index], seed: index + 1 }));
  return {
    id: crypto.randomUUID(),
    name,
    players,
    ...calculateTeamStats(players),
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
          <p class="override-note">Manual override: swap any player with another team.</p>
          <div class="team-list">
            ${team.players
              .map(
                (player) => `
                  <div class="team-player">
                    <div>
                      <strong>${escapeHtml(player.name)}</strong>
                    </div>
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

  const night = {
    id: crypto.randomUUID(),
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
    teamResults: generatedTeams.map((team) => ({
      teamId: team.id,
      name: team.name,
      goalDifferenceForNight: team.goalDifferenceForNight,
    })),
    createdAt: now,
    updatedAt: now,
  };

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
    await supabaseFetch("match_nights", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(toDbNight(night)),
    });
    state.nights.unshift(night);
  } catch (error) {
    console.error(error);
    showWarning(`Results could not be saved to the live database. ${error.message}`);
    await loadRemoteData();
    return;
  }

  selectedPlayerIds = [];
  generatedTeams = [];
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
      (night) => `
        <article class="history-card">
          <div class="history-card-heading">
            <div>
              <h3>${formatDate(night.date)}</h3>
              <p class="muted">${night.selectedPlayers.length} players</p>
            </div>
            <button class="small-button danger-button" data-delete-night="${night.id}">Remove night</button>
          </div>
          <div class="history-teams">
            ${night.teams
              .map(
                (team) => `
                  <section class="history-team">
                    <strong>${team.name}: ${formatSigned(team.goalDifferenceForNight)} GD</strong>
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
      `,
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
  const shouldDelete = window.confirm(
    `Remove ${label}? This will subtract that night's games and goal differences from the players.`,
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

function showWarning(message) {
  teamWarning.textContent = message;
  teamWarning.classList.toggle("is-visible", Boolean(message));
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
