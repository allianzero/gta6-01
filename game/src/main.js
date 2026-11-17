// Boot and the main loop: a fixed 60 Hz simulation, a state machine for the
// screens (title, playing, paused, wasted, busted, complete), and the global
// keys (mute, pause, restart). The game starts muted until the first key or
// click, as browsers require for audio.

import { STEP } from './config.js';
import { createGame, startNewGame, continueGame, populateWorld, updateGame, drainEvents } from './world.js';
import { Input } from './input.js';
import { drawWorld } from './render.js';
import { drawHUD, drawTitle, drawPaused, drawWasted, drawBusted, drawComplete } from './hud.js';
import { applyShot, fakeInput } from './shots.js';
import { startMission } from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);

const G = createGame();
G.viewW = window.innerWidth;
G.viewH = window.innerHeight;

// Debug handle: lets a test driver read the live state (window.__palmira).
window.__palmira = G;

function resize() {
  G.viewW = window.innerWidth;
  G.viewH = window.innerHeight;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// The title screen shows a living city behind it.
populateWorld(G);
G.camera.x = 1980;
G.camera.y = 1980;
G.camera.zoom = 0.8;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(G, shot);
}

let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  G.sound.unlock();
}
window.addEventListener('keydown', unlockAudio, { once: false });
window.addEventListener('mousedown', unlockAudio, { once: false });

function quitToTitle() {
  G.mode = 'title';
  G.titleTime = 0;
  // Stop the old job and the old heat: nothing from the run follows the player here.
  G.mission = null;
  G.events = [];
  G.player.wanted = 0;
  G.player.health = G.player.maxHealth;
  // Rebuild the living backdrop so the title never shows a wrecked city.
  populateWorld(G);
  G.camera.x = 1980;
  G.camera.y = 1980;
  G.camera.zoom = 0.8;
}

function restartMission() {
  const m = G.mission;
  const index = m ? m.index : 0;
  startNewGame(G);
  // Jump back to the job that was running.
  if (index > 0) {
    G.mission = null;
    startMission(G, index);
  }
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += elapsed;

  // Global keys, whatever the mode.
  if (input.wasPressed('KeyM')) {
    G.sound.setMuted(!G.sound.muted);
  }

  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    accumulator -= STEP;
    steps++;
    tick();
  }
  if (steps === 5) accumulator = 0;

  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

function tick() {
  G.titleTime += STEP;
  switch (G.mode) {
    case 'title': {
      // The city lives behind the title; the camera drifts over downtown.
      updateGame(G, STEP, fakeInput());
      const t = G.titleTime * 0.07;
      G.camera.x = 1980 + Math.cos(t) * 420;
      G.camera.y = 1980 + Math.sin(t * 0.8) * 320;
      G.camera.zoom = 0.8;
      if (input.wasPressed('Enter', 'NumpadEnter')) {
        startNewGame(G);
      } else if (input.wasPressed('KeyC') && G.save.missionsDone > 0) {
        continueGame(G);
      }
      break;
    }
    case 'playing': {
      updateGame(G, STEP, input);
      drainEvents(G);
      if (input.wasPressed('Escape', 'KeyP')) {
        G.mode = 'paused';
      }
      break;
    }
    case 'paused': {
      if (input.wasPressed('Escape', 'KeyP')) G.mode = 'playing';
      else if (input.wasPressed('KeyR')) restartMission();
      else if (input.wasPressed('KeyQ')) quitToTitle();
      break;
    }
    case 'wasted':
    case 'busted': {
      if (input.wasPressed('Enter', 'NumpadEnter')) startNewGame(G);
      break;
    }
    case 'complete': {
      updateGame(G, STEP, fakeInput());
      if (input.wasPressed('Enter', 'NumpadEnter')) G.mode = 'playing';
      break;
    }
    default:
      break;
  }
}

function render() {
  ctx.clearRect(0, 0, G.viewW, G.viewH);
  ctx.fillStyle = '#11141b';
  ctx.fillRect(0, 0, G.viewW, G.viewH);
  if (G.mode === 'title') {
    drawWorld(G, ctx);
    drawTitle(G, ctx);
    return;
  }
  drawWorld(G, ctx);
  if (G.mode === 'playing' || G.mode === 'paused' || G.mode === 'complete') {
    drawHUD(G, ctx);
  }
  if (G.mode === 'paused') drawPaused(G, ctx);
  else if (G.mode === 'wasted') drawWasted(G, ctx);
  else if (G.mode === 'busted') drawBusted(G, ctx);
  else if (G.mode === 'complete') drawComplete(G, ctx);
}

// Pause when the tab loses focus mid-game.
window.addEventListener('blur', () => {
  if (G.mode === 'playing') G.mode = 'paused';
});

requestAnimationFrame(frame);
