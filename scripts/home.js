// ------------------------ SETTINGS ------------------------

const NAME_SPACE = 80;        // space at top for name (same as --name-space in style.css)
const CAMERA_PADDING = 32;    // space between focused group and edges of screen
const MIN_CAMERA_SCALE = 0.6; // furthest camera zooms out to fit subcategories
const FOCUS_ZOOM = 1.2;       // how far camera zooms in on subcategories



// ------------------------ UTILITIES ------------------------

// fast at start, slow at end
function easeOut(u) {
    return 1 - Math.pow(1 - u, 3);
}

function lerp(a, b, u) {
    return a + (b - a) * u;
}



// ------------------------ STATE ------------------------

const home = document.getElementById("home");

let phase = "idle"; // idle -> focusing -> focused -> unfocusing -> idle, or focused -> opening (a subcategory's page)
let focusedBox = null;
let layout = null; //  evnentual position of subboxes

// camera
const world = document.getElementById("world");
const worldCamera = {
    x: 0,    // px
    y: 0,    // px
    scale: 1
};

// where the camera goes to center the bounds of the boxes
function getCameraTarget(bounds, box) {
    const top = NAME_SPACE;
    const width = home.clientWidth;
    const height = home.clientHeight - top;

    const scale = Math.max(MIN_CAMERA_SCALE, Math.min(FOCUS_ZOOM,
        (width  - 2 * CAMERA_PADDING) / bounds.width,
        (height - 2 * CAMERA_PADDING) / bounds.height
    ));

    return {
        x: fitAxis(bounds.minX, bounds.maxX, box.center.x, scale, 0, width),
        y: fitAxis(bounds.minY, bounds.maxY, box.center.y, scale, top, height),
        scale: scale
    };
}

// translate the camera along one axis
function fitAxis(min, max, boxCenter, scale, start, size) {
    if ((max - min) * scale <= size - 2 * CAMERA_PADDING) return start + size / 2 - scale * (min + max) / 2;
    if (boxCenter - min < max - boxCenter) return start + CAMERA_PADDING - scale * min;
    return start + size - CAMERA_PADDING - scale * max;
}

function drawCamera() {
    world.style.transform = "translate(" + worldCamera.x + "px, " + worldCamera.y + "px) scale(" + worldCamera.scale + ")";
}

// ease camera from current position to target
let cameraMove = null;
function moveCamera(target, duration) {
    cameraMove = {
        from: { x: worldCamera.x, y: worldCamera.y, scale: worldCamera.scale },
        to: target,
        elapsed: 0,        // ms
        duration: duration // ms
    };
}

function stepCamera(dt) {
    if (cameraMove === null) return;
    cameraMove.elapsed = Math.min(cameraMove.duration, cameraMove.elapsed + dt);
    const u = easeOut(cameraMove.elapsed / cameraMove.duration);

    worldCamera.x     = lerp(cameraMove.from.x,     cameraMove.to.x,     u);
    worldCamera.y     = lerp(cameraMove.from.y,     cameraMove.to.y,     u);
    worldCamera.scale = lerp(cameraMove.from.scale, cameraMove.to.scale, u);
    drawCamera();
    if (u === 1) cameraMove = null;
}

// turn the box to the side of the ring, extending subboxes
function focus(box) {
    focusedBox = box;
    turnToSide(box);
    layout = layoutSubboxes(box); // laid out from where the box will stop

    moveCamera(getCameraTarget(layout.bounds, layout.box), EXTEND_TIME);
    spawnSubcats(box, layout);
    phase = "focusing";
    startHomeLoop();
}
// camera starts back
function unfocus() {
    start();
    moveCamera({ x: 0, y: 0, scale: 1 }, RETRACT_TIME);
    retractSubcats();
    phase = "unfocusing";
    startHomeLoop();
}



// ------------------------ RUNNING CODE ------------------------

let homeLooping = false;
let lastHomeFrame = null;

function startHomeLoop() {
    if (homeLooping) return;
    homeLooping = true;
    lastHomeFrame = null;
    requestAnimationFrame(homeFrame);
}

// move the camera and subboxes
function homeFrame(now) {
    const dt = lastHomeFrame === null ? 0 : now - lastHomeFrame;
    lastHomeFrame = now;

    stepCamera(dt);
    updateSubcats(dt);

    // phases end once the ring stops and the subboxes finish moving
    if (phase === "focusing") {
        if (isStable() && isRingStopped()) phase = "focused";
    } else if (phase === "unfocusing") {
        if (isStable()) {
            focusedBox = null;
            layout = null;
            phase = "idle";
            if (ringEl.querySelector(".category:hover")) stop(); // mouse already on a box
        }
    }

    // keep going while focused
    if (phase === "focusing" || phase === "focused" || phase === "unfocusing" || cameraMove !== null) requestAnimationFrame(homeFrame);
    else homeLooping = false;
}

// clicks
home.addEventListener("click", function (event) {
    if (event.target.closest("#replay")) return;
    const box = event.target.closest(".category");

    if (phase === "idle") {
        if (!box) return;

        // no subcategories, open its page directly
        const link = boxLinks[box.dataset.cat];
        if (link) {
            phase = "opening";
            openElement(box, box, link, worldCamera.scale);
        } else focus(box);
    } else if (phase === "focused") {
        // open a subcategory's page
        const shape = shapeAt({ x: event.clientX, y: event.clientY });
        if (shape !== null && shape.link) {
            phase = "opening";
            openSubcat(shape);
            return;
        }
        unfocus(); // back to home
    }
});

// hover over a box to stop rotation, leave hovering to start
boxes.forEach(function (box) {
    box.addEventListener("pointerenter", function (event) {
        if (event.pointerType !== "touch" && phase === "idle") stop();
    });
    box.addEventListener("pointerleave", function (event) {
        if (event.pointerType !== "touch" && phase === "idle") start();
    });
});

// came back from a subcategory's page, reset to unfocused
window.addEventListener("pageshow", function (event) {
    if (!event.persisted || phase !== "opening") return;
    clearBlobs();
    cameraMove = null;
    worldCamera.x = 0;
    worldCamera.y = 0;
    worldCamera.scale = 1;
    drawCamera();
    focusedBox = null;
    layout = null;
    phase = "idle";
    start(); // ring turns again
});

// init
function showHome() {
    if (home.classList.contains("shown")) return;
    home.classList.add("shown");
    drawCamera();
    startRing();
}
