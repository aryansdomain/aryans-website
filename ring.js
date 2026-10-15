// ------------------------ SETTINGS ------------------------

const LAP_TIME = 15000;         // ms   how long the ring takes to turn all the way around, at starting speed
const SPEED_CHANGE_TIME = 3000; // ms   how long the ring takes to speed up from rest
const CLOCKWISE = true;         //      which way the ring turns
const LINE_WIDTH = 1;           // px   width of the ring's circle, keep the same as style.css



// ------------------------ UTILITIES ------------------------

// measure ring's radius in px
let radius = 0;
function measureRing() {
    radius = ringEl.clientWidth / 2;
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
    angle: 0,                                 // rad
    speed: 0,                                 // rad/s
    speedUp: { from: 0, to: baseSpeed, time: 0 } // move between speeds
};

// turn ring, ease between speeds
function updateRing(dt) {
    const speedUp = ring.speedUp;
    const speedUpTime = SPEED_CHANGE_TIME / 1000;
    speedUp.time = Math.min(speedUpTime, speedUp.time + dt);

    // ease speed
    const s = speedUp.time / speedUpTime;
    ring.speed = speedUp.from + (speedUp.to - speedUp.from) * (3*s*s - 2*s*s*s);
    ring.angle += ring.speed * dt;
}

// move each box to its place on the ring, in order from the top
function drawBoxes() {
    const lineRadius = radius - LINE_WIDTH / 2;
    for (let i = 0; i < boxes.length; i++) {
        const angle = ring.angle + i * 2 * Math.PI / boxes.length - Math.PI / 2;
        const x = radius + lineRadius * Math.cos(angle);
        const y = radius + lineRadius * Math.sin(angle);
        boxes[i].style.transform = translate(x, y) + " translate(-50%, -50%)"; // centered on the ring
    }
}



// ------------------------ RUNNING CODE ------------------------

let lastFrame = null;

function ringFrame(now) {
    const dt = lastFrame === null ? 0 : Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    updateRing(dt);
    drawBoxes();
    requestAnimationFrame(ringFrame);
}

// start the ring turning, once it's on screen
function startRing() {
    measureRing();
    drawBoxes();
    requestAnimationFrame(ringFrame);
}

window.addEventListener("resize", measureRing);
