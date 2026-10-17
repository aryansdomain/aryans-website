// ------------------------ SETTINGS ------------------------

const DOT_COUNT = 100;       //        number of dots wandering the background
const DOT_RADIUS = 1.5;      // px

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



// ------------------------ STATE ------------------------

// behind ring and boxes
const dotCanvas = document.getElementById("dots");
const dotCtx = dotCanvas.getContext("2d");

const dots = [];

let dotWidth = 0;
let dotHeight = 0;
let dotColor = null;

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
            heading: Math.random() * Math.PI * 2, // direction it's heading
            turn: 0 // how fast direction is changing
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
    const nearEdge = Math.max(
        (EDGE_MARGIN - dot.x) / EDGE_MARGIN,
        (dot.x - (dotWidth - EDGE_MARGIN)) / EDGE_MARGIN,
        (top + EDGE_MARGIN - dot.y) / EDGE_MARGIN,
        (dot.y - (dotHeight - EDGE_MARGIN)) / EDGE_MARGIN
    );
    if (nearEdge > 0) {
        const toMiddle = Math.atan2(dotHeight / 2 + top / 2 - dot.y, dotWidth / 2 - dot.x);
        const steer = Math.min(1, EDGE_STEER * Math.min(1, nearEdge) * seconds);
        dot.heading += angleBetween(dot.heading, toMiddle) * steer;
    }

    dot.x += Math.cos(dot.heading) * dot.wanderSpeed * seconds;
    dot.y += Math.sin(dot.heading) * dot.wanderSpeed * seconds;
}

// draw dots, fading in after they appear
function drawDots(now) {
    dotCtx.clearRect(0, 0, dotWidth, dotHeight);
    dotCtx.fillStyle = dotColor;
    for (const dot of dots) {
        const shown = clamp(0, 1, (now - dot.appearAt) / DOT_FADE_IN);
        if (shown <= 0) continue;

        dotCtx.globalAlpha = shown;
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
readDotColor();
resizeDots();
