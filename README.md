# 6-a-side Football Manager

A static web app for managing player rankings, balanced team generation, results entry, and match-night history.

## Open the app

Open `index.html` in a browser. The app stores data in the browser with `localStorage`, so it does not need a server or database for local use.

## What it does

- Calculates score automatically: `goalDifference + (5 * gamesPlayed)`.
- Sorts the leaderboard by score, then goal difference, then games played.
- Highlights the top three players.
- Selects exactly 18 players for a night.
- Generates deterministic teams using the requested seed pattern.
- Saves team goal differences and applies them to every player in that team.
- Adds one game played to every selected player when results are saved.
- Stores previous nights with teams, scores, and results.
- Shows rank movement after a saved night.
- Provides player add, edit, and remove controls.

## Notes

The admin screens are private in the sense that they are local management views on the same device. A real hosted private admin page would need authentication and a backend.
