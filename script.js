
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
            'Hello — this is still Square 1.',
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
    // body to the full text briefly to measure, then clear it and start
    // the typewriter effect which will reveal the same text.
    body.textContent = text;
    // Force layout and measure after filling (we don't need the measured
    // values here; measuring causes layout so later rectNode will be correct)
    body.getBoundingClientRect();

    // Now clear before starting the typewriter reveal
    body.textContent = '';
    // Start a cancellable typewriter reveal for the dialogue body.
    startTypewriter(body, text, typewriterCps);
    dialogueNode.dataset.squareId = id;

    // Make the node hidden while we measure and position above the square
    dialogueNode.style.visibility = 'hidden';
    dialogueNode.classList.remove('anchor-top-left', 'anchor-top-right');
    // Always use top-right anchor class for styling (even if we allow
    // overflow) — kept for potential styling hooks.
    dialogueNode.classList.add('anchor-top-right');

    // We measured body previously; but the dialogueNode may have its own
    // padding/border. Use getBoundingClientRect on the node now that the
    // body's size is known to compute final placement.
        const rectNode = dialogueNode.getBoundingClientRect();
        const boxW = rectNode.width;
        const boxH = rectNode.height;

    // Compute target left/top so the dialog appears above the chosen corner
    let left, top;
    const padding = 8; // margin from viewport edges / square
    const arrowGap = 6; // small gap between dialog and square
    // Always anchor to the square's top-right corner irrespective of
    // viewport visibility (per your request). This places the dialogue so
    // its right edge aligns with the square's right edge and the box sits
    // above the square.
        left = rect.right - boxW;
        // Place above the square so the square remains visible; do not clamp
        // horizontally so the box can overflow the viewport if needed.
        top = rect.top - boxH - arrowGap;

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
    // Auto-close dialogue ONLY if the square left the player's movement bounds
    // (i.e., outside the follow thresholds). We do not auto-close simply
    // because overlap ended; the user asked to keep the dialogue until
    // the square is outside the follow threshold.
    if (dialogueNode && dialogueNode.dataset && dialogueNode.dataset.squareId) {
        const shownId = dialogueNode.dataset.squareId;
        const shownEl = document.getElementById(shownId);
        // Only close when the square is outside movement bounds.
        if (shownEl && !isSquareWithinMovementBounds(shownEl)) {
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
