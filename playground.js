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
const dialoguePanel = dialogueBox?.querySelector('.dialogue-panel') || null;
const dialogueName = document.getElementById('dialogueName');
const dialogueText = document.getElementById('dialogueText');
const tomeboyFrame = document.getElementById('tomeboy-frame');
const redirectArea = document.getElementById('mobile-redirect-area');

const musicAnnounceEl = document.createElement('div');
musicAnnounceEl.id = 'music-announcer';
musicAnnounceEl.className = 'music-announcer';
musicAnnounceEl.setAttribute('aria-live', 'polite');
musicAnnounceEl.setAttribute('aria-atomic', 'true');
musicAnnounceEl.hidden = true;
if (arena) arena.appendChild(musicAnnounceEl);

const hitboxCanvas = document.getElementById('hitbox-canvas');
const hitboxCtx = hitboxCanvas ? hitboxCanvas.getContext('2d', { willReadFrequently: true }) : null;
const worldHitboxImg = document.getElementById('world-hitbox');
let hitboxReady = false;

let worldMapOffsetX = 0;
let worldMapOffsetY = 0;
let worldMapPixelWidth = 0;
let worldMapPixelHeight = 0;
const COLLISION_FEET_OFFSET = 2;

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


  const centeredY = window.innerHeight / 2 - arenaRect.top - worldHeight / 2 + offsetY;
  const centeredX = window.innerWidth / 2 - arenaRect.left - worldWidth / 2 + centerOffsetX;
  worldMapOffsetX = Math.round(centeredX);
  worldMapOffsetY = Math.round(centeredY);
  worldMapPixelWidth = worldWidth;
  worldMapPixelHeight = worldHeight;

  worldMapEl.style.left = `${worldMapOffsetX}px`;
  worldMapEl.style.top = `${worldMapOffsetY}px`;
  updateMusicAnnouncerPosition();
}

function updateDialogueLayoutFromTomeboy() {
  if (!dialoguePanel || !tomeboyFrame) return;
  const rect = tomeboyFrame.getBoundingClientRect();
  if (!rect.width) return;

  const xScale = getVar('--dialogueBoxXScale', 0.15);
  const widthScale = getVar('--dialogueBoxWidthScale', 0.70);
  const xOffset = getVar('--dialogueBoxXOffset', 0);
  const yScale = getVar('--dialogueBoxYScale', 0.10);
  const heightScale = getVar('--dialogueBoxHeightScale', 0.40);
  const yOffset = getVar('--dialogueBoxYOffset', 0);
  const minHeight = getVar('--dialogueBoxMinHeight', 120);

  const leftPx = rect.left + rect.width * xScale + xOffset;
  const widthPx = Math.max(40, rect.width * widthScale);
  const topPx = window.innerHeight * yScale + yOffset;
  const heightPx = Math.max(minHeight, window.innerHeight * heightScale);

  dialoguePanel.style.left = `${Math.round(leftPx)}px`;
  dialoguePanel.style.width = `${Math.round(widthPx)}px`;
  dialoguePanel.style.top = `${Math.round(topPx)}px`;
  dialoguePanel.style.height = `${Math.round(heightPx)}px`;
}

function updateRedirectAreaLayoutFromTomeboy() {
  if (!redirectArea || !tomeboyFrame) return;
  const rect = tomeboyFrame.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const xScale = getVar('--redirectAreaXScale', 0.17);
  const yScale = getVar('--redirectAreaYScale', 0.245);
  const widthScale = getVar('--redirectAreaWidthScale', 0.68);
  const heightScale = getVar('--redirectAreaHeightScale', 0.098);
  const xOffset = getVar('--redirectAreaXOffset', 0);
  const yOffset = getVar('--redirectAreaYOffset', 0);

  const leftPx = rect.left + rect.width * xScale + xOffset;
  const topPx = rect.top + rect.height * yScale + yOffset;
  const widthPx = Math.max(100, rect.width * widthScale);
  const heightPx = Math.max(32, rect.height * heightScale);

  redirectArea.style.left = `${Math.round(leftPx)}px`;
  redirectArea.style.top = `${Math.round(topPx)}px`;
  redirectArea.style.width = `${Math.round(widthPx)}px`;
  redirectArea.style.height = `${Math.round(heightPx)}px`;
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
  "Assets/Mobile/MobilePlayerIdle1.png",
  "Assets/Mobile/MobilePlayerIdle2.png"
];

const walkFrames = [
  "Assets/Mobile/MobilePlayerWalk1.png",
  "Assets/Mobile/MobilePlayerWalk2.png"
];

const pressed = { left: false, right: false, up: false, down: false };
let sprintHeld = false;
let sprintToggled = false;
let lastDirection = 'right';
let frameIndex = 0;
let frameElapsedMs = 0;
let currentFrames = idleFrames;
let currentX = 0;
let currentY = 0;

const baseSpeedPxPerSecond = 20;
const sprintSpeedMultiplier = 2.4;
const animationFps = 5;

// Music system
const MUSIC_TRACKS_PLAYGROUND = [
    "Assets/Music/Mobile/Visager - Factory Time.mp3",
    "Assets/Music/Mobile/Visager - Royal Entrance.mp3",
    "Assets/Music/Mobile/Visager - The Plateau at Night.mp3",
];
const MUSIC_DEFAULT_VOLUME = 0.65;

let playgroundMusicAudio = null;
let playgroundMusicQueue = [];
let playgroundCurrentMusicTrack = '';
let playgroundMusicStarted = false;
let playgroundMusicPaused = false;
let playgroundMusicSkipRequested = false;
let playgroundMusicVolume = MUSIC_DEFAULT_VOLUME;
let musicAnnounceHideTimer = null;
let musicAnnounceShowRaf = 0;
let musicAnnounceSequence = 0;

function getMusicTrackLabel(trackPath) {
  const path = String(trackPath || '').trim();
  if (!path) return 'Unknown Track';
  const file = path.split('/').pop() || path;
  const withoutExt = file.replace(/\.[^/.]+$/, '');
  return withoutExt.trim() || 'Unknown Track';
}

function updateMusicAnnouncerPosition() {
  if (!musicAnnounceEl || !worldMapEl) return;
  const x = Math.round(worldMapOffsetX + getVar('--musicAnnounceOffsetX', 0));
  const y = Math.round(worldMapOffsetY + getVar('--musicAnnounceOffsetY', 0));
  musicAnnounceEl.style.left = `${x}px`;
  musicAnnounceEl.style.top = `${y}px`;
}

function showMusicAnnouncement(trackPath) {
  if (!musicAnnounceEl) return;
  musicAnnounceSequence += 1;
  const sequenceId = musicAnnounceSequence;
  const label = getMusicTrackLabel(trackPath);
  const visibleMs = Math.max(0, getVar('--musicAnnounceVisibleMs', 2200));
  const fadeMs = Math.max(0, getVar('--musicAnnounceFadeMs', 350));

  musicAnnounceEl.textContent = `Now Playing: ${label}`;
  musicAnnounceEl.style.setProperty('--musicAnnounceFadeMs', `${fadeMs}ms`);
  updateMusicAnnouncerPosition();

  if (musicAnnounceShowRaf) cancelAnimationFrame(musicAnnounceShowRaf);
  musicAnnounceEl.classList.remove('is-visible');
  musicAnnounceEl.hidden = false;

  // Defer class add so the browser paints the hidden state first, then fades in.
  musicAnnounceShowRaf = requestAnimationFrame(() => {
    musicAnnounceShowRaf = requestAnimationFrame(() => {
      if (sequenceId !== musicAnnounceSequence) return;
      musicAnnounceEl.classList.add('is-visible');
    });
  });

  if (musicAnnounceHideTimer) clearTimeout(musicAnnounceHideTimer);
  musicAnnounceHideTimer = window.setTimeout(() => {
    if (sequenceId !== musicAnnounceSequence) return;
    musicAnnounceEl.classList.remove('is-visible');

    const onFadeOutEnd = (event) => {
      if (event.target !== musicAnnounceEl) return;
      if (sequenceId !== musicAnnounceSequence) return;
      if (!musicAnnounceEl.classList.contains('is-visible')) {
        musicAnnounceEl.hidden = true;
      }
    };

    musicAnnounceEl.addEventListener('transitionend', onFadeOutEnd, { once: true });

    if (fadeMs === 0) {
      musicAnnounceEl.hidden = true;
    }
  }, visibleMs);
}

function playgroundClamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function playgroundShuffleList(items) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function playgroundRefillMusicQueue() {
    playgroundMusicQueue = playgroundShuffleList(MUSIC_TRACKS_PLAYGROUND);
    if (playgroundMusicQueue.length > 1 && playgroundMusicQueue[0] === playgroundCurrentMusicTrack) {
        const first = playgroundMusicQueue.shift();
        playgroundMusicQueue.push(first);
    }
}

function playgroundEnsureMusicAudio() {
    if (playgroundMusicAudio) return playgroundMusicAudio;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = playgroundMusicVolume;
    audio.addEventListener('ended', () => {
        playgroundPlayNextMusicTrack();
    });
    audio.addEventListener('error', () => {
        console.warn('Music track failed to load, skipping:', playgroundCurrentMusicTrack);
        playgroundPlayNextMusicTrack();
    });
    playgroundMusicAudio = audio;
    return audio;
}

function playgroundPlayNextMusicTrack() {
    if (!MUSIC_TRACKS_PLAYGROUND.length) return;
    const audio = playgroundEnsureMusicAudio();
    if (!playgroundMusicQueue.length) playgroundRefillMusicQueue();
    const nextTrack = playgroundMusicQueue.shift();
    if (!nextTrack) return;

    playgroundCurrentMusicTrack = nextTrack;
    audio.src = nextTrack;

    if (playgroundMusicPaused) {
        return;
    }

    showMusicAnnouncement(nextTrack);

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise
            .then(() => {
                playgroundMusicStarted = true;
            })
            .catch(() => {
                playgroundMusicStarted = false;
            });
    } else {
        playgroundMusicStarted = true;
    }
}

function playgroundMaybeStartMusicPlayback() {
    if (playgroundMusicPaused || playgroundMusicStarted || !MUSIC_TRACKS_PLAYGROUND.length) return;
    playgroundPlayNextMusicTrack();
}

function playgroundSetMusicPaused(value) {
    const next = Boolean(value);
    if (next === playgroundMusicPaused) return;
    playgroundMusicPaused = next;

    if (!playgroundMusicAudio) return;

    if (playgroundMusicPaused) {
        playgroundMusicAudio.pause();
        return;
    }

    if (!playgroundMusicAudio.src) {
        playgroundMaybeStartMusicPlayback();
        return;
    }

    const resumePromise = playgroundMusicAudio.play();
    if (resumePromise && typeof resumePromise.catch === 'function') {
        resumePromise
            .then(() => {
                playgroundMusicStarted = true;
            })
            .catch(() => {
                playgroundMusicStarted = false;
            });
    } else {
        playgroundMusicStarted = true;
    }
}

function playgroundSetMusicSkipRequested(value) {
    const next = Boolean(value);
    playgroundMusicSkipRequested = next;
    if (!next) return;
    playgroundPlayNextMusicTrack();
    playgroundMusicSkipRequested = false;
}

function parseIndexedFrames(dataset, prefix) {
  const lowerPrefix = String(prefix || '').toLowerCase();
  const frames = [];

  for (const key of Object.keys(dataset || {})) {
    const lowerKey = key.toLowerCase();
    if (!lowerKey.startsWith(lowerPrefix)) continue;

    const suffix = key.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;

    const order = parseInt(suffix, 10);
    const value = String(dataset[key] || '').trim();
    if (!value) continue;
    frames.push({ order, value });
  }

  frames.sort((a, b) => a.order - b.order);
  return frames.map(f => f.value);
}

// Expose as window properties
Object.defineProperty(window, 'playgroundMusicPaused', {
    get() { return playgroundMusicPaused; },
    set(val) { playgroundSetMusicPaused(val); },
    configurable: true
});

Object.defineProperty(window, 'playgroundMusicSkipRequested', {
    get() { return playgroundMusicSkipRequested; },
    set(val) { playgroundSetMusicSkipRequested(val); },
    configurable: true
});

Object.defineProperty(window, 'playgroundMusicVolume', {
    get() { return playgroundMusicVolume; },
    set(val) { 
        playgroundMusicVolume = playgroundClamp01(val);
        if (playgroundMusicAudio) playgroundMusicAudio.volume = playgroundMusicVolume;
    },
    configurable: true
});

// Button action handling
function getWindowPathValue(path) {
    const parts = String(path || '').split('.').map(p => p.trim()).filter(Boolean);
    if (!parts.length) return undefined;

    let ref = window;
    for (const part of parts) {
        if (ref == null || !(part in ref)) return undefined;
        ref = ref[part];
    }
    return ref;
}

function setWindowPathValue(path, value) {
    const parts = String(path || '').split('.').map(p => p.trim()).filter(Boolean);
    if (!parts.length) return false;

    let ref = window;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (ref[part] == null || typeof ref[part] !== 'object') return false;
        ref = ref[part];
    }

    const leaf = parts[parts.length - 1];
    ref[leaf] = value;
    return true;
}

function runButtonNpcAction(squareState) {
    const cfg = squareState?.buttonConfig;
    if (!cfg?.targetPath) return;

    const current = getWindowPathValue(cfg.targetPath);
    let next = current;

    switch (cfg.actionMode) {
        case 'set':
            next = cfg.actionValue;
            break;
        case 'add': {
            const base = Number(current);
            const delta = Number(cfg.actionValue);
            if (!Number.isFinite(base) || !Number.isFinite(delta)) return;
            next = base + delta;
            break;
        }
        case 'toggle':
        default:
            next = !Boolean(current);
            break;
    }

    if (!setWindowPathValue(cfg.targetPath, next)) return;
    
    // Update visual state after action
    updateButtonVisualState(squareState);
}

function updateButtonVisualState(squareState) {
    if (!squareState?.buttonConfig) return;
    const cfg = squareState.buttonConfig;
    const currentValue = getWindowPathValue(cfg.targetPath);
    const isOn = Boolean(currentValue);
    const frames = isOn ? cfg.onFrames : cfg.offFrames;
    
    squareState.frames = frames;
    squareState.frameIndex = 0;
    squareState.frameElapsedMs = 0;
    if (squareState.img && frames.length > 0) {
        squareState.img.src = frames[0];
    }
}

const squareEls = Array.from(document.querySelectorAll('.game-square'));
const squareStates = {};
const dialogueConfig = {};

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

for (const el of squareEls) {
  const id = el.id || `sq-${Math.random().toString(36).slice(2, 8)}`;
  const spawnOffsetX = parseFloat(el.dataset.x) || 0;
  const spawnOffsetY = parseFloat(el.dataset.y) || 0;
  const canMove = (el.dataset.canMove ?? 'true') !== 'false';
  const interactionTypeRaw = (el.dataset.interactionType || '').trim().toLowerCase();
  const interactionType = interactionTypeRaw === 'button' ? 'button' : 'dialogue';
  
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
    el.dataset['idle-1'] || 'Assets/WebsiteNPC1Idle1.png',
    el.dataset['idle-2'] || 'Assets/WebsiteNPC1Idle2.png'
  ];

  const framesWalk = [
    el.dataset['walk-1'] || 'Assets/WebsiteNPC1Walk1.png',
    el.dataset['walk-2'] || 'Assets/WebsiteNPC1Walk2.png'
  ];

  const buttonOffFramesIndexed = parseIndexedFrames(el.dataset, 'buttonOffIdle');
  const buttonOnFramesIndexed = parseIndexedFrames(el.dataset, 'buttonOnIdle');
  const buttonOffLegacy = (el.dataset.buttonOffIdle || '').trim();
  const buttonOnLegacy = (el.dataset.buttonOnIdle || '').trim();

  const defaultOffFrame = el.dataset['button-off-idle1'] || buttonOffLegacy || el.dataset['idle-1'] || 'Assets/WebsiteNPC1Idle1.png';
  const defaultOnFrame = el.dataset['button-on-idle1'] || buttonOnLegacy || el.dataset['idle-1'] || 'Assets/WebsiteNPC1Idle1.png';

  const offFrames = buttonOffFramesIndexed.length
    ? buttonOffFramesIndexed
    : [defaultOffFrame, el.dataset['button-off-idle2'] || defaultOffFrame];
  const onFrames = buttonOnFramesIndexed.length
    ? buttonOnFramesIndexed
    : [defaultOnFrame, el.dataset['button-on-idle2'] || defaultOnFrame];

  squareStates[id] = {
    id,
    el,
    x: 0,
    y: 0,
    spawnOffsetX,
    spawnOffsetY,
    canMove,
    state: 'idle',
    timerMs: randRange(500, 1500),
    dirX: 0,
    dirY: 0,
    speed: randRange(15, 30),
    framesIdle,
    framesWalk,
    frames: framesIdle,
    frameIndex: 0,
    frameElapsedMs: 0,
    img,
    lastDirection: 'right',
    interactionType,
    buttonConfig: interactionType === 'button' ? {
      targetPath: String(el.dataset.actionTarget || '').trim(),
      actionMode: (el.dataset.actionMode || 'toggle').toLowerCase(),
      actionValue: el.dataset.actionValue || null,
      offFrames,
      onFrames
    } : null,
  };

  img.src = framesIdle[0];
  el.style.left = `0px`;
  el.style.top = `0px`;
}

// Initialize button visual states
for (const id of Object.keys(squareStates)) {
  const state = squareStates[id];
  if (state.interactionType === 'button') {
    updateButtonVisualState(state);
  }
}

function setDialogueFont(url, fontFamily) {
    if (!url || !fontFamily) return;
    const linkId = 'dialogue-font-link' + btoa(url).replace(/=/g, '');
    if (!document.getElementById(linkId)) {
        const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: url, id: linkId });
        document.head.appendChild(link);
    }
    root.style.setProperty('--dialogueFontFamily', fontFamily);
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

function renderDialogueText(rawText) {
  const text = String(rawText || '').replace(/\/n/g, '\n');
  const linkTokenRegex = /\{link:([^|}]+)\|([^}]+)\}/g;
  let match;
  let lastIndex = 0;
  let foundLink = false;

  dialogueText.textContent = '';
  const fragment = document.createDocumentFragment();

  while ((match = linkTokenRegex.exec(text)) !== null) {
    foundLink = true;

    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    const label = match[1].trim();
    let href = match[2].trim();
    if (!/^([a-zA-Z][a-zA-Z0-9+.-]*:)?\/\//.test(href) && !href.startsWith('mailto:') && !href.startsWith('/')) {
      href = `https://${href}`;
    }

    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label || href;
    fragment.appendChild(link);

    lastIndex = linkTokenRegex.lastIndex;
  }

  if (!foundLink) {
    dialogueText.textContent = text;
    return;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  dialogueText.appendChild(fragment);
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
  const state = squareStates[id];
  
  // Handle button type NPCs
  if (state?.interactionType === 'button') {
    runButtonNpcAction(state);
    dialogueBox.hidden = true;
    return;
  }
  
  // Handle dialogue type NPCs
  dialogueName.textContent = id;
  renderDialogueText(getNextDialogueText(id));
  dialogueBox.hidden = false;
}

function closeDialogueOnMove() {
  if (!dialogueBox.hidden) dialogueBox.hidden = true;
}

function forcePlayerOutOfWall() {
  if (!hitboxReady) return;
  const playerSize = getVar('--playerSize', 80);
  if (!isSpriteFeetBlocked(currentX, currentY, playerSize)) return;
  const unstuck = findNearestValidPosition(currentX, currentY, playerSize);
  currentX = unstuck.x;
  currentY = unstuck.y;
}

function applyCenterRelativeSpawns() {
  const centerX = (arena?.clientWidth || 0) / 2;
  const centerY = (arena?.clientHeight || 0) / 2;
  const playerSize = getVar('--playerSize', 80);
  
  // Read player starting position from CSS variables (center-relative, like NPCs)
  const playerStartX = getVar('--playerStartX', 0);
  const playerStartY = getVar('--playerStartY', 0);
  const hasCustomStart = playerStartX !== 0 || playerStartY !== 0;

  currentX = centerX + (hasCustomStart ? playerStartX : 0);
  currentY = centerY + (hasCustomStart ? playerStartY : 0);
  const playerSpawn = findNearestValidPosition(currentX, currentY, playerSize);
  currentX = playerSpawn.x;
  currentY = playerSpawn.y;

  for (const id of Object.keys(squareStates)) {
    const s = squareStates[id];
    const spriteSize = Math.max(s.el.offsetWidth || 0, s.el.offsetHeight || 0) || playerSize;
    const spawnX = centerX + s.spawnOffsetX;
    const spawnY = centerY + s.spawnOffsetY;
    const valid = findNearestValidPosition(spawnX, spawnY, spriteSize);
    s.x = valid.x;
    s.y = valid.y;
    s.el.style.left = `${Math.round(s.x)}px`;
    s.el.style.top = `${Math.round(s.y)}px`;
  }
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
          s.speed = randRange(15, 25);
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

// Attempt autoplay immediately, then unlock on first user interaction if blocked.
playgroundMaybeStartMusicPlayback();
document.addEventListener('pointerdown', playgroundMaybeStartMusicPlayback, { once: true, capture: true });
document.addEventListener('keydown', playgroundMaybeStartMusicPlayback, { once: true, capture: true });

document.addEventListener('pointerup', () => {
  pressed.left = pressed.right = pressed.up = pressed.down = false;
});

sprintBtn?.addEventListener('click', () => {
  sprintToggled = !sprintToggled;
  sprintBtn.setAttribute('aria-pressed', String(sprintToggled));
});

if (redirectArea) {
  redirectArea.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = 'index.html';
  });
}

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
    case 'n':
    case 'N':
      playgroundPlayNextMusicTrack();
      e.preventDefault();
      break;
    case 'Shift':
      sprintHeld = true;
      break;
  }
  playgroundMaybeStartMusicPlayback();
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

function applyDialogueFontFromLink() {
    const link = document.getElementById('dialogue-font-link');
    const href = (link?.getAttribute('href') || '').trim();
    if (!href) return;
    try {
        const params   = new URLSearchParams(new URL(href, location.href).search);
        const families = params.getAll('family').map(v => `"${v.split(':')[0].replace(/\+/g, ' ').trim()}"`);
        root.style.setProperty('--dialogueFontFamily', families.length ? families.join(', ') + ', sans-serif' : 'sans-serif');
    } catch (err) {
        console.debug('Could not parse dialogue font link:', err);
    }
}

applyDialogueFontFromLink();
const _fontLink = document.getElementById('dialogue-font-link');
if (_fontLink) {
    _fontLink.addEventListener('load', applyDialogueFontFromLink);
    new MutationObserver(muts => {
        if (muts.some(m => m.attributeName === 'href')) applyDialogueFontFromLink();
    }).observe(_fontLink, { attributes: true });
}

let spawnValidated = false;
let lastTime = null;

function loop(timestamp) {
  if (lastTime == null) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (!spawnValidated && hitboxReady) {
    applyCenterRelativeSpawns();
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

  forcePlayerOutOfWall();

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
updateDialogueLayoutFromTomeboy();
updateRedirectAreaLayoutFromTomeboy();
window.addEventListener('resize', () => {
  updateWorldPlacement();
  updateDialogueLayoutFromTomeboy();
  updateRedirectAreaLayoutFromTomeboy();
});
requestAnimationFrame(loop);