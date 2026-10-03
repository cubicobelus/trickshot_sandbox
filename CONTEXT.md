# Project context

Quick notes for anyone (or any AI assistant) picking this project up. For how to play, see `README.md`.

## What this is

Trickshot Sandbox: a single-page browser FPS built with three.js. Movement is momentum-based
(slides, bunnyhops, wall bounces up to 22 u/s) and scoring rewards trickshots (air, spins, no-scopes,
quickscopes, speed, moving/small targets, streaks). No build step, no bundler, no tests in the repo.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page markup: menus, HUD, scoreboard. Loads three.js r128 and PeerJS 1.5.4 from cdnjs. |
| `style.css` | All styling. |
| `game.js` | One IIFE with everything: config, level, targets, weapons, audio, player physics, scoring, multiplayer. |
| `README.md` | Player-facing docs. |

`game.js` is organised in banner-commented sections: CONFIG, SCENE, LEVEL, TARGETS, PROPS, PARTICLES,
TRACERS, VIEWMODELS, AUDIO, DOM, INPUT, AMMO/RELOAD, PLAYER, COMBAT + SCORING, MULTIPLAYER, MAIN LOOP.

## Modes

- **Singleplayer:** the original sandbox. Behaviour should stay unchanged by multiplayer work.
- **Multiplayer:** up to 8 players, room codes (5 chars), no public lobbies.
  - **Score Race:** shared targets, best trickscore after 3 minutes wins. No player damage.
  - **Deathmatch:** targets off, any hit eliminates, 3s respawn, 1.5s spawn protection, headshot bonus.

## Multiplayer design

- Peer-to-peer over WebRTC via PeerJS, using the free public PeerJS cloud server for signalling only.
  Room id is `trickshot-sandbox-<CODE>`. Data channels use JSON serialization.
- **Host-authoritative** for: round clock and phases, target spawns/kills, who is alive, scoreboard,
  respawn points. Clients simulate their own movement and do their own hit-scan, then report hits
  (`hit`, `pvp`, `shot`, `st` messages). The host validates and broadcasts events (`round`, `board`,
  `phase`, `states`, `tkill`, `tspawn`, `kill`, `respawn`, `shot`), which every peer, including the host,
  applies through the same `applyEvent` function.
- Players send state at 20 Hz via a `setInterval` (not `requestAnimationFrame`) so a backgrounded host
  keeps the room alive. Remote avatars are interpolated.
- Moving targets use the host's clock (`mpTargetClock`) so everyone sees the same positions.
- Physics crates are disabled in multiplayer (they are local-only physics).
- Known limits: shooter-side hit detection (not cheat-proof); strict NATs may need a TURN server;
  the room closes if the host leaves.

## How it was verified

An end-to-end check was run with two headless Chromium pages (Playwright), a local PeerJS server and
local copies of three.js/PeerJS. It covered: joining by code, identical target layouts, scoring on both
sides, respawns, clock sync, round end and mode change, deathmatch kill/respawn/K-D tracking, leaving a
room, and a bad room code. That harness is not stored in this repo.

## Repo / GitHub setup history

- The game started as a single `trickshot-sandbox.html` file, then was split into the three files above.
- Multiplayer was added on a temporary working branch, which was later deleted.
- `main` was recreated as a single commit so the history is authored under the owner's GitHub account,
  using their GitHub noreply address (not a personal email).
- GitHub "Keep my email addresses private" and "Block command line pushes that expose my email" are on.
  Keep them on, and keep personal emails out of commits and files.
- Default branch: `main`. The repo is public. GitHub Pages can serve it from `main` / root.

## Ideas / not done yet

- Re-add physics crates in multiplayer (needs host-synced physics).
- Host-side hit validation (line of sight / range checks) if cheating ever matters.
- A TURN server option for players behind strict networks.
- Optional automated tests (the harness above could live in `tests/`).
