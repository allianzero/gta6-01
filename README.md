# Palmira Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/allianzero/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/allianzero/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built for make.fun's "Make GTA 6" bounty. Palmira Bay is a sun-soaked coastal city you explore on foot and by car: steal cars, outrun the police, and run six story jobs for Marco "Rook" Santana, from his first stolen car to the King of Palmira. Everything in it is original — its city, characters, vehicles, names, story, art and sounds.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network: `game/` is plain static files. Keyboard and mouse.

## Controls

- **WASD / Arrows** — move & drive · **Shift** — run
- **Mouse** — aim · **Click** — shoot
- **E** — steal / enter / exit a car
- **Space** — handbrake · **M** — mute · **Esc** — pause

## What's in the city

- **A living city** — 8×8 blocks of streets, parks, parking lots and a beach promenade, generated from a fixed seed so the map is the same every visit; traffic drives the lanes and turns at intersections; pedestrians stroll the sidewalks and flee from gunfire.
- **Cars to steal and drive** — arcade handling with handbrake drifts, damage, smoke and explosions; steal a stranger's car and the driver flees while your wanted level rises.
- **A wanted level and police who respond** — 0 to 5 stars; police cars chase and ram, officers on foot shoot and bust you if they get close; stay clean and out of sight and the heat cools off.
- **Six missions and a story** — steal a car, deliver a package, lose the heat, collect three drops, outrun a timer to the hideout, then take out the rival crew and reach the rooftop party. Cash rewards, a save in your browser, and a free-roam ending.
- **Combat** — a pistol with mouse aim, rival gunners who shoot back, health and armour pickups, cash dropped by startled pedestrians.
- **A HUD with a minimap** — wanted stars, cash, health and armour bars, speed, the mission objective with an off-screen arrow, and a live minimap with the objective, the police and the player.
- **Polish** — a title screen over a living city, pause / wasted / busted / ending screens, screen shake, skid smoke, particles, and fully synthesised sound (engine, sirens, gunshots and a bass groove) with no audio files.

## Layout

- `game/index.html` + `game/src/*.js` — the game, plain ES modules, no libraries, no build step.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library. Run it with `MAKEFUN_OUTPUT_DIR=out node main.ts`.
- `screenshots/` — four real renders of the game in a browser (title, driving, police chase, mission).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `serve.ts` — a tiny static server for local play. `shots.json` — the four screenshot scenes.

## Run the entry program

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It needs no network, no dependencies and no secrets: two runs write the same bytes.

---

<sub>Entered on [make.fun](https://make.fun/?ref=f0netwmk&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
