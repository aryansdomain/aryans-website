// ------------------------ SETTINGS ------------------------

const DOT_COUNT = 800;       //        number of dots wandering the background
const DOT_RADIUS = 1.5;      // px
const DOT_MIN_ALPHA = 0.15;  // 0-1    faintest a dot can be

// APPEAR
const APPEAR_START = 0.1;    // ratio  fraction of TOPBAR_TIME when the first dot appears
const APPEAR_END = 0.9;      // ratio  fraction of TOPBAR_TIME when the last  dot appears
const DOT_FADE_IN = 800;     // ms     time each dot takes to fade in

// WANDER
const WANDER_SPEED = 35;     // px/s
const WANDER_VARIETY = 0.6;  // ratio  how much wander speed differs between dots
const WANDER_TURN = 1.2;     // rad/s  fastest dots turn while wandering
const WANDER_JITTER = 4;     //        how often a dot changes which way it's turning, higher -> wigglier
const EDGE_MARGIN = 60;      // px     how close to edges the dots get before turning back
const EDGE_STEER = 3;        //        how hard dots turn back from edges
const EDGE_TOLERANCE = 40;   // px     how far past EDGE_MARGIN a dot may go before turning

const CURSOR_MARGIN = 80;    // px     how close to the cursor dots get before turning away
const CURSOR_STEER = 200;     //        how hard dots turn away from the cursor
const CURSOR_SPEEDUP = 5;    // ratio  how much faster than wandering dots are when at the cursor
const CURSOR_CALM = 600;     // ms     how quickly fleeing dots slow back down to wandering



// ------------------------ STATE ------------------------

// behind ring and boxes
const dotCanvas = document.getElementById("dots");
const dotCtx = dotCanvas.getContext("2d");

const dots = [];

let dotWidth = 0;
let dotHeight = 0;
let dotColor = null;
let cursor = null;

// resize canvas to window
function resizeDots() {
    const dpr = window.devicePixelRatio || 1;
    dotWidth  = window.innerWidth;
    dotHeight = window.innerHeight;
    dotCanvas.width  = Math.round(dotWidth  * dpr);
    dotCanvas.height = Math.round(dotHeight * dpr);
    dotCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// dots' color, from style.css
function readDotColor() {
    dotColor = getComputedStyle(document.documentElement).getPropertyValue("--dot").trim();
}

// a random ratio around 1, up to amount above or below
function vary(amount) {
    return 1 + (Math.random() * 2 - 1) * amount;
}

// how far past EDGE_MARGIN a dot goes before turning back
function randomReach() {
    return (Math.random() * 1.5 - 0.5) * EDGE_TOLERANCE;
}

// signed smallest angle from a to b
function angleBetween(a, b) {
    return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}



// ------------------------ MAIN FUNCTIONS ------------------------

// scatter dots across the page, fading in as the name moves into topbar
function showDots() {
    if (dots.length > 0) return;
    const now = performance.now();
    const top = NAME_SPACE + EDGE_MARGIN;

    for (let i = 0; i < DOT_COUNT; i++) {
        dots.push({
            appearAt: now + TOPBAR_TIME * (APPEAR_START + (APPEAR_END - APPEAR_START) * Math.random()),
            x: EDGE_MARGIN + Math.random() * Math.max(0, dotWidth  - 2 * EDGE_MARGIN),
            y: top         + Math.random() * Math.max(0, dotHeight - top - EDGE_MARGIN),
            wanderSpeed: WANDER_SPEED * vary(WANDER_VARIETY),
            alpha: DOT_MIN_ALPHA + (1 - DOT_MIN_ALPHA) * Math.random(),
            heading: Math.random() * Math.PI * 2, // direction it's heading
            turn: 0, // how fast direction is changing
            reach: randomReach(), // how far past EDGE_MARGIN it goes before turning back this time
            turningBack: false, // is it turning back from an edge
            boost: 0 // extra speed from fleeing the cursor, as a ratio of wander speed
        });
    }
    startDotLoop();
}

// wander
function moveDot(dot, dt) {
    const seconds = dt / 1000;

    // randomly turn a tiny bit
    dot.turn += (Math.random() - 0.5) * WANDER_JITTER * WANDER_TURN * seconds * 2;
    dot.turn -= dot.turn * Math.min(1, seconds); // drift back toward straight
    dot.turn = clamp(-WANDER_TURN, WANDER_TURN, dot.turn);
    dot.heading += dot.turn * seconds;

    // near the edges, turn back to the middle, and stay away from name
    const top = NAME_SPACE;
    const margin = EDGE_MARGIN - dot.reach;
    const nearEdge = Math.max(
        (margin - dot.x) / EDGE_MARGIN,
        (dot.x - (dotWidth - margin)) / EDGE_MARGIN,
        (top + margin - dot.y) / EDGE_MARGIN,
        (dot.y - (dotHeight - margin)) / EDGE_MARGIN
    );
    if (nearEdge > 0) {
        const toMiddle = Math.atan2(dotHeight / 2 + top / 2 - dot.y, dotWidth / 2 - dot.x);
        steerToward(dot, toMiddle, nearEdge, EDGE_STEER, seconds);
        dot.turningBack = true;
    } else if (dot.turningBack) {
        // back inside, pick a new distance for next time
        dot.turningBack = false;
        dot.reach = randomReach();
    }

    // near the cursor, turn away from it and speed up, calm down after
    dot.boost *= Math.exp(-dt / CURSOR_CALM);
    if (cursor !== null) {
        const distance = Math.hypot(dot.x - cursor.x, dot.y - cursor.y);
        const nearCursor = (CURSOR_MARGIN - distance) / CURSOR_MARGIN;
        if (nearCursor > 0) {
            const awayFromCursor = Math.atan2(dot.y - cursor.y, dot.x - cursor.x);
            steerToward(dot, awayFromCursor, nearCursor, CURSOR_STEER, seconds);
            dot.boost = Math.max(dot.boost, CURSOR_SPEEDUP * nearCursor);
        }
    }

    const speed = dot.wanderSpeed * (1 + dot.boost);
    dot.x += Math.cos(dot.heading) * speed * seconds;
    dot.y += Math.sin(dot.heading) * speed * seconds;
}

// turn heading toward angle
function steerToward(dot, angle, closeness, strength, seconds) {
    const steer = Math.min(1, strength * Math.min(1, closeness) * seconds);
    dot.heading += angleBetween(dot.heading, angle) * steer;
}

// draw dots, fading in after they appear
function drawDots(now) {
    dotCtx.clearRect(0, 0, dotWidth, dotHeight);
    dotCtx.fillStyle = dotColor;
    for (const dot of dots) {
        const shown = clamp(0, 1, (now - dot.appearAt) / DOT_FADE_IN);
        if (shown <= 0) continue;

        dotCtx.globalAlpha = shown * dot.alpha;
        dotCtx.beginPath();
        dotCtx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        dotCtx.fill();
    }
    dotCtx.globalAlpha = 1;
}



// ------------------------ RUNNING CODE ------------------------

let dotsLooping = false;
let lastDotFrame = null;

function startDotLoop() {
    if (dotsLooping) return;
    dotsLooping = true;
    lastDotFrame = null;
    requestAnimationFrame(dotFrame);
}

function dotFrame(now) {
    const dt = lastDotFrame === null ? 0 : Math.min(50, now - lastDotFrame);
    lastDotFrame = now;

    for (const dot of dots) moveDot(dot, dt);
    drawDots(now);

    requestAnimationFrame(dotFrame);
}

window.addEventListener("resize", function () {
    resizeDots();
    for (const dot of dots) {
        dot.x = clamp(0, dotWidth,  dot.x);
        dot.y = clamp(0, dotHeight, dot.y);
    }
});
// track cursor, forget when it leaves the page
window.addEventListener("pointermove", function (event) {
    cursor = { x: event.clientX, y: event.clientY };
});
document.documentElement.addEventListener("pointerleave", function () {
    cursor = null;
});

readDotColor();
resizeDots();
