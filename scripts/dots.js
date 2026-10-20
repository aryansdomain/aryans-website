// ------------------------ SETTINGS ------------------------

const DOTS_PER_PIXEL = 0.000405; // dots/px   dots wandering the background per pixel of window (800 on a 1990x992 window)
const DOT_RADIUS = 1.5;          // px
const DOT_MIN_ALPHA = 0.15;      // 0-1       faintest a dot can be

// APPEAR
const APPEAR_START = 0.1; // ratio   fraction of TOPBAR_TIME when the first dot appears
const APPEAR_END = 0.9;   // ratio   fraction of TOPBAR_TIME when the last  dot appears
const DOT_FADE_IN = 800;  // ms      time each dot takes to fade in

// WANDER
const WANDER_SPEED = 35;    // px/s
const WANDER_VARIETY = 0.6; // ratio   how much wander speed differs between dots
const WANDER_TURN = 1.2;    // rad/s   fastest dots turn while wandering
const WANDER_JITTER = 4;    //         how often a dot changes which way it's turning, higher -> wigglier
const EDGE_MARGIN = 60;     // px      how close to edges the dots get before turning back
const EDGE_STEER = 3;       //         how hard dots turn back from edges
const EDGE_TOLERANCE = 40;  // px      how far past EDGE_MARGIN a dot may go before turning

const CURSOR_MARGIN = 80; // px      how close to the cursor dots get before turning away
const CURSOR_STEER = 200; //         how hard dots turn away from the cursor
const CURSOR_SPEEDUP = 5; // ratio   how much faster than wandering dots are when at the cursor
const CURSOR_CALM = 600;  // ms      how quickly fleeing dots slow back down to wandering

// CHROMATIC ABERRATION
const CHROMA_OFFSET = 1; // px    how far colors split from a dot
const CHROMA_EASE = 150; // ms    how quickly color split follows the dot



// ------------------------ STATE ------------------------

// behind ring and boxes
const dotCanvas = document.getElementById("dots");
const dotCtx = dotCanvas.getContext("2d");

const dots = [];

let dotWidth = 0;
let dotHeight = 0;
let dotColor = null;
let dotDarkness = 1; // how solid --dot is
let dotBackground = null;
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

// dots' colors, from style.css
function readDotColor() {
    const style = getComputedStyle(document.documentElement);
    dotColor = style.getPropertyValue("--dot").trim();
    dotBackground = style.getPropertyValue("--background").trim();
    const parts = dotColor.match(/[\d.]+/g);
    dotDarkness = parts && parts.length === 4 ? parseFloat(parts[3]) : 1;
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

    const count = Math.round(DOTS_PER_PIXEL * dotWidth * dotHeight);
    for (let i = 0; i < count; i++) {
        dots.push({
            appearAt: now + TOPBAR_TIME * (APPEAR_START + (APPEAR_END - APPEAR_START) * Math.random()),
            x: EDGE_MARGIN + Math.random() * Math.max(0, dotWidth  - 2 * EDGE_MARGIN),
            y: EDGE_MARGIN + Math.random() * Math.max(0, dotHeight - 2 * EDGE_MARGIN),
            wanderSpeed: WANDER_SPEED * vary(WANDER_VARIETY),
            alpha: DOT_MIN_ALPHA + (1 - DOT_MIN_ALPHA) * Math.random(),
            heading: Math.random() * Math.PI * 2, // direction it's heading
            turn: 0, // how fast direction is changing
            reach: randomReach(), // how far past EDGE_MARGIN it goes before turning back this time
            turningBack: false, // is it turning back from an edge
            boost: 0, // extra speed from fleeing the cursor, as a ratio of wander speed
            chroma: 0, // how split the color channels are
            chromaAngle: 0 // which way the channels split, away from the closest boundary
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

    // near the edges, turn back to the middle
    const margin = EDGE_MARGIN - dot.reach;
    const nearEdge = Math.max(
        (margin - dot.x) / EDGE_MARGIN,
        (dot.x - (dotWidth - margin)) / EDGE_MARGIN,
        (margin - dot.y) / EDGE_MARGIN,
        (dot.y - (dotHeight - margin)) / EDGE_MARGIN
    );
    const toMiddle = Math.atan2(dotHeight / 2 - dot.y, dotWidth / 2 - dot.x);
    if (nearEdge > 0) {
        steerToward(dot, toMiddle, nearEdge, EDGE_STEER, seconds);
        dot.turningBack = true;
    } else if (dot.turningBack) {
        // back inside, pick a new distance for next time
        dot.turningBack = false;
        dot.reach = randomReach();
    }

    // color channels split
    let chroma      = lensAmount(dot.x, dot.y) * LENS_OFFSET;
    let chromaAngle = lensAngle (dot.x, dot.y);

    // near the cursor, turn away from it and speed up, calm down after
    dot.boost *= Math.exp(-dt / CURSOR_CALM);
    if (cursor !== null) {
        const distance = Math.hypot(dot.x - cursor.x, dot.y - cursor.y);
        const nearCursor = (CURSOR_MARGIN - distance) / CURSOR_MARGIN;
        if (nearCursor > 0) {
            const awayFromCursor = Math.atan2(dot.y - cursor.y, dot.x - cursor.x);
            steerToward(dot, awayFromCursor, nearCursor, CURSOR_STEER, seconds);
            dot.boost = Math.max(dot.boost, CURSOR_SPEEDUP * nearCursor);

            // cursor splits it more
            if (Math.min(1, nearCursor) * CHROMA_OFFSET > chroma) {
                chroma = Math.min(1, nearCursor) * CHROMA_OFFSET;
                chromaAngle = awayFromCursor;
            }
        }
    }

    // ease towarda new split
    const follow = 1 - Math.exp(-dt / CHROMA_EASE);
    dot.chroma += (chroma - dot.chroma) * follow;
    if (chroma > 0) dot.chromaAngle = chromaAngle;

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
    dotCtx.globalAlpha = 1;
    dotCtx.globalCompositeOperation = "source-over";
    dotCtx.fillStyle = dotBackground;
    dotCtx.fillRect(0, 0, dotWidth, dotHeight);

    for (const dot of dots) {
        const shown = clamp(0, 1, (now - dot.appearAt) / DOT_FADE_IN);
        if (shown <= 0) continue;
        const alpha = shown * dot.alpha;

        // not split
        if (dot.chroma < 0.01) {
            dotCtx.globalCompositeOperation = "source-over";
            dotCtx.globalAlpha = alpha;
            dotCtx.fillStyle = dotColor;
            dotCtx.beginPath();
            dotCtx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
            dotCtx.fill();
            continue;
        }

        // chromatic aberration
        const dx = Math.cos(dot.chromaAngle) * dot.chroma;
        const dy = Math.sin(dot.chromaAngle) * dot.chroma;
        dotCtx.globalCompositeOperation = "multiply";
        dotCtx.globalAlpha = alpha * dotDarkness;
        for (const [color, side] of [["#0ff", 1], ["#f0f", 0], ["#ff0", -1]]) {
            dotCtx.fillStyle = color;
            dotCtx.beginPath();
            dotCtx.arc(dot.x + dx * side, dot.y + dy * side, DOT_RADIUS, 0, Math.PI * 2);
            dotCtx.fill();
        }
    }
    dotCtx.globalCompositeOperation = "source-over";
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
