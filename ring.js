// ------------------------ SETTINGS ------------------------

const LAP_TIME = 15000;        // ms   time ring takes to turn all the way around, at starting speed
const FIRST_START_TIME = 3000; // ms   time ring takes to speed up the first time
const        START_TIME = 1200; // ms   time ring takes to speed up
const         STOP_TIME = 800;  // ms   time ring takes to slow down
const CLOCKWISE = true; //      which way the ring turns
const LINE_WIDTH = 1;   // px   width of the ring's circle, keep the same as style.css



// ------------------------ UTILITIES ------------------------

// measure ring's radius and center
let radius = 0;
const center = { x: 0, y: 0 };
function measureRing() {
    radius = ringEl.clientWidth / 2;
    center.x = ringEl.offsetLeft + radius;
    center.y = ringEl.offsetTop  + radius;
}

// point on ring's line at an angle
function pointOnRing(angle) {
    const lineRadius = radius - LINE_WIDTH / 2;
    return {
        x: center.x + lineRadius * Math.cos(angle),
        y: center.y + lineRadius * Math.sin(angle)
    };
}

// css transform moving an element to x, y in px
function translate(x, y) {
    return "translate(" + x + "px, " + y + "px)";
}



// ------------------------ MAIN FUNCTIONS ------------------------

const ringEl = document.querySelector(".ring");
const boxes = ringEl.querySelectorAll(".category");

// how far the ring has turned
const baseSpeed = 2 * Math.PI / (LAP_TIME / 1000) * (CLOCKWISE ? 1 : -1); // rad/s
const ring = {
    angle: 0,
    speed: 0,
    transition: null // change between speeds
};

// ease from current speed to targetSpeed
function changeSpeed(targetSpeed, time) {
    ring.transition = {
        fromSpeed: ring.speed,
        toSpeed: targetSpeed,
        startAngle: ring.angle,
        elapsed: 0,
        duration: time / 1000
    };
}

// turn ring
function updateRing(dt) {
    const t = ring.transition;
    if (t === null) {
        ring.angle += ring.speed * dt;
        return;
    }

    const leftover = Math.max(0, t.elapsed + dt - t.duration); // time past end of transition
    t.elapsed = Math.min(t.duration, t.elapsed + dt);
    const u = t.duration === 0 ? 1 : t.elapsed / t.duration;
    const change = t.toSpeed - t.fromSpeed;

    ring.speed = t.fromSpeed + change * (3*u*u - 2*u*u*u);
    ring.angle = t.startAngle + t.duration * (t.fromSpeed * u + change * (u*u*u - u*u*u*u / 2));

    // keep turning at new speed
    if (u === 1) {
        ring.transition = null;
        ring.angle += ring.speed * leftover;
    }
}

// where the ring will stop if stopped now
function getPredictedStopAngle() {
    const t = ring.transition;
    if (t !== null && t.toSpeed === 0) return t.startAngle + t.duration * t.fromSpeed / 2;
    return ring.angle + ring.speed * (STOP_TIME / 1000) / 2;
}

// angle of box number i, in order from top
function boxAngle(i, ringAngle) {
    return ringAngle + i * 2 * Math.PI / boxes.length - Math.PI / 2;
}

// move each box to its place on ring
function drawBoxes() {
    for (let i = 0; i < boxes.length; i++) {
        const point = pointOnRing(boxAngle(i, ring.angle));
        const x = point.x - (center.x - radius);
        const y = point.y - (center.y - radius);
        boxes[i].style.transform = translate(x, y) + " translate(-50%, -50%)"; // centered on the ring, upright
    }
}



// ------------------------ RUNNING CODE ------------------------

let lastFrame = null;
let ringStarted = false;

function ringFrame(now) {
    const dt = lastFrame === null ? 0 : Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    updateRing(dt);
    drawBoxes();
    requestAnimationFrame(ringFrame);
}

// start the ring turning, once it's on screen
function startRing() {
    if (ringStarted) return; // only one loop
    ringStarted = true;
    changeSpeed(baseSpeed, FIRST_START_TIME);
    measureRing();
    drawBoxes();
    requestAnimationFrame(ringFrame);
}



// ------------------------ FOR HOME.JS ------------------------

// slow down to a stop
function stop() {
    changeSpeed(0, STOP_TIME);
}
// speed up to normal speed
function start() {
    changeSpeed(baseSpeed, START_TIME);
}

// center of a box in, now or where it will stop
function getBoxCenter(box, atStop) {
    return pointOnRing(getBoxAngle(box, atStop));
}
// angle of a box around the ring, now or where it will stop
function getBoxAngle(box, atStop) {
    const i = Array.prototype.indexOf.call(boxes, box);
    return boxAngle(i, atStop ? getPredictedStopAngle() : ring.angle);
}

function getRingSpeed() {
    return ring.speed;
}

// whether stopping has finished
function isRingStopped() {
    return ring.speed === 0 && ring.transition === null;
}

window.addEventListener("resize", measureRing);
