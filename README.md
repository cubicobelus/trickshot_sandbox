# Trickshot Sandbox

A browser FPS where you chain slides, bunnyhops and wall bounces to build speed, then land
absurd trickshots for a big score multiplier. Plain HTML and JavaScript, no build step.

## Play

**[▶ Play in your browser](https://cubicobelus.github.io/trickshot_sandbox/)**: nothing to download or install.
Click the link, then click **Click to play**. Press **Esc** for the menu. Needs a keyboard and mouse.

<details>
<summary>Running it offline</summary>

The game's files must stay **together**: `index.html`, `style.css`, `game.js`, `sounds.js` and the `lib` folder.
Downloading only `index.html` gives you an unstyled page that does nothing. Use **Code → Download ZIP**,
unzip, and open `index.html`. No internet connection is needed.

</details>

## How to play

**Controls:** WASD move, Space jump, Shift sprint (or walk, with Auto sprint on in Settings > Gameplay), Ctrl slide
(when moving faster than a walk; slower, Ctrl crouch-walks), E grappling hook (tap it at a wall, the floor or a target to zip
there; tap again or jump to let go), R reload, F inspect, P replay last hit, hold M for the map, hold L for the leaderboard (Tab does the same in a room), left click attack,
right click aim down the sights (iron sights, or the scope or red dot if one is fitted) or throw (knife),
1 / 2 / Q / mouse wheel switch between gun and knife.
Playing goes fullscreen and locks keys like W, T and N away from the browser (Chrome and Edge), so Ctrl+W can't close the tab; turn that off in Settings > Gameplay. Every one of these can be changed in **Settings > Controls**: each action has two boxes, and a box takes a key, a
mouse button (left, right, middle, back, forward) or a wheel direction. Esc, Tab and Enter stay fixed for the menus. A **gamepad** works too (click the game once to start, since a browser won't start the mouse capture from a controller): left stick moves, right stick looks, A jump, B slide, X reload, Y swap gun and knife, LB grapple, RB knife, LT aim, RT fire, stick click sprint, Select the leaderboard, D-pad left the map, Start the menu; the look speed is in Settings > Controls.

**First visit and tutorial:** the first time, the menu is just one line about the game and a Play button, which starts a two-minute intro (or skip it). The intro is six goals about the idea of the game: move and look, hit a target, hit one in the air, slide, ride a jump pad, then stack tricks for a 3x shot. Each goal ticks off when you do it; Enter skips one. After that the whole menu opens, and the Tutorial button becomes **More moves**: aiming, bunnyhops, wall bounces, the grapple, the knife and the map and records keys.

**Maps:** pick one in the menu (a small picture of each is shown; click the chosen one again for a bigger map). **Arena** is the original trickshot map; **Courtyard** is close quarters at dusk (a ring of walls with four gates); **Foundry** is a steel works built for team play (a long hall of crates with sliding gates, side lanes and a raised gallery at each end); **Rooftops** has three levels: a street canyon between buildings, rooftops at 6.5 and 10 m, linked by ladders, ramps and bridges (walk up to a ladder and hold forward to climb, jump to let go). **Harbour** is a container terminal at sunset (rows of shipping containers make lanes, some stacked two high with ladders, some with a ramp up the side, and a flag yard at each end); **Greenhouse** is a glass conservatory (hedges and planting beds make lanes round a central pond, with a wooden walkway up each side, ramps up from the flag yards and a bridge over the water); **Canyon** is a desert canyon with a river down the middle, a base at each end, ledges up both sides and two bridges; **Summit** is a wooded valley round a stepped hill (trails and ramps up three tiers, ladders up the last cliff) and the home of King of the Hill; **Moonbase** has low gravity and portals and **Ice Lake** is slippery. **Random** picks a different map each Score Attack run and each online round. Free play, Score Attack, practice with bots and online rooms all use them (the host picks the map for a room), and each map keeps its own Score Attack top 5. Bots use the ladders, ramps and roof edges too: they go up to reach you, and now and then climb to a roof to fight from there.

**Modes:** Free play is endless. **Score Attack** gives you 1 minute (after a 3-2-1 countdown) to
score as much as you can; Esc pauses the clock, and your top 5 runs are kept in your browser.

**Stats:** the Stats button in the menu shows your lifetime numbers: play time, accuracy, records (longest
shot, highest multiplier, top speed...), each gun, targets by colour, movement, and how often you've landed
each trick. Every map keeps its own records, on your own and in practice: your best trickshot and longest streak there (a new best on a map shows ★ MAP BEST). Hold L in a game to see them next to that map's Score Attack top 5, or open Stats for the list by map. **Achievements** (also in the menu) are goals to chase, from your first hit to a 720 no-scope
or a 100x shot, plus ones for the map features (portals, launch strips, lifts, ladders, the Summit hilltop) and King of the Hill. **Trick challenges** ask for one shot that puts certain tricks together, in four tiers from Bronze to Legendary (a 1440 no-scope, five targets in one jump, a 1000x shot, twelve tricks at once). All of it is kept in your browser. **Settings > Gameplay** can also **export your data** to a file and import it back (to move browsers or keep a backup), and **Settings > Accessibility** has Reduce motion, a high-contrast HUD, a HUD size slider and arrows that show where other players' shots come from; **Settings > View > Colorblind-friendly colours** recolours the targets, the red team (it turns orange) and the hill ring. **Settings > Gameplay > Erase all data** wipes everything
the game has saved and starts you over.

**Replays:** every hit is recorded. The menu's **Watch best trickshot** and **Watch last hit** buttons (and
**Watch best shot** on a Score Attack results screen) play it back from your view, slowing down around the
hit, with a **bullet cam** that rides the shot to the target. Press **P** while playing to watch your last
hit (P again to carry on). Your best trickshot's replay is kept in your browser. **Save video** in the replay bar
saves it as a video you can post anywhere (.webm, or .mp4 in Safari), and **Save card** (also in the menu and on the results screen) makes a picture of your best shot: the map with the shot drawn on it, the points and every trick.

**Loadout:** pick one gun in the menu (three favourites sit in the row, and **More guns** opens the rest); you always carry the knife too. 1 is the gun, 2 the knife.

- **Sniper:** iron sights out of the box; fit a low- or high-zoom scope from Attachments. Its no-scope (a hit from the hip) and quickscope (a hit just after aiming in) bonuses are its own, and the other guns score less per hit so trickshots stay king.
- **Rifle, AK, burst rifle:** the all-rounders. The burst rifle fires three rounds with each pull.
- **SMG:** very fast with little kick, but its damage fades with distance (full to 12 m, half by 35 m), so it is for sliding into close fights.
- **LMG:** 100 rounds, slow to aim and slow to reload.
- **DMR** (marksman rifle): semi-automatic, accurate, and zooms a little when you aim. Two body shots or one head shot kill.
- **Crossbow:** a real flying bolt (fast, with a little drop) that takes two body hits or one to the head, so you lead moving targets. One bolt, reloaded between shots.
- **Shotgun, double barrel shotgun, combat shotgun:** the pump is the standard; the double barrel holds two shells of ten pellets (a kill from the hip up close, nothing at range); the combat shotgun fires one shot per pull, weaker than the pump but quicker.
- **Deagle and revolver:** slow and exact (two body hits or one head hit). The revolver holds six: a tap is one aimed shot, holding the trigger fans the hammer (a quick, wide shot every 0.16 s that scores half, FANNED); it loads one round at a time and you can fire to stop loading.
- **Machine pistol:** a fast automatic with a 20-round magazine.
- **Dual SMGs:** fire in turn from both hands, very fast and wide, with 40 rounds shared. A hip gun: you cannot aim them.
- **Railgun:** charges while you hold the trigger (0.6 s, with a rising whine and glowing coils), then fires by itself; let go early and nothing happens. One bolt goes through up to three targets or players in a line (a wall stops it), and a bolt through two or more scores THREADED on each. Three cells.
- **Minigun:** spins up for a quarter of a second, then fires about sixteen rounds a second from a 150-round belt. While it spins you move at 60% speed, cannot sprint and cannot aim.
- **Bow:** hold the trigger to draw (0.7 s) and let go to loose an arrow (let go early and nothing flies); you walk at half speed while it is drawn or aimed.
- **Grenade launcher:** lobs a grenade that bounces and goes off after about two seconds or on touching a target or player. The blast scores every target in it, hurts everyone but you (full damage in the middle, a quarter at 4.5 m) and throws you away from it, so you can blast jump. It takes a bigger load or a quick loader.
- **RPG:** one fast rocket that goes off on the first thing it touches (a wider blast, a long reload), and it kicks you backwards when it fires. It takes a red dot, a 2x scope or a quick loader.

Bots never carry the launcher or the RPG, and neither is in the gun game by default.

**G** throws a grenade from any gun on a 9 second cooldown (off in the gun game): hold it to throw further, and from halfway the fuse starts burning, so you can cook it for a quicker blast; hold it too long and it goes off in your hand, which kills you in a room. **C** throws a blast pack (a Raze-style satchel): it sticks where it lands and goes off when you press C again or after 4 seconds, flinging you away from it and only scratching other players (5 to 15 damage; none to you; 6 second recharge). In a room your own grenade, launcher and RPG blasts hurt you like anyone else.

**Throwables:** pick what G throws in the loadout (More guns, grenade): the **Frag** above, a **Sticky** grenade that glues to the first wall or floor it touches (a direct hit on a target or a player sets it off at once), **Smoke** that pops into a cloud about 10 m across for 13 s (bots can't see through it, and standing inside it greys out your view), or a **Flash** that blinds anyone near who is looking at it, bots included (turn away). A host can switch any throwable, the blast pack too, off for a room in the setup window's rules; if yours is off, G throws the next one the room allows.

The bottom left shows a small tile for the grenade, the blast pack and the grapple: lit when ready, dim with a thin grey ring filling round it while it recharges, pulsing while a pack waits for you to set it off. Holding G puts two tiny bars under the crosshair: how far the throw will go, and once the pin is out, how much fuse is left.

**Attachments** (the button under the loadout) add scopes, a red dot, suppressors, brakes, grips, magazines, a choke or a laser to each gun (the SMG, rifle, AK, burst rifle, revolver and Deagle take lasers), plus a bipod (steadier when crouched, for the LMG and marksman rifle) and shotgun slugs (all the pellets in one tight, heavy shot). Every one is a trade (a suppressor is quiet but kicks a bit more, a high-zoom scope is slower to aim, an extended magazine reloads slower), and each unlocks once you have landed enough hits with that gun (10 to 80; a kill online counts as a hit). Every gun also has three **skins** (Desert camo, Midnight, Gold, Arctic and Crimson recolours), opened by landing 25, 75 and 150 hits with it and picked at the top of the Attachments window. Other players see your attachments and skin.

Shots that land on a wall, platform or the floor leave bullet holes (switch them off in Settings > View), and what flies off depends on what you hit: sparks from metal, dust from stone and concrete, chips from wood.

Base run speed is slow. You *build* speed by chaining slides, bunnyhops (press jump just as you land) and
wall bounces, up to 22 u/s (25 on Ice Lake). Tap **E** to fire the grappling hook at a wall, the floor or a target and
zip there (the gun goes away while it's out).

**Scoring:** every trick multiplies the shot. Being airborne, hang time, spins, speed, distance (no cap: the
further, the more), no-scopes, quickscopes, flicks, quick switches, launches off pads and ramps, shooting
backwards mid-flight, several hits in one jump, last-round shots, sliding, wall bounces, small and moving
targets and streaks all stack. Two things scale a shot down: firing from close in (under 15 m, down to x0.4 at
3 m; knife swings are exempt) and standing still (moving under 2 u/s when you fire, even if you hop in place).
The newer ones: PORTAL SHOT and STRIP SHOT (a hit soon after a portal or a launch strip), PLATFORM SHOT (riding a lift), ZERO-G (long hang time on a low-gravity map), ROCKET, LAUNCHER, GRENADE and PACK JUMP (a hit while still in the air from the shove of your own blast), THREADED (one railgun bolt through two or more targets), CHAIN (different movement tricks within 5 seconds: slide, wall bounce, grapple, pad or ramp launch, portal, strip, lift, blast jump), NEW (the first time in a run you land each trick, so variety pays), HIP SHOT (any gun that can aim, fired from the hip at 30 m or more), BUNNY HOP (three or more jumps chained on landing), DROP SHOT (a hit just after landing from a big drop), LADDER SHOT, QUICK DOUBLE and TRIPLE (targets in quick succession on the ground), and BUZZER BEATER (the last 3 seconds of a Score Attack). A **live trick feed** down the left shows the tricks and your chain as you pull them off (Settings > View turns it off).
The full list with every value is under **Trickshot list** in the menu.

Targets come in four kinds, each with its own colour and mark: red with a ring (standard, still), orange with side chevrons (always moving), blue with a diamond (small, still) and
purple with a star (tiny and fast, and it runs from you if you get close). How many of each are up at once is set in Settings > Targets.

Settings (sensitivity, crosshair, sound levels, target counts, unlimited ammo and so on) are saved in your
browser. **Settings > Crosshair** has ready-made presets you can fine-tune, and a hit-marker style (a crosshair flash, an X, a ring or none). **Settings > Mouse** can import your sensitivity from CS2 / CS:GO / Apex / TF2, Valorant, Overwatch 2 or
Call of Duty, so the same hand movement turns you the same amount here. **Settings > View > Graphics** trades looks for speed
(Auto steps down by itself if the game runs slow), and **Show FPS** puts a frame counter in the corner. **Realistic shooting** (Settings > Gameplay; on by default in every mode) makes shots spread the faster you move, up to 10 u/s, and more in the air. Standing still is
perfectly accurate, crouching tames recoil, and the sniper has a little spread from the hip. Turn it off for perfectly accurate shots, but every shot is then worth half (an UNREALISTIC x0.50 penalty).

## Multiplayer

Open the **Multiplayer** tab in the menu, pick a loadout and a name, then **Create room** (share the 5-letter code or
the invite link) or **Join** with a code. Up to 8 players, 3-minute rounds, peer-to-peer over WebRTC: the host's browser
runs the room, so the host has to keep their tab open. It is experimental and has only been tested lightly.

- **Score Race:** everyone shoots the same targets, and the best trickscore when the timer ends wins. Players can't hurt each other.
- **Deathmatch** (and **Team Deathmatch**, two teams with no friendly fire): targets are off and players shoot each other. The first to the kill limit (5 to 50, or none) wins, or whoever has the most kills when the 3 minutes end. 100 health. Sniper: one hit kills, anywhere.
- **King of the Hill** (and **Team King of the Hill**): the same health and damage, but kills only clear the hill. A ring marks the hilltop on the **Summit** map (it always plays there); stand alone on it to score a point a second, with someone else on it nobody scores, and the first to the first-to number times 5 wins (or the most hill time when the 3 minutes end). The ring and its column of light show who holds it, and bots fight for it. A progress bar across the top shows the score (the teams fill in from their own side), and the scoreboard (Tab or L, and at the end of a round) shows kills, deaths, K/D, headshots, damage, best kill and best streak. On your own, L shows this map's Score Attack top 5.
  Deagle: 55 to the body, a head hit kills. AK: 34 body / 50 head. Rifle: 26 body / 40 head. Shotgun: about 11 a pellet,
  falling off with distance. Knife: a swing kills in one hit; a thrown knife is 55 to the body or a kill to the head, like the Deagle. Health starts coming back after 10 seconds without taking
  damage or shooting. Only kills score (with the trick multipliers of the killing shot). When you're killed you watch the player who did it until you respawn, and a short recap says what killed you, from how far, and how much you hit them for, and the damage you deal floats up from the player you hit (switch the numbers off in Settings > View). Other players show what they're holding,
  reloads, knife swings and their grappling rope.
- The host checks hits against the shots it saw, limits how fast a player can send messages, and drops anyone who goes silent for
  12 seconds. It can't stop every kind of cheating, so play with people you know. Players can see each other's IP addresses
  (that's how WebRTC works).

The **Multiplayer tab** has three choices: **Practice vs bots**, **Host a room** and **Join a room** (type the code). Practice and Host open a setup window with the mode cards, a map picker with a bigger preview, and a Rules section (first to, bots, bot level, and the match options); it remembers your last choices, and the host can change the next round from the room. **Rules** also has match options the host can switch on: low gravity, one-shot kills, headshots only, fast respawn and **siphon** (every kill refills your health to 100; it starts on in every mode that is not a team mode, and in battle royale). The timer names any that are on.

**Practice vs bots** (no internet needed): a deathmatch, team deathmatch or King of the Hill against up to 7 AI players (11 on the big maps, up to 15 in a battle royale) on Easy, Medium or Hard. Bots take lifts, portals, jump pads and launch strips on purpose, remember where they last saw (or heard) you, and sometimes post up on an edge with a view. In a hill game they defend the hill harder, in battle royale they play more cautiously, and in deathmatch and battle royale a few have a light personality (a rusher, a marksman, a careful one). **Battle royale** gives everyone one life in a safe circle that closes in over the round (a red wall shows its edge, and the map popup draws it): anyone outside takes damage that gets worse, the last player standing wins, and the bots stay inside the circle and fight. **Capture the flag** is a team game: touch the other team's flag to pick it up and bring it back to your own flag (while yours is home) to score; kill the carrier and it drops, touch your own dropped flag to send it home, and it returns by itself after 15 seconds. It plays on Courtyard, Foundry, Greenhouse, Harbour, Moonbase, Rooftops and Canyon (the maps with two flag bases): a flag dropped in mid-air falls to the floor. The first-to number divided by 5 is the number of captures, and the bots attack, defend and hunt the carrier. **Gun game** gives everyone the same gun and swaps it for the next one with every kill: each game rolls a new ladder of ten guns picked at random from the guns the host has switched on in the setup window (every gun but the launcher and RPG by default; click a gun's icon to switch it on or off), the easiest first, then the knife; every gun comes with a sensible random setup of attachments that changes each game and is the same for everyone (a sniper always has a scope; your own loadout is locked), a kill shows LEVEL UP and your new gun, a kill with the knife wins, and getting knifed drops you a level. Every room round opens with a 3-2-1 (nobody moves or shoots), and for one second after you respawn you cannot be hurt, or until you shoot or move; teams open at opposite ends of the map and respawns avoid enemies and each other. The **Shooting range** is on the single player menu, next to Free play and Score Attack: stationary dummies stand at 10 to 70 metres on a lane with distance boards, they never shoot back, heal fast and return after a kill, every hit shows its damage, and a corner box lists what your gun does. They run
and strafe, use every gun with its real fire rate, reload, and take and deal the same damage as real players. Esc pauses it.

To switch multiplayer off completely, set `MULTIPLAYER_ENABLED` to `false` in `game.js`.

<details>
<summary><b>For developers: files, tuning and tests</b></summary>

**Files** (they must stay together):

- `index.html`: the page and the menus
- `style.css`: the styles (every colour is a named token at the top)
- `game.js`: everything else (movement, scoring, weapons, audio). Tuning knobs live in the `CFG`
  object at the top.
- `sounds.js`: recorded sounds, embedded so the game also works when opened from disk
- `lib/three.min.js`: [three.js](https://threejs.org) r128 (MIT license), the 3D engine, unchanged
- `lib/fonts/ChakraPetch-Bold.ttf`: the display font for the title and big numbers, [Chakra Petch](https://github.com/m4rc1e/Chakra-Petch) (SIL Open Font License, in `lib/fonts/OFL.txt`)
- `tools/sound-lab.html`: test bench for every sound in the game, played the way the game plays it,
  with sliders to try changes, plus the synthesized sniper shots kept for reference
  ([open it](https://cubicobelus.github.io/trickshot_sandbox/tools/sound-lab.html))

**Browsers:** built and tested in Chrome and Edge, and the test suite also passes in Firefox. Safari's engine (WebKit) runs it in the tests too, but Safari itself and sound there have not been tried. Keyboard lock (so Ctrl+W can't close the tab) is Chrome and Edge only; everything else works without it, and the game keeps running silently if a browser refuses sound.

**Running it:** open `index.html` in a browser to play your local copy and refresh after editing. Tuning knobs (movement,
scoring, accuracy, the grapple) are in the `CFG` object at the top of `game.js`.

**Tests:** they drive the real page in a headless browser and check the loadouts, weapon switching, the trickshot
list, settings, controls, the grapple, the tutorial, a full Score Attack run, every map (that every jump pad, spawn, flag base,
ladder and portal stands in the open and can be reached), and every sound in the sound lab.

```
pip install playwright
python -m playwright install chromium
python tests/run_tests.py                  # everything (about half an hour)
python tests/run_tests.py --quick          # the fast set, about 5 minutes
python tests/run_tests.py --only bots,maps # just these (see --list)
```

`--small` (also set by `--quick`) draws the test pages smaller, which is much faster; `TSB_VIEW=800x450` does the same.

**Reports:** if the game hits an error it shows a small red bar, and **Settings > Gameplay > Copy debug info** copies the game
version, browser, graphics level, map and mode and the last errors (nothing personal). Bump `GAME_VERSION` at the top of
`game.js` when you push a change, so a report says which build it came from.

</details>

<details>
<summary><b>Sound credits</b></summary>

Sniper shot: ["Rifle Gun Shot 01"](https://freesound.org/people/LilMati/sounds/433858/) by LilMati (CC0).
Deagle: ["Gunshot.wav"](https://freesound.org/people/Cloud-10/sounds/632821/) by Cloud-10 (CC0).
Rifle: ["AssaultRifle1.wav"](https://freesound.org/people/SuperPhat/sounds/404562/) by SuperPhat (CC0).
AK: ["AK47 Shot"](https://freesound.org/people/LeMudCrab/sounds/163457/) by LeMudCrab (CC0).
Shotgun: ["Shotgun Shot 03.wav"](https://freesound.org/people/LilMati/sounds/473846/) by LilMati (CC0).
Bolt action: from ["Sniper Rifle M24 SFX"](https://freesound.org/people/kennysvoice/sounds/351777/) by kennysvoice (CC0).
Footsteps, landings, reloads, knife, impacts and handling: short clips from CC0 recordings on
freesound.org; each is credited in `sounds.js`. A couple of small cues (the perfect-wall-bounce ping) are
generated in code.

</details>
