// ------------------------ SETTINGS ------------------------

const SEEN_INTRO_KEY = "intro_seen";

// POINTS
const POINTS_PER_PIXEL = 0.002;           // points per pixel (2500 on a 1990x992 window)
const POINT_RADIUS = 0.0013;              // radius of points (1.8px on a 1990x992 window)
const REFERENCE_SCREEN_AREA = 1990 * 992; // screen the point settings were tuned on
const POINT_MAKEUP = 0.5;                 // how much smaller points are made up for with more points

// TEXT
const TEXT = "Aryan Singhal";
const TEXT_SCREEN_WIDTH = 0.5;       // how much of the width of the screen the text fills
const TEXT_FONT_FAMILY = "Palatino"; // text font family
const SAMPLE_SIZE = 100;             // size text is measured at, larger -> more accurate shape

// 1. BURST
const BURST_DELAY = 250;      // time after loading before points burst
const BURST_TIME = 1500;      // time points take to fly out
const BURST_END_SPEED = 0.6;  // ratio of final speed to burst speed
const BURST_RADIUS = 1;       // size the ball the points burst out into
const MIN_SLOWNESS = 0.55;    // ratio of BURST_TIME and FORM_TIME the fastest points take
const SLOWNESS_SPREAD = 0.25; // how much longer the slowest points take, so they don't all land together

// 2. DRIFT
const DRIFT_START_SPEED = 0.3; // when points reach this speed from burst, they start drifting
const DRIFT_TIME = 2000;       // time points drift before heading to the text
const DRIFT_REACH = 0.2;       // how far each drifting curve can reach

// 3. FORM
const FORM_TIME = 2000; // time points take to travel to the text

// 4. TOPBAR
const TOPBAR_TIME = 900;           // time text takes to move up into the topbar
const TOPBAR_TEXT_WIDTH = 0.12;    // how much of the width of the screen the text fills in the topbar
const TOPBAR_MIN_TEXT_WIDTH = 130; // smallest topbar text can be
const TOPBAR_Y = 40;               // how far the middle of the text is from the top of the screen
const TOPBAR_POINTS_PER_PIXEL = 7; // points per pixel of topbar letters
const TOPBAR_POINT_RADIUS = 0.4;   // size of points in the topbar text, bigger -> darker

// CAMERA
const FOV = 70;       // up-and-down view angle
const CAMERA_PATH = [ // the path the camera takes
    { time: 0,    yaw: 180, pitch: 0,  distance: 1   },
    { time: 1200, yaw: 145, pitch: 15, distance: 0.3 },
    { time: 2400, yaw: 90,  pitch: 30, distance: 0.5 },
    { time: 3600, yaw: 45,  pitch: 15, distance: 0.8 },
    { time: 4500, yaw: 0,   pitch: 0,  distance: 1   }
];
const NEAR_CLIP = 0.02; // points closer to the camera than this aren't drawn

// TRAILS
const TRAIL_DURATION = 500;   // time a position stays in a trail, roughly the length of the trail
const TRAIL_POSITIONS = 15;   // most positions kept in a trail, fewer -> faster but more angular
const TRAIL_MIN_DISTANCE = 5; // pixels a point must move before recording again
const TRAIL_WIDTH = 1;        // number of pixels in trail lines
const TRAIL_ALPHA = 0.6;      // opacity of newest part of a trail
const TRAIL_FADE_STEPS = 10;  // number of brightness levels in the trail, more = smoother fading

// GLOW
const TRAIL_GLOW_STEPS = 3;       // how many of the newest brightness levels of a trail glow
const POINT_GLOW_SIZE = 0.0057;   // radius of glow around points (8px on a 1990x992 window)
const POINT_GLOW_STRENGTH = 0.6;  // brightness of point
const TRAIL_GLOW_SIZE = 0.0043;   // width of the glow around trails, (6px on a 1990x992 window)
const TRAIL_GLOW_STRENGTH = 0.2;  // brightness of trail
const GLOW_RESOLUTION = 0.5;      // glow canvas pixels per canvas pixel, lower -> faster but blockier glow

// DOTS
const DOT_IMAGE_SIZES = [2, 4, 8, 16, 32, 64]; // widths points are drawn at
const GLOW_SPRITE_SIZE = 64;                   // width the point glow is drawn at

// CANVAS
const MAX_INTRO_PIXEL_RATIO = 1.5; // maximum number of canvas pixels per screen pixel while animating


// ------------------------ UTILITIES ------------------------

function font(family, size) {
    return "200 " + size + "px " + family;
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

// draw glow at a lower resolution on its own canvas
const glowCanvas = document.createElement("canvas");
const glowCtx = glowCanvas.getContext("2d");

let width = 0;
let height = 0;

// canvas pixels per screen pixel
function canvasPixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    return capture === null ? Math.min(dpr, MAX_INTRO_PIXEL_RATIO) : dpr;
}

// canvas size to window size
function sizeCanvas() {
    const ratio = canvasPixelRatio();
    canvas.width  = Math.round(width  * ratio);
    canvas.height = Math.round(height * ratio);

    // scale so drawing can be done using pixels
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    // only draw glow while animating
    const glowRatio = capture === null ? ratio * GLOW_RESOLUTION : 0;
    glowCanvas.width  = Math.round(width  * glowRatio);
    glowCanvas.height = Math.round(height * glowRatio);
    glowCtx.setTransform(glowRatio, 0, 0, glowRatio, 0, 0);
}

// resize canvas size to window size
function resize() {
    width  = window.innerWidth;
    height = window.innerHeight;
    sizeCanvas();

    updateCameraLens();

    // redraw here
    if (capture !== null) {
        drawTopbarImage();
        colorCaptureForHome();
        ctx.clearRect(0, 0, width, height);
        drawCapture(performance.now());
    }
}

// set point positions
const points = [];
// smaller screens have smaller points, so add more
const screenArea = window.innerWidth * window.innerHeight;
const radiusShrink = Math.sqrt(screenArea / REFERENCE_SCREEN_AREA); // point radius compared to on the reference screen
const pointCount = Math.max(1, Math.round(POINTS_PER_PIXEL * screenArea / Math.pow(radiusShrink, 2 * POINT_MAKEUP))); // set once page loads
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
        slowness: MIN_SLOWNESS + Math.random() * SLOWNESS_SPREAD,
        trail: [] // all points in the trail, oldest first
    });
}

// draw points and their glow
function drawPoints(target, glowTarget = target) {
    const screenSize = Math.sqrt(width * height);
    const splitting = introStrength > 0 && LENS_OFFSET > 0;

    // size and color split of each point
    for (const point of points) {
        if (!point.visible) continue;
        point.depthScale = clamp(0.3, 4, camera.homeDistance / point.depth); // scale with window size
        if (splitting) point.split = lensSplit(point.x, point.y, introStrength);
    }

    // draw rgb parts once
    function together(point) {
        return !splitting || (target === ctx && point.split.x === 0 && point.split.y === 0);
    }

    // glow
    if (POINT_GLOW_SIZE > 0 && POINT_GLOW_STRENGTH > 0) {
        glowTarget.globalCompositeOperation = "lighter";
        glowTarget.globalAlpha = POINT_GLOW_STRENGTH;
        for (const point of points) {
            if (!point.visible) continue;

            const size = POINT_GLOW_SIZE * screenSize * point.depthScale;
            if (together(point)) {
                drawSprite(glowTarget, glowSprite, point.x - size, point.y - size, size * 2, size * 2);
                continue;
            }

            // chromatic aberration toward the edges
            const split = point.split;
            for (let channel = 0; channel < 3; channel++) {
                const side = 1 - channel; // red 1, green 0, blue -1
                const x = point.x + split.x * side;
                const y = point.y + split.y * side;
                drawSprite(glowTarget, glowSprites[channel], x - size, y - size, size * 2, size * 2);
            }
        }
        glowTarget.globalCompositeOperation = "source-over";
    }

    // draw the points
    const ratio = target.getTransform().a; // canvas pixels per screen pixel
    target.globalAlpha = 1;
    if (!splitting) {
        for (const point of points) {
            if (!point.visible) continue;
            stampDot(target, dotImages.text, point.x, point.y, POINT_RADIUS * screenSize * point.depthScale, ratio);
        }
        return;
    }

    // chromatic aberration toward the edges
    target.globalCompositeOperation = "lighter";
    for (const point of points) {
        if (point.visible && together(point)) stampDot(target, dotImages.text, point.x, point.y, POINT_RADIUS * screenSize * point.depthScale, ratio);
    }
    for (let channel = 0; channel < 3; channel++) {
        const side = 1 - channel; // red 1, green 0, blue -1
        for (const point of points) {
            if (!point.visible || together(point)) continue;

            const x = point.x + point.split.x * side;
            const y = point.y + point.split.y * side;
            stampDot(target, dotImages.channels[channel], x, y, POINT_RADIUS * screenSize * point.depthScale, ratio);
        }
    }
    target.globalCompositeOperation = "source-over";
}

// the parts of point's path that don't change over time
function pointPath(point) {
    const startPose = camera.start;

    const burstEndTime = BURST_TIME * point.slowness;
    const formDuration = FORM_TIME * point.slowness;

    const start = { x: 0, y: 0, z: 0 }; // burst from the middle of the screen

    // first control point for drift, starting at the burst end speed
    const push = BURST_END_SPEED*DRIFT_TIME / (3*DRIFT_START_SPEED*burstEndTime);

    // form continues drifting curve's direction
    const carry = (2 - DRIFT_START_SPEED) * formDuration / (2 * DRIFT_TIME);

    return {
        pose: startPose,
        burstEndTime: burstEndTime,
        driftEndTime: burstEndTime + DRIFT_TIME,
        formDuration: formDuration,
        start: start,
        c1: continuePast(start, point.burstEnd, push),
        f1: continuePast(point.driftCurve.c2, point.driftCurve.end, carry),
        target: { x: point.targetX, y: point.targetY, z: 0 }
    };
}

// update points
function updatePoints(burstTime) {
    for (const point of points) {
        if (!point.path || point.path.pose !== camera.start) point.path = pointPath(point);
        const path = point.path;
        const burstEnd = point.burstEnd; // end of burst
        const driftCurve = point.driftCurve;

        let pos;

        // state in which particle is
        if (burstTime < path.burstEndTime) {
            // burst - fast at first, slow to end speed at destination
            const t = burstTime / path.burstEndTime;
            const eased = (1 - BURST_END_SPEED) * (1 - Math.pow(1-t, 4)) + BURST_END_SPEED*t;
            pos = lerp3(path.start, burstEnd, eased);

        } else if (burstTime < path.driftEndTime) {
            // drift: begin like burst end, keep getting faster
            const t = (burstTime - path.burstEndTime) / DRIFT_TIME;
            const eased = DRIFT_START_SPEED*t + (1 - DRIFT_START_SPEED)*t*t;
            pos = bezier3d(burstEnd, path.c1, driftCurve.c2, driftCurve.end, eased);

        } else {
            // form: begin like drift end, go the same way at same speed, then slow into destination
            const t = clamp(0, 1, (burstTime - path.driftEndTime) / path.formDuration);
            const eased = 1 - (1-t)*(1-t);
            pos = bezier3d(driftCurve.end, path.f1, path.target, path.target, eased);
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
    const pad = Math.max(POINT_GLOW_SIZE, POINT_RADIUS) * Math.sqrt(width * height) + 2;

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
        image,
        small: null,
        home: null,
        left:   (left   - width  / 2) / textWidth,
        top:    (top    - height / 2) / textWidth,
        width:  (right  - left      ) / textWidth,
        height: (bottom - top       ) / textWidth
    };
    drawTopbarImage();
    colorCaptureForHome();

    // kill points
    points.length = 0;

    // full resolution for name
    sizeCanvas();
    drawCapture(performance.now());
}

// width of topvar text
function topbarTextWidth() {
    return Math.max(width * TOPBAR_TEXT_WIDTH, TOPBAR_MIN_TEXT_WIDTH);
}

// draw the points at topbar size so text is sharp
function drawTopbarImage() {
    const textWidth = topbarTextWidth();

    // enough points to fill all letters at this size
    const letterPixelsHere = letterPixels.length * Math.pow(letterPixelSize * textWidth, 2);
    const count = Math.round(TOPBAR_POINTS_PER_PIXEL * letterPixelsHere);
    const targets = [];
    for (let i = 0; i < count; i++) targets.push(randomInLetters());

    capture.small = drawTopbarPoints(targets, textWidth, TOPBAR_POINT_RADIUS);
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

// where the captured text is at a time
let topbarStart = null; // time the move to the topbar started
function namePlace(now) {
    const t = topbarStart === null ? 0 : clamp(0, 1, (now - topbarStart) / TOPBAR_TIME);
    const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(2 - 2*t, 3) / 2; // ease in and out

    return {
        eased: eased,
        textWidth: width * TEXT_SCREEN_WIDTH + (topbarTextWidth() - width * TEXT_SCREEN_WIDTH) * eased,
        middleY: height / 2 + (TOPBAR_Y - height / 2) * eased
    };
}

// draw captured text, moving it into the topbar
function drawCapture(now) {
    const { eased, textWidth, middleY } = namePlace(now);
    setIntroLens(1 - eased); // lens fades out as the name moves into the topbar

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
            // when not moving, line up with pixels and don't stretch
            const dpr = window.devicePixelRatio || 1;
            const box = sharp === 1
                ? [Math.round(x * dpr) / dpr, Math.round(y * dpr) / dpr, images.small.width / dpr, images.small.height / dpr]
                : [x, y, w, h];

            ctx.globalAlpha = alpha * sharp;
            ctx.drawImage(images.small, ...box);
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
        image: colorImage(capture.image, colors.homeText),
        small: colorImage(capture.small, colors.homeText)
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
    canvas.style.pointerEvents = "none"; // let main page underneath be hovered and clicked
    canvas.classList.add("done");        // fade out dark background
    startLoop();
    showDots(TOPBAR_TIME);

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
    canvas.style.pointerEvents = "none";
    ctx.clearRect(0, 0, width, height);
    drawCapture(performance.now());
    showHome();
    showDots(TOPBAR_TIME);
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

    // chromatic abberation
    const splitting = introStrength > 0 && LENS_OFFSET > 0;
    const wholeLevels = [];           // segments that dont split
    const splitLevels = [[], [], []]; // rgb parts of segments that split
    if (splitting) {
        for (let i = 0; i < TRAIL_FADE_STEPS; i++) {
            wholeLevels.push(new Path2D());
            for (const channelLevels of splitLevels) channelLevels.push(new Path2D());
        }
    }

    // draw segment from a to b
    function addSegment(a, b, age) {
        const timeLeft = 1 - age / TRAIL_DURATION;
        if (timeLeft <= 0) return;

        const level = Math.min(TRAIL_FADE_STEPS - 1, Math.floor(timeLeft * TRAIL_FADE_STEPS));
        levels[level].moveTo(a.x, a.y);
        levels[level].lineTo(b.x, b.y);
        if (!splitting) return;

        // draw unsplit segments only once
        const split = lensSplit((a.x + b.x) / 2, (a.y + b.y) / 2, introStrength);
        if (split.x === 0 && split.y === 0) {
            wholeLevels[level].moveTo(a.x, a.y);
            wholeLevels[level].lineTo(b.x, b.y);
            return;
        }

        // draw split segments three times
        for (let channel = 0; channel < 3; channel++) {
            const side = 1 - channel; // red 1, green 0, blue -1
            splitLevels[channel][level].moveTo(a.x + split.x * side, a.y + split.y * side);
            splitLevels[channel][level].lineTo(b.x + split.x * side, b.y + split.y * side);
        }
    }

    // add segment to trails
    for (const point of points) {
        const trail = point.trail;
        let previous = trail.length > 0 ? project(trail[0]) : null;
        for (let i = 1; i <= trail.length; i++) {
            const newest  = i === trail.length;
            const end     = newest ? point.world : trail[i];
            const endTime = newest ? burstTime   : trail[i].time;
            const next = project(end);
            const age = burstTime - (trail[i-1].time + endTime) / 2; // average age of two ends of segments
            if (previous && next) addSegment(previous, next, age);
            previous = next;
        }
    }

    // add a glow
    glowCtx.globalCompositeOperation = "lighter";
    glowCtx.strokeStyle = colors.glow;
    for (let i = TRAIL_FADE_STEPS - TRAIL_GLOW_STEPS; i < TRAIL_FADE_STEPS; i++) {
        if (i < 0) continue;
        for (let layer = 1; layer <= 3; layer++) {
            glowCtx.lineWidth = TRAIL_GLOW_SIZE * Math.sqrt(width * height) * layer / 3;
            glowCtx.globalAlpha = TRAIL_GLOW_STRENGTH / 3 * (i + 1) / TRAIL_FADE_STEPS;
            glowCtx.stroke(levels[i]);
        }
    }
    glowCtx.globalCompositeOperation = "source-over";

    // draw the trail lines
    ctx.lineWidth = TRAIL_WIDTH;
    if (introStrength <= 0 || LENS_OFFSET <= 0) {
        ctx.strokeStyle = colors.trail;
        for (let i = 0; i < TRAIL_FADE_STEPS; i++) {
            ctx.globalAlpha = TRAIL_ALPHA * (i + 1) / TRAIL_FADE_STEPS;
            ctx.stroke(levels[i]);
        }
        return;
    }

    // chromatic aberration toward the edges
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = colors.trail;
    for (let i = 0; i < TRAIL_FADE_STEPS; i++) {
        ctx.globalAlpha = TRAIL_ALPHA * (i + 1) / TRAIL_FADE_STEPS;
        ctx.stroke(wholeLevels[i]);
    }
    for (let channel = 0; channel < 3; channel++) {
        ctx.strokeStyle = colors.trailChannels[channel];
        for (let i = 0; i < TRAIL_FADE_STEPS; i++) {
            ctx.globalAlpha = TRAIL_ALPHA * (i + 1) / TRAIL_FADE_STEPS;
            ctx.stroke(splitLevels[channel][i]);
        }
    }
    ctx.globalCompositeOperation = "source-over";
}

// update trails
function updateTrails(burstTime) {
    for (const point of points) {
        const trail = point.trail;
        const last = trail[trail.length - 1];

        // only add if time passed and point moved enough
        const world = point.world;
        const timeEnough = !last                   || burstTime - last.time                                                                    >= TRAIL_DURATION / TRAIL_POSITIONS;
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

// make the dot and glow onto one sheet
const SPRITE_ROW_HEIGHT = Math.max(GLOW_SPRITE_SIZE, ...DOT_IMAGE_SIZES) + 2; // gap on each side
let spriteSheet = null;

// draw part of the sprite sheet
function drawSprite(target, sprite, x, y, width, height) {
    target.drawImage(spriteSheet, sprite.x, sprite.y, sprite.width, sprite.height, x, y, width, height);
}

// glow around points, in a row of the sprite sheet
function makeGlowSprite(sheetCtx, color, row) {
    const size = GLOW_SPRITE_SIZE;
    const x = 1;
    const y = row * SPRITE_ROW_HEIGHT + 1;

    // add color
    const gradient = sheetCtx.createRadialGradient(x + size / 2, y + size / 2, 0, x + size / 2, y + size / 2, size / 2);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "transparent");
    sheetCtx.fillStyle = gradient;
    sheetCtx.fillRect(x, y, size, size);

    return { x, y, width: size, height: size };
}

// draw a filled circle in every DOT_IMAGE_SIZE
function makeDotImages(sheetCtx, color, row) {
    let x = 0;
    const y = row * SPRITE_ROW_HEIGHT;
    sheetCtx.fillStyle = color;
    return DOT_IMAGE_SIZES.map(function (size) {
        sheetCtx.beginPath();
        sheetCtx.arc(x + size / 2 + 1, y + size / 2 + 1, size / 2, 0, Math.PI * 2);
        sheetCtx.fill();

        const image = { x, y, width: size + 2, height: size + 2 };
        x += size + 2;
        return image;
    });
}

// draw a dot
function stampDot(target, images, x, y, radius, ratio) {
    const needed = 2 * radius * ratio; // width in canvas pixels
    let image = images[images.length - 1];
    for (const candidate of images) {
        if (candidate.width - 2 >= needed) {
            image = candidate;
            break;
        }
    }
    const half = radius * image.width / (image.width - 2);
    drawSprite(target, image, x - half, y - half, half * 2, half * 2);
}

let colors = null;
let glowSprite = null;
let glowSprites = null; // rgb parts of the glow
let dotImages = null;   // dots in text color, and in rgb parts
function readColors() {
    const style = getComputedStyle(document.documentElement);
    colors = {
        background: style.getPropertyValue("--intro-background").trim(),
        text:       style.getPropertyValue("--intro-text").trim(),
        trail:      style.getPropertyValue("--intro-trail").trim(),
        glow:       style.getPropertyValue("--intro-glow").trim(),
        homeText:   style.getPropertyValue("--text").trim()
    };
    colors.textChannels  = splitChannels(colors.text);
    colors.trailChannels = splitChannels(colors.trail);

    // text dots, rgb dots, glow, rgb glows
    spriteSheet = document.createElement("canvas");
    spriteSheet.width  = Math.max(GLOW_SPRITE_SIZE + 2, DOT_IMAGE_SIZES.reduce(function (sum, size) { return sum + size + 2; }, 0));
    spriteSheet.height = 8 * SPRITE_ROW_HEIGHT;
    const sheetCtx = spriteSheet.getContext("2d");

    dotImages = {
        text: makeDotImages(sheetCtx, colors.text, 0),
        channels: colors.textChannels.map(function (color, i) { return makeDotImages(sheetCtx, color, 1 + i); })
    };
    glowSprite = makeGlowSprite(sheetCtx, colors.glow, 4);
    glowSprites = splitChannels(colors.glow).map(function (color, i) { return makeGlowSprite(sheetCtx, color, 5 + i); });
}

// a color as its parts
function splitChannels(color) {
    const swatch = document.createElement("canvas").getContext("2d");
    swatch.fillStyle = color;
    swatch.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = swatch.getImageData(0, 0, 1, 1).data;
    const alpha = a / 255;
    return [
        "rgba(" + r + ", 0, 0, " + alpha + ")",
        "rgba(0, " + g + ", 0, " + alpha + ")",
        "rgba(0, 0, " + b + ", " + alpha + ")"
    ];
}
readColors();


// ------------------------ RUNNING CODE ------------------------

// make fonts
const fontTasks = [
    document.fonts.ready,
    document.fonts.load(font(TEXT_FONT_FAMILY, SAMPLE_SIZE), TEXT).catch(function() {})
]

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
        placePointsOnText();
        findSettleTime();
    })
];

// load everything
let loaded = false;
Promise.all(loadTasks).then(function () { loaded = true; });

// run
let burstStart = null; // time the points burst

let running = true;

// redraw every frame
function frame(now) {
    if (!running) return;

    // burst after everything has loaded
    if (loaded && burstStart === null) burstStart = now + BURST_DELAY;

    // background color, see-through once captured
    ctx.globalAlpha = 1;
    if (capture === null) {
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, width, height);
    } else {
        ctx.clearRect(0, 0, width, height);
    }

    // before or after burst
    const burstTime = burstStart === null ? -1 : now - burstStart;
    if      (capture !== null) drawCapture(now); // first, since a skipped intro never loads or bursts
    else if (burstTime >= 0)   drawParticles(burstTime);

    // swap points for capture, move text into topbar
    if (capture === null && burstTime > settleTime) {
        capturePoints();
        moveToTopbar();
    }

    if (capture !== null) {
        const moving = topbarStart !== null && now - topbarStart < TOPBAR_TIME;

        // text is in topbar, so show the main page
        if (topbarStart !== null && !moving) showHome();

        // after captured, only redraw when moving to topbar
        if (!moving) {
            looping = false;
            return;
        }
    }

    requestAnimationFrame(frame);
}

// draw points, trails, camera, etc.
function drawParticles(burstTime) {
    updateCamera(burstTime);
    updatePoints(burstTime);
    updateTrails(burstTime);

    glowCtx.clearRect(0, 0, width, height);
    drawTrails(burstTime);
    drawPoints(ctx, glowCtx);

    // add glow on top
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1;
    ctx.drawImage(glowCanvas, 0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
}

// replay button in the corner
document.getElementById("replay").addEventListener("click", function () {
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
    setIntroLens(0);
    Promise.all(loadTasks).then(skipIntro);
}
else startLoop();
