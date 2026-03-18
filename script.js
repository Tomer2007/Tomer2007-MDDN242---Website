// =============================================================================
//  PORTFOLIO WEBSITE — script.js
//  Controls: Arrow keys / on-screen d-pad to move, Space / Interact to talk
// =============================================================================

// Disable the browser's built-in scroll restoration so it never overrides
// our own scroll management on page load or reload.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const root = document.documentElement;

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function parsePx(value) {
    const v = (value || '').trim();
    if (!v || v === 'auto') return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

function getVar(name, fallback = 0) {
    const parsed = parsePx(getComputedStyle(root).getPropertyValue(name));
    return Number.isFinite(parsed) ? parsed : fallback;
}

// ---------------------------------------------------------------------------
//  ZOOM
//  Reads --zoom-desktop and --zoom-mobile from :root in styles.css and
//  applies the correct one to <body> depending on screen width.
//  To change the zoom level, edit --zoom-desktop / --zoom-mobile in styles.css.
// ---------------------------------------------------------------------------

const isMobile = window.innerWidth < 900;

const hitboxCanvas = document.getElementById('hitbox-canvas');
const hitboxCtx    = hitboxCanvas ? hitboxCanvas.getContext('2d', { willReadFrequently: true }) : null;
let   hitboxReady  = false;

const worldHitboxImg = document.getElementById('world-hitbox');
if (worldHitboxImg && hitboxCtx) {
    function loadHitbox() {
        if (worldHitboxImg.naturalWidth === 0) return; // not ready yet
        hitboxCanvas.width  = worldHitboxImg.naturalWidth;
        hitboxCanvas.height = worldHitboxImg.naturalHeight;
        hitboxCtx.drawImage(worldHitboxImg, 0, 0);
        hitboxReady = true;
    }
    worldHitboxImg.addEventListener('load', loadHitbox);
    if (worldHitboxImg.complete) loadHitbox();
}

const COLLISION_FEET_OFFSET = 10;

// World map offset — must match .world-map top/left in styles.css
const WORLD_MAP_OFFSET_X = 590;   // px  (matches `left: 400px` in CSS)
const WORLD_MAP_OFFSET_Y = -30;   // px  (matches `top:  600px` in CSS)

function isBlockedAt(arenaX, arenaY) {
    if (!hitboxReady || !hitboxCtx) return false;

    // Convert arena coords to hitbox image coords
    const worldPxW = parsePx(getComputedStyle(root).getPropertyValue('--worldWidth'))  || hitboxCanvas.width;
    const worldPxH = parsePx(getComputedStyle(root).getPropertyValue('--worldHeight')) || hitboxCanvas.height;
    const imgX = Math.round((arenaX - WORLD_MAP_OFFSET_X) / worldPxW  * hitboxCanvas.width);
    const imgY = Math.round((arenaY - WORLD_MAP_OFFSET_Y) / worldPxH * hitboxCanvas.height);

    if (imgX < 0 || imgY < 0 || imgX >= hitboxCanvas.width || imgY >= hitboxCanvas.height) return false;

    const pixel = hitboxCtx.getImageData(imgX, imgY, 1, 1).data;
    // Blocked if red channel dominant and not transparent
    return pixel[3] > 128 && pixel[0] > 180 && pixel[1] < 80 && pixel[2] < 80;
}

function isSpriteFeetBlocked(arenaX, arenaY, spriteSize) {
    return isBlockedAt(arenaX + spriteSize * 0.2, arenaY + spriteSize - COLLISION_FEET_OFFSET)
        || isBlockedAt(arenaX + spriteSize * 0.5, arenaY + spriteSize - COLLISION_FEET_OFFSET)
        || isBlockedAt(arenaX + spriteSize * 0.8, arenaY + spriteSize - COLLISION_FEET_OFFSET);
}

function clampToArena(arenaX, arenaY, spriteSize) {
    const maxX = Math.max(0, (arena?.clientWidth  || 0) - spriteSize);
    const maxY = Math.max(0, (arena?.clientHeight || 0) - spriteSize);
    return {
        x: Math.max(0, Math.min(arenaX, maxX)),
        y: Math.max(0, Math.min(arenaY, maxY)),
    };
}


// ── UI POSITION OFFSETS ──────────────────────────────────────────────────────
// Adjust these to reposition the TomeBoy frame and button controls on screen.
// Positive X = right, Negative X = left. Positive Y = down, Negative Y = up.
const TOMEBOY_OFFSET_X  =   0;   // px
const TOMEBOY_OFFSET_Y  =   -125;   // px
const CONTROLS_OFFSET_X =   0;   // px
const CONTROLS_OFFSET_Y =   325;   // px

(function applyZoom() {
    const varName = isMobile ? '--zoom-mobile' : '--zoom-desktop';
    const zoom    = getVar(varName, 1.0);
    const zoomRoot = document.getElementById('zoom-root');
    if (!zoomRoot) return;
    zoomRoot.style.transformOrigin = 'top left';
    zoomRoot.style.transform       = `scale(${zoom})`;
    zoomRoot.style.width           = `${100 / zoom}%`;
})();

// ---------------------------------------------------------------------------
//  Movement state
// -------------------------------------------------------------------
let currentX = getVar('--buttonX', 0);
let currentY = getVar('--buttonY', 150);

const baseSpeedPxPerSecond  = 200;
const sprintSpeedMultiplier = 1.8;

// ---------------------------------------------------------------------------
//  TomeBoy screen-hole geometry
//
//  The TomeBoy sprite is 480×480 native. The black screen hole was measured:
//    left=112  right=367  top=131  bottom=339
//    centre: (239.5, 235.0)   half-extents: (127.5, 104.0)
//
//  The sprite is position:fixed centred by CSS, so we can compute the hole's
//  exact viewport rect from just the rendered size — no element queries needed.
//
//  Rendered size formula must match CSS: width = height = 480px * ctrl-scale / 2
// ---------------------------------------------------------------------------

const TB_NATIVE      = 480;
const TB_HOLE_CX     = 239.5;
const TB_HOLE_CY     = 235.0;
const TB_HOLE_HALF_W = 18.75;
const TB_HOLE_HALF_H = 16.00;
const MOVEMENT_REDUCTION_FOLLOW_BOUNDARY_SCALE = 1.2;
const MOVEMENT_REDUCTION_DRAG_BOUNDARY_SCALE = 0.55; // Smaller value = camera scrolls sooner when dragging
const MOVEMENT_REDUCTION_BOUNDARY_MAX_VIEWPORT_RATIO = 0.28;

function getTomeboySize() {
    const ctrlScale = parseFloat(getComputedStyle(root).getPropertyValue('--ctrl-scale')) || 2.8;
    return 480 * ctrlScale / 2;   // matches CSS: calc(480px * var(--ctrl-scale) / 2)
}

function getScreenHoleRect() {
    // Read the TomeBoy's actual rendered position — most reliable
    const tbRect = document.getElementById('tomeboy-frame')?.getBoundingClientRect();
    let tbLeft, tbTop, tbSize;
    if (tbRect && tbRect.width > 0) {
        tbLeft = tbRect.left;
        tbTop  = tbRect.top;
        tbSize = tbRect.width;
    } else {
        tbSize = getTomeboySize();
        tbLeft = window.innerWidth  / 2 - tbSize / 2;
        tbTop  = window.innerHeight / 2 - tbSize / 2;
    }
    const scale = tbSize / TB_NATIVE;
    const baseHalfW = TB_HOLE_HALF_W * scale;
    const baseHalfH = TB_HOLE_HALF_H * scale;

    // Use drag boundary scale when actively dragging, otherwise use standard follow boundary scale
    const movementReduced = Boolean(window.MovementReduction);
    const movementBoundaryScale = movementReduced
        ? (dragState ? MOVEMENT_REDUCTION_DRAG_BOUNDARY_SCALE : MOVEMENT_REDUCTION_FOLLOW_BOUNDARY_SCALE)
        : 1;

    let halfW = baseHalfW * movementBoundaryScale;
    let halfH = baseHalfH * movementBoundaryScale;

    // Keep boundary behavior consistent across displays by capping it to viewport size.
    // Without this cap, large rendered UI scales can make camera scrolling trigger too late.
    if (movementReduced) {
        const maxHalfW = window.innerWidth * MOVEMENT_REDUCTION_BOUNDARY_MAX_VIEWPORT_RATIO;
        const maxHalfH = window.innerHeight * MOVEMENT_REDUCTION_BOUNDARY_MAX_VIEWPORT_RATIO;
        halfW = Math.min(halfW, maxHalfW);
        halfH = Math.min(halfH, maxHalfH);
    }

    return {
        cx:    tbLeft + TB_HOLE_CX     * scale,
        cy:    tbTop  + TB_HOLE_CY     * scale,
        halfW,
        halfH,
    };
}

let dialogueBoundaryScale = 3.0;

let sprintHeld    = false;
let sprintToggled = false;
function isSprinting() { return Boolean(sprintHeld || sprintToggled); }

const pressed = { left: false, right: false, up: false, down: false };

// ---------------------------------------------------------------------------
//  DOM references
// ---------------------------------------------------------------------------

const player    = document.getElementById('player');
const arena     = document.getElementById('arena');
const leftBtn   = document.getElementById('leftBtn');
const rightBtn  = document.getElementById('rightBtn');
const upBtn     = document.getElementById('upBtn');
const downBtn   = document.getElementById('downBtn');
const actionBtn = document.getElementById('actionBtn');
const sprintBtn = document.getElementById('sprintBtn');

// ---------------------------------------------------------------------------
//  Player sprite animation
// ---------------------------------------------------------------------------

const idleFrames = [
    "Assets/Tomer'sWebsitePlayerIdle1.png",
    "Assets/Tomer'sWebsitePlayerIdle2.png"
];
const walkFrames = [
    "Assets/Tomer'sWebsitePlayerWalk1.png",
    "Assets/Tomer'sWebsitePlayerWalk2.png"
];

let frames         = idleFrames;
let frameIndex     = 0;
let frameElapsedMs = 0;
let lastDirection  = 'right';
const animationFps        = 4;
const sprintFpsMultiplier = 1.35;

if (player) player.src = frames[0];

// ---------------------------------------------------------------------------
//  NPC system — built from data-* attributes on .game-square elements
//
//  Each .game-square in index.html carries everything it needs:
//    data-x / data-y          → starting position in the arena (px)
//    data-size                → optional NPC size in px: "80" (both) or "120,80" (width,height)
//    data-idle-1/2            → paths to the two idle sprite frames
//    data-walk-1/2            → paths to the two walk sprite frames
//    data-can-move            → "true" | "false"
//    data-dialogue-mode       → "sequence" | "random"
//    data-dialogue            → pipe-separated dialogue lines  e.g. "Hi! | Bye!"
//
//  script.js reads those attributes here and builds its internal state.
//  To add a new NPC: add a <div class="game-square"> in index.html.
//  No changes to script.js are ever needed.
// ---------------------------------------------------------------------------

const CHICKEN_TOTAL_DEFAULT = 15;
const CHICKEN_COOP_STORAGE_KEY = 'website.chickenCoopState.v1';
const DEFAULT_COOP_AREA = { x: 1995, y: 3160, width: 265, height: 165 };
let chickenCountSyncAccumulator = 0;

function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function roundChickenCount(value, fallback = 0) {
    return Math.max(0, Math.round(toFiniteNumber(value, fallback)));
}

function getConfiguredCoopArea() {
    const coopEl = document.getElementById('CoopArea');
    const x = toFiniteNumber(coopEl?.dataset?.x, DEFAULT_COOP_AREA.x);
    const y = toFiniteNumber(coopEl?.dataset?.y, DEFAULT_COOP_AREA.y);
    const width = Math.max(1, toFiniteNumber(coopEl?.dataset?.width, DEFAULT_COOP_AREA.width));
    const height = Math.max(1, toFiniteNumber(coopEl?.dataset?.height, DEFAULT_COOP_AREA.height));

    if (coopEl) {
        coopEl.style.position = 'absolute';
        coopEl.style.left = `${Math.round(x)}px`;
        coopEl.style.top = `${Math.round(y)}px`;
        coopEl.style.width = `${Math.round(width)}px`;
        coopEl.style.height = `${Math.round(height)}px`;
        coopEl.style.pointerEvents = 'none';
    }

    const rect = { x, y, width, height };
    window.CoopArea = rect;
    return rect;
}

function isPointInsideRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width
        && y >= rect.y && y <= rect.y + rect.height;
}

function clampChickenPair(inCoop, outOfCoop) {
    const safeInCoop = roundChickenCount(inCoop, 0);
    const safeOutOfCoop = roundChickenCount(outOfCoop, CHICKEN_TOTAL_DEFAULT);
    return { inCoop: safeInCoop, outOfCoop: safeOutOfCoop };
}

function saveChickenState(inCoop, outOfCoop) {
    const pair = clampChickenPair(inCoop, outOfCoop);
    try {
        localStorage.setItem(CHICKEN_COOP_STORAGE_KEY, JSON.stringify({
            ChickensInCoop: pair.inCoop,
            ChickensOutofCoop: pair.outOfCoop
        }));
    } catch (_err) {
        // Ignore storage errors.
    }
}

function loadChickenState() {
    try {
        const raw = localStorage.getItem(CHICKEN_COOP_STORAGE_KEY);
        if (!raw) return { inCoop: 0, outOfCoop: CHICKEN_TOTAL_DEFAULT };
        const parsed = JSON.parse(raw);
        return clampChickenPair(parsed?.ChickensInCoop, parsed?.ChickensOutofCoop);
    } catch (_err) {
        return { inCoop: 0, outOfCoop: CHICKEN_TOTAL_DEFAULT };
    }
}

function setChickenProgress(inCoop, outOfCoop, persist = true) {
    const pair = clampChickenPair(inCoop, outOfCoop);
    window.ChickensInCoop = pair.inCoop;
    window.ChickensOutofCoop = pair.outOfCoop;
    if (persist) saveChickenState(pair.inCoop, pair.outOfCoop);
}

function randInt(min, max) {
    const low = Math.ceil(Math.min(min, max));
    const high = Math.floor(Math.max(min, max));
    return Math.floor(Math.random() * (high - low + 1)) + low;
}

function randomPointInCoopArea(rect) {
    return {
        x: randInt(rect.x, rect.x + Math.max(1, rect.width - 1)),
        y: randInt(rect.y, rect.y + Math.max(1, rect.height - 1))
    };
}

function randomPointOutsideCoopArea(rect) {
    const minX = 1000;
    const maxX = 5000;
    const minY = 100;
    const maxY = 5000;
    for (let i = 0; i < 250; i++) {
        const point = { x: randInt(minX, maxX), y: randInt(minY, maxY) };
        if (!isPointInsideRect(point.x, point.y, rect)) return point;
    }
    return { x: maxX, y: maxY };
}

function createCoopChickenElement(id, x, y) {
    const div = document.createElement('div');
    div.className = 'game-square';
    div.id = id;
    div.setAttribute('data-chicken-flock', 'coop');
    div.setAttribute('data-x', String(Math.round(x)));
    div.setAttribute('data-y', String(Math.round(y)));
    div.setAttribute('data-idle-1', "Assets/Tomer'sWebsiteChickenIdle1.png");
    div.setAttribute('data-idle-2', "Assets/Tomer'sWebsiteChickenIdle2.png");
    div.setAttribute('data-walk-1', "Assets/Tomer'sWebsiteChickenWalk1.png");
    div.setAttribute('data-walk-2', "Assets/Tomer'sWebsiteChickenWalk2.png");
    div.setAttribute('data-night-idle1', 'Assets/Nighttime/WebsiteSleepingChicken1.png');
    div.setAttribute('data-night-idle2', 'Assets/Nighttime/WebsiteSleepingChicken2.png');
    div.setAttribute('data-night-idle3', 'Assets/Nighttime/WebsiteSleepingChicken3.png');
    div.setAttribute('data-can-move', 'true');
    div.setAttribute('data-dialogue-mode', 'random');
    div.setAttribute('data-night-dialogue-mode', 'random');
    div.setAttribute('data-night-dialogue', '{size_change:10}Bawk... ||{size_change:10} Bakaw... ||{size_change:20} Zzz...||{size_change:10} Zzz...||{size_change:30} Zzz...');
    div.setAttribute('data-dialogue', '{size_change:60}Bawk || {size_change:60}Bakaw || {size_change:20}Chirp || {size_change:10}hello...');
    return div;
}

function rebuildCoopChickenElements() {
    const arenaEl = document.getElementById('arena');
    if (!arenaEl) return;

    arenaEl.querySelectorAll('.game-square[data-chicken-flock="coop"]').forEach(el => el.remove());

    const state = loadChickenState();
    const coopArea = getConfiguredCoopArea();
    setChickenProgress(state.inCoop, state.outOfCoop, true);

    let nextId = 1;

    // Spawn chickens currently outside the coop.
    for (let i = 0; i < window.ChickensOutofCoop; i++) {
        const p = randomPointOutsideCoopArea(coopArea);
        arenaEl.appendChild(createCoopChickenElement(`square5-out-${nextId++}`, p.x, p.y));
    }

    // Spawn chickens currently inside the coop.
    for (let i = 0; i < window.ChickensInCoop; i++) {
        const p = randomPointInCoopArea(coopArea);
        arenaEl.appendChild(createCoopChickenElement(`square5-in-${nextId++}`, p.x, p.y));
    }
}

window.ChickensInCoop = 0;
window.ChickensOutofCoop = CHICKEN_TOTAL_DEFAULT;
window.CoopArea = { ...DEFAULT_COOP_AREA };
rebuildCoopChickenElements();

const squareEls    = Array.from(document.querySelectorAll('.game-square'));
const squareStates = {};    // keyed by element id
const dialogueConfig = {};  // keyed by element id — populated from data-* below
let npcSpawnPositionsValidated = false;
const DEFAULT_CHICKEN_NIGHT_IDLE = 'Assets/Mobile/MobileChicken.png';
const DEFAULT_CHICKEN_NIGHT_DIALOGUE = ['Bawk... (night mode)'];
let isNight = false;
let movementReduction = false;
const MOVEMENT_REDUCTION_SCALE = 0.5;

function randRange(min, max) { return Math.random() * (max - min) + min; }

function parseDialogueLines(raw) {
    return String(raw || '')
        .split('||')
        .map(s => s.trim())
        .filter(Boolean);
}

function parseActionValue(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return undefined;
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (text === 'null') return null;

    const num = Number(text);
    if (Number.isFinite(num)) return num;

    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
        try { return JSON.parse(text); }
        catch (_err) { /* fall through to plain string */ }
    }

    return text;
}

function parseNpcSize(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return null;

    const nums = text.match(/\d*\.?\d+/g) || [];
    if (!nums.length) return null;

    const first = parseFloat(nums[0]);
    const second = nums.length > 1 ? parseFloat(nums[1]) : NaN;

    if (!Number.isFinite(first) || first <= 0) return null;

    // Single value keeps previous behavior: square size.
    if (!Number.isFinite(second) || second <= 0) {
        return { width: first, height: first };
    }

    return { width: first, height: second };
}

function isUnsafePathSegment(segment) {
    return segment === '__proto__' || segment === 'prototype' || segment === 'constructor';
}

function getWindowPathValue(path) {
    const parts = String(path || '').split('.').map(p => p.trim()).filter(Boolean);
    if (!parts.length) return undefined;

    let ref = window;
    for (const part of parts) {
        if (isUnsafePathSegment(part)) return undefined;
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
        if (isUnsafePathSegment(part)) return false;
        if (ref[part] == null || typeof ref[part] !== 'object') return false;
        ref = ref[part];
    }

    const leaf = parts[parts.length - 1];
    if (isUnsafePathSegment(leaf)) return false;
    ref[leaf] = value;
    return true;
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

function isChickenPath(path) {
    return /chicken/i.test(String(path || ''));
}

function getButtonVisualOnState(buttonConfig, value) {
    if (!buttonConfig) return false;
    if (buttonConfig.onWhenDefined) return value === buttonConfig.onWhen;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return Boolean(value);
}

function applyButtonVisualState(squareState, isOn) {
    if (!squareState?.buttonConfig) return;

    const cfg = squareState.buttonConfig;
    const visual = isOn ? 'on' : 'off';
    if (squareState.buttonVisualState === visual && squareState.frames?.length) return;

    const nextFrames = isOn ? cfg.onFrames : cfg.offFrames;
    if (!Array.isArray(nextFrames) || !nextFrames.length) return;

    squareState.framesIdle = [...nextFrames];
    squareState.framesWalk = [...nextFrames];
    squareState.frames = squareState.framesIdle;
    squareState.frameIndex = 0;
    squareState.frameElapsedMs = 0;
    squareState.buttonVisualState = visual;
    if (squareState.img) squareState.img.src = squareState.frames[0];
}

function syncButtonNpcVisuals() {
    for (const id of Object.keys(squareStates)) {
        const s = squareStates[id];
        if (s?.interactionType !== 'button' || !s.buttonConfig?.targetPath) continue;
        const current = getWindowPathValue(s.buttonConfig.targetPath);
        applyButtonVisualState(s, getButtonVisualOnState(s.buttonConfig, current));
    }
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

    const updated = getWindowPathValue(cfg.targetPath);
    applyButtonVisualState(squareState, getButtonVisualOnState(cfg, updated));
}

for (const el of squareEls) {
    const id = el.id || `sq-${Math.random().toString(36).slice(2, 8)}`;

    // ── Read data-* attributes ──────────────────────────────────────────────

    const x        = parseFloat(el.dataset.x)  || 0;
    const y        = parseFloat(el.dataset.y)  || 0;
    const npcSize = parseNpcSize(el.dataset.size);
    const canMove  = (el.dataset.canMove ?? 'true') !== 'false'; // default: true
    const diagMode = el.dataset.dialogueMode || 'sequence';
    const textBoxTypeRaw = (el.dataset.textBoxType || el.dataset.textboxType || '').trim().toLowerCase();
    const textBoxType = textBoxTypeRaw === 'try' ? 'try' : 'default';
    const interactionTypeRaw = (el.dataset.interactionType || '').trim().toLowerCase();
    const interactionType = interactionTypeRaw === 'button' ? 'button' : 'dialogue';
    const chickenFlock = (el.dataset.chickenFlock || '').trim().toLowerCase();
    const isCoopChicken = chickenFlock === 'coop';

    // Dialogue lines are separated by || in the attribute
    const diagLines = parseDialogueLines(el.dataset.dialogue);

    // ── Build dialogueConfig entry ──────────────────────────────────────────
    dialogueConfig[id] = {
        texts:       diagLines.length ? diagLines : [`You interacted with ${id}.`],
        mode:        diagMode,
        counter:     0,
        randomRange: [0, Math.max(1, diagLines.length - 1)],
        textBoxType
    };

    // ── Build or reuse the NPC sprite <img> ────────────────────────────────
    let img = el.querySelector('.npc-sprite');
    if (!img) {
        img = document.createElement('img');
        img.className = 'npc-sprite';
        img.alt       = 'NPC';
        img.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;image-rendering:pixelated;';
        el.appendChild(img);
    }

    // Read sprite paths from data-* (fall back to a shared default path)
    const framesIdle = [
        el.dataset['idle-1'] || 'Assets/WebsiteNPC1Idle1.png',
        el.dataset['idle-2'] || 'Assets/WebsiteNPC1Idle2.png'
    ];
    const framesWalk = [
        el.dataset['walk-1'] || 'Assets/WebsiteNPC1Walk1.png',
        el.dataset['walk-2'] || 'Assets/WebsiteNPC1Walk2.png'
    ];
    const isChicken = [...framesIdle, ...framesWalk].some(isChickenPath);
    const indexedNightIdleFrames = parseIndexedFrames(el.dataset, 'nightIdle');
    const nightIdleLegacy = (el.dataset.nightIdle || '').trim();
    const nightIdleFrames = indexedNightIdleFrames.length
        ? indexedNightIdleFrames
        : (nightIdleLegacy ? [nightIdleLegacy] : [DEFAULT_CHICKEN_NIGHT_IDLE]);
    const nightDialogue = parseDialogueLines(el.dataset.nightDialogue);
    const nightDialogueMode = (el.dataset.nightDialogueMode || 'sequence').trim() || 'sequence';
    const buttonOnFramesIndexed = parseIndexedFrames(el.dataset, 'buttonOnIdle');
    const buttonOffFramesIndexed = parseIndexedFrames(el.dataset, 'buttonOffIdle');
    const buttonOnLegacy = (el.dataset.buttonOnIdle || '').trim();
    const buttonOffLegacy = (el.dataset.buttonOffIdle || '').trim();
    const buttonOnFrames = buttonOnFramesIndexed.length
        ? buttonOnFramesIndexed
        : (buttonOnLegacy ? [buttonOnLegacy] : [...framesIdle]);
    const buttonOffFrames = buttonOffFramesIndexed.length
        ? buttonOffFramesIndexed
        : (buttonOffLegacy ? [buttonOffLegacy] : [...framesIdle]);

    const actionModeRaw = (el.dataset.actionMode || '').trim().toLowerCase();
    const actionMode = (actionModeRaw === 'set' || actionModeRaw === 'add' || actionModeRaw === 'toggle')
        ? actionModeRaw
        : 'toggle';
    const actionValue = parseActionValue(el.dataset.actionValue);
    const onWhen = parseActionValue(el.dataset.buttonOnWhen);
    const onWhenDefined = String(el.dataset.buttonOnWhen ?? '').trim().length > 0;
    const buttonTargetPath = String(el.dataset.actionTarget || '').trim();

    // ── Store runtime state ─────────────────────────────────────────────────
    squareStates[id] = {
        el, id, x, y,
        canMove,
        baseCanMove: canMove,
        state:    'idle',
        timerMs:  randRange(800, 2400),
        dirX: 0,  dirY: 0,
        speed:    randRange(20, 60),
        interactedPaused: false,
        framesIdle, framesWalk,
        dayFramesIdle: [...framesIdle],
        dayFramesWalk: [...framesWalk],
        isChicken,
        isCoopChicken,
        nightIdleFrames,
        dayDialogueLines: [...(diagLines.length ? diagLines : [`You interacted with ${id}.`])],
        dayDialogueMode: diagMode,
        nightDialogue: nightDialogue.length ? nightDialogue : DEFAULT_CHICKEN_NIGHT_DIALOGUE,
        nightDialogueMode,
        interactionType,
        buttonVisualState: null,
        buttonConfig: {
            targetPath: buttonTargetPath,
            actionMode,
            actionValue,
            onFrames: [...buttonOnFrames],
            offFrames: [...buttonOffFrames],
            onWhen,
            onWhenDefined
        },
        frames:        framesIdle,
        frameIndex:    0,
        frameElapsedMs: 0,
        img,
        lastDirection: 'right'
    };

    img.src = framesIdle[0];
    img.style.setProperty('--npcFlip', 1);
    if (npcSize) {
        el.style.width = `${npcSize.width}px`;
        el.style.height = `${npcSize.height}px`;
    }
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;

    if (interactionType === 'button' && buttonTargetPath) {
        const current = getWindowPathValue(buttonTargetPath);
        applyButtonVisualState(squareStates[id], getButtonVisualOnState(squareStates[id].buttonConfig, current));
    }
}

// ---------------------------------------------------------------------------
//  Dialogue — get next line for a given NPC id
// ---------------------------------------------------------------------------

function getNextDialogueText(id) {
    const cfg = dialogueConfig[id];
    if (!cfg || !cfg.texts.length) return `You interacted with ${id}.`;

    if (cfg.mode === 'random') {
        return cfg.texts[Math.floor(Math.random() * cfg.texts.length)];
    } else {
        // sequence — advance counter and loop
        const idx = Math.floor(cfg.counter) % cfg.texts.length;
        cfg.counter += 1;
        return cfg.texts[idx];
    }
}

// Public console helpers
function setDialogueMode(id, mode)            { if (dialogueConfig[id]) dialogueConfig[id].mode = mode; }
function setDialogueCounter(id, value)        { if (dialogueConfig[id]) dialogueConfig[id].counter = Number(value) || 0; }
function setDialogueTexts(id, textsArray)     { if (dialogueConfig[id]) dialogueConfig[id].texts = Array.from(textsArray); }
function setDialogueBoundaryScale(v) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) dialogueBoundaryScale = n;
}

function applyNightStateToChickens() {
    for (const id of Object.keys(squareStates)) {
        const s = squareStates[id];
        if (!s?.isChicken) continue;

        const cfg = dialogueConfig[id];
        if (!cfg) continue;

        if (isNight) {
            s.canMove = false;
            s.state = 'idle';
            s.timerMs = randRange(700, 1400);
            s.dirX = 0;
            s.dirY = 0;
            const nightFrames = (Array.isArray(s.nightIdleFrames) && s.nightIdleFrames.length)
                ? s.nightIdleFrames
                : [DEFAULT_CHICKEN_NIGHT_IDLE];
            s.framesIdle = [...nightFrames];
            s.framesWalk = [...nightFrames];
            s.frames = s.framesIdle;
            s.frameIndex = 0;
            s.frameElapsedMs = 0;
            if (s.img) s.img.src = s.frames[0];

            cfg.texts = [...s.nightDialogue];
            cfg.mode = s.nightDialogueMode;
            cfg.counter = 0;
        } else {
            s.canMove = s.baseCanMove;
            s.framesIdle = [...s.dayFramesIdle];
            s.framesWalk = [...s.dayFramesWalk];
            s.frames = s.framesIdle;
            s.frameIndex = 0;
            s.frameElapsedMs = 0;
            if (s.img) s.img.src = s.frames[0];

            cfg.texts = [...s.dayDialogueLines];
            cfg.mode = s.dayDialogueMode;
            cfg.counter = 0;
        }
    }
}

function applyMovementReductionVisualState() {
    if (!arena) return;
    if (movementReduction) {
        arena.style.transformOrigin = 'top left';
        arena.style.transform = `scale(${MOVEMENT_REDUCTION_SCALE})`;
    } else {
        arena.style.transform = '';
        arena.style.transformOrigin = '';
    }
}

function applyMovementReductionNpcState() {
    for (const id of Object.keys(squareStates)) {
        const s = squareStates[id];
        if (!s) continue;

        if (movementReduction) {
            s.speed = 0;
            s.dirX = 0;
            s.dirY = 0;
            s.state = 'idle';
            s.frames = s.framesIdle;
            s.frameIndex = 0;
            s.frameElapsedMs = 0;
            if (s.img && s.frames?.length) s.img.src = s.frames[0];
        } else if (s.canMove && s.speed <= 0) {
            s.speed = randRange(20, 60);
        }
    }
}

function setMovementReduction(value) {
    const next = Boolean(value);
    if (next === movementReduction) return;
    movementReduction = next;
    applyMovementReductionVisualState();
    applyMovementReductionNpcState();
}

function setIsNight(value) {
    const next = Boolean(value);
    if (next === isNight) return;
    isNight = next;
    applyNightStateToChickens();
    applyMovementReductionNpcState();
}

function refreshChickenCoopCounts(force = false) {
    const coopArea = getConfiguredCoopArea();
    let inCoop = 0;
    let tracked = 0;

    for (const id of Object.keys(squareStates)) {
        const s = squareStates[id];
        if (!s?.isCoopChicken) continue;
        tracked += 1;

        const elW = s.el.offsetWidth || 0;
        const elH = s.el.offsetHeight || 0;
        const centerX = s.x + elW / 2;
        const centerY = s.y + elH / 2;
        if (isPointInsideRect(centerX, centerY, coopArea)) inCoop += 1;
    }

    const outOfCoop = Math.max(0, tracked - inCoop);
    if (!force && window.ChickensInCoop === inCoop && window.ChickensOutofCoop === outOfCoop) return;
    setChickenProgress(inCoop, outOfCoop, true);
}

window.setIsNight = setIsNight;
window.setMovementReduction = setMovementReduction;

try {
    Object.defineProperty(window, 'isNight', {
        configurable: true,
        get() { return isNight; },
        set(value) { setIsNight(value); }
    });
} catch (_err) {
    window.isNight = isNight;
}

try {
    Object.defineProperty(window, 'MovementReduction', {
        configurable: true,
        get() { return movementReduction; },
        set(value) { setMovementReduction(value); }
    });
} catch (_err) {
    window.MovementReduction = movementReduction;
}

function setDialogueFont(url, fontFamily) {
    if (!url || !fontFamily) return;
    const linkId = 'dialogue-font-' + btoa(url).replace(/=/g, '');
    if (!document.getElementById(linkId)) {
        const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: url, id: linkId });
        document.head.appendChild(link);
    }
    root.style.setProperty('--dialogueFontFamily', fontFamily);
}

// ---------------------------------------------------------------------------
//  Dialogue UI
// ---------------------------------------------------------------------------

let dialogueNode         = null;
let _typewriterHandle    = null;
let _typewriterCancelled = false;
const typewriterCps      = 60;

function createDialogueNode() {
    const d    = document.createElement('div');
    d.className = 'dialogue-box';
    // Text column
    const body = document.createElement('div');
    body.className = 'dialogue-body';
    d.appendChild(body);
    d.style.cssText = 'position:absolute; left:0; top:0; visibility:hidden;';
    document.body.appendChild(d);
    return d;
}

function hideDialogue() {
    if (!dialogueNode) return;

    const squareId = dialogueNode.dataset?.squareId || '';
    if (squareId && squareStates[squareId]) {
        const s = squareStates[squareId];
        s.interactedPaused = false;
        s.state = 'idle';
        s.timerMs = randRange(400, 1200);
    }

    if (_typewriterHandle) { clearTimeout(_typewriterHandle); _typewriterHandle = null; }
    _typewriterCancelled = true;
    dialogueNode.remove();
    dialogueNode = null;
}

// Compute and apply the dialogue box position above a given square element.
// Called both when first showing and every frame while open so it tracks moving NPCs.
function positionDialogueNearSquare(squareEl) {
    if (!dialogueNode || !squareEl) return;
    const rect    = squareEl.getBoundingClientRect();
    const boxRect = dialogueNode.getBoundingClientRect();
    const boxW    = boxRect.width  || dialogueNode._boxW || 0;
    const boxH    = boxRect.height || dialogueNode._boxH || 0;
    const vOffset = parsePx(getComputedStyle(root).getPropertyValue('--dialogueVerticalOffset')) || 12;
    dialogueNode.style.left = `${Math.round(rect.right  - boxW  + window.scrollX)}px`;
    dialogueNode.style.top  = `${Math.round(rect.top    - boxH - 6 - vOffset + window.scrollY)}px`;
}

function positionTryDialogueInScreen() {
    if (!dialogueNode) return;
    const hole = getScreenHoleRect();
    const width = parsePx(getComputedStyle(root).getPropertyValue('--tryDialogueWidth')) || 420;
    const height = parsePx(getComputedStyle(root).getPropertyValue('--tryDialogueHeight')) || 220;
    const yOffset = parsePx(getComputedStyle(root).getPropertyValue('--tryDialogueYOffset')) || 0;
    const left = hole.cx - width / 2;
    const top = hole.cy - height / 2 + yOffset;
    dialogueNode.style.left = `${Math.round(left)}px`;
    dialogueNode.style.top = `${Math.round(top)}px`;
}

// ---------------------------------------------------------------------------
//  Dialogue token rendering
//
//  Supported tokens (can be mixed in the same line):
//    {size_change:24}     → sets this line's dialogue font size to 24px
//    /n                   → line break
//    {link:Label|URL}     → clickable hyperlink, opens in new tab
//    {img:path/to/img}    → image on the RIGHT of the text
//                           size controlled by --dialogueImageSize in styles.css
// ---------------------------------------------------------------------------

function renderDialogueContent(rawText) {
    // Replace /n with real newlines
    let text = rawText.replace(/\/n/g, '\n');
    const body = dialogueNode.querySelector('.dialogue-body');

    // Optional leading size token: {size_change:int}
    // Example: {size_change:28} This line will render at 28px.
    let customSizePx = null;
    text = text.replace(/^\s*\{size_change:\s*(-?\d+)\s*\}\s*/i, (_m, n) => {
        const parsed = parseInt(n, 10);
        if (Number.isFinite(parsed) && parsed > 0) customSizePx = parsed;
        return '';
    });
    body.style.fontSize = customSizePx ? `${customSizePx}px` : '';

    // Extract any {img:...} tokens — there may be more than one, but we
    // render all of them to the right of the text column.
    const imgTokenRegex = /\{img:([^|}]+)\|?(\d*)\}/g;
    const imgPaths = [];
    text = text.replace(imgTokenRegex, (_m, path, size) => {
        imgPaths.push({ src: path.trim(), size: parseInt(size, 10) || 100 });
        return '';
    }).trim();

    // Process {link:...} tokens — convert to anchor HTML fragments.
    const linkTokenRegex = /\{link:([^|}]+)\|([^}]+)\}/g;
    const hasLinks = linkTokenRegex.test(text);

    // Remove any previously appended image elements so we start clean
    dialogueNode.querySelectorAll('.dialogue-img').forEach(el => el.remove());

    if (hasLinks) {
        // Has links → use innerHTML (no typewriter — keeps implementation simple)
        const html = text.replace(/\{link:([^|}]+)\|([^}]+)\}/g, (_m, label, href) => {
            let safeHref = href.trim();
            if (!/^([a-zA-Z][a-zA-Z0-9+.-]*:)?\/\//.test(safeHref) && !safeHref.startsWith('mailto:') && !safeHref.startsWith('/'))
                safeHref = 'https://' + safeHref;
            return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label.trim()}</a>`;
        });
        body.innerHTML = html;
    } else {
        // Plain text → measure full text for box sizing, then run typewriter
        body.textContent = text;
        dialogueNode.style.visibility = 'hidden';
        const m = dialogueNode.getBoundingClientRect();
        dialogueNode._boxW = m.width;
        dialogueNode._boxH = m.height;
        body.textContent = '';
        startTypewriter(body, text, typewriterCps);
    }

    // Append image elements to the dialogue box (they go after the body div,
    // which puts them to the right thanks to the flex layout in CSS).
    for (const { src, size } of imgPaths) {
        const img = document.createElement('img');
        img.src       = src;
        img.style.width = `${size}px`;
        img.style.height = 'auto';
        img.alt       = '';                    // decorative — no alt text needed
        img.className = 'dialogue-img';
        dialogueNode.appendChild(img);
    }
}

function showDialogueForSquare(squareEl) {
    if (!squareEl) return;

    if (!dialogueNode) dialogueNode = createDialogueNode();

    const id = squareEl.id || squareEl.dataset.name || 'object';

    // Tap same square again → close
    if (dialogueNode.dataset.squareId === id) { hideDialogue(); return; }

    const rawText = getNextDialogueText(id);
    renderDialogueContent(rawText);

    const cfg = dialogueConfig[id];
    const textBoxType = cfg?.textBoxType === 'try' ? 'try' : 'default';
    dialogueNode.dataset.textBoxType = textBoxType;
    dialogueNode.classList.toggle('dialogue-box-try', textBoxType === 'try');
    dialogueNode.style.position = textBoxType === 'try' ? 'fixed' : 'absolute';

    // Measure after rendering so we have box dimensions for positioning
    dialogueNode.style.visibility = 'hidden';
    const m = dialogueNode.getBoundingClientRect();
    dialogueNode._boxW = m.width  || dialogueNode._boxW;
    dialogueNode._boxH = m.height || dialogueNode._boxH;

    dialogueNode.dataset.squareId = id;
    if (textBoxType === 'try') positionTryDialogueInScreen();
    else positionDialogueNearSquare(squareEl);
    dialogueNode.style.visibility = 'visible';

    // Pause this NPC's wandering while the player is talking to it
    const s = squareStates[id];
    if (s) {
        s.interactedPaused = true;
        s.state            = 'idle';
        s.frames           = s.framesIdle;
        s.frameIndex       = 0;
        s.frameElapsedMs   = 0;
        if (s.img) s.img.src = s.frames[0];
    }
}

function startTypewriter(el, text, cps = 60) {
    if (_typewriterHandle) { clearTimeout(_typewriterHandle); _typewriterHandle = null; }
    _typewriterCancelled = false;
    el.textContent = '';
    if (!text) return;
    const delay = Math.max(4, Math.round(1000 / Math.max(1, cps)));
    let i = 0;
    function step() {
        if (_typewriterCancelled) return;
        el.textContent = text.slice(0, ++i);
        if (i < text.length) _typewriterHandle = setTimeout(step, delay);
        else _typewriterHandle = null;
    }
    _typewriterHandle = setTimeout(step, delay);
}

function isSquareWithinDialogueBoundary(squareEl) {
    if (!squareEl) return false;
    const r    = squareEl.getBoundingClientRect();
    const hole = getScreenHoleRect();
    const scale = Number(dialogueBoundaryScale) || 1;
    return Math.abs((r.left + r.width  / 2) - hole.cx) <= hole.halfW * scale
        && Math.abs((r.top  + r.height / 2) - hole.cy) <= hole.halfH * scale;
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dialogueNode) hideDialogue(); });

// ---------------------------------------------------------------------------
//  Overlap / collision detection
// ---------------------------------------------------------------------------

let currentOverlapSquare = null;

function isOverlapping(elA, elB) {
    if (!elA || !elB) return false;
    const a = elA.getBoundingClientRect();
    const b = elB.getBoundingClientRect();
    // Quick AABB rejection
    if (a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom) return false;
    // Centre-point checks for pixel-art sprites with transparent padding
    const acx = a.left + a.width  / 2, acy = a.top  + a.height / 2;
    const bcx = b.left + b.width  / 2, bcy = b.top  + b.height / 2;
    return (acx >= b.left && acx <= b.right && acy >= b.top && acy <= b.bottom)
        || (bcx >= a.left && bcx <= a.right && bcy >= a.top && bcy <= a.bottom)
        || true; // rects already intersected
}

function updateOverlap() {
    if (!player) return;
    const squares = Array.from(document.querySelectorAll('.game-square'));
    const found   = squares.find(sq => isOverlapping(player, sq)) ?? null;
    if (found !== currentOverlapSquare) {
        currentOverlapSquare?.classList.remove('highlight');
        currentOverlapSquare = found;
        if (found) { found.classList.add('highlight'); player.classList.add('overlap'); }
        else        { player.classList.remove('overlap'); }
    }
}

// ---------------------------------------------------------------------------
//  Action / interact
// ---------------------------------------------------------------------------

function handleAction() {
    if (dialogueNode) { hideDialogue(); return; }

    const target = currentOverlapSquare
        ?? Array.from(document.querySelectorAll('.game-square')).find(sq => isOverlapping(player, sq))
        ?? null;
    if (!target) return;

    const state = squareStates[target.id];
    if (state?.interactionType === 'button') {
        runButtonNpcAction(state);
        return;
    }

    showDialogueForSquare(target);
}

actionBtn?.addEventListener('click', handleAction);

// ---------------------------------------------------------------------------
//  NPC square update — wandering AI + frame animation
// ---------------------------------------------------------------------------

function updateSquares(dt) {
    if (!arena) return;

    if (!npcSpawnPositionsValidated && hitboxReady) {
        for (const id of Object.keys(squareStates)) {
            const s = squareStates[id];
            const spriteSize = Math.max(s.el.offsetWidth || 0, s.el.offsetHeight || 0)
                || parsePx(getComputedStyle(root).getPropertyValue('--playerSize'));
            if (spriteSize <= 0) continue;
            const spawn = findNearestValidPosition(s.x, s.y, spriteSize);
            const clamped = clampToArena(spawn.x, spawn.y, spriteSize);
            s.x = clamped.x;
            s.y = clamped.y;
            s.el.style.left = `${Math.round(s.x)}px`;
            s.el.style.top  = `${Math.round(s.y)}px`;
        }
        npcSpawnPositionsValidated = true;
    }

    for (const id of Object.keys(squareStates)) {
        const s  = squareStates[id];
        const el = s.el;
        const spriteSize = Math.max(el.offsetWidth || 0, el.offsetHeight || 0);
        const isDragged = dragState?.type === 'npc' && dragState.id === id;

        if (movementReduction && !isDragged) {
            s.speed = 0;
            s.dirX = 0;
            s.dirY = 0;
            if (s.state !== 'idle') {
                s.state = 'idle';
                s.frames = s.framesIdle;
                s.frameIndex = 0;
                s.frameElapsedMs = 0;
                if (s.img && s.frames?.length) s.img.src = s.frames[0];
            }
        }

        if (!isDragged && spriteSize > 0 && isSpriteFeetBlocked(s.x, s.y, spriteSize)) {
            const unstuck = findNearestValidPosition(s.x, s.y, spriteSize);
            const clamped = clampToArena(unstuck.x, unstuck.y, spriteSize);
            s.x = clamped.x;
            s.y = clamped.y;
            s.state = 'idle';
            s.dirX = 0;
            s.dirY = 0;
            s.timerMs = randRange(500, 1400);
            s.frames = s.framesIdle;
            s.frameIndex = 0;
            s.frameElapsedMs = 0;
            if (s.img) s.img.src = s.frames[0];
            el.style.left = `${Math.round(s.x)}px`;
            el.style.top  = `${Math.round(s.y)}px`;
        }

        // ── Interaction pause ───────────────────────────────────────────────
        if (s.interactedPaused && !isDragged) {
            if (!isOverlapping(player, el)) {
                s.interactedPaused = false;
                s.state   = 'idle';
                s.timerMs = randRange(400, 1200);
            } else {
                s.state  = 'idle';
                s.frames = s.framesIdle;
                // skip movement; fall through to animation update
            }
        }

        // ── Wander AI (only for NPCs with data-can-move="true") ─────────────
        if (s.canMove && !s.interactedPaused && !isDragged && !movementReduction) {
            s.timerMs -= dt * 1000;
            if (s.timerMs <= 0) {
                if (s.state === 'idle') {
                    s.state   = 'walk';
                    s.timerMs = randRange(600, 2200);
                    const ang = randRange(0, Math.PI * 2);
                    s.dirX    = Math.cos(ang);
                    s.dirY    = Math.sin(ang);
                    s.speed   = randRange(20, 60);
                    if (Math.abs(s.dirX) > 0.05) s.lastDirection = s.dirX < 0 ? 'left' : 'right';
                    s.frames       = s.framesWalk;
                    s.frameIndex   = 0;
                    s.frameElapsedMs = 0;
                    if (s.img) s.img.src = s.frames[0];
                } else {
                    s.state   = 'idle';
                    s.timerMs = randRange(800, 3000);
                    s.dirX = s.dirY = 0;
                    s.frames       = s.framesIdle;
                    s.frameIndex   = 0;
                    s.frameElapsedMs = 0;
                    if (s.img) s.img.src = s.frames[0];
                }
            }

            if (s.state === 'walk') {
                const elW     = el.offsetWidth  || 0;
                const elH     = el.offsetHeight || 0;
                const maxLeft = Math.max(0, arena.clientWidth  - elW);
                const maxTop  = Math.max(0, arena.clientHeight - elH);
                let nx = s.x + s.dirX * s.speed * dt;
                let ny = s.y + s.dirY * s.speed * dt;
                if (nx < 0)       { nx = 0;       s.dirX *= -1; }
                if (ny < 0)       { ny = 0;       s.dirY *= -1; }
                if (nx > maxLeft) { nx = maxLeft; s.dirX *= -1; }
                if (ny > maxTop)  { ny = maxTop;  s.dirY *= -1; }
                
                const npcFeetX = nx + (el.offsetWidth  || 0) / 2;
                const npcFeetY = ny + (el.offsetHeight || 0);
                if (!isBlockedAt(npcFeetX, npcFeetY)) {
                    s.x = nx; s.y = ny;
                } else {
                    s.dirX *= -1; s.dirY *= -1;  // bounce off wall
                }
                el.style.left = `${Math.round(s.x)}px`;
                el.style.top  = `${Math.round(s.y)}px`;
                
                if (Math.abs(s.dirX) > 0.05) s.lastDirection = s.dirX < 0 ? 'left' : 'right';
            }
        }

        // ── Sprite frame animation ──────────────────────────────────────────
        if (s.frames?.length && s.img) {
            s.frameElapsedMs += dt * 1000;
            const interval = 1000 / Math.max(1, animationFps);
            if (s.frameElapsedMs >= interval) {
                const steps      = Math.floor(s.frameElapsedMs / interval);
                s.frameElapsedMs -= steps * interval;
                s.frameIndex     = (s.frameIndex + steps) % s.frames.length;
                s.img.src        = s.frames[s.frameIndex];
            }
        }

        if (s.img) s.img.style.setProperty('--npcFlip', s.lastDirection === 'left' ? -1 : 1);
    }
}

applyMovementReductionVisualState();

// ---------------------------------------------------------------------------
//  Depth sorting
// ---------------------------------------------------------------------------

function updateDepthSorting() {
    const items = [];
    if (player) { const r = player.getBoundingClientRect(); items.push({ el: player, bottom: r.bottom }); }
    for (const { el } of Object.values(squareStates)) {
        const r = el.getBoundingClientRect();
        items.push({ el, bottom: r.bottom });
    }
    items.sort((a, b) => a.bottom - b.bottom);
    items.forEach(({ el }, i) => { el.style.zIndex = String(100 + i); });
}

// ---------------------------------------------------------------------------
//  CSS variable sync
// ---------------------------------------------------------------------------

function applyValues() {
    root.style.setProperty('--buttonX', `${Math.round(currentX)}px`);
    root.style.setProperty('--buttonY', `${Math.round(currentY)}px`);
}

// ---------------------------------------------------------------------------
//  On-screen controls
// ---------------------------------------------------------------------------

function makeHoldable(btn, dir) {
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pressed[dir] = true;
        if (dir === 'left' || dir === 'right') lastDirection = dir;
    });
    btn.addEventListener('pointerup',    (e) => { e.preventDefault(); pressed[dir] = false; });
    btn.addEventListener('pointerleave', ()  => { pressed[dir] = false; });
}

makeHoldable(leftBtn,  'left');
makeHoldable(rightBtn, 'right');
makeHoldable(upBtn,    'up');
makeHoldable(downBtn,  'down');

document.addEventListener('pointerup', () => {
    pressed.left = pressed.right = pressed.up = pressed.down = false;
});

sprintBtn?.addEventListener('click', () => {
    sprintToggled = !sprintToggled;
    sprintBtn.setAttribute('aria-pressed', String(sprintToggled));
    sprintBtn.classList.toggle('active', sprintToggled);
});

// ---------------------------------------------------------------------------
//  Keyboard input
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
    const a = document.activeElement;
    if (a?.tagName === 'INPUT' || a?.tagName === 'TEXTAREA' || a?.isContentEditable) return;
    if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); handleAction(); return; }
    switch (e.key) {
        case 'Shift':      sprintHeld = true;  break;
        case 'ArrowLeft':  pressed.left  = true; lastDirection = 'left';  e.preventDefault(); break;
        case 'ArrowRight': pressed.right = true; lastDirection = 'right'; e.preventDefault(); break;
        case 'ArrowUp':    pressed.up    = true; e.preventDefault(); break;
        case 'ArrowDown':  pressed.down  = true; e.preventDefault(); break;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') sprintHeld = false;
    switch (e.key) {
        case 'ArrowLeft':  pressed.left  = false; break;
        case 'ArrowRight': pressed.right = false; break;
        case 'ArrowUp':    pressed.up    = false; break;
        case 'ArrowDown':  pressed.down  = false; break;
    }
});

// ---------------------------------------------------------------------------
//  Button controls positioning
//
//  The TomeBoy is position:fixed centred by CSS — its viewport rect never
//  changes except on resize. We read it directly from getBoundingClientRect()
//  so we're always working from the real rendered position, not a calculation
//  that might disagree with the browser's CSS engine.
// ---------------------------------------------------------------------------

const controlsEl = document.getElementById('button-controls');
const tomeboyEl  = document.getElementById('tomeboy-frame');

function positionButtonControls() {
    if (!controlsEl) return;
    const ctrlScale = parseFloat(getComputedStyle(root).getPropertyValue('--ctrl-scale')) || 2.8;
    const btnW = 150 * ctrlScale;
    const btnH =  90 * ctrlScale;
    controlsEl.style.left      = `${Math.round(window.innerWidth  / 2 + CONTROLS_OFFSET_X)}px`;
    controlsEl.style.top       = `${Math.round(window.innerHeight / 2 + CONTROLS_OFFSET_Y)}px`;
    controlsEl.style.transform = `translate(-50%, -50%)`;
    // Get the TomeBoy's actual rendered rect — most reliable source of truth
    let tbLeft, tbTop, tbSize;
    const tbRect = tomeboyEl?.getBoundingClientRect();
    if (tbRect && tbRect.width > 0) {
        tbLeft = tbRect.left;
        tbTop  = tbRect.top;
        tbSize = tbRect.width;   // square sprite, width == height
    } else {
        // Fallback before element is measured
        tbSize = getTomeboySize();
        tbLeft = window.innerWidth  / 2 - tbSize / 2;
        tbTop  = window.innerHeight / 2 - tbSize / 2;
    }

    const scale = tbSize / TB_NATIVE;

    // D-pad centre in native TomeBoy sprite coords: (185, 400)
    const dpadVpX = tbLeft + 185 * scale;
    const dpadVpY = tbTop  + 400 * scale;

    // Button wrapper: 150×90 * ctrl-scale. D-pad sits at ~30% across, ~50% down.

}

function positionTomeboy() {
    if (!tomeboyEl) return;
    tomeboyEl.style.left      = `${Math.round(window.innerWidth  / 2 + TOMEBOY_OFFSET_X)}px`;
    tomeboyEl.style.top       = `${Math.round(window.innerHeight / 2 + TOMEBOY_OFFSET_Y)}px`;
    tomeboyEl.style.transform = `translate(-50%, -50%)`;
}

window.addEventListener('resize', () => {
    positionTomeboy();
    positionButtonControls();
});
// ---------------------------------------------------------------------------
//  Camera — only follows player while movement input is held.
//  When no input is active the user can scroll freely.
//
//  Two modes once input is held:
//    SNAP: player is outside the screen hole (user scrolled away).
//          Camera lerps quickly back to centre on the player.
//    FOLLOW: player is inside the hole. Camera only scrolls when the
//            player walks far enough to exit the hole boundary — it
//            moves exactly as much as needed, no more, no less.
// ---------------------------------------------------------------------------

let cameraSnapActive = false;
const SNAP_LERP = 18;   // lerp factor for snap-back — higher = faster re-centre

function isAnyInputHeld() {
    return pressed.left || pressed.right || pressed.up || pressed.down;
}


// ---------------------------------------------------------------------------
//  Drag to reposition — click/touch any actor (player or NPC) to pick it up
//  and drag it around the arena. Dropped outside the screen-hole or on a wall
//  snaps to the nearest valid position.
// ---------------------------------------------------------------------------

let dragState = null;
const DRAG_LERP_FACTOR = 0.18;  // Smoothing factor for drag motion (0.2 = fast, 0.1 = slow)
// dragState = {
//   type:       'player' | 'npc'
//   id:         npc id string (npc only)
//   el:         the DOM element being dragged
//   offsetX/Y:  cursor offset from element top-left at grab time (arena coords)
//   targetX/Y:  target position to smoothly interpolate towards
// }

// Convert a viewport point to arena coordinates
function viewportToArena(vpX, vpY) {
    if (!arena) return { x: vpX, y: vpY };
    const r = arena.getBoundingClientRect();
    return { x: vpX - r.left + window.scrollX - r.left + arena.getBoundingClientRect().left - arena.getBoundingClientRect().left,
             y: vpY - r.top };
}

// Simpler version — just subtract arena's page position
function vpToArena(vpX, vpY) {
    if (!arena) return { x: vpX, y: vpY };
    const r = arena.getBoundingClientRect();
    
    // Account for CSS transform scale on the arena
    // When arena has transform: scale(0.5), we need to divide by 0.5 to get true arena coords
    const scale = arena.offsetWidth > 0 ? r.width / arena.offsetWidth : 1;
    
    return {
        x: (vpX - r.left) / scale,
        y: (vpY - r.top) / scale,
    };
}

// Find the nearest non-blocked position within a search radius
function findNearestValidPosition(arenaX, arenaY, spriteSize) {
    const origin = clampToArena(arenaX, arenaY, spriteSize);
    function clear(px, py) {
        const clamped = clampToArena(px, py, spriteSize);
        return !isSpriteFeetBlocked(clamped.x, clamped.y, spriteSize);
    }
    if (clear(origin.x, origin.y)) return origin;
    // Spiral search outward in steps
    for (let radius = 4; radius <= 120; radius += 4) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
            const tx = origin.x + Math.cos(angle) * radius;
            const ty = origin.y + Math.sin(angle) * radius;
            if (clear(tx, ty)) return clampToArena(tx, ty, spriteSize);
        }
    }
    return origin; // give up, return original
}

function isInsideScreenHole(vpX, vpY) {
    const hole = getScreenHoleRect();
    return Math.abs(vpX - hole.cx) <= hole.halfW
        && Math.abs(vpY - hole.cy) <= hole.halfH;
}

function dropDragged() {
    if (!dragState) return;
    const droppedType = dragState.type;
    const droppedId = dragState.id;
    const spriteSize = parsePx(getComputedStyle(root).getPropertyValue('--playerSize'));

    if (dragState.type === 'player') {
        const valid = findNearestValidPosition(currentX, currentY, spriteSize);
        currentX = valid.x;
        currentY = valid.y;
        applyValues();
    } else {
        const s = squareStates[dragState.id];
        if (s) {
            const valid = findNearestValidPosition(s.x, s.y, spriteSize);
            s.x = valid.x;
            s.y = valid.y;
            s.el.style.left = `${Math.round(s.x)}px`;
            s.el.style.top  = `${Math.round(s.y)}px`;
            s.interactedPaused = false;
        }
    }
    dragState.el.style.opacity  = '';
    dragState.el.style.cursor   = '';
    dragState = null;

    if (droppedType === 'npc' && squareStates[droppedId]?.isCoopChicken) {
        refreshChickenCoopCounts(true);
    }
}

function onDragPointerMove(e) {
    if (!dragState) return;
    // Store the raw cursor viewport position; target is recomputed each frame
    // so it stays correct even when the camera scrolls without cursor movement.
    dragState.cursorVpX = e.clientX;
    dragState.cursorVpY = e.clientY;
}

function updateDraggedMovement() {
    if (!dragState) return;
    const spriteSize = parsePx(getComputedStyle(root).getPropertyValue('--playerSize'));

    // Recompute arena target fresh every frame from stored cursor viewport position.
    // This ensures the target stays correct when the camera scrolls without the cursor moving.
    const pos    = vpToArena(dragState.cursorVpX, dragState.cursorVpY);
    const targetX = clampToArena(pos.x - dragState.offsetX, pos.y - dragState.offsetY, spriteSize).x;
    const targetY = clampToArena(pos.x - dragState.offsetX, pos.y - dragState.offsetY, spriteSize).y;

    if (dragState.type === 'player') {
        currentX += (targetX - currentX) * DRAG_LERP_FACTOR;
        currentY += (targetY - currentY) * DRAG_LERP_FACTOR;
        applyValues();
    } else {
        const s = squareStates[dragState.id];
        if (s) {
            s.x += (targetX - s.x) * DRAG_LERP_FACTOR;
            s.y += (targetY - s.y) * DRAG_LERP_FACTOR;
            const clamped = clampToArena(s.x, s.y, spriteSize);
            s.x = clamped.x;
            s.y = clamped.y;
            s.el.style.left = `${Math.round(s.x)}px`;
            s.el.style.top  = `${Math.round(s.y)}px`;
        }
    }
}

function onDragPointerUp(e) {
    dropDragged();
    window.removeEventListener('pointermove', onDragPointerMove);
    window.removeEventListener('pointerup',   onDragPointerUp);
}

function startDrag(e, type, id, el) {
    e.preventDefault();
    hideDialogue();
    const pos = vpToArena(e.clientX, e.clientY);
    const r   = el.getBoundingClientRect();
    const ar  = arena.getBoundingClientRect();

    dragState = {
        type,
        id,
        el,
        offsetX: e.clientX - r.left,   // cursor offset within the sprite (viewport coords)
        offsetY: e.clientY - r.top,
        cursorVpX: e.clientX,           // live cursor viewport position (updated each pointermove)
        cursorVpY: e.clientY,
    };

    el.style.opacity = '0.75';
    el.style.cursor  = 'grabbing';

    if (type === 'npc') {
        const s = squareStates[id];
        if (s) { s.interactedPaused = true; s.state = 'idle'; }
    }

    window.addEventListener('pointermove', onDragPointerMove);
    window.addEventListener('pointerup',   onDragPointerUp);
}

// Attach drag listeners to player
if (player) {
    player.style.cursor = 'grab';
    player.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        startDrag(e, 'player', 'player', player);
    });
}

// Attach drag listeners to all NPC elements
for (const { id, el } of Object.values(squareStates)) {
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        startDrag(e, 'npc', id, el);
    });
}


// ---------------------------------------------------------------------------
//  Camera
// ---------------------------------------------------------------------------

// Target scroll position — updated every frame, applied smoothly
let cameraTargetX = window.scrollX;
let cameraTargetY = window.scrollY;

function isAnyInputHeld() {
    return pressed.left || pressed.right || pressed.up || pressed.down;
}

// Track player velocity for predictive camera
let playerVelX = 0;
let playerVelY = 0;
let prevPlayerX = currentX;
let prevPlayerY = currentY;

// How many pixels ahead of the player the camera looks
const CAMERA_LOOKAHEAD = 80;   // px — tweak this
const CAMERA_TRIGGER_MARGIN = 90; 
const CAMERA_LERP      = 10;   // smoothing — lower = smoother but more lag

function updateCamera(dt) {
    if (!player) return;

    // Update velocity from how much the player moved this frame
    playerVelX = (currentX - prevPlayerX) / (dt || 1);
    playerVelY = (currentY - prevPlayerY) / (dt || 1);
    prevPlayerX = currentX;
    prevPlayerY = currentY;

    const hole      = getScreenHoleRect();
    const r         = player.getBoundingClientRect();
    const playerVpX = r.left + r.width  / 2;
    const playerVpY = r.top  + r.height / 2;

// If dragging, follow the dragged actor instead of keyboard input
    if (dragState) {
        const r      = dragState.el.getBoundingClientRect();
        const actorVpX = r.left + r.width  / 2;
        const actorVpY = r.top  + r.height / 2;
        const dxView = actorVpX - hole.cx;
        const dyView = actorVpY - hole.cy;
        // Recompute target fresh each frame so camera scrolls even when cursor is stationary
        cameraTargetX = window.scrollX + (Math.abs(dxView) > hole.halfW ? (Math.abs(dxView) - hole.halfW) * Math.sign(dxView) : 0);
        cameraTargetY = window.scrollY + (Math.abs(dyView) > hole.halfH ? (Math.abs(dyView) - hole.halfH) * Math.sign(dyView) : 0);
        const doc = document.documentElement;
        cameraTargetX = Math.min(Math.max(0, cameraTargetX), Math.max(0, doc.scrollWidth  - window.innerWidth));
        cameraTargetY = Math.min(Math.max(0, cameraTargetY), Math.max(0, doc.scrollHeight - window.innerHeight));
        const lerpFactor = Math.min(1, CAMERA_LERP * dt);
        window.scrollTo({
            left: window.scrollX + (cameraTargetX - window.scrollX) * lerpFactor,
            top:  window.scrollY + (cameraTargetY - window.scrollY) * lerpFactor,
            behavior: 'auto'
        });
        return;
    }

    if (!isAnyInputHeld()) {
        cameraTargetX = window.scrollX;
        cameraTargetY = window.scrollY;
        playerVelX = 0;
        playerVelY = 0;
        cameraSnapActive = false;
        return;
    }

    // How far the player is from the hole centre
    const dxView = playerVpX - hole.cx;
    const dyView = playerVpY - hole.cy;

    const softHalfW = hole.halfW - CAMERA_TRIGGER_MARGIN;
    const softHalfH = hole.halfH - CAMERA_TRIGGER_MARGIN;

    const outsideX = Math.abs(dxView) > softHalfW;
    const outsideY = Math.abs(dyView) > softHalfH;

    if (outsideX || outsideY) {
        if (outsideX) cameraTargetX += (Math.abs(dxView) - softHalfW) * Math.sign(dxView)
                                     + playerVelX * dt * CAMERA_LOOKAHEAD * 0.016;
        if (outsideY) cameraTargetY += (Math.abs(dyView) - softHalfH) * Math.sign(dyView)
                                     + playerVelY * dt * CAMERA_LOOKAHEAD * 0.016;
    }

    // Clamp to valid scroll range
    const doc = document.documentElement;
    cameraTargetX = Math.min(Math.max(0, cameraTargetX), Math.max(0, doc.scrollWidth  - window.innerWidth));
    cameraTargetY = Math.min(Math.max(0, cameraTargetY), Math.max(0, doc.scrollHeight - window.innerHeight));

    // Lerp scroll toward target each frame
    const lerpFactor = Math.min(1, CAMERA_LERP * dt);
    const newScrollX = window.scrollX + (cameraTargetX - window.scrollX) * lerpFactor;
    const newScrollY = window.scrollY + (cameraTargetY - window.scrollY) * lerpFactor;

    window.scrollTo({ left: newScrollX, top: newScrollY, behavior: 'auto' });
}

function centerCameraOnPlayer() {
    if (!player) return;
    const hole = getScreenHoleRect();
    const r    = player.getBoundingClientRect();
    window.scrollTo({
        left:     window.scrollX + (r.left + r.width  / 2) - hole.cx,
        top:      window.scrollY + (r.top  + r.height / 2) - hole.cy,
        behavior: 'instant'
    });
}

// ---------------------------------------------------------------------------
//  Dialogue font — read from <link id="dialogue-font-link"> in index.html
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
//  Main loop
// ---------------------------------------------------------------------------

let lastTime = null;

function loop(timestamp) {
    if (lastTime == null) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000;
    lastTime  = timestamp;

    // Player movement
    let dx = 0, dy = 0;
    if (pressed.left)  dx -= 1;
    if (pressed.right) dx += 1;
    if (pressed.up)    dy -= 1;
    if (pressed.down)  dy += 1;

    if (dx !== 0 || dy !== 0) {
        if (dialogueNode) hideDialogue();

        if (dx !== 0 && dy !== 0) { dx *= 1 / Math.sqrt(2); dy *= 1 / Math.sqrt(2); }
        const speed      = baseSpeedPxPerSecond * (isSprinting() ? sprintSpeedMultiplier : 1);
        const playerSize = parsePx(getComputedStyle(root).getPropertyValue('--playerSize'));
        const nextX      = Math.max(0, currentX + dx * speed * dt);
        const nextY      = Math.max(0, currentY + dy * speed * dt);

        // Check three points across the bottom of the sprite for solid collision
        function blockedX(px) {
            return isSpriteFeetBlocked(px, currentY, playerSize);
        }
        function blockedY(py) {
            return isSpriteFeetBlocked(currentX, py, playerSize);
        }
        function blockedXY(px, py) {
            return isSpriteFeetBlocked(px, py, playerSize);
        }

        if (!blockedXY(nextX, nextY)) {
            // Fully unblocked — move freely
            currentX = nextX;
            currentY = nextY;
        } else {
            // Try sliding on each axis independently
            if (!blockedX(nextX)) currentX = nextX;
            if (!blockedY(nextY)) currentY = nextY;
        }
        applyValues();

        prevPlayerX = currentX;
        prevPlayerY = currentY;
    }

    // Player sprite animation
    if (player) {
        const moving       = dx !== 0 || dy !== 0;
        const targetFrames = moving ? walkFrames : idleFrames;
        if (targetFrames !== frames) {
            frames = targetFrames; frameIndex = 0; frameElapsedMs = 0; player.src = frames[0];
        } else {
            frameElapsedMs += dt * 1000;
            const fps      = animationFps * (isSprinting() ? sprintFpsMultiplier : 1);
            const interval = 1000 / Math.max(1, fps);
            if (frameElapsedMs >= interval) {
                const steps    = Math.floor(frameElapsedMs / interval);
                frameElapsedMs -= steps * interval;
                frameIndex     = (frameIndex + steps) % frames.length;
                player.src     = frames[frameIndex];
            }
        }
        player.style.setProperty('--playerFlip', lastDirection === 'left' ? -1 : 1);
    }

    updateSquares(dt);
    updateDraggedMovement();
    chickenCountSyncAccumulator += dt;
    if (chickenCountSyncAccumulator >= 0.2) {
        refreshChickenCoopCounts(false);
        chickenCountSyncAccumulator = 0;
    }
    syncButtonNpcVisuals();
    updateDepthSorting();
    updateCamera(dt);
    updateOverlap();

    // Track open dialogue and auto-close if the NPC wandered too far
    if (dialogueNode?.dataset.squareId) {
        const squareEl = document.getElementById(dialogueNode.dataset.squareId);
        if (squareEl) {
            if (dialogueNode.dataset.textBoxType === 'try') positionTryDialogueInScreen();
            else positionDialogueNearSquare(squareEl);
            if (!isSquareWithinDialogueBoundary(squareEl)) hideDialogue();
        }
    }

    requestAnimationFrame(loop);

    
}

// ---------------------------------------------------------------------------
//  Init
// ---------------------------------------------------------------------------

applyValues();
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

window.addEventListener('load', () => {
    positionTomeboy();
    positionButtonControls();
    centerCameraOnPlayer();
});
requestAnimationFrame(loop);

applyNightStateToChickens();
refreshChickenCoopCounts(true);