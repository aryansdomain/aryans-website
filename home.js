// ------------------------ SETTINGS ------------------------

const CAMERA_TIME = 500;  // ms   time camera takes to move to or from a focused box

const SUBBOX_SCALE = 0.8;        //      size of subboxes compared to their box
const SUBBOX_GAP = 24;           // px   space between subboxes
const FIRST_SUBBOX_GAP = 56;     // px  space between a box and its first subbox
const MIN_FIRST_SUBBOX_GAP = 16; // px  smallest that space shrinks to in emergencies (longest subbox is still too close to the screen's edge)

const NAME_SPACE = 80;        // px   space at top for name (same as --name-space in style.css)
const CAMERA_PADDING = 32;    // px   space between focused group and edges of screen
const MIN_CAMERA_SCALE = 0.6; //      furthest camera zooms out to fit subcategories



// ------------------------ SUBCATEGORIES ------------------------

// labels for subcategories in order
const subcats = {
    about: ["Me", "Contact"],
    writing: ["Essays", "Short Stories", "Poetry"],
    research: ["2026", "2027"],
    projects: ["Intscript", "Wörtel"]
};

function getSubcats(box) {
    const parent = box.dataset.cat;
    return subcats[parent].map(function (label) {
        return {
            id: parent + "-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            label: label,
            parent: parent
        };
    });
}

// get subbox size
function measureSubbox(box, label) {
    const copy = box.cloneNode(true);
    copy.querySelector("span").textContent = label;
    copy.style.transform = "none";
    copy.style.visibility = "hidden";
    box.parentNode.appendChild(copy);

    const size = { width: copy.offsetWidth * SUBBOX_SCALE, height: copy.offsetHeight * SUBBOX_SCALE };
    copy.remove();
    return size;
}

// how far a (sub)box reaches from its center along direction
function reach(size, dir) {
    return Math.abs(dir.x) * size.width / 2 + Math.abs(dir.y) * size.height / 2;
}

// how far from point until CAMERA_PADDING from the edge of the screen
function spaceToEdge(point, dir) {
    const left = CAMERA_PADDING, right  = home.clientWidth  - CAMERA_PADDING;
    const top  = NAME_SPACE + CAMERA_PADDING, bottom = home.clientHeight - CAMERA_PADDING;

    let space = Infinity;
    if (dir.x > 0) space = Math.min(space, (right  - point.x) / dir.x);
    if (dir.x < 0) space = Math.min(space, (left   - point.x) / dir.x);
    if (dir.y > 0) space = Math.min(space, (bottom - point.y) / dir.y);
    if (dir.y < 0) space = Math.min(space, (top    - point.y) / dir.y);
    return space;
}

// compute position of subboxes when ring stops
function layoutSubboxes(box) {
    const angle  = getBoxAngle(box, true);
    const center = getBoxCenter(box, true);

    const out   = { x:  Math.cos(angle), y: Math.sin(angle) }; // away from the ring's center
    const along = { x: -Math.sin(angle), y: Math.cos(angle) }; // along the ring
    const boxSize = { width: box.offsetWidth, height: box.offsetHeight };

    const subboxes = getSubcats(box).map(function (subcat) {
        return Object.assign(subcat, measureSubbox(box, subcat.label));
    });

    // overflow: start a new row when subboxes go too far
    const room = spaceToEdge(center, out);

    // shrink the first gap if the longest subbox is too close to the edge
    const longest = Math.max.apply(null, subboxes.map(function (subbox) { return reach(subbox, out); }));
    const firstGap = Math.max(MIN_FIRST_SUBBOX_GAP, Math.min(FIRST_SUBBOX_GAP, room - reach(boxSize, out) - 2 * longest));

    const rows = [[]];
    let edge = reach(boxSize, out); // how far the current row reaches
    subboxes.forEach(function (subbox) {
        const depth = reach(subbox, out);
        let row = rows[rows.length - 1];
        if (row.length > 0 && edge + SUBBOX_GAP + 2 * depth > room) {
            row = [];
            rows.push(row);
            edge = reach(boxSize, out);
        }

        const gap = row.length === 0 ? firstGap : SUBBOX_GAP;
        subbox.distance = edge + gap + depth; // distance out from box's center
        edge = subbox.distance + depth;
        row.push(subbox);
    });

    // stack rows along ring
    const width = Math.max.apply(null, subboxes.map(function (subbox) { return reach(subbox, along); }));
    const s = 2 * width + SUBBOX_GAP; // space between rows
    rows.forEach(function (row, i) {
        const side = (i - (rows.length - 1) / 2) * s;
        row.forEach(function (subbox) {
            subbox.center = {
                x: center.x + subbox.distance * out.x + side * along.x,
                y: center.y + subbox.distance * out.y + side * along.y
            };
        });
    });

    const boxRect = { center: center, width: boxSize.width, height: boxSize.height };
    return {
        box: boxRect,
        subboxes: subboxes,
        bounds: getBounds([boxRect].concat(subboxes))
    };
}

// smallest rectangle around every rectangle given
function getBounds(rects) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    rects.forEach(function (rect) {
        minX = Math.min(minX, rect.center.x - rect.width / 2);
        minY = Math.min(minY, rect.center.y - rect.height / 2);
        maxX = Math.max(maxX, rect.center.x + rect.width / 2);
        maxY = Math.max(maxY, rect.center.y + rect.height / 2);
    });

    return {
        minX: minX, minY: minY,
        maxX: maxX, maxY: maxY,
        centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2,
        width: maxX - minX, height: maxY - minY
    };
}

// fast at start, slow at end
function easeOut(u) {
    return 1 - Math.pow(1 - u, 3);
}

function lerp(a, b, u) {
    return a + (b - a) * u;
}



// ------------------------ STATE ------------------------

const home = document.getElementById("home");

let phase = "idle"; // idle -> focusing -> focused -> unfocusing -> idle
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

    const scale = Math.max(MIN_CAMERA_SCALE, Math.min(1,
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
    updateLiquid(dt);

    // phases end once the ring stops and the subboxes finish moving
    if (phase === "focusing") {
        if (isStable() && isRingStopped()) phase = "focused";
    } else if (phase === "unfocusing") {
        if (isStable()) {
            focusedBox = null;
            layout = null;
            phase = "idle";
        }
    }

    // keep going while focused
    if (phase === "focusing" || phase === "focused" || phase === "unfocusing" || cameraMove !== null) requestAnimationFrame(homeFrame);
    else homeLooping = false;
}

// clicks
home.addEventListener("click", function (event) {
    if (event.target.closest("#name")) return;
    const box = event.target.closest(".category");

    if (phase === "idle") {
        if (box) focus(box);
    } else if (phase === "focused") {
        if (!box || box === focusedBox) unfocus();
    }
});

// init
function showHome() {
    if (home.classList.contains("shown")) return;
    home.classList.add("shown");
    drawCamera();
    startRing();
}

// TODO: fix the issue of different screen dimensions
