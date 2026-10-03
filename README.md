# Trickshot Sandbox

A browser FPS where you chain slides, bunnyhops and wall bounces to build speed, then land
absurd trickshots for a big score multiplier. No build step: three.js and PeerJS load from a CDN.

## Run it

Open `index.html` in a browser (or serve the folder, e.g. `python3 -m http.server`).

To play with friends, host the folder somewhere static. GitHub Pages is free: repo
**Settings → Pages → Deploy from a branch**. Share the Pages URL, or the invite link the room gives you.

## Modes

**Singleplayer** — the original sandbox: shoot targets, chase score.

**Multiplayer** — up to 8 players, no accounts, no public lobbies:

1. One player clicks **Create room** and picks a sub-mode. They get a 5-letter code.
2. Everyone else enters the code under **Join a room** (or opens the invite link).
3. Rounds are 3 minutes; the scoreboard shows at the end, then a new round starts. The host can change
   the sub-mode for the next round from the room panel. Hold **Tab** for the scoreboard.

| Sub-mode | What happens |
| --- | --- |
| **Score Race** | Everyone shoots the same targets. Players can't hurt each other. Best trickscore wins. |
| **Deathmatch** | Targets are off. Any hit eliminates (3s respawn, 1.5s spawn protection). Kills pay out your full trick multipliers, plus a headshot bonus. |

### How multiplayer works

Peer-to-peer over WebRTC (PeerJS). The host's browser is the authority for the round clock, target
spawns, who is alive and the scoreboard. The free PeerJS cloud server is only used to introduce
players; game traffic goes directly between browsers. Hit detection is done by the shooter (fine for
friends, not cheat-proof). Keep the host's tab open — if the host leaves, the room closes.
Some strict NATs/corporate networks can't make direct WebRTC connections without a TURN server.

## Files

- `index.html` — page + menus
- `style.css` — styles
- `game.js` — everything else (movement, scoring, weapons, audio, multiplayer)
