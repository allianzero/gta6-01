# Palmira Bay — Make GTA 6 (gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/allianzero/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/allianzero/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Palmira Bay** is an original open-world crime game that runs entirely offline in a desktop browser. Sun, sand and trouble on the Coral Coast: Rosa needs a driver, the PBPD is always watching, and the bay is yours to take — one job at a time.

Everything is original: the city of Palmira Bay, its nine districts, its characters (Rosa, Dante and the Vipers), its cars, its story and its synthesized music. Nothing from Rockstar Games or any other commercial game.

## What is in the game

- **A city to explore on foot and by car** — nine districts (Old Harbor, Neon Strip, Downtown, Coral Beach, South Docks and more), a deterministic road grid, buildings, parks, palms, parking lots and landmarks like the Coral Crown Casino and Bayview Pier.
- **Traffic and pedestrians** — cars cruise the grid, park, honk and crash; pedestrians stroll the sidewalks, flee gunfire and panic when a car comes at them.
- **Steal and drive** — walk up to any car and press E. Six vehicle types, from the Bay Taxi to the Vortex GT, with arcade handling, handbrake and damage.
- **Wanted system and police** — crime raises your stars (up to 5). PBPD cruisers chase, ram and bust you on foot; lay low and the heat cools off.
- **Missions and a story** — five chapters for Rosa's crew: First Wheels, Courier Run, Heat Wave, Payback and the Coral Bank score, with timers, objectives and a mission marker on the minimap.
- **Combat** — fists, pistol and SMG, enemy gang members who shoot back, bullets, muzzle flashes and floating damage numbers.
- **HUD with a live minimap** — cash, health, wanted stars, clock, speed, mission card and toasts, plus a day/night cycle.
- **Start screen and saving** — menu, how-to-play, pause, and F5/F9 save & load via localStorage (cash, weapons, level, missions).
- **Polish** — fully synthesized WebAudio sound: engine hum, sirens, gunshots, pickups and a looping coastal groove. No audio files, no network requests, no images — all art is drawn in code.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Shift | Run |
| Mouse | Aim, click to shoot |
| E | Enter or steal car, talk, grab |
| F | Punch |
| Space | Handbrake (in car) |
| Q / 1 / 2 / 3 | Switch weapon |
| H | Horn |
| P / Esc | Pause |
| M | Mute |
| F5 / F9 | Save / load |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static file server and open `game/index.html`. The game is plain static files under `game/` — no build step, no network request.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game itself: the start menu, driving the Neon Strip, a 3-star police chase, and the Payback mission at the South Docks.

## License

MIT — see [LICENSE](LICENSE).
