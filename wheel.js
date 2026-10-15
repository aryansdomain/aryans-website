// ------------------------ SETTINGS ------------------------

const PHYSICS_STEP = 1/240 ; // s   small step for one tick

// WHEEL
const LAP_TIME = 15000;         // ms   how long the wheel takes to turn all the way around, at starting speed
const SPEED_CHANGE_TIME = 3000; // ms   how long the wheel takes to speed up from rest
const CLOCKWISE = true;         //      which way the wheel turns
const LINE_WIDTH = 1;           // px   width of the wheel's circle and the cables, keep the same as style.css

// HANGING
const CABLE_LENGTH = 0.1;   // ratio   length of the line a box hangs from, compared to the wheel's radius
const SWING_PERIOD = 1;     // s       how long one swing takes, longer -> heavier and lazier
const SWING_DAMPING = 1.1;  // 1/s     how quickly swinging dies down, higher -> settles sooner



// ------------------------ UTILITIES ------------------------

// measure the wheel's radius in px
let radius = 0;
function measureWheel() {
    radius = wheelEl.clientWidth / 2;
}

// css transform moving an element to x, y in px
function translate(x, y) {
    return "translate(" + x + "px, " + y + "px)";
}



// ------------------------ MAIN FUNCTIONS ------------------------

const wheelEl = document.querySelector(".wheel");

// create wheel cars, each containing the box and the line it hangs from
const cars = [];
const boxes = wheelEl.querySelectorAll(".category");
for (let i = 0; i < boxes.length; i++) {
    const cable = document.createElement("div");
    cable.className = "cable";
    wheelEl.insertBefore(cable, boxes[i]);

    cars.push({
        box: boxes[i],
        cable,
        slot: i,  //         order from the top
        swing: 0, // rad     cable angle, counterclockwise from down
        spin: 0   // rad/s   how fast the swing angle is changing
    });
}

// how far the wheel has turned
const baseSpeed = 2 * Math.PI / (LAP_TIME / 1000) * (CLOCKWISE ? 1 : -1); // rad/s
const wheel = {
    angle: 0,                                 // rad
    speed: 0,                                 // rad/s
    accel: 0,                                 // rad/s^2
    speedUp: { from: 0, to: baseSpeed, time: 0 } // move between speeds
};

// turn wheel, ease between speeds
function updateWheel(dt) {
    const speedUp = wheel.speedUp;
    const speedUpTime = SPEED_CHANGE_TIME / 1000;
    speedUp.time = Math.min(speedUpTime, speedUp.time + dt);

    // ease speed
    const s = speedUp.time / speedUpTime;
    wheel.speed = speedUp.from + (speedUp.to - speedUp.from) * (3*s*s - 2*s*s*s);
    wheel.accel =                (speedUp.to - speedUp.from) * (6*s - 6*s*s) / speedUpTime;
    wheel.angle += wheel.speed * dt;
}

// swing each box, pushed around by its hanging point moving with the wheel
function updateSwings(dt) {
    const cableLength = CABLE_LENGTH * radius;
    const gravity = cableLength * Math.pow(2 * Math.PI / SWING_PERIOD, 2);

    for (const car of cars) {
        // hanging point's position around wheel
        const angle = wheel.angle + car.slot * 2 * Math.PI / cars.length - Math.PI / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // acceleration of hanging point
        const ax = radius * (-wheel.speed * wheel.speed * cos - wheel.accel * sin);
        const ay = radius * (-wheel.speed * wheel.speed * sin + wheel.accel * cos);

        // pendulum math - acceleration versus pull of gravity
        const pull = (-ax * Math.cos(car.swing) - (gravity - ay) * Math.sin(car.swing)) / cableLength;
        car.spin += (pull - SWING_DAMPING * car.spin) * dt;
        car.swing += car.spin * dt;

        // update
        const lineRadius = radius - LINE_WIDTH / 2;
        car.x = radius + lineRadius * cos;
        car.y = radius + lineRadius * sin;
    }
}

// move lines and boxes
function drawCars() {
    const cableLength = CABLE_LENGTH * radius;
    for (const car of cars) {
        const endX = car.x + cableLength * Math.sin(car.swing);
        const endY = car.y + cableLength * Math.cos(car.swing);

        car.cable.style.height = cableLength + "px";
        car.cable.style.transform = translate(car.x - LINE_WIDTH / 2, car.y) + " rotate(" + -car.swing + "rad)"; // centered on the hanging point
        car.box  .style.transform = translate( endX,  endY) + " translate(-50%, 0)";
    }
}



// ------------------------ RUNNING CODE ------------------------

let lastFrame = null;
let behind = 0; // time the physics has to catch up on

function wheelFrame(now) {
    // catch physics up to now
    behind += lastFrame === null ? 0 : Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    while (behind >= PHYSICS_STEP) {
        behind -= PHYSICS_STEP;
        updateWheel (PHYSICS_STEP);
        updateSwings(PHYSICS_STEP);
    }

    drawCars();
    requestAnimationFrame(wheelFrame);
}

// start the wheel turning, once it's on screen
function startWheel() {
    measureWheel();
    updateSwings(0);
    drawCars();
    requestAnimationFrame(wheelFrame);
}

window.addEventListener("resize", measureWheel);
