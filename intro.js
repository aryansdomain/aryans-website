// ------------------------ SETTINGS ------------------------

const SEEN_INTRO_KEY = "intro_seen";

// POINTS
const POINTS_PER_PIXEL = 0.002; // pts/px   points per pixel (2500 on a 1990x992 window)
const POINT_RADIUS = 1.8;        // px

// TEXT
const TEXT = "Aryan Singhal";
const TEXT_SCREEN_WIDTH = 0.5;          // ratio   how much of the width of the screen the text fills
const TEXT_FONT_FAMILY    = "Palatino"; //         text font family
const SAMPLE_SIZE = 100;                // px      size text is measured at, larger -> more accurate shape

// 1. LOADING PERCENTAGE
const PERCENT_FONT_FAMILY = "'Helvetica Neue'"; //      loading percentage font family
const FASTEST_LOAD_TIME = 1000;                 // ms   quickest the percentage can go from 0 to 100
const HOLD_TIME = 100;                          // ms   how long percentage is at 100% before shrinking
const SHRINK_TIME = 200;                        // ms   how long the percentage shrink takes
const PERCENT_FADE_OUT = 100;                   // ms   how long the percentage fade out takes
const START_SIZE = 18;                          // px   text size of percentage at 0%
const PEAK_SIZE = 26;                           // px   text size of percentage at 100%
const BURST_SIZE = 14;                          // px   text size of percentage as it bursts
const GROW_EASE = 2;                            //      how hard the easing is, higher -> faster start, earlier slow-down

// 2. BURST
const BURST_TIME = 1500;      // ms            how long points take to fly out
const BURST_END_SPEED = 0.6;  // ratio         ratio of final speed to burst speed
const BURST_RADIUS = 1;       // text-widths   size the ball the points burst out into
const MIN_SLOWNESS = 0.55;    // ratio         ratio of BURST_TIME and FORM_TIME the fastest points take
const SLOWNESS_SPREAD = 0.25; // ratio         how much longer the slowest points take, so they don't all land together

// 3. DRIFT
const DRIFT_START_SPEED = 0.3; // ratio         when points reach this speed from burst, they start drifting
const DRIFT_TIME = 2000;       // ms            how long points drift before heading to the text
const DRIFT_REACH = 0.2;       // text-widths   how far each drifting curve can reach

// 4. FORM
const FORM_TIME = 2000; // ms   how long points take to travel to the text

// 5. TOPBAR
const TOPBAR_TIME = 900;           // ms      how long the text takes to move up into the topbar
const TOPBAR_TEXT_WIDTH = 0.12;    // ratio   how much of the width of the screen the text fills in the topbar
const TOPBAR_Y = 40;               // px      how far the middle of the text is from the top of the screen
const TOPBAR_POINTS_PER_PIXEL = 7; // pts/px  points per pixel of topbar letters
const TOPBAR_POINT_RADIUS = 0.25;  // px      size of points in the topbar text

const HOVER_POINT_RADIUS = 0.4;    // px      size of points in the topbar text when hovered, bigger -> bolder
const HOVER_TIME = 200;            // ms      how long the hover animation takes

// CAMERA
const FOV = 70;       // deg   up-and-down view angle
const CAMERA_PATH = [ //       the path the camera takes
    { time: 0,    yaw: 180, pitch: 0,  distance: 1   },
    { time: 1200, yaw: 145, pitch: 15, distance: 0.3 },
    { time: 2400, yaw: 90,  pitch: 30, distance: 0.5 },
    { time: 3600, yaw: 45,  pitch: 15, distance: 0.8 },
    { time: 4500, yaw: 0,   pitch: 0,  distance: 1   },

];
const NEAR_CLIP = 0.02; // text-widths points closer to the camera than this aren't drawn

// TRAILS
const TRAIL_DURATION = 500;   // ms      how long a position stays in a trail, roughly the length of the trail
const TRAIL_MIN_TIME = 10;    // ms      how often a new trail position is recorded
const TRAIL_MIN_DISTANCE = 5; // px      pixels a point must move before recording again
const TRAIL_WIDTH = 1;        // px      number of pixels in trail lines
const TRAIL_ALPHA = 0.6;      // 0-1     opacity of newest part of a trail
const TRAIL_FADE_STEPS = 10;  // count   number of brightness levels in the trail, more = smoother fading

// GLOW
const TRAIL_GLOW_STEPS = 3;      // count   how many of the newest brightness levels of a trail glow
const POINT_GLOW_SIZE = 0.0057;  // ratio   radius of glow around points (8px on a 1990x992 window)
const POINT_GLOW_STRENGTH = 0.6; // 0-1     brightness of point
const TRAIL_GLOW_SIZE = 0.0043;  // ratio   width of the glow around trails, (6px on a 1990x992 window)
const TRAIL_GLOW_STRENGTH = 0.2; // 0-1     brightness of trail



// ------------------------ UTILITIES ------------------------

function font(family, size) {
    return "200 " + size + "px " + family;
}

// ensure a value is between min and max
function clamp(min, max, value) {
    return Math.min(max, Math.max(min, value));
}

// a point along a cubic bezier curve
function bezier(a, b, c, d, t) {
    const u = 1 - t;
    return u*u*u*a + 3*u*u*t*b + 3*u*t*t*c + t*t*t*d;
}

// a point along a 3d cubic bezier curve
function bezier3d(a, b, c, d, t) {
    return {
        x: bezier(a.x, b.x, c.x, d.x, t),
        y: bezier(a.y, b.y, c.y, d.y, t),
        z: bezier(a.z, b.z, c.z, d.z, t)
    };
}

// the point t of the way from a to b, in 3D
function lerp3(a, b, t) {
    return { x: a.x + (b.x - a.x) * t,
             y: a.y + (b.y - a.y) * t,
             z: a.z + (b.z - a.z) * t
    };
}

// extend the line from `from` through p, `amount` times `from`'s distance past p
function continuePast(a, b, amount) {
    return {
        x: b.x + (b.x - a.x) * amount,
        y: b.y + (b.y - a.y) * amount,
        z: b.z + (b.z - a.z) * amount
    };
}

// a random direction in 3D, length 1
function randomDirection() {
    const z = Math.random() * 2 - 1;
    const angle = Math.random() * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    return { x: Math.cos(angle) * ring, y: Math.sin(angle) * ring, z: z };
}

// a random spot up to `dist` away from p, in 3D
function randomNear(p, dist) {
    const direction = randomDirection();
    const distance = dist * (0.4 + Math.random() * 0.6);
    return {
        x: p.x + direction.x * distance,
        y: p.y + direction.y * distance,
        z: p.z + direction.z * distance
    };
}

function dot(a, b) {
    return a.x*b.x + a.y*b.y + a.z*b.z;
}

function cross(a, b) {
    return { x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x };
}

function normalize(a) {
    const length = Math.hypot(a.x, a.y, a.z) || 1;
    return { x: a.x / length, y: a.y / length, z: a.z / length };
}

// smoothly move between keyframes in path
// eases in and out at the ends
function interpolate(path, key, time) {
    const lastIndex = path.length - 1;
    if (time >= path[lastIndex].time) return path[lastIndex][key];

    // between which two points
    let i = 0;
    while (path[i + 1].time < time) i++;
    const from = path[i    ];
    const to   = path[i + 1];

    // slope between value's neighbours
    function slopeAt(k) {
        if (k === 0 || k === lastIndex) return 0;
        return (path[k + 1][key] - path[k - 1][key]) / (path[k + 1].time - path[k - 1].time);
    }

    // bezier curve between path, enters and exits at path's speeds
    const t = to.time - from.time;
    const s = (time - from.time) / t;
    return (2*s*s*s - 3*s*s + 1) * from[key] +
           (s*s*s - 2*s*s + s)   * t * slopeAt(i) +
           (-2*s*s*s + 3*s*s)    * to[key] +
           (s*s*s - s*s)         * t * slopeAt(i + 1);
}

// draw text on a hidden canvas and find which pixels it covers
function findTextPixels(text, family) {
    const textCanvas = document.createElement("canvas");
    const textCtx = textCanvas.getContext("2d");

    // make canvas wide enough for text
    textCtx.font = font(family, SAMPLE_SIZE);
    textCanvas.width = Math.ceil(textCtx.measureText(text).width) + SAMPLE_SIZE;
    textCanvas.height = SAMPLE_SIZE * 1.6;

    // ctx settings
    textCtx.fillStyle = "#fff";
    textCtx.font = font(family, SAMPLE_SIZE);
    textCtx.textAlign = "center";
    textCtx.textBaseline = "middle";
    textCtx.fillText(text, textCanvas.width / 2, textCanvas.height / 2); // draw text

    const pixels = textCtx.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
    const covered = [];
    for (let y = 0; y < textCanvas.height; y++) {
        for (let x = 0; x < textCanvas.width; x++) {
            if (pixels[(y*textCanvas.width + x)*4 + 3] > 60) {
                covered.push({ x: x - textCanvas.width / 2, y: y - textCanvas.height / 2 });
            }
        }
    }
    if (covered.length === 0) covered.push({ x: 0, y: 0 });
    return covered;
}



// ------------------------ MAIN FUNCTIONS ------------------------

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");

let width = 0;
let height = 0;

// resize canvas size to window size
function resize() {
    const dpr = window.devicePixelRatio || 1;

    width  = window.innerWidth;
    height = window.innerHeight;
    canvas.width  = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    // scale so drawing can be done using pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    updateCameraLens();

    // redraw here
    if (capture !== null) {
        drawTopbarImage();
        colorCaptureForHome();
        ctx.clearRect(0, 0, width, height);
        drawCapture(performance.now());
        placeNameButton();
    }
}

// set point positions
const points = [];
const pointCount = Math.max(1, Math.round(POINTS_PER_PIXEL * window.innerWidth * window.innerHeight)); // set once page loads
for (let i = 0; i < pointCount; i++) {
    // bursting: random direction, random radius
    const direction = randomDirection();
    const radius = BURST_RADIUS * Math.cbrt(Math.random());
    const burstEnd = { x: direction.x*radius, y: direction.y*radius, z: direction.z*radius };

    const driftEnd = randomNear(burstEnd, DRIFT_REACH * 0.7); // end point of bezier curve

    // add properties to points
    points.push({
        burstEnd,
        driftCurve: { c2: randomNear(driftEnd, DRIFT_REACH), end: driftEnd }, // second control point and end of bezier curve
        trail: [] // all points in the trail, oldest first, { x, y, z, time }
    });
}

// draw points onto target
function drawPoints(target) {
    // glow
    if (POINT_GLOW_SIZE > 0 && POINT_GLOW_STRENGTH > 0) {
        const screenSize = Math.sqrt(width * height);
        target.globalCompositeOperation = "lighter";
        target.globalAlpha = POINT_GLOW_STRENGTH;
        for (const point of points) {
            if (!point.visible) continue;

            // scale with window size
            const depthScale = clamp(0.3, 4, camera.homeDistance / point.depth)
            const size = POINT_GLOW_SIZE * screenSize * depthScale;
            target.drawImage(glowSprite, point.x - size, point.y - size, size * 2, size * 2);
        }
        target.globalCompositeOperation = "source-over";
    }

    // draw the points
    target.globalAlpha = 1;
    target.fillStyle = colors.text;
    target.beginPath();
    for (const point of points) {
        if (!point.visible) continue;

        // scale with windo
        const depthScale = clamp(0.3, 4, camera.homeDistance / point.depth)
        const radius = POINT_RADIUS * depthScale;
        target.moveTo(point.x + radius, point.y);
        target.arc(point.x, point.y, radius, 0, Math.PI * 2);
    }
    target.fill();
}

// update points
function updatePoints(burstTime) {
    const startPose = camera.start;
    const pixelsToWorld = startPose.distance / camera.focal;

    for (const point of points) {
        const burstEndTime = BURST_TIME * point.slowness;
        const driftEndTime = burstEndTime + DRIFT_TIME;
        const formDuration = FORM_TIME * point.slowness;

        // where it bursts from
        const across = point.startX * pixelsToWorld;
        const down   = point.startY * pixelsToWorld;
        const start = {
            x: startPose.right.x * across - startPose.up.x * down,
            y: startPose.right.y * across - startPose.up.y * down,
            z: startPose.right.z * across - startPose.up.z * down
        };
        const burstEnd = point.burstEnd; // end of burst
        const driftCurve = point.driftCurve;

        // add first control point for drift, starting at the burst end speed
        const push = BURST_END_SPEED*DRIFT_TIME / (3*DRIFT_START_SPEED*burstEndTime);
        const c1 = continuePast(start, burstEnd, push);

        let pos;

        // state in which particle is
        if (burstTime < burstEndTime) {
            // burst - fast at first, slow to end speed at destination
            const t = burstTime / burstEndTime;
            const eased = (1 - BURST_END_SPEED) * (1 - Math.pow(1-t, 4)) + BURST_END_SPEED*t;
            pos = lerp3(start, burstEnd, eased);

        } else if (burstTime < driftEndTime) {
            // drift: begin like burst end, keep getting faster
            const t = (burstTime - burstEndTime) / DRIFT_TIME;
            const eased = DRIFT_START_SPEED*t + (1 - DRIFT_START_SPEED)*t*t;
            pos = bezier3d(burstEnd, c1, driftCurve.c2, driftCurve.end, eased);

        } else {
            // form: begin like drift end, go the same way at same speed, then slow into destination
            const t = clamp(0, 1, (burstTime - driftEndTime) / formDuration);
            const eased = 1 - (1-t)*(1-t);

            // continue drifting curve's direction
            const carry = (2 - DRIFT_START_SPEED) * formDuration / (2 * DRIFT_TIME);
            const f1 = continuePast(driftCurve.c2, driftCurve.end, carry);
            const target = { x: point.targetX, y: point.targetY, z: 0 };
            pos = bezier3d(driftCurve.end, f1, target, target, eased);
        }

        // update
        const onScreen = project(pos);
        point.world = pos;
        point.visible = onScreen !== null;
        if (point.visible) {
            point.x = onScreen.x;
            point.y = onScreen.y;
            point.depth = onScreen.depth;
        }
    }
}

// pixels the letters of the text cover
let letterPixels = [];
let letterPixelSize = 0; // width of one pixel in text-widths

// a random spot inside the letters
function randomInLetters() {
    const pixel = letterPixels[Math.floor(Math.random() * letterPixels.length)];
    return {
        x: pixel.x + Math.random() * letterPixelSize,
        y: pixel.y + Math.random() * letterPixelSize
    };
}

// assign to the points a destination inside the letters of the text
function placePointsOnText() {
    const covered = findTextPixels(TEXT, TEXT_FONT_FAMILY);

    // find the box the letters fill
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const pixel of covered) {
        left   = Math.min(left,   pixel.x    );
        right  = Math.max(right,  pixel.x + 1);
        top    = Math.min(top,    pixel.y    );
        bottom = Math.max(bottom, pixel.y + 1);
    }
    const middleX = (left + right) / 2;
    const middleY = (top + bottom) / 2;
    const textWidth = (right - left) || 1;

    // keep letters' pixels
    letterPixelSize = 1 / textWidth;
    letterPixels = covered.map(function (pixel) {
        return { x: (pixel.x - middleX) / textWidth, y: (pixel.y - middleY) / textWidth };
    });

    // pick a pixel for each point
    const targets = [];
    for (let i = 0; i < points.length; i++) targets.push(randomInLetters());

    // ensure the points' destinations are near to where they burst
    targets.sort(function (a, b) { return a.x - b.x; }); // horizontally
    const ordered = points.slice().sort(function (a, b) { return a.burstEnd.x - b.burstEnd.x; });
    for (let i = 0; i < ordered.length; i++) {
        ordered[i].targetX = targets[i].x;
        ordered[i].targetY = targets[i].y;
    }
}

// assign to the points a destination inside the letters of the 100%
function placePointsOnPercent() {
    const covered = findTextPixels("100%", PERCENT_FONT_FAMILY);

    // pick random covered pixel for each point
    const shrink = BURST_SIZE / SAMPLE_SIZE;
    const starts = [];
    for (let i = 0; i < points.length; i++) {
        const pixel = covered[Math.floor(Math.random() * covered.length)];
        starts.push({
            x: (pixel.x + Math.random()) * shrink,
            y: (pixel.y + Math.random()) * shrink
        });
    }

    // burst!
    starts.sort(function (a, b) { return a.x - b.x; });
    const ordered = points.slice().sort(function (a, b) { return a.burstEnd.x - b.burstEnd.x; });
    for (let i = 0; i < ordered.length; i++) {
        ordered[i].startX = starts[i].x;
        ordered[i].startY = starts[i].y;
        ordered[i].slowness = MIN_SLOWNESS + Math.random() * SLOWNESS_SPREAD; // so they don't all land together
    }
}

// time after all animations have finished
let settleTime = Infinity;
function findSettleTime() {
    let landed = 0;
    for (const point of points) {
        landed = Math.max(landed, (BURST_TIME + FORM_TIME) * point.slowness + DRIFT_TIME);
    }
    settleTime = Math.max(CAMERA_PATH[CAMERA_PATH.length - 1].time, landed + TRAIL_DURATION);
}

// copy what the points look like now into an image, so they can be moved as once
let capture = null;
function capturePoints() {
    const dpr = window.devicePixelRatio || 1;
    const pad = Math.max(POINT_GLOW_SIZE * Math.sqrt(width * height), POINT_RADIUS) + 2;

    // find the box the points fill
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const point of points) {
        if (!point.visible) continue;
        left   = Math.min(left,   point.x);
        right  = Math.max(right,  point.x);
        top    = Math.min(top,    point.y);
        bottom = Math.max(bottom, point.y);
    }

    // line up with pixels
    left   = Math.floor((left   - pad) * dpr) / dpr;
    top    = Math.floor((top    - pad) * dpr) / dpr;
    right  = Math.ceil ((right  + pad) * dpr) / dpr;
    bottom = Math.ceil ((bottom + pad) * dpr) / dpr;

    // draw the points onto a see-through canvas the size of the box
    const image = document.createElement("canvas");
    image.width  = Math.round((right  - left) * dpr);
    image.height = Math.round((bottom - top ) * dpr);
    const imageCtx = image.getContext("2d");
    imageCtx.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
    drawPoints(imageCtx);

    // box relative to the middle of the text, in text-widths
    const textWidth = width * TEXT_SCREEN_WIDTH;
    capture = {
        image,                                                                    // the points as they were, full size
        small: null,                                                              // the points drawn at topbar size
        hoverSmall: null,                                                         // the same points at hovered size
        home: null,                                                               // all three in the main page's text color
        left:  (left - width  / 2) / textWidth,
        top:    (top  - height / 2) / textWidth,
        width:  (right  - left) / textWidth,
        height: (bottom - top ) / textWidth
    };
    drawTopbarImage();
    colorCaptureForHome();

    // kill points
    points.length = 0;
}

// draw the points at topbar size so text is sharp
function drawTopbarImage() {
    const textWidth = width * TOPBAR_TEXT_WIDTH;

    // enough points to fill all letters at this size
    const letterPixelsHere = letterPixels.length * Math.pow(letterPixelSize * textWidth, 2);
    const count = Math.round(TOPBAR_POINTS_PER_PIXEL * letterPixelsHere);
    const targets = [];
    for (let i = 0; i < count; i++) targets.push(randomInLetters());

    // same points, normal and hovered
    capture.small      = drawTopbarPoints(targets, textWidth, TOPBAR_POINT_RADIUS);
    capture.hoverSmall = drawTopbarPoints(targets, textWidth, HOVER_POINT_RADIUS );
}

// image of points at targets
function drawTopbarPoints(targets, textWidth, radius) {
    const dpr = window.devicePixelRatio || 1;

    const small = document.createElement("canvas");
    small.width  = Math.max(1, Math.round(capture.width  * textWidth * dpr));
    small.height = Math.max(1, Math.round(capture.height * textWidth * dpr));
    const smallCtx = small.getContext("2d");
    smallCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    smallCtx.fillStyle = colors.text;
    smallCtx.beginPath();
    for (const target of targets) {
        const x = (target.x - capture.left) * textWidth;
        const y = (target.y - capture.top ) * textWidth;
        smallCtx.moveTo(x + radius, y);
        smallCtx.arc(x, y, radius, 0, Math.PI * 2);
    }
    smallCtx.fill();

    return small;
}

// hover over the topbar text, eased between 0 (not hovered) and 1 (hovered)
let hoverFrom = 0;
let hoverTo = 0;
let hoverStart = -Infinity; // time hover animation started
function hoverAmount(now) {
    const t = clamp(0, 1, (now - hoverStart) / HOVER_TIME);
    const eased = 1 - (1 - t) * (1 - t) * (1 - t); // fast start, slow end
    return hoverFrom + (hoverTo - hoverFrom) * eased;
}
function setHover(to) {
    const now = performance.now();
    hoverFrom  = hoverAmount(now);
    hoverTo    = to;
    hoverStart = now;
    startLoop();
}

// draw captured text, moving it into the topbar once topbarStart is set
let topbarStart = null; // time the move to the topbar started
function drawCapture(now) {
    const t = topbarStart === null ? 0 : clamp(0, 1, (now - topbarStart) / TOPBAR_TIME);
    const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(2 - 2*t, 3) / 2; // ease in and out

    const hover = hoverAmount(now);

    const textWidth = width * (TEXT_SCREEN_WIDTH + (TOPBAR_TEXT_WIDTH - TEXT_SCREEN_WIDTH) * eased);
    const middleY = height / 2 + (TOPBAR_Y - height / 2) * eased;

    // box location
    const x = width / 2 + capture.left * textWidth;
    const y = middleY   + capture.top  * textWidth;
    const w = capture.width  * textWidth;
    const h = capture.height * textWidth;

    // ease into smaller points
    const sharp = eased * eased * eased;

    // draw, fade from intro color color to dark
    ctx.imageSmoothingQuality = "high";
    for (const [images, alpha] of [[capture, 1 - eased], [capture.home, eased]]) {
        if (alpha <= 0) continue;

        if (sharp < 1) {
            ctx.globalAlpha = alpha * (1 - sharp);
            ctx.drawImage(images.image, x, y, w, h);
        }
        if (sharp > 0) {
            // fade from normal to hovered points, which are bigger so the text is bolder
            const dpr = window.devicePixelRatio || 1;
            for (const [small, strength] of [[images.small, 1 - hover], [images.hoverSmall, hover]]) {
                if (strength <= 0) continue;

                // when not moving, line up with pixels and don't stretch, to keep it sharp
                const box = sharp === 1
                    ? [Math.round(x * dpr) / dpr, Math.round(y * dpr) / dpr, small.width / dpr, small.height / dpr]
                    : [x, y, w, h];

                ctx.globalAlpha = alpha * sharp * strength;
                ctx.drawImage(small, ...box);
            }
        }
    }
    ctx.globalAlpha = 1;
}

// copy of image in color, same shape and glow
function colorImage(image, color) {
    const colored = document.createElement("canvas");
    colored.width  = image.width;
    colored.height = image.height;
    const coloredCtx = colored.getContext("2d");
    coloredCtx.drawImage(image, 0, 0);
    coloredCtx.globalCompositeOperation = "source-in";
    coloredCtx.fillStyle = color;
    coloredCtx.fillRect(0, 0, colored.width, colored.height);
    return colored;
}

// copy captured text in the main page's text color
function colorCaptureForHome() {
    capture.home = {
        image:      colorImage(capture.image,      colors.homeText),
        small:      colorImage(capture.small,      colors.homeText),
        hoverSmall: colorImage(capture.hoverSmall, colors.homeText)
    };
}

// run frame, unless it's already running
let looping = false;
function startLoop() {
    if (looping) return;
    looping = true;
    requestAnimationFrame(frame);
}

// start moving the captured text into the topbar
function moveToTopbar() {
    if (capture === null || topbarStart !== null) return;
    topbarStart = performance.now();
    canvas.style.cursor = "auto";
    canvas.style.pointerEvents = "none"; // let main page underneath be hovered and clicked
    canvas.classList.add("done");        // fade out dark background
    startLoop();

    // intro seen, skip it next time
    try { localStorage.setItem(SEEN_INTRO_KEY, "true"); } catch (error) {}
}

// go directly to text in topbar, for intro already seen
function skipIntro() {
    // points where they land, seen from where the camera stops
    updateCamera(settleTime);
    updatePoints(settleTime);
    capturePoints();

    topbarStart = -Infinity; // already in the topbar
    canvas.style.cursor = "auto";
    canvas.style.pointerEvents = "none";
    ctx.clearRect(0, 0, width, height);
    drawCapture(performance.now());
    showHome();
    placeNameButton();
}

// draw the loading percentage
function drawPercent(percent, size, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = colors.text;
    ctx.font = font(PERCENT_FONT_FAMILY, size);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.floor(percent) + "%", width / 2, height / 2);
}

// camera points toward middle of scene. starts, ends straight in front
const camera = {
    x: 0, y: 0, z: 0,
    right: null, up: null, forward: null,
    focal: 1,        // pixels covered by 1 unit at a distance of 1
    homeDistance: 1  // distance from the middle when straight in front
};

// where the camera is and which way it faces at time
function cameraPose(time) {
    const yaw      =                       interpolate(CAMERA_PATH, "yaw",      time) * (Math.PI / 180);
    const pitch    =                       interpolate(CAMERA_PATH, "pitch",    time) * (Math.PI / 180);
    const distance = camera.homeDistance * interpolate(CAMERA_PATH, "distance", time);

    const pose = {
        x: distance * Math.sin(yaw) * Math.cos(pitch),
        y: distance                 * Math.sin(pitch),
        z: distance * Math.cos(yaw) * Math.cos(pitch),
        distance: distance
    };

    // which way camera is facing
    pose.forward = normalize(      { x: -pose.x, y: -pose.y, z: -pose.z });
    pose.right   = normalize(cross({ x: 0,       y: -1,      z: 0 }, pose.forward));
    pose.up      =           cross(pose.forward, pose.right);
    return pose;
}

// update the camera components that change when the window changes
function updateCameraLens() {
    camera.focal = (height / 2) / Math.tan(FOV * Math.PI / 360);
    camera.homeDistance = camera.focal / (width * TEXT_SCREEN_WIDTH); // in front of text
    camera.start = cameraPose(CAMERA_PATH[0].time); // where the camera is at the burst
}

// update camera components
function updateCamera(burstTime) {
    const pose = cameraPose(burstTime);
    camera.x       = pose.x;
    camera.y       = pose.y;
    camera.z       = pose.z;
    camera.forward = pose.forward;
    camera.right   = pose.right;
    camera.up      = pose.up;
}

// project a 3D point to the screen, also how far it is from the camera.
function project(p) {
    const relative = { x: p.x - camera.x, y: p.y - camera.y, z: p.z - camera.z };
    const depth = dot(relative, camera.forward);
    if (depth < NEAR_CLIP) return null;

    return {
        x: width / 2  + camera.focal * dot(relative, camera.right) / depth,
        y: height / 2 - camera.focal * dot(relative, camera.up   ) / depth,
        depth: depth
    };
}

// draw trails
function drawTrails(burstTime) {
    // segments sorted into brightness levels
    const levels = [];
    for (let i = 0; i < TRAIL_FADE_STEPS; i++) levels.push(new Path2D());

    // draw segment from a to b
    function addSegment(a, b, age) {
        const timeLeft = 1 - age / TRAIL_DURATION;
        if (timeLeft <= 0) return;

        const level = Math.min(TRAIL_FADE_STEPS - 1, Math.floor(timeLeft * TRAIL_FADE_STEPS));
        levels[level].moveTo(a.x, a.y);
        levels[level].lineTo(b.x, b.y);
    }

    // add segment to trails
    for (const point of points) {
        // the trail, then the point itself as its newest end 
        const ends = point.trail.concat({ ...point.world, time: burstTime });

        for (let i = 1; i < ends.length; i++) {
            const a = project(ends[i-1]);
            const b = project(ends[i]);
            const age = burstTime - (ends[i-1].time + ends[i].time) / 2; // average age of two ends of segments
            if (a && b) addSegment(a, b, age);
        }
    }

    // add a glow
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = colors.glow;
    for (let i = TRAIL_FADE_STEPS - TRAIL_GLOW_STEPS; i < TRAIL_FADE_STEPS; i++) {
        if (i < 0) continue;
        for (let layer = 1; layer <= 3; layer++) {
            ctx.lineWidth = TRAIL_GLOW_SIZE * Math.sqrt(width * height) * layer / 3;
            ctx.globalAlpha = TRAIL_GLOW_STRENGTH / 3 * (i + 1) / TRAIL_FADE_STEPS;
            ctx.stroke(levels[i]);
        }
    }
    ctx.globalCompositeOperation = "source-over";

    // draw the trail lines
    ctx.strokeStyle = colors.trail;
    ctx.lineWidth = TRAIL_WIDTH;
    for (let i = 0; i < TRAIL_FADE_STEPS; i++) {
        ctx.globalAlpha = TRAIL_ALPHA * (i + 1) / TRAIL_FADE_STEPS;
        ctx.stroke(levels[i]);
    }
}

// update trails
function updateTrails(burstTime) {
    for (const point of points) {
        const trail = point.trail;
        const last = trail[trail.length - 1];

        // only add if time passed and point moved enough
        const world = point.world;
        const timeEnough = !last                   || burstTime - last.time                                                                    >= TRAIL_MIN_TIME;
        const moveEnough = !last || !point.visible || (Math.hypot(world.x-last.x, world.y-last.y, world.z-last.z) * camera.focal / point.depth >= TRAIL_MIN_DISTANCE);
        if (timeEnough && moveEnough) {
            trail.push({ x: world.x, y: world.y, z: world.z, time: burstTime });
        }

        // remove
        while (trail.length > 0 && burstTime - trail[0].time > TRAIL_DURATION) {
            trail.shift();
        }
    }
}

// glow around points
function makeGlowSprite() {
    // create sprite
    const size = 64;
    const sprite = document.createElement("canvas");
    sprite.width = size;
    sprite.height = size;

    // add color
    const spriteCtx = sprite.getContext("2d");
    const gradient = spriteCtx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, colors.glow);
    gradient.addColorStop(1, "transparent");
    spriteCtx.fillStyle = gradient;
    spriteCtx.fillRect(0, 0, size, size);

    return sprite;
}

// the intro's colors, from style.css
let colors = null;
let glowSprite = null;
function readColors() {
    const style = getComputedStyle(document.documentElement);
    colors = {
        background: style.getPropertyValue("--intro-background").trim(),
        text:       style.getPropertyValue("--intro-text").trim(),
        trail:      style.getPropertyValue("--intro-trail").trim(),
        glow:       style.getPropertyValue("--intro-glow").trim(),
        homeText:   style.getPropertyValue("--text").trim()
    };
    glowSprite = makeGlowSprite();
}
readColors();


// ------------------------ RUNNING CODE ------------------------

// make fonts
const fontTasks = [
    document.fonts.ready,
    document.fonts.load(font(PERCENT_FONT_FAMILY, SAMPLE_SIZE), "0123456789%").catch(function() {}),
    document.fonts.load(font(TEXT_FONT_FAMILY,    SAMPLE_SIZE), TEXT         ).catch(function() {})
];

// everything that must finish before intro can start
const loadTasks = [
    // window
    new Promise(function (resolve) {
        if (document.readyState === "complete") resolve();
        else window.addEventListener("load", resolve);
    }),
    
    // font
    ...fontTasks,

    // points
    Promise.all(fontTasks).then(function () {
        placePointsOnPercent();
        placePointsOnText();
        findSettleTime();
    })
];

// load everything
let loadedCount = 0;
for (const task of loadTasks) {
    task.then(function () {
        loadedCount++;
    });
}

// run

let shownPercent = 0;
let lastTime = null;
let fullAt = null; // time the percentage reached 100

let running = true;

// redraw every frame
function frame(now) {
    if (!running) return;

    // track time
    const elapsed = lastTime === null ? 0 : now - lastTime;
    lastTime = now;

    // increment percentage, but limit load time
    const loadedPercent = 100 * loadedCount / loadTasks.length;
    shownPercent = Math.min(loadedPercent, shownPercent + 100 * elapsed / FASTEST_LOAD_TIME);
    if (shownPercent >= 100 && fullAt === null) {
        fullAt = now;
    }

    // background color, see-through once captured
    ctx.globalAlpha = 1;
    if (capture === null) {
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, width, height);
    } else {
        ctx.clearRect(0, 0, width, height);
    }

    // before or after burst
    const burstTime = fullAt === null ? -1 : now - fullAt - HOLD_TIME - SHRINK_TIME;
    if      (capture !== null) drawCapture(now); // first, since a skipped intro never loads or bursts
    else if (burstTime < 0)    drawLoading(fullAt === null ? null : now - fullAt);
    else                       drawParticles(burstTime);

    // swap points for capture
    if (capture === null && burstTime > settleTime) capturePoints();

    if (capture !== null) {
        const moving = topbarStart !== null && now - topbarStart < TOPBAR_TIME;
        const hovering = now - hoverStart < HOVER_TIME;

        // text is in topbar, so show the main page
        if (topbarStart !== null && !moving) {
            showHome();
            placeNameButton();
        }

        // after captured, only redraw when moving to topbar or hovering
        if (!moving && !hovering) {
            looping = false;
            return;
        }
    }

    requestAnimationFrame(frame);
}

// events for the percent
function drawLoading(sinceFull) {
    if (sinceFull === null) {
        // grow text as counting
        const p = shownPercent / 100;
        const grown = 1 - Math.pow(1 - p, GROW_EASE); // fastest at the start, slow to a stop at 100%
        drawPercent(shownPercent, START_SIZE + (PEAK_SIZE - START_SIZE) * grown, 1);

    } else if (sinceFull < HOLD_TIME) {
        // hold at 100
        drawPercent(100, PEAK_SIZE, 1);

    } else {
        // sharp shrink, speed up
        const t = (sinceFull - HOLD_TIME) / SHRINK_TIME;
        drawPercent(100, PEAK_SIZE + (BURST_SIZE - PEAK_SIZE) * Math.pow(t, 3), 1);
    }
}

// darw points, trails, camera, etc.
function drawParticles(burstTime) {
    const percentAlpha = 1 - clamp(0, 1, burstTime / PERCENT_FADE_OUT);
    if (percentAlpha > 0) drawPercent(100, BURST_SIZE, percentAlpha);
    updateCamera(burstTime);
    updatePoints(burstTime);
    updateTrails(burstTime);
    drawTrails(burstTime);
    drawPoints(ctx);
}

// click or scroll down anywhere moves text into topbar
window.addEventListener("click", moveToTopbar);
window.addEventListener("wheel", function (event) {
    if (event.deltaY > 0) moveToTopbar();
});
window.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") moveToTopbar();
});
let touchStartY = null;
window.addEventListener("touchstart", function (event) {
    touchStartY = event.touches[0].clientY;
});
window.addEventListener("touchmove", function (event) {
    if (touchStartY !== null && touchStartY - event.touches[0].clientY > 10) moveToTopbar(); // swipe up
});

// name at the top: see-through button over the text
const nameButton = document.getElementById("name");

// put button over topbar text
function placeNameButton() {
    if (topbarStart === null) return; // not in topbar yet

    const textWidth = width * TOPBAR_TEXT_WIDTH;
    nameButton.style.left   = width / 2 + capture.left  * textWidth + "px";
    nameButton.style.top    = TOPBAR_Y  + capture.top   * textWidth + "px";
    nameButton.style.width  =            capture.width  * textWidth + "px";
    nameButton.style.height =            capture.height * textWidth + "px";
}

nameButton.addEventListener("mouseenter", function () { setHover(1); });
nameButton.addEventListener("mouseleave", function () { setHover(0); });

// clicked, replay intro
nameButton.addEventListener("click", function () {
    try { localStorage.removeItem(SEEN_INTRO_KEY); } catch (error) {}
    location.reload();
});

window.addEventListener("resize", resize);
resize();

// only show intro to those who haven't seen it
let seenIntro = false;
try { seenIntro = localStorage.getItem(SEEN_INTRO_KEY) === "true"; } catch (error) {}
if (seenIntro) {
    // no intro
    canvas.style.transition = "none";
    canvas.classList.add("done");
    Promise.all(loadTasks).then(skipIntro);
}
else startLoop();
