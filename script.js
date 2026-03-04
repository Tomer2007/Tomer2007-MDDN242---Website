// =============================================================================
//  PORTFOLIO WEBSITE — script.js
//  Controls: Arrow keys / on-screen d-pad to move, Space / Interact to talk
// =============================================================================

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

(function applyZoom() {
    const varName = isMobile ? '--zoom-mobile' : '--zoom-desktop';
    const zoom    = getVar(varName, 1.0);
    document.body.style.transformOrigin = 'top left';
    document.body.style.transform       = `scale(${zoom})`;
    document.body.style.width           = `${100 / zoom}%`;
})();

// ---------------------------------------------------------------------------
//  Movement state
// ---------------------------------------------------------------------------

let currentX = getVar('--buttonX', 0);
let currentY = getVar('--buttonY', 150);

const baseSpeedPxPerSecond  = 200;
const sprintSpeedMultiplier = 1.8;

const followThresholdX = isMobile ? 60 : 120;
const followThresholdY = isMobile ? 80 : 120;

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
    "Assets/Tomer'sWebsitePlayerIdle1.png.png",
    "Assets/Tomer'sWebsitePlayerIdle2.png.png"
];
const walkFrames = [
    "Assets/Tomer'sWebsitePlayerWalk1.png.png",
    "Assets/Tomer'sWebsitePlayerWalk2.png.png"
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

const squareEls    = Array.from(document.querySelectorAll('.game-square'));
const squareStates = {};    // keyed by element id
const dialogueConfig = {};  // keyed by element id — populated from data-* below

function randRange(min, max) { return Math.random() * (max - min) + min; }

for (const el of squareEls) {
    const id = el.id || `sq-${Math.random().toString(36).slice(2, 8)}`;

    // ── Read data-* attributes ──────────────────────────────────────────────

    const x        = parseFloat(el.dataset.x)  || 0;
    const y        = parseFloat(el.dataset.y)  || 0;
    const canMove  = (el.dataset.canMove ?? 'true') !== 'false'; // default: true
    const diagMode = el.dataset.dialogueMode || 'sequence';
    // Dialogue lines are separated by  |  in the attribute
    const diagLines = (el.dataset.dialogue || '')
        .split('||')
        .map(s => s.trim())
        .filter(Boolean);

    // ── Build dialogueConfig entry ──────────────────────────────────────────
    dialogueConfig[id] = {
        texts:       diagLines.length ? diagLines : [`You interacted with ${id}.`],
        mode:        diagMode,
        counter:     0,
        randomRange: [0, Math.max(1, diagLines.length - 1)]
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
        el.dataset.idle1 || 'Assets/WebsiteNPC1Idle1.png.png',
        el.dataset.idle2 || 'Assets/WebsiteNPC1Idle2.png.png'
    ];
    const framesWalk = [
        el.dataset.walk1 || 'Assets/WebsiteNPC1Walk1.png.png',
        el.dataset.walk2 || 'Assets/WebsiteNPC1Walk2.png.png'
    ];

    // ── Store runtime state ─────────────────────────────────────────────────
    squareStates[id] = {
        el, id, x, y,
        canMove,
        state:    'idle',
        timerMs:  randRange(800, 2400),
        dirX: 0,  dirY: 0,
        speed:    randRange(20, 60),
        interactedPaused: false,
        framesIdle, framesWalk,
        frames:        framesIdle,
        frameIndex:    0,
        frameElapsedMs: 0,
        img,
        lastDirection: 'right'
    };

    img.src = framesIdle[0];
    img.style.setProperty('--npcFlip', 1);
    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
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
    d.style.cssText = 'position:absolute; left:0; top:0; visibility:hidden; z-index:100000;';
    document.body.appendChild(d);
    return d;
}

function hideDialogue() {
    if (!dialogueNode) return;
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

// ---------------------------------------------------------------------------
//  Dialogue token rendering
//
//  Supported tokens (can be mixed in the same line):
//    /n                   → line break
//    {link:Label|URL}     → clickable hyperlink, opens in new tab
//    {img:path/to/img}    → image on the RIGHT of the text
//                           size controlled by --dialogueImageSize in styles.css
// ---------------------------------------------------------------------------

function renderDialogueContent(rawText) {
    // Replace /n with real newlines
    let text = rawText.replace(/\/n/g, '\n');

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

    const body = dialogueNode.querySelector('.dialogue-body');

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

    // Measure after rendering so we have box dimensions for positioning
    dialogueNode.style.visibility = 'hidden';
    const m = dialogueNode.getBoundingClientRect();
    dialogueNode._boxW = m.width  || dialogueNode._boxW;
    dialogueNode._boxH = m.height || dialogueNode._boxH;

    dialogueNode.dataset.squareId = id;
    positionDialogueNearSquare(squareEl);
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
    const r     = squareEl.getBoundingClientRect();
    const scale = Number(dialogueBoundaryScale) || 1;
    return Math.abs((r.left + r.width  / 2) - window.innerWidth  / 2) <= followThresholdX * scale
        && Math.abs((r.top  + r.height / 2) - window.innerHeight / 2) <= followThresholdY * scale;
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
    const target = currentOverlapSquare
        ?? Array.from(document.querySelectorAll('.game-square')).find(sq => isOverlapping(player, sq))
        ?? null;
    if (target) showDialogueForSquare(target);
}

actionBtn?.addEventListener('click', handleAction);

// ---------------------------------------------------------------------------
//  NPC square update — wandering AI + frame animation
// ---------------------------------------------------------------------------

function updateSquares(dt) {
    if (!arena) return;
    for (const id of Object.keys(squareStates)) {
        const s  = squareStates[id];
        const el = s.el;

        // ── Interaction pause ───────────────────────────────────────────────
        if (s.interactedPaused) {
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
        if (s.canMove && !s.interactedPaused) {
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
                s.x = nx; s.y = ny;
                el.style.left = `${Math.round(nx)}px`;
                el.style.top  = `${Math.round(ny)}px`;
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
//  Controls position
//
//  CONTROLS_OFFSET sets how far below/beside the player the buttons appear.
//  Positive Y = below the player. Positive X = right of centre.
// ---------------------------------------------------------------------------

const CONTROLS_OFFSET = {
    desktop: { x: 700, y: 340 },
    mobile:  { x: 0, y: 910 },
};

const controlsEl = document.getElementById('button-controls');

// Page-coordinate position of the controls. Set once on load, then updated
// only when the page scrolls — not when the player moves inside the follow zone.
let controlsPageX = 0;
let controlsPageY = 0;
let prevScrollX   = window.scrollX;
let prevScrollY   = window.scrollY;

function initControlsPosition() {
    if (!controlsEl) return;
    const offset  = isMobile ? CONTROLS_OFFSET.mobile : CONTROLS_OFFSET.desktop;
    controlsPageX = currentX + offset.x;
    controlsPageY = currentY + offset.y;
    const cW = controlsEl.offsetWidth || 200;
    controlsEl.style.left      = `${Math.round(controlsPageX - cW / 2)}px`;
    controlsEl.style.top       = `${Math.round(controlsPageY)}px`;
    controlsEl.style.transform = 'none';
}

function updateControlsPosition() {
    if (!controlsEl) return;
    // Only move the controls by exactly how much the page scrolled this frame.
    // Inside the follow zone there is no scroll, so the controls stay still.
    const dScrollX = window.scrollX - prevScrollX;
    const dScrollY = window.scrollY - prevScrollY;
    prevScrollX = window.scrollX;
    prevScrollY = window.scrollY;
    if (dScrollX === 0 && dScrollY === 0) return;
    controlsPageX += dScrollX;
    controlsPageY += dScrollY;
    const cW = controlsEl.offsetWidth || 200;
    controlsEl.style.left = `${Math.round(controlsPageX - cW / 2)}px`;
    controlsEl.style.top  = `${Math.round(controlsPageY)}px`;
}

// ---------------------------------------------------------------------------
//  Camera — follow-scroll (original behaviour, now in its own function)
// ---------------------------------------------------------------------------

function updateCamera() {
    if (!player) return;
    const rect   = player.getBoundingClientRect();
    const dxView = (rect.left + rect.width  / 2) - window.innerWidth  / 2;
    const dyView = (rect.top  + rect.height / 2) - window.innerHeight / 2;
    let scrollDX = 0, scrollDY = 0;
    if (Math.abs(dxView) > followThresholdX) scrollDX = (Math.abs(dxView) - followThresholdX) * Math.sign(dxView);
    if (Math.abs(dyView) > followThresholdY) scrollDY = (Math.abs(dyView) - followThresholdY) * Math.sign(dyView);
    if (scrollDX !== 0 || scrollDY !== 0) {
        const doc = document.documentElement;
        window.scrollTo({
            left:     Math.min(Math.max(0, window.scrollX + scrollDX), Math.max(0, doc.scrollWidth  - window.innerWidth)),
            top:      Math.min(Math.max(0, window.scrollY + scrollDY), Math.max(0, doc.scrollHeight - window.innerHeight)),
            behavior: 'auto'
        });
    }
}

function centerCameraOnPlayer() {
    if (!player) return;
    const r = player.getBoundingClientRect();
    window.scrollTo({
        left:     r.left + window.scrollX - window.innerWidth  / 2 + r.width  / 2,
        top:      r.top  + window.scrollY - window.innerHeight / 2 + r.height / 2,
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
        if (dx !== 0 && dy !== 0) { dx *= 1 / Math.sqrt(2); dy *= 1 / Math.sqrt(2); }
        const speed = baseSpeedPxPerSecond * (isSprinting() ? sprintSpeedMultiplier : 1);
        currentX = Math.max(0, currentX + dx * speed * dt);
        currentY = Math.max(0, currentY + dy * speed * dt);
        applyValues();
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
    updateDepthSorting();
    updateCamera();
    updateOverlap();
    updateControlsPosition();

    // Track open dialogue and auto-close if the NPC wandered too far
    if (dialogueNode?.dataset.squareId) {
        const squareEl = document.getElementById(dialogueNode.dataset.squareId);
        if (squareEl) {
            positionDialogueNearSquare(squareEl);
            if (!isSquareWithinDialogueBoundary(squareEl)) hideDialogue();
        }
    }

    requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
//  Init
// ---------------------------------------------------------------------------

applyValues();
window.addEventListener('load', () => {
    centerCameraOnPlayer();
    initControlsPosition();
});
requestAnimationFrame(loop);