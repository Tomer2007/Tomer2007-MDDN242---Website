
// This script updates the CSS variables --buttonX and --buttonY on :root
// and moves them while arrow keys are held (continuous movement using
// requestAnimationFrame). It still supports the on-page inputs/buttons.

const root = document.documentElement;

// Debug: confirm script loaded
console.debug('script.js loaded');

function parsePx(value) {
    value = (value || '').trim();
    if (!value || value === 'auto') return 0;
    return parseFloat(value);
}

function getVar(name, fallback = 0) {
    const v = getComputedStyle(root).getPropertyValue(name);
    const parsed = parsePx(v);
    return Number.isFinite(parsed) ? parsed : fallback;
}

let currentX = getVar('--buttonX', 0);
let currentY = getVar('--buttonY', 150);

// Movement settings
const baseSpeedPxPerSecond = 200; // base movement speed (px/s)
const sprintSpeedMultiplier = 1.8; // how much faster when sprinting

// Follow-scroll thresholds (pixels). If a square is outside these
// thresholds from the viewport center, the player would need to scroll
// to reach it. We use these to auto-close dialogue when the square is
// outside the player's movement bounds.
const followThresholdX = 120;
const followThresholdY = 120;
// Dialogue boundary: a scale multiplier applied to the follow thresholds.
// The dialogue will auto-close only when the square leaves this scaled
// boundary. Change `dialogueBoundaryScale` to expand/contract this area.
let dialogueBoundaryScale = 3.0; // 1.0 = same as follow thresholds

// Sprint state: keyboard hold vs on-screen toggle
let sprintHeld = false;     // true while Shift is held
let sprintToggled = false;  // true when on-screen Sprint button toggled on

function isSprinting() {
    return Boolean(sprintHeld || sprintToggled);
}

// Track which arrow keys are pressed
const pressed = { left: false, right: false, up: false, down: false };

// Controls from the DOM (optional helpers)
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const upBtn = document.getElementById('upBtn');
const downBtn = document.getElementById('downBtn');
const xInput = document.getElementById('xValue');
const yInput = document.getElementById('yValue');
const stepInput = document.getElementById('stepSize');
const actionBtn = document.getElementById('actionBtn');
const player = document.getElementById('player');

// Debug: list the DOM controls we found (null means missing)
console.debug('DOM elements:', {
    leftBtn: Boolean(leftBtn), rightBtn: Boolean(rightBtn), upBtn: Boolean(upBtn), downBtn: Boolean(downBtn),
    xInput: Boolean(xInput), yInput: Boolean(yInput), stepInput: Boolean(stepInput), actionBtn: Boolean(actionBtn), player: Boolean(player)
});

// Sprite animation frames
const idleFrames = [
    "Assets/Tomer'sWebsitePlayerIdle1.png.png",
    "Assets/Tomer'sWebsitePlayerIdle2.png.png"
];
const walkFrames = [
    "Assets/Tomer'sWebsitePlayerWalk1.png.png",
    "Assets/Tomer'sWebsitePlayerWalk2.png.png"
];

let frames = idleFrames;
let frameIndex = 0;

// Animation speed: number of sprite frames to show per second.
// Change this value to adjust animation FPS (higher = faster animation).
let animationFps = 4; // base animation fps (frames per second)
const sprintFpsMultiplier = 1.35; // multiply FPS while sprinting (slightly faster)
// Internal accumulator (ms) used to advance sprite frames based on real time
let frameElapsedMs = 0;
let lastDirection = 'right'; // 'left' or 'right'

// Dialogue configuration for each square. Replace the texts array to edit
// the dialogue lines. Each entry supports two modes:
// - mode: 'sequence' — returns texts in order; internal counter advances
//   by 1 each interaction (counter is a float; Math.floor(counter) used)
// - mode: 'random'   — returns a random entry; a `randomRange` [min,max]
//   can be specified to control the random float range used internally.
//
// You can programmatically change a square's config at runtime using the
// helper functions below: setDialogueMode, setDialogueCounter, setDialogueRandomRange.
const dialogueConfig = {
    square1: {
        texts: [
            'Hello — this is Square 1.',
            'Hello — this is still Square 1. /n {link:Google|https://google.com}',
            'Hello — this really is /n still Square 1.',
            'Hello — this is Square 2.'
        ],
        mode: 'sequence',
        counter: 0,
        randomRange: [0, 2]
    },
    square2: {
        texts: [
            'Square 2 says: welcome /n to the demo!',
            'Square 2 says: second line.'
        ],
        mode: 'random',
        counter: 0,
        randomRange: [0, 1]
    },
    square3: {
        texts: [
            'Square 3: This dialogue is /n easy to edit in the script.',
            'Square 3: Another response.'
        ],
        mode: 'sequence',
        counter: 0,
        randomRange: [0, 1]
    },
    square4: {
        texts: [
            'Square 4: AAAAAAAAAAAGHHHHHHHHH!!!!!!',
            'Square 4: AAAAAAAAAAAAAAAAAAAAAAAAHHHHHHH!!!!!!!/n!!!!!!!!!!',
            'Square 4: Aaaah.',
            'Square 4: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHHHHHHHHHHHHHHHHH!!!!!!!!!!!!!!!'
        ],
        mode: 'random',
        counter: 0,
        randomRange: [0, 3]
    }
};

// Single DOM node we reuse for the dialogue box
let dialogueNode = null;

// Typewriter state (so we can cancel an ongoing reveal)
let _typewriterHandle = null;
let _typewriterCancelled = false;
// characters per second for the typewriter effect (adjustable)
let typewriterCps = 60; // 60 chars/sec -> ~16ms per char

/**
 * getNextDialogueText(id)
 * - id: string (square id)
 * Returns the next dialogue string for the square according to its
 * configuration in `dialogueConfig`. For 'sequence' mode this will
 * advance an internal counter (float) so you may set it directly via
 * setDialogueCounter(id, value). For 'random' mode a random float in
 * `randomRange` is chosen each time; the float is used to pick an index
 * from the texts array.
 */
function getNextDialogueText(id) {
    const cfg = dialogueConfig[id];
    if (!cfg || !Array.isArray(cfg.texts) || cfg.texts.length === 0) {
        return `You interacted with ${id}. (No dialogue configured)`;
    }
    const texts = cfg.texts;
    if (cfg.mode === 'random') {
        const range = Array.isArray(cfg.randomRange) && cfg.randomRange.length === 2 ? cfg.randomRange : [0, 1];
        const min = Number(range[0]) || 0;
        const max = Number(range[1]) || 1;
        const r = Math.random() * (max - min) + min;
        cfg._lastRandom = r;
        // normalize r into [0,1) and pick an index
        const normalized = (r - min) / ((max - min) || 1);
        const idx = Math.floor(normalized * texts.length) % texts.length;
        return texts[idx];
    } else {
        // sequence
        const c = Number(cfg.counter) || 0;
        const idx = Math.floor(c) % texts.length;
        // advance counter by 1 for next time (float supported)
        cfg.counter = c + 1;
        return texts[idx];
    }
}

// Helper API to change dialogue behavior from other scripts or the console
function setDialogueMode(id, mode) { if (dialogueConfig[id]) dialogueConfig[id].mode = mode; }
function setDialogueCounter(id, value) { if (dialogueConfig[id]) dialogueConfig[id].counter = Number(value) || 0; }
function setDialogueRandomRange(id, min, max) { if (dialogueConfig[id]) dialogueConfig[id].randomRange = [Number(min) || 0, Number(max) || 1]; }
function setDialogueTexts(id, textsArray) { if (dialogueConfig[id]) dialogueConfig[id].texts = Array.from(textsArray); }
// Set a web font for dialogue text by URL (e.g. Google Fonts stylesheet)
// and the font-family name to use. Example:
// setDialogueFont('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap', '"Press Start 2P", monospace');
function setDialogueFont(url, fontFamily) {
    if (!url || !fontFamily) return;
    // Insert a stylesheet link if not already present
    const id = 'dialogue-font-' + btoa(url).replace(/=/g, '');
    if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.id = id;
        document.head.appendChild(link);
    }
    // Apply the font family to the dialogue CSS variable
    document.documentElement.style.setProperty('--dialogueFontFamily', fontFamily);
    console.debug('Dialogue font set to', fontFamily, 'from', url);
}

// Initialize player src if available
if (player) player.src = frames[frameIndex];

// On-screen sprint button
const sprintBtn = document.getElementById('sprintBtn');
if (sprintBtn) {
    sprintBtn.addEventListener('click', () => {
        sprintToggled = !sprintToggled;
        sprintBtn.setAttribute('aria-pressed', String(Boolean(sprintToggled)));
        sprintBtn.classList.toggle('active', Boolean(sprintToggled));
        console.debug('Sprint toggled (button). sprintToggled=', sprintToggled);
    });
}

function applyValues() {
    root.style.setProperty('--buttonX', `${Math.round(currentX)}px`);
    root.style.setProperty('--buttonY', `${Math.round(currentY)}px`);
    if (xInput) xInput.value = String(Math.round(currentX));
    if (yInput) yInput.value = String(Math.round(currentY));
}

// Collision/overlap tracking
let currentOverlapSquare = null;
let isOverlappingFlag = false;

function isOverlapping(elA, elB) {
    if (!elA || !elB) return false;
    // Use the visible bounding rect of each element as the authoritative
    // interaction box. This keeps the interaction box the same size and
    // centered as the visible square element.
    const a = elA.getBoundingClientRect();
    const b = elB.getBoundingClientRect();

    // Standard rectangle intersection test
    const rectsIntersect = !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);

    // Additionally consider the player's center inside the square, or the
    // square's center inside the player's rect. This makes interaction
    // robust when sprites have transparent padding or uneven shapes.
    const playerCenterX = a.left + a.width / 2;
    const playerCenterY = a.top + a.height / 2;
    const playerCenterInsideSquare = (playerCenterX >= b.left && playerCenterX <= b.right && playerCenterY >= b.top && playerCenterY <= b.bottom);

    const squareCenterX = b.left + b.width / 2;
    const squareCenterY = b.top + b.height / 2;
    const squareCenterInsidePlayer = (squareCenterX >= a.left && squareCenterX <= a.right && squareCenterY >= a.top && squareCenterY <= a.bottom);

    return rectsIntersect || playerCenterInsideSquare || squareCenterInsidePlayer;
}

function updateOverlap() {
    if (!player) return;
    const squares = Array.from(document.querySelectorAll('.game-square'));
    let found = null;
    for (const sq of squares) {
        if (isOverlapping(player, sq)) { found = sq; break; }
    }

    if (found !== currentOverlapSquare) {
        // Remove highlight from previous
        if (currentOverlapSquare) currentOverlapSquare.classList.remove('highlight');
        currentOverlapSquare = found;
        if (currentOverlapSquare) {
            currentOverlapSquare.classList.add('highlight');
            player.classList.add('overlap');
            isOverlappingFlag = true;
        } else {
            player.classList.remove('overlap');
            isOverlappingFlag = false;
        }
    }
}

// On-screen controls are fixed in the viewport (CSS). No JS positioning needed.

function handleAction() {
    // Prefer the overlap detected by the per-frame updater (this covers
    // cases where updateOverlap already found the square), otherwise
    // recompute immediately so action works the instant the key/button
    // is pressed.
    let target = currentOverlapSquare || null;
    if (!target) {
        const squares = Array.from(document.querySelectorAll('.game-square'));
        for (const sq of squares) {
            if (isOverlapping(player, sq)) { target = sq; break; }
        }
    }
    if (target) {
        const id = target.id || target.dataset.name || 'object';
        console.debug('handleAction on', id);
        showDialogueForSquare(target);
    } else {
        // No overlapped object — optional feedback could go here.
    }
}

// Wire the on-screen action button
actionBtn?.addEventListener('click', handleAction);

// --- Dialogue UI helpers -------------------------------------------------
function createDialogueNode() {
    const d = document.createElement('div');
    d.className = 'dialogue-box';

    // Simple body only — the user asked for a minimal square that sizes
    // to its text. We still provide a body element for easy replacement.
    const body = document.createElement('div');
    body.className = 'dialogue-body';
    body.textContent = '';
    d.appendChild(body);

    // Start hidden so we can measure and then position. Use absolute so
    // the dialogue is positioned in document coordinates and moves with
    // the page (stays near the square when the page scrolls).
    d.style.position = 'absolute';
    d.style.left = '0px';
    d.style.top = '0px';
    d.style.visibility = 'hidden';
    d.style.zIndex = 100000;

    document.body.appendChild(d);
    return d;
}

function hideDialogue() {
    if (!dialogueNode) return;
    // cancel any running typewriter
    if (_typewriterHandle) {
        clearTimeout(_typewriterHandle);
        _typewriterHandle = null;
    }
    _typewriterCancelled = true;
    dialogueNode.remove();
    dialogueNode = null;
}

/**
 * showDialogueForSquare(squareElement)
 * - squareElement: the DOM node for the square the player interacted with
 *
 * Creates (or reuses) a small dialogue panel and positions it near the
 * square's top-left or top-right corner depending on visibility. The
 * content comes from `dialogueTexts[id]` and falls back to the square's
 * data-name or id.
 */
function showDialogueForSquare(squareEl) {
    if (!squareEl) return;
    const rect = squareEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Create or reuse the dialogue node
    if (!dialogueNode) dialogueNode = createDialogueNode();

    const body = dialogueNode.querySelector('.dialogue-body');

    const id = squareEl.id || squareEl.dataset.name || 'object';
    // If the same square was already showing, toggle (close) instead
    if (dialogueNode.dataset && dialogueNode.dataset.squareId === id) {
        hideDialogue();
        return;
    }

    let text = getNextDialogueText(id);
    // Replace '/n' with an actual newline so authors can write '/n' for Enter
    // in the in-code dialogue strings.
    if (typeof text === 'string') {
        text = text.replace(/\/n/g, '\n');
    }

    // For correct sizing we need to measure the dialogue box with the
    // full text (so its width/height reflect the content). We'll set the
    // body to the full text briefly to measure.
    // Support a simple link token syntax: {link:label|url}
    // If present we render HTML (anchor opens in new tab) and skip the
    // typewriter for that entry (keeps implementation simple).
    const linkTokenRegex = /\{link:([^|}]+)\|([^}]+)\}/g;
    const hasLinkToken = linkTokenRegex.test(text);

    // Fill the dialogue body with the full content first, then measure
    // the dialogue node's final size so we can position it. For non-link
    // entries we will clear the body and run the typewriter, but we'll
    // keep the measured width/height for placement so the box doesn't
    // jump when the body is emptied.
    let boxW = 0, boxH = 0;
    if (hasLinkToken) {
        // Convert tokens to safe anchor HTML (developer-controlled strings).
        const html = text.replace(linkTokenRegex, (m, label, href) => {
            let safeHref = href.trim();
            const safeLabel = label.trim();
            // If the href looks like a bare domain (no scheme), default to https://
            if (!/^([a-zA-Z][a-zA-Z0-9+.-]*:)?\/\//.test(safeHref) && !safeHref.startsWith('mailto:') && !safeHref.startsWith('/')) {
                safeHref = 'https://' + safeHref;
            }
            return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
        });
        body.innerHTML = html;
        // Measure the fully-rendered dialogue node
        dialogueNode.style.visibility = 'hidden';
        const measured = dialogueNode.getBoundingClientRect();
        boxW = measured.width;
        boxH = measured.height;
        // store measured size so we can reposition while typewriter runs
        dialogueNode._boxW = boxW;
        dialogueNode._boxH = boxH;
        dialogueNode.dataset.squareId = id;
        // pause this NPC while the player is interacting; they will remain
        // paused until the player leaves their bounding box. Put them into
        // the idle animation so they 'stand still' visually.
        if (squareStates[id]) {
            const s = squareStates[id];
            s.interactedPaused = true;
            s.state = 'idle';
            s.frames = s.framesIdle;
            s.frameIndex = 0;
            s.frameElapsedMs = 0;
            if (s.img) s.img.src = s.frames[s.frameIndex];
        }
    } else {
        body.textContent = text;
        // Measure the fully-rendered dialogue node while it contains the full text
        dialogueNode.style.visibility = 'hidden';
        const measured = dialogueNode.getBoundingClientRect();
        boxW = measured.width;
        boxH = measured.height;
        // store measured size so we can reposition while typewriter runs
        dialogueNode._boxW = boxW;
        dialogueNode._boxH = boxH;
        // Clear body and start the cancellable typewriter reveal
        body.textContent = '';
        startTypewriter(body, text, typewriterCps);
        dialogueNode.dataset.squareId = id;
        // pause this NPC while the player is interacting; they will remain
        // paused until the player leaves their bounding box. Put them into
        // the idle animation so they 'stand still' visually.
        if (squareStates[id]) {
            const s = squareStates[id];
            s.interactedPaused = true;
            s.state = 'idle';
            s.frames = s.framesIdle;
            s.frameIndex = 0;
            s.frameElapsedMs = 0;
            if (s.img) s.img.src = s.frames[s.frameIndex];
        }
    }

    // Anchor class for styling hooks
    dialogueNode.classList.remove('anchor-top-left', 'anchor-top-right');
    dialogueNode.classList.add('anchor-top-right');

    // Compute target left/top so the dialog appears above the chosen corner
    let left, top;
    const padding = 8; // margin from viewport edges / square
    const arrowGap = 6; // small gap between dialog and square (base)
    // Additional vertical offset (controlled by CSS var --dialogueVerticalOffset)
    const vOffset = parsePx(getComputedStyle(root).getPropertyValue('--dialogueVerticalOffset')) || 12;
    // Always anchor to the square's top-right corner irrespective of
    // viewport visibility (per your request). This places the dialogue so
    // its right edge aligns with the square's right edge and the box sits
    // above the square.
    left = rect.right - boxW;
    // Place above the square so the square remains visible; include an
    // extra configurable vertical offset so dialogs sit a bit higher.
    // Do not clamp horizontally so the box can overflow the viewport if needed.
    top = rect.top - boxH - arrowGap - vOffset;

    // Position in page coordinates so the dialogue sticks with the square
    // when the page scrolls.
    const pageLeft = Math.round(left + window.scrollX);
    const pageTop = Math.round(top + window.scrollY);
    dialogueNode.style.left = `${pageLeft}px`;
    dialogueNode.style.top = `${pageTop}px`;
    dialogueNode.style.visibility = 'visible';
}

// Close dialogue when user presses Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialogueNode) hideDialogue();
});

// Helper: determine if a square is within the player's movement bounds
// (i.e., the square's center is close enough to the viewport center that
// the player could reach it without causing a scroll). Uses top-level
// followThresholdX/followThresholdY constants.
function isSquareWithinMovementBounds(squareEl) {
    if (!squareEl) return false;
    const r = squareEl.getBoundingClientRect();
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const viewCenterX = window.innerWidth / 2;
    const viewCenterY = window.innerHeight / 2;
    return (Math.abs(centerX - viewCenterX) <= followThresholdX) && (Math.abs(centerY - viewCenterY) <= followThresholdY);
}

// Like isSquareWithinMovementBounds but uses the dialogueBoundaryScale so
// the dialogue auto-close boundary can be adjusted separately from the
// movement follow thresholds.
function isSquareWithinDialogueBoundary(squareEl) {
    if (!squareEl) return false;
    const r = squareEl.getBoundingClientRect();
    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    const viewCenterX = window.innerWidth / 2;
    const viewCenterY = window.innerHeight / 2;
    const effectiveX = followThresholdX * Number(dialogueBoundaryScale || 1);
    const effectiveY = followThresholdY * Number(dialogueBoundaryScale || 1);
    return (Math.abs(centerX - viewCenterX) <= effectiveX) && (Math.abs(centerY - viewCenterY) <= effectiveY);
}

function setDialogueBoundaryScale(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return;
    dialogueBoundaryScale = n;
    console.debug('dialogueBoundaryScale set to', dialogueBoundaryScale);
}

// --- Simple NPC square AI setup ---------------------------------------
const arena = document.getElementById('arena');
const squareEls = Array.from(document.querySelectorAll('.game-square'));
const squareStates = {}; // keyed by element id

function randRange(min, max) { return Math.random() * (max - min) + min; }

// Initialize each square's state from its inline left/top or computed style
for (const el of squareEls) {
    const id = el.id || `sq-${Math.random().toString(36).slice(2,8)}`;
    // starting position: prefer inline style then computed
    let x = parsePx(el.style.left) || parsePx(getComputedStyle(el).left) || 0;
    let y = parsePx(el.style.top) || parsePx(getComputedStyle(el).top) || 0;
    // Create or reuse an <img> inside the square for pixelated sprite rendering
    let img = el.querySelector('.npc-sprite');
    if (!img) {
        img = document.createElement('img');
        img.className = 'npc-sprite';
        img.alt = 'NPC';
        // ensure the img doesn't intercept pointer events
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.display = 'block';
        img.style.pointerEvents = 'none';
        // preserve pixel-art crispness
        img.style.imageRendering = 'pixelated';
        el.appendChild(img);
    }

    // Sprite frame lists (uses the same naming pattern you requested)
    const base = 'Assets/WebsiteNPC1';
    const framesIdle = [`${base}Idle1.png.png`, `${base}Idle2.png.png`];
    const framesWalk = [`${base}Walk1.png.png`, `${base}Walk2.png.png`];

    // store as px relative to arena and attach animation state
    squareStates[id] = {
        el,
        id,
        x,
        y,
        state: 'idle', // 'idle' | 'walk'
        timerMs: randRange(800, 2400), // initial idle between 0.8s and 2.4s
        dirX: 0,
        dirY: 0,
        speed: randRange(20, 60), // px/s when walking
        interactedPaused: false, // true after player interaction until they leave bounding box
        // animation
        framesIdle,
        framesWalk,
        frames: framesIdle,
        frameIndex: 0,
        frameElapsedMs: 0,
        img,
        lastDirection: 'right'
    };
    // initialize image src and ensure element uses left/top inline so updates apply
    const s = squareStates[id];
    img.src = s.frames[s.frameIndex];
    // set initial flip variable so sprite faces right by default
    img.style.setProperty('--npcFlip', 1);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
}


function updateSquares(dt) {
    if (!arena) return;
    const maxX = Math.max(0, arena.clientWidth - 1);
    const maxY = Math.max(0, arena.clientHeight - 1);
    for (const id of Object.keys(squareStates)) {
        const s = squareStates[id];
        const el = s.el;
        // If this square was interacted with and player still overlapping,
        // keep it paused. Resume when player no longer overlaps.
        if (s.interactedPaused) {
            if (!isOverlapping(player, el)) {
                s.interactedPaused = false;
                // restart as idle with a short pause
                s.state = 'idle';
                s.timerMs = randRange(400, 1200);
            } else {
                // remain paused: ensure NPC shows idle frames but do not move
                s.state = 'idle';
                s.frames = s.framesIdle;
                // fall through to animation update (do not perform movement)
            }
        }

        s.timerMs -= dt * 1000;
        if (s.timerMs <= 0) {
            // toggle state
            if (s.state === 'idle') {
                s.state = 'walk';
                s.timerMs = randRange(600, 2200);
                // random direction unit vector
                const ang = randRange(0, Math.PI * 2);
                s.dirX = Math.cos(ang);
                s.dirY = Math.sin(ang);
                s.speed = randRange(20, 60);
                // set facing direction based on horizontal component
                if (s.dirX !== 0) s.lastDirection = s.dirX < 0 ? 'left' : 'right';
                // switch to walk frames
                s.frames = s.framesWalk;
                s.frameIndex = 0;
                s.frameElapsedMs = 0;
                if (s.img) s.img.src = s.frames[s.frameIndex];
            } else {
                s.state = 'idle';
                s.timerMs = randRange(800, 3000);
                s.dirX = 0; s.dirY = 0;
                // switch to idle frames
                s.frames = s.framesIdle;
                s.frameIndex = 0;
                s.frameElapsedMs = 0;
                if (s.img) s.img.src = s.frames[s.frameIndex];
            }
        }

        if (s.state === 'walk') {
            // move
            const dx = s.dirX * s.speed * dt;
            const dy = s.dirY * s.speed * dt;
            let nx = s.x + dx;
            let ny = s.y + dy;
            // clamp and bounce off edges of the arena
            const elW = el.offsetWidth || 0;
            const elH = el.offsetHeight || 0;
            const maxLeft = Math.max(0, arena.clientWidth - elW);
            const maxTop = Math.max(0, arena.clientHeight - elH);
            if (nx < 0) { nx = 0; s.dirX *= -1; }
            if (ny < 0) { ny = 0; s.dirY *= -1; }
            if (nx > maxLeft) { nx = maxLeft; s.dirX *= -1; }
            if (ny > maxTop) { ny = maxTop; s.dirY *= -1; }
            s.x = nx; s.y = ny;
            el.style.left = `${Math.round(s.x)}px`;
            el.style.top = `${Math.round(s.y)}px`;
            // if horizontal movement is significant, update facing
            if (Math.abs(s.dirX) > 0.05) s.lastDirection = s.dirX < 0 ? 'left' : 'right';
        }
        
        // Advance NPC animation frames (idle or walk) based on global animationFps
        if (s.frames && s.frames.length > 0 && s.img) {
            s.frameElapsedMs += dt * 1000;
            const frameIntervalMs = 1000 / Math.max(1, animationFps);
            if (s.frameElapsedMs >= frameIntervalMs) {
                const steps = Math.floor(s.frameElapsedMs / frameIntervalMs);
                s.frameElapsedMs -= steps * frameIntervalMs;
                s.frameIndex = (s.frameIndex + steps) % s.frames.length;
                s.img.src = s.frames[s.frameIndex];
            }
        }
        // Update flip based on lastDirection so NPC faces left/right like the player
        if (s.img) {
            const flipVal = (s.lastDirection === 'left') ? -1 : 1;
            s.img.style.setProperty('--npcFlip', flipVal);
        }
    }
}

// Depth sorting: set z-index based on element bottom Y coordinate so
// entities lower on the screen appear above those higher up.
function updateDepthSorting() {
    const items = [];
    if (player) {
        const r = player.getBoundingClientRect();
        items.push({ el: player, bottom: r.top + r.height });
    }
    for (const id of Object.keys(squareStates)) {
        const s = squareStates[id];
        if (!s || !s.el) continue;
        const r = s.el.getBoundingClientRect();
        items.push({ el: s.el, bottom: r.top + r.height });
    }

    // Sort ascending by bottom (top-most first). We'll assign increasing
    // z-index so items with larger bottom (lower on screen) receive
    // higher z-index and render on top.
    items.sort((a, b) => a.bottom - b.bottom);
    const base = 100; // keep dialogue and UI above this
    for (let i = 0; i < items.length; i++) {
        try {
            items[i].el.style.zIndex = String(base + i);
        } catch (err) {
            // ignore
        }
    }
}

/**
 * startTypewriter(targetElement, text, cps)
 * - targetElement: element whose textContent will be filled
 * - text: the full string to reveal
 * - cps: characters-per-second speed
 *
 * Reveals `text` into targetElement one character at a time. Cancels any
 * currently running typewriter so only one reveal runs at a time. The
 * effect is cancellable by calling hideDialogue() which clears timers and
 * sets a cancel flag.
 */
function startTypewriter(targetElement, text, cps = 60) {
    // cancel previous
    if (_typewriterHandle) { clearTimeout(_typewriterHandle); _typewriterHandle = null; }
    _typewriterCancelled = false;
    targetElement.textContent = '';
    if (!text) return;
    const delay = Math.max(4, Math.round(1000 / Math.max(1, cps))); // ms per char, min 4ms
    let i = 0;

    function step() {
        if (_typewriterCancelled) return;
        i += 1;
        targetElement.textContent = text.slice(0, i);
        if (i < text.length) {
            _typewriterHandle = setTimeout(step, delay);
        } else {
            _typewriterHandle = null;
        }
    }

    // kick off
    _typewriterHandle = setTimeout(step, delay);
}


// (Space-action was merged into the unified keyboard handler below.)

// Buttons still do a single-step change (useful for keyboard-less interaction)
function stepAmount() {
    const s = parseInt(stepInput?.value || '5', 10);
    return Number.isFinite(s) && s > 0 ? s : 5;
}

// On-screen controls: support pointerdown/hold for continuous movement and pointerup to stop.
function makeHoldable(buttonEl, directionKey) {
    if (!buttonEl) return;
    buttonEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        console.debug(buttonEl.id + ' pointerdown');
        pressed[directionKey] = true;
        // record last direction so sprite can face the correct way
        if (directionKey === 'left' || directionKey === 'right') lastDirection = directionKey;
    });
    // Stop when pointer released over the button
    buttonEl.addEventListener('pointerup', (e) => {
        e.preventDefault();
        console.debug(buttonEl.id + ' pointerup');
        pressed[directionKey] = false;
    });
    // Also stop if the pointer leaves the button while pressed
    buttonEl.addEventListener('pointerleave', () => {
        pressed[directionKey] = false;
    });
}

makeHoldable(leftBtn, 'left');
makeHoldable(rightBtn, 'right');
makeHoldable(upBtn, 'up');
makeHoldable(downBtn, 'down');

// As a safety, clear movement flags when pointer is released anywhere
document.addEventListener('pointerup', () => {
    if (pressed.left || pressed.right || pressed.up || pressed.down) console.debug('document pointerup - clearing pressed flags');
    pressed.left = pressed.right = pressed.up = pressed.down = false;
});

xInput?.addEventListener('change', () => {
    const v = parseInt(xInput.value || '0', 10);
    if (Number.isFinite(v)) { currentX = Math.max(0, v); applyValues(); }
});

yInput?.addEventListener('change', () => {
    const v = parseInt(yInput.value || '0', 10);
    if (Number.isFinite(v)) { currentY = Math.max(0, v); applyValues(); }
});

// Keyboard handling: set pressed flags on keydown, clear on keyup.
// We avoid handling keys when an input or textarea is focused so typing isn't blocked.
document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const activeIsInput = Boolean(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable));
    console.debug('keydown:', e.key, 'code:', e.code, 'activeIsInput=', activeIsInput);
    if (activeIsInput) return;

    // Space triggers action
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        console.debug('Action key (Space) pressed');
        handleAction();
        return;
    }

    // Arrow keys start movement
    switch (e.key) {
        // Sprint (hold Shift) — set sprintHeld while Shift is down
        case 'Shift':
            sprintHeld = true; console.debug('Shift pressed - sprintHeld=true'); break;
        case 'ArrowLeft': pressed.left = true; lastDirection = 'left'; e.preventDefault(); break;
        case 'ArrowRight': pressed.right = true; lastDirection = 'right'; e.preventDefault(); break;
        case 'ArrowUp': pressed.up = true; e.preventDefault(); break;
        case 'ArrowDown': pressed.down = true; e.preventDefault(); break;
        default: return; // ignore other keys
    }
});

document.addEventListener('keyup', (e) => {
    console.debug('keyup:', e.key);
    // Release Shift to stop sprinting
    if (e.key === 'Shift') {
        sprintHeld = false; console.debug('Shift released - sprintHeld=false');
    }
    switch (e.key) {
        case 'ArrowLeft': pressed.left = false; break;
        case 'ArrowRight': pressed.right = false; break;
        case 'ArrowUp': pressed.up = false; break;
        case 'ArrowDown': pressed.down = false; break;
    }
});

// Main animation loop: moves the button every frame while arrow keys are held.
let lastTime = null;
function loop(timestamp) {
    if (lastTime == null) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000; // delta time in seconds
    lastTime = timestamp;

    let dx = 0, dy = 0;
    if (pressed.left) dx -= 1;
    if (pressed.right) dx += 1;
    if (pressed.up) dy -= 1;    // up should decrease Y (move up)
    if (pressed.down) dy += 1;

    if (dx !== 0 || dy !== 0) {
        // Normalize diagonal movement so diagonal speed isn't faster
        if (dx !== 0 && dy !== 0) {
            const inv = 1 / Math.sqrt(2);
            dx *= inv; dy *= inv;
        }

    const speedMultiplier = isSprinting() ? sprintSpeedMultiplier : 1;
        const effectiveSpeed = baseSpeedPxPerSecond * speedMultiplier;

        const prevX = currentX, prevY = currentY;
        currentX = Math.max(0, currentX + dx * effectiveSpeed * dt);
        currentY = Math.max(0, currentY + dy * effectiveSpeed * dt);
        applyValues();
        console.debug('moved dx,dy:', dx.toFixed(3), dy.toFixed(3), 'from', Math.round(prevX), Math.round(prevY), 'to', Math.round(currentX), Math.round(currentY));
    }

    // Update NPC squares movement before overlap detection so overlap uses
    // the latest positions.
    updateSquares(dt);
    // Depth-sort entities each frame so sprites overlap realistically
    updateDepthSorting();

    // Sprite animation: switch between idle and walk frames and flip based on lastDirection
    if (player) {
        const moving = Boolean(pressed.left || pressed.right || pressed.up || pressed.down);
        const targetFrames = moving ? walkFrames : idleFrames;
        if (targetFrames !== frames) {
            frames = targetFrames;
            frameIndex = 0;
            frameElapsedMs = 0;
            player.src = frames[frameIndex];
        } else {
            // advance frames based on elapsed real time so animation is
            // independent of the display frame rate. `dt` (seconds) is
            // available from the main loop; convert to milliseconds and
            // accumulate.
            const dtMs = dt * 1000;
            frameElapsedMs += dtMs;
            // If sprinting, increase animation fps slightly so the walk looks faster
            const effectiveFps = isSprinting() ? animationFps * sprintFpsMultiplier : animationFps;
            const frameIntervalMs = 1000 / Math.max(1, effectiveFps);
            if (frameElapsedMs >= frameIntervalMs) {
                // advance by how many intervals have passed (handles slow frames)
                const steps = Math.floor(frameElapsedMs / frameIntervalMs);
                frameElapsedMs -= steps * frameIntervalMs;
                frameIndex = (frameIndex + steps) % frames.length;
                player.src = frames[frameIndex];
            }
        }

        // Flip sprite using CSS variable
        player.style.setProperty('--playerFlip', lastDirection === 'left' ? -1 : 1);
    }

    // FOLLOW-SCROLL: keep the button near the viewport center when it moves.
    // If the button's center is further than the threshold from the viewport
    // center, scroll the page a small amount so it remains in view.
    // 'player' is declared once at top; reuse it here.
    if (player) {
            const rect = player.getBoundingClientRect();
            const btnCenterX = rect.left + rect.width / 2;
            const btnCenterY = rect.top + rect.height / 2;
            const viewCenterX = window.innerWidth / 2;
            const viewCenterY = window.innerHeight / 2;

            const dxView = btnCenterX - viewCenterX; // positive = to the right
            const dyView = btnCenterY - viewCenterY; // positive = below center

            // Thresholds in pixels before we start scrolling (use top-level constants)
            // followThresholdX and followThresholdY are defined near the top.

            // Only scroll the amount beyond the threshold so the button doesn't
            // jump to the exact center; this keeps the motion smooth and predictable.
            let scrollX = 0, scrollY = 0;
            if (Math.abs(dxView) > followThresholdX) {
                scrollX = (Math.abs(dxView) - followThresholdX) * Math.sign(dxView);
            }
            if (Math.abs(dyView) > followThresholdY) {
                scrollY = (Math.abs(dyView) - followThresholdY) * Math.sign(dyView);
            }

            if (scrollX !== 0 || scrollY !== 0) {
                // Compute new scroll positions and clamp to document bounds
                const doc = document.documentElement;
                const maxScrollLeft = Math.max(0, doc.scrollWidth - window.innerWidth);
                const maxScrollTop = Math.max(0, doc.scrollHeight - window.innerHeight);

                const newLeft = Math.min(maxScrollLeft, Math.max(0, window.scrollX + scrollX));
                const newTop = Math.min(maxScrollTop, Math.max(0, window.scrollY + scrollY));

                // Immediate scroll (no smooth) so the follow keeps up with per-frame updates.
                window.scrollTo({ left: newLeft, top: newTop, behavior: 'auto' });
            }
        }

    // Update overlap state each frame so visual feedback is immediate
    updateOverlap();
    // If a dialogue is shown for a square, reposition it so the text follows
    // the moving square. Use stored measured box size if available so we
    // avoid measuring an empty body during typewriter reveals.
    if (dialogueNode && dialogueNode.dataset && dialogueNode.dataset.squareId) {
        const shownId = dialogueNode.dataset.squareId;
        const shownEl = document.getElementById(shownId);
        if (shownEl) {
            const rect = shownEl.getBoundingClientRect();
            const rectNode = dialogueNode.getBoundingClientRect();
            const boxW = rectNode.width || dialogueNode._boxW || 0;
            const boxH = rectNode.height || dialogueNode._boxH || 0;
            const arrowGap = 6;
            const vOffset = parsePx(getComputedStyle(root).getPropertyValue('--dialogueVerticalOffset')) || 12;
            const left = rect.right - boxW;
            const top = rect.top - boxH - arrowGap - vOffset;
            const pageLeft = Math.round(left + window.scrollX);
            const pageTop = Math.round(top + window.scrollY);
            dialogueNode.style.left = `${pageLeft}px`;
            dialogueNode.style.top = `${pageTop}px`;
        }
    }
    // Auto-close dialogue ONLY if the square left the player's movement bounds
    // (i.e., outside the follow thresholds). We do not auto-close simply
    // because overlap ended; the user asked to keep the dialogue until
    // the square is outside the follow threshold.
    if (dialogueNode && dialogueNode.dataset && dialogueNode.dataset.squareId) {
        const shownId = dialogueNode.dataset.squareId;
        const shownEl = document.getElementById(shownId);
        // Only close when the square is outside the dialogue boundary
        // (which can be scaled independently of follow thresholds).
        if (shownEl && !isSquareWithinDialogueBoundary(shownEl)) {
            hideDialogue();
        }
    }
    // On-screen controls are fixed via CSS; no per-frame positioning required.

    requestAnimationFrame(loop);
}

// Start the animation loop
requestAnimationFrame(loop);

// Initialize UI with current CSS variable values
applyValues();

// If the head contains a <link id="dialogue-font-link"> with a Google
// Fonts (or other) stylesheet href, parse the `family=` query params and
// set the --dialogueFontFamily CSS variable so the dialogue boxes use
// the loaded fonts. This lets the user only paste the stylesheet URL in
// `index.html` and immediately have the dialogue change to that font.
function applyDialogueLinkFontFromLink() {
    const link = document.getElementById('dialogue-font-link');
    if (!link) return;
    const href = (link.getAttribute('href') || '').trim();
    if (!href) return;
    try {
        const url = new URL(href, location.href);
        const params = new URLSearchParams(url.search);
        const families = [];
        // Google Fonts uses repeated `family=` params; collect them all.
        for (const v of params.getAll('family')) {
            // Remove any after-colon weight/style suffix (e.g. `:wght@400;700`)
            const name = String(v).split(':')[0].replace(/\+/g, ' ').trim();
            if (name) families.push(`"${name}"`);
        }
        // Fallback if none found
        const fontFamily = families.length ? families.join(', ') + ', sans-serif' : 'sans-serif';
        document.documentElement.style.setProperty('--dialogueFontFamily', fontFamily);
        console.debug('Applied dialogue font from link:', fontFamily, 'href=', href);
    } catch (err) {
        console.debug('Failed to parse dialogue font link href', err);
    }
}

// Run once on load. Also watch for the link loading or attribute changes
// so users can paste/change the href and see immediate effect.
applyDialogueLinkFontFromLink();
const _dialogueLinkEl = document.getElementById('dialogue-font-link');
if (_dialogueLinkEl) {
    _dialogueLinkEl.addEventListener('load', applyDialogueLinkFontFromLink);
    const mo = new MutationObserver((muts) => {
        for (const m of muts) {
            if (m.type === 'attributes' && m.attributeName === 'href') applyDialogueLinkFontFromLink();
        }
    });
    mo.observe(_dialogueLinkEl, { attributes: true });
}
