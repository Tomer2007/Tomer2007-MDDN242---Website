
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
    const a = elA.getBoundingClientRect();
    const b = elB.getBoundingClientRect();
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
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
    if (currentOverlapSquare) {
        const name = currentOverlapSquare.dataset.name || currentOverlapSquare.id || 'object';
        console.debug('handleAction on', name);
        alert(`Action on ${name}`);
    } else {
        // Optional: give feedback when no object is overlapped
        // alert('No object to interact with');
    }
}

// Wire the on-screen action button
actionBtn?.addEventListener('click', handleAction);

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

            // Thresholds in pixels before we start scrolling
            const followThresholdX = 120;
            const followThresholdY = 120;

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
    // On-screen controls are fixed via CSS; no per-frame positioning required.

    requestAnimationFrame(loop);
}

// Start the animation loop
requestAnimationFrame(loop);

// Initialize UI with current CSS variable values
applyValues();
