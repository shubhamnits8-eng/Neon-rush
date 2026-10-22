# NEON RUSH: CYBER VELOCITY

A free neon arcade racing game that runs in the browser. Plain HTML + CSS + JavaScript (ES modules) and Canvas.
No build step, no backend, no API keys, no external assets.

## Features
Endless 4-lane racer, traffic/barriers/trucks, energy orbs with combo multiplier, boost meter, shield pickup,
5 vehicles (garage), 8 missions + reputation level, synthesized sound (Web Audio), mobile touch controls, pause/restart,
reduced-motion + quality settings, progress saved in LocalStorage.

## Controls
- Desktop: A/D or arrows = lane, W/Up/Space = boost (hold), Esc/P = pause
- Mobile: tap the arrow buttons or swipe, hold BOOST, tap the pause button

## Run locally
Browsers block ES modules when opening `index.html` by double-click. Use a tiny local server:
`python -m http.server 8000` in this folder, then open http://localhost:8000

## Deploy (GitHub + Render Static Site)
1. GitHub: create repo `neon-rush`, upload everything in this folder (keep folders), commit to `main`.
   `index.html` must be at the repository root.
2. Render: New + > Static Site > connect the repo. Branch `main`, Build Command empty, Publish Directory `.`
3. Deploy. Your URL looks like `https://neon-rush-xxxx.onrender.com`. Every push to `main` redeploys automatically.

## Troubleshooting
- Blank page / "Oops" screen: the `src` folder or `styles.css` was not uploaded, or Publish Directory is wrong (must be `.`).
- Works on GitHub but 404 on Render: check Publish Directory is `.` and `index.html` is in the repo root, not inside a subfolder.
- No sound: click/tap once first (browsers block audio until a gesture) and check Settings > Sound.
- Progress missing: private/incognito mode or cleared site data wipes LocalStorage.

## Data stored locally (LocalStorage key `neonrush.save.v1`)
High score, credits, owned/selected vehicles, completed missions, best-run stats, settings. Nothing is sent anywhere.

## Tests
`node tests/logic-test.mjs` runs headless checks of scoring, collisions, pause, garage and missions.

## Future upgrades (not implemented)
Online leaderboards, daily challenges, multiplayer, cloud saves (all need a backend), more vehicles/tracks, music.
