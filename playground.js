const root = document.documentElement;

const player = document.getElementById('player');
const arena = document.getElementById('arena');
const worldMapEl = document.querySelector('.world-map');
const actionBtn = document.getElementById('actionBtn');
const sprintBtn = document.getElementById('sprintBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const upBtn = document.getElementById('upBtn');
const downBtn = document.getElementById('downBtn');
const dialogueBox = document.getElementById('dialogueBox');
const dialogueName = document.getElementById('dialogueName');
const dialogueText = document.getElementById('dialogueText');

const hitboxCanvas = document.getElementById('hitbox-canvas');
const hitboxCtx = hitboxCanvas ? hitboxCanvas.getContext('2d', { willReadFrequently: true }) : null;
const worldHitboxImg = document.getElementById('world-hitbox');
let hitboxReady = false;

let worldMapOffsetX = 0;
let worldMapOffsetY = 0;
let worldMapPixelWidth = 0;
let worldMapPixelHeight = 0;
const COLLISION_FEET_OFFSET = 10;

function parsePx(value) {
  const n = parseFloat(String(value || '').trim());
  return Number.isFinite(n) ? n : 0;
}

function getVar(name, fallback = 0) {
  const parsed = parsePx(getComputedStyle(root).getPropertyValue(name));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function updateWorldPlacement() {
  if (!arena || !worldMapEl) return;

  const arenaRect = arena.getBoundingClientRect();
  const worldWidth = getVar('--worldWidth', worldMapEl.offsetWidth || 0);
  const worldHeight = getVar('--worldHeight', worldMapEl.offsetHeight || 0);
  const centerOffsetX = getVar('--worldCenterOffsetX', 0);
  const offsetY = getVar('--worldOffsetY', 120);

  const centeredX = window.innerWidth / 2 - arenaRect.left - worldWidth / 2 + centerOffsetX;
  worldMapOffsetX = Math.round(centeredX);
  worldMapOffsetY = Math.round(offsetY);
  worldMapPixelWidth = worldWidth;
  worldMapPixelHeight = worldHeight;

  worldMapEl.style.left = `${worldMapOffsetX}px`;
  worldMapEl.style.top = `${worldMapOffsetY}px`;
}

function isBlockedAt(arenaX, arenaY) {
  if (!hitboxReady || !hitboxCtx) return false;
  const worldPxW = worldMapPixelWidth || getVar('--worldWidth', hitboxCanvas.width);
  const worldPxH = worldMapPixelHeight || getVar('--worldHeight', hitboxCanvas.height);
  const imgX = Math.round((arenaX - worldMapOffsetX) / worldPxW * hitboxCanvas.width);
  const imgY = Math.round((arenaY - worldMapOffsetY) / worldPxH * hitboxCanvas.height);
  if (imgX < 0 || imgY < 0 || imgX >= hitboxCanvas.width || imgY >= hitboxCanvas.height) return false;
  const pixel = hitboxCtx.getImageData(imgX, imgY, 1, 1).data;
  return pixel[3] > 128 && pixel[0] > 180 && pixel[1] < 80 && pixel[2] < 80;
}

function isSpriteFeetBlocked(arenaX, arenaY, spriteSize) {
  return isBlockedAt(arenaX + spriteSize * 0.2, arenaY + spriteSize - COLLISION_FEET_OFFSET)
    || isBlockedAt(arenaX + spriteSize * 0.5, arenaY + spriteSize - COLLISION_FEET_OFFSET)
    || isBlockedAt(arenaX + spriteSize * 0.8, arenaY + spriteSize - COLLISION_FEET_OFFSET);
}

function clampToArena(arenaX, arenaY, spriteSize) {
  const maxX = Math.max(0, (arena?.clientWidth || 0) - spriteSize);
  const maxY = Math.max(0, (arena?.clientHeight || 0) - spriteSize);
  return {
    x: Math.max(0, Math.min(arenaX, maxX)),
    y: Math.max(0, Math.min(arenaY, maxY)),
  };
}

function findNearestValidPosition(arenaX, arenaY, spriteSize) {
  const origin = clampToArena(arenaX, arenaY, spriteSize);
  function clear(px, py) {
    const clamped = clampToArena(px, py, spriteSize);
    return !isSpriteFeetBlocked(clamped.x, clamped.y, spriteSize);
  }
  if (clear(origin.x, origin.y)) return origin;
  for (let radius = 4; radius <= 160; radius += 4) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 10) {
      const tx = origin.x + Math.cos(angle) * radius;
      const ty = origin.y + Math.sin(angle) * radius;
      if (clear(tx, ty)) return clampToArena(tx, ty, spriteSize);
    }
  }
  return origin;
}

if (worldHitboxImg && hitboxCtx) {
  function loadHitbox() {
    if (worldHitboxImg.naturalWidth === 0) return;
    hitboxCanvas.width = worldHitboxImg.naturalWidth;
    hitboxCanvas.height = worldHitboxImg.naturalHeight;
    hitboxCtx.drawImage(worldHitboxImg, 0, 0);
    hitboxReady = true;
  }
  worldHitboxImg.addEventListener('load', loadHitbox);
  if (worldHitboxImg.complete) loadHitbox();
}

const idleFrames = [
  "Assets/Tomer'sWebsitePlayerIdle1.png.png",
  "Assets/Tomer'sWebsitePlayerIdle2.png.png"
];

const walkFrames = [
  "Assets/Tomer'sWebsitePlayerWalk1.png.png",
  "Assets/Tomer'sWebsitePlayerWalk2.png.png"
];

const pressed = { left: false, right: false, up: false, down: false };
let sprintHeld = false;
let sprintToggled = false;
let lastDirection = 'right';
let frameIndex = 0;
let frameElapsedMs = 0;
let currentFrames = idleFrames;
let currentX = 380;
let currentY = 430;

const baseSpeedPxPerSecond = 200;
const sprintSpeedMultiplier = 1.8;
const animationFps = 5;

const squareEls = Array.from(document.querySelectorAll('.game-square'));
const squareStates = {};
const dialogueConfig = {};

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

for (const el of squareEls) {
  const id = el.id || `sq-${Math.random().toString(36).slice(2, 8)}`;
  const x = parseFloat(el.dataset.x) || 0;
  const y = parseFloat(el.dataset.y) || 0;
  const canMove = (el.dataset.canMove ?? 'true') !== 'false';
  const mode = el.dataset.dialogueMode || 'sequence';
  const lines = (el.dataset.dialogue || '').split('||').map(s => s.trim()).filter(Boolean);

  dialogueConfig[id] = {
    texts: lines.length ? lines : [`You interacted with ${id}.`],
    mode,
    counter: 0,
  };

  let img = el.querySelector('.npc-sprite');
  if (!img) {
    img = document.createElement('img');
    img.className = 'npc-sprite';
    img.alt = 'NPC';
    el.appendChild(img);
  }

  const framesIdle = [
    el.dataset['idle-1'] || 'Assets/WebsiteNPC1Idle1.png.png',
    el.dataset['idle-2'] || 'Assets/WebsiteNPC1Idle2.png.png'
  ];

  const framesWalk = [
    el.dataset['walk-1'] || 'Assets/WebsiteNPC1Walk1.png.png',
    el.dataset['walk-2'] || 'Assets/WebsiteNPC1Walk2.png.png'
  ];

  squareStates[id] = {
    id,
    el,
    x,
    y,
    canMove,
    state: 'idle',
    timerMs: randRange(500, 1500),
    dirX: 0,
    dirY: 0,
    speed: randRange(25, 60),
    framesIdle,
    framesWalk,
    frames: framesIdle,
    frameIndex: 0,
    frameElapsedMs: 0,
    img,
    lastDirection: 'right',
  };

  img.src = framesIdle[0];
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
}

function getNextDialogueText(id) {
  const cfg = dialogueConfig[id];
  if (!cfg) return `You interacted with ${id}.`;
  if (cfg.mode === 'random') {
    return cfg.texts[Math.floor(Math.random() * cfg.texts.length)];
  }
  const idx = cfg.counter % cfg.texts.length;
  cfg.counter += 1;
  return cfg.texts[idx];
}

function isOverlapping(elA, elB) {
  if (!elA || !elB) return false;
  const a = elA.getBoundingClientRect();
  const b = elB.getBoundingClientRect();
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

let currentOverlapSquare = null;

function updateOverlap() {
  const found = squareEls.find(sq => isOverlapping(player, sq)) || null;
  if (found !== currentOverlapSquare) {
    currentOverlapSquare?.classList.remove('highlight');
    currentOverlapSquare = found;
    if (currentOverlapSquare) currentOverlapSquare.classList.add('highlight');
  }
}

function handleAction() {
  if (!currentOverlapSquare) {
    dialogueBox.hidden = true;
    return;
  }
  const id = currentOverlapSquare.id;
  dialogueName.textContent = id;
  dialogueText.textContent = getNextDialogueText(id).replace(/\/n/g, '\n');
  dialogueBox.hidden = false;
}

function closeDialogueOnMove() {
  if (!dialogueBox.hidden) dialogueBox.hidden = true;
}

function updateNPCs(dt) {
  for (const id of Object.keys(squareStates)) {
    const s = squareStates[id];
    const spriteSize = Math.max(s.el.offsetWidth || 0, s.el.offsetHeight || 0) || getVar('--playerSize', 80);

    if (hitboxReady && isSpriteFeetBlocked(s.x, s.y, spriteSize)) {
      const unstuck = findNearestValidPosition(s.x, s.y, spriteSize);
      s.x = unstuck.x;
      s.y = unstuck.y;
      s.state = 'idle';
      s.dirX = 0;
      s.dirY = 0;
      s.timerMs = randRange(400, 1000);
      s.frames = s.framesIdle;
      s.frameIndex = 0;
      s.frameElapsedMs = 0;
      s.img.src = s.frames[0];
    }

    if (s.canMove) {
      s.timerMs -= dt * 1000;
      if (s.timerMs <= 0) {
        if (s.state === 'idle') {
          s.state = 'walk';
          s.timerMs = randRange(700, 2000);
          const ang = randRange(0, Math.PI * 2);
          s.dirX = Math.cos(ang);
          s.dirY = Math.sin(ang);
          s.speed = randRange(20, 60);
          s.frames = s.framesWalk;
        } else {
          s.state = 'idle';
          s.timerMs = randRange(800, 1800);
          s.dirX = 0;
          s.dirY = 0;
          s.frames = s.framesIdle;
        }
        s.frameIndex = 0;
        s.frameElapsedMs = 0;
        s.img.src = s.frames[0];
      }

      if (s.state === 'walk') {
        let nx = s.x + s.dirX * s.speed * dt;
        let ny = s.y + s.dirY * s.speed * dt;
        const clamped = clampToArena(nx, ny, spriteSize);
        nx = clamped.x;
        ny = clamped.y;

        if (hitboxReady && isSpriteFeetBlocked(nx, ny, spriteSize)) {
          const valid = findNearestValidPosition(nx, ny, spriteSize);
          s.x = valid.x;
          s.y = valid.y;
          s.state = 'idle';
          s.dirX = 0;
          s.dirY = 0;
          s.timerMs = randRange(400, 1000);
          s.frames = s.framesIdle;
          s.frameIndex = 0;
          s.frameElapsedMs = 0;
          s.img.src = s.frames[0];
        } else {
          s.x = nx;
          s.y = ny;
          if (Math.abs(s.dirX) > 0.05) s.lastDirection = s.dirX < 0 ? 'left' : 'right';
        }
      }
    }

    s.el.style.left = `${Math.round(s.x)}px`;
    s.el.style.top = `${Math.round(s.y)}px`;

    s.frameElapsedMs += dt * 1000;
    const interval = 1000 / animationFps;
    if (s.frameElapsedMs >= interval) {
      const steps = Math.floor(s.frameElapsedMs / interval);
      s.frameElapsedMs -= steps * interval;
      s.frameIndex = (s.frameIndex + steps) % s.frames.length;
      s.img.src = s.frames[s.frameIndex];
    }

    s.img.style.setProperty('--npcFlip', s.lastDirection === 'left' ? -1 : 1);
  }
}

function placePlayer() {
  player.style.left = `${Math.round(currentX)}px`;
  player.style.top = `${Math.round(currentY)}px`;
  player.style.setProperty('--playerFlip', lastDirection === 'left' ? -1 : 1);
}

function makeHoldable(btn, dir) {
  if (!btn) return;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pressed[dir] = true;
    if (dir === 'left' || dir === 'right') lastDirection = dir;
  });
  btn.addEventListener('pointerup', (e) => {
    e.preventDefault();
    pressed[dir] = false;
  });
  btn.addEventListener('pointerleave', () => {
    pressed[dir] = false;
  });
}

makeHoldable(leftBtn, 'left');
makeHoldable(rightBtn, 'right');
makeHoldable(upBtn, 'up');
makeHoldable(downBtn, 'down');

document.addEventListener('pointerup', () => {
  pressed.left = pressed.right = pressed.up = pressed.down = false;
});

sprintBtn?.addEventListener('click', () => {
  sprintToggled = !sprintToggled;
  sprintBtn.setAttribute('aria-pressed', String(sprintToggled));
});

document.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      pressed.left = true;
      lastDirection = 'left';
      e.preventDefault();
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      pressed.right = true;
      lastDirection = 'right';
      e.preventDefault();
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      pressed.up = true;
      e.preventDefault();
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      pressed.down = true;
      e.preventDefault();
      break;
    case ' ':
    case 'Spacebar':
      handleAction();
      e.preventDefault();
      break;
    case 'Shift':
      sprintHeld = true;
      break;
  }
});

document.addEventListener('keyup', (e) => {
  switch (e.key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      pressed.left = false;
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      pressed.right = false;
      break;
    case 'ArrowUp':
    case 'w':
    case 'W':
      pressed.up = false;
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      pressed.down = false;
      break;
    case 'Shift':
      sprintHeld = false;
      break;
  }
});

actionBtn?.addEventListener('click', handleAction);

let spawnValidated = false;
let lastTime = null;

function loop(timestamp) {
  if (lastTime == null) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (!spawnValidated && hitboxReady) {
    const playerSize = getVar('--playerSize', 80);
    const p = findNearestValidPosition(currentX, currentY, playerSize);
    currentX = p.x;
    currentY = p.y;
    for (const id of Object.keys(squareStates)) {
      const s = squareStates[id];
      const spriteSize = Math.max(s.el.offsetWidth || 0, s.el.offsetHeight || 0) || playerSize;
      const valid = findNearestValidPosition(s.x, s.y, spriteSize);
      s.x = valid.x;
      s.y = valid.y;
      s.el.style.left = `${Math.round(s.x)}px`;
      s.el.style.top = `${Math.round(s.y)}px`;
    }
    spawnValidated = true;
  }

  let dx = 0;
  let dy = 0;
  if (pressed.left) dx -= 1;
  if (pressed.right) dx += 1;
  if (pressed.up) dy -= 1;
  if (pressed.down) dy += 1;

  if (dx !== 0 || dy !== 0) {
    closeDialogueOnMove();
    if (dx !== 0 && dy !== 0) {
      dx *= 1 / Math.sqrt(2);
      dy *= 1 / Math.sqrt(2);
    }

    const playerSize = getVar('--playerSize', 80);
    const speed = baseSpeedPxPerSecond * ((sprintHeld || sprintToggled) ? sprintSpeedMultiplier : 1);
    const nx = currentX + dx * speed * dt;
    const ny = currentY + dy * speed * dt;
    const clamped = clampToArena(nx, ny, playerSize);

    if (!hitboxReady || !isSpriteFeetBlocked(clamped.x, clamped.y, playerSize)) {
      currentX = clamped.x;
      currentY = clamped.y;
    }
  }

  const moving = dx !== 0 || dy !== 0;
  const targetFrames = moving ? walkFrames : idleFrames;
  if (targetFrames !== currentFrames) {
    currentFrames = targetFrames;
    frameIndex = 0;
    frameElapsedMs = 0;
    player.src = currentFrames[0];
  } else {
    frameElapsedMs += dt * 1000;
    const interval = 1000 / animationFps;
    if (frameElapsedMs >= interval) {
      const steps = Math.floor(frameElapsedMs / interval);
      frameElapsedMs -= steps * interval;
      frameIndex = (frameIndex + steps) % currentFrames.length;
      player.src = currentFrames[frameIndex];
    }
  }

  placePlayer();
  updateNPCs(dt);
  updateOverlap();
  requestAnimationFrame(loop);
}

placePlayer();
updateWorldPlacement();
window.addEventListener('resize', updateWorldPlacement);
requestAnimationFrame(loop);