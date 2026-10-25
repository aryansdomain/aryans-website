// ------------------------ SETTINGS ------------------------

const TURN_TIME = 700; // ms   time boxes take to turn

// LIQUID
const LIQUID_BLUR = 1; // px   how far apart shapes can be and still join

// LAYOUT
const LEVEL_SCALE = [1, 0.8, 0.8]; //      size of years, months and entries compared to font of blog
const BOX_PADDING = 1.6;           // em   space between label of box and its sides
const BOX_HEIGHT  = 3;             // em   box's height
const BOX_GAP     = 24;            // px   space between boxes
const FIRST_GAP   = 56;            // px   space between a box and the first subbox
const ROW_PADDING = 32;            // px   space between a row and the sides of the screen

// SCROLLING
const SCROLL_SMOOTH  = 80;  // ms   bigger -> smoother, more delayed scrolling
const DRAG_THRESHOLD = 5;   // px   how far the pointer moves before it starts dragging
const SCROLL_PAST    = 400; // px   how far past the row ends the row can be scrolled



// ------------------------ ENTRIES ------------------------

const entries = [
    { title: "Poly x Trig = Linear?", date: "2025-02-18", link: "2025feb18.html" }
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];



// ------------------------ STATE ------------------------

const SVG_NS = "http://www.w3.org/2000/svg";
const blog         = document.getElementById("blog");
const scene        = document.getElementById("blog-scene");
const boxLayer     = document.getElementById("blog-boxes");
const liquidShapes = document.getElementById("liquid-shapes");
const liquidBlur   = document.querySelector("#liquid-filter feGaussianBlur");

// chromatic aberration toward screen edge
const liquidSplitRed  = smoothOffset(document.querySelector("#liquid-filter .split-red"));
const liquidSplitBlue = smoothOffset(document.querySelector("#liquid-filter .split-blue"));
const lensFilters = document.getElementById("lens-filters"); // filter for each box
const lensColors  = lensBackground();
setLiquidBorderAlpha();

// directions that each row extends from its parent
const ROW_DIRECTIONS = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]; // years, months, entries

const allBoxes = [];
const years = buildTree();
let path = []; // path to entry

// camera
const camera = { x: 0, y: 0, angle: 0, pivot: years[0] };

let scroll = 0, scrollTarget = 0, scrollMax = 0;
let turning = null; // is stuff turning?
let family  = null; // box and its subboxes
let steps   = [];   // what to do next
let liquidTime = 0; // time since the page started, for drifting
let resized = false;



// ------------------------ UTILITIES ------------------------

function svgElement(tag, parent, attributes) {
    const element = document.createElementNS(SVG_NS, tag);
    setAttributes(element, attributes);
    parent.appendChild(element);
    return element;
}

function setAttributes(element, attributes) {
    for (const name in attributes) element.setAttribute(name, attributes[name]);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function easeInOut(u) {
    return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

function easeOut(u) {
    return 1 - Math.pow(1 - u, 3);
}

// move animation forward
function progress(animation, dt) {
    animation.time += dt;
    return animation.duration ? Math.min(1, animation.time / animation.duration) : 1;
}

// keep scrolling within the row, and a little past its ends
function clampScroll(value) {
    return clamp(-SCROLL_PAST, scrollMax + SCROLL_PAST, value);
}

// rotate clowckwise
function turn(dx, dy, angle) {
    const a = angle * Math.PI / 180;
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}



// ------------------------ BOXES ------------------------

// path to every entry
function buildTree() {
    const yearBoxes = [];
    entries.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (entry) { // most recent first
        const yearLabel  = entry.date.slice(0, 4);
        const monthLabel = MONTHS[parseInt(entry.date.slice(5, 7), 10) - 1];

        // in date order\
        let year = yearBoxes[yearBoxes.length - 1];
        if (!year || year.label !== yearLabel) yearBoxes.push(year = makeBox(yearLabel, 0, null));
        let month = year.children[year.children.length - 1];
        if (!month || month.label !== monthLabel) year.children.push(month = makeBox(monthLabel, 1, year));

        // entries
        const entryBox = makeBox(entry.title, 2, month);
        entryBox.link = entry.link;
        month.children.push(entryBox);
    });
    return yearBoxes;
}

function makeBox(label, level, parent) {
    const group = svgElement("g", boxLayer, { class: "blog-box", tabindex: "0", role: level === 2 ? "link" : "button", "aria-label": label });
    const box = {
        label: label,
        id: label.toLowerCase(),
        level: level,
        parent: parent,
        children: [],
        link: null,

        homeX: 0, homeY: 0, // extended center
        width: 0, height: 0,

        angle: 0, angleFrom: 0, angleTo: 0, // turn on the screen
        shown: level === 0,

        group: group,
        glow:  svgElement("rect", group, { class: "glow", filter: "url(#subbox-glow)" }),
        frame: svgElement("rect", group, { class: "frame" }),
        text:  svgElement("text", group, {}),
        silhouette: null, // for liquid filter
        lens: null,       // chromatic aberration
        lensId: "box-lens-" + allBoxes.length,
        blob: null,       // while out of its parent
        transform: ""
    };
    box.text.textContent = label;
    group.classList.toggle("hidden", !box.shown);

    // clicks or keypresses
    group.addEventListener("click", function () { clickBox(box); });
    group.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        clickBox(box);
    });

    allBoxes.push(box);
    return box;
}

function showBox(box, shown) {
    box.shown = shown;
    box.group.classList.toggle("hidden", !shown);
}

// row being looked at
function currentRow() {
    if (path.length === 0) return years;
    const opened = path[path.length - 1];
    return [opened].concat(opened.children);
}

// upright/sideways
function restingAngle(box) {
    if (family !== null && !family.out && box.parent === family.parent) return 0; // retracting
    return path.indexOf(box) !== -1 || currentRow().indexOf(box) !== -1 ? 0 : -90;
}



// ------------------------ LAYOUT ------------------------

function layout() {
    const font = parseFloat(getComputedStyle(blog).fontSize);
    allBoxes.forEach(function (box) { measureBox(box, font * LEVEL_SCALE[box.level]); });

    placeRow(years, null);
    years.forEach(function (year) {
        placeRow(year.children, year);
        year.children.forEach(function (month) { placeRow(month.children, month); });
    });
}

// dimensions of box
function measureBox(box, size) {
    box.text.style.fontSize = size + "px";
    box.width  = box.text.getComputedTextLength() + 2 * BOX_PADDING * size;
    box.height = BOX_HEIGHT * size;

    const rect = { x: -box.width / 2, y: -box.height / 2, width: box.width, height: box.height };
    setAttributes(box.frame, rect);
    setAttributes(box.glow, rect);
}

// line up row going out from parent's center
function placeRow(row, parent) {
    if (row.length === 0) return;
    const direction = ROW_DIRECTIONS[row[0].level];
    const originX = parent ? parent.homeX : 0, originY = parent ? parent.homeY : 0;

    let edge = parent ? parent.width / 2 + FIRST_GAP : -row[0].width / 2; // next box starting place
    row.forEach(function (box) {
        const distance = edge + box.width / 2;
        box.homeX = originX + direction.x * distance;
        box.homeY = originY + direction.y * distance;
        edge = distance + box.width / 2 + BOX_GAP;
    });
}

// center of box, in SCENE
function boxSpot(box) {
    if (box.blob === null) return { x: box.homeX, y: box.homeY };
    if (turning === null || box.parent !== camera.pivot) return { x: box.blob.x, y: box.blob.y };

    // face in row's end direction
    const center = boxSpot(box.parent);
    const offset = turn(box.blob.x - center.x, box.blob.y - center.y, turning.rowAngle - camera.angle);
    return { x: center.x + offset.x, y: center.y + offset.y };
}

// center of box, on SCREEN
function screenSpot(box) {
    const spot = boxSpot(box);
    const offset = turn(spot.x - camera.pivot.homeX, spot.y - camera.pivot.homeY, camera.angle);
    return { x: camera.x - scroll + offset.x, y: camera.y + offset.y };
}



// ------------------------ CAMERA ------------------------

// where the first box in the row is, and how far the row can scroll
function frameRow(row, angle) {
    const first = row[0]; // first box
    const left = -first.width / 2; // left edge
    let right = -Infinity; // temp right edge
    // find right edge
    row.forEach(function (box) {
        const offset = turn(box.homeX - first.homeX, box.homeY - first.homeY, angle).x;
        right = Math.max(right, offset + box.width / 2);
    });

    const length = right - left;
    const room = blog.clientWidth - 2 * ROW_PADDING;
    return {
        x: length <= room ? (blog.clientWidth - length) / 2 - left : ROW_PADDING - left,
        y: blog.getBoundingClientRect().top + blog.clientHeight / 2,
        scrollMax: Math.max(0, length - room)
    };
}

// where pivot goes on the screen so the focused row is still looked at when turned, and how far the row can scroll
function restingCamera(pivot, angle) {
    const row = currentRow();
    const frame = frameRow(row, angle);
    const offset = turn(row[0].homeX - pivot.homeX, row[0].homeY - pivot.homeY, angle);
    return { x: frame.x - offset.x, y: frame.y - offset.y, scrollMax: frame.scrollMax };
}

// turn the scene
function startTurn(pivot, keep, instant) {
    const angle = -90 * path.length; // counterclockwise
    const rest = restingCamera(pivot, angle);

    let endScroll = 0;
    // box that was just closed
    if (keep) {
        const keepOffset = turn(keep.homeX - pivot.homeX, keep.homeY - pivot.homeY, angle).x;
        endScroll = clamp(0, rest.scrollMax, rest.x + keepOffset - blog.clientWidth / 2);
    }

    // update turn info
    const start = screenSpot(pivot);
    turning = {
        from: { x: start.x, y: start.y, angle: camera.angle },
        to:   { x: rest.x,  y: rest.y,  angle:        angle },
        rowAngle: keep ? camera.angle : angle,
        scroll: endScroll,
        scrollMax: rest.scrollMax,
        time: 0,
        duration: instant ? 0 : TURN_TIME
    };
    camera.pivot = pivot;
    camera.x = start.x;
    camera.y = start.y;
    scroll = scrollTarget = 0;

    // update boxes
    allBoxes.forEach(function (box) {
        box.angleFrom = box.angle;
        box.angleTo = restingAngle(box);
        box.group.classList.toggle("dim", box.angleTo !== 0);
    });
    saveHash();
}

// do the turn
function updateTurn(dt) {
    const t = progress(turning, dt);
    const e = easeInOut(t);

    // do the turn
    camera.x     = lerp(turning.from.x,     turning.to.x,     e);
    camera.y     = lerp(turning.from.y,     turning.to.y,     e);
    camera.angle = lerp(turning.from.angle, turning.to.angle, e);
    scroll = scrollTarget = turning.scroll * e;
    allBoxes.forEach(function (box) { box.angle = lerp(box.angleFrom, box.angleTo, e); });

    // end
    if (t === 1) {
        scrollMax = turning.scrollMax;
        turning = null;
    }
}

// fit the focused row to new screen size
function reframe() {
    layout();
    allBoxes.forEach(function (box) {
        if (box.blob !== null) Object.assign(box.blob, { targetX: box.homeX, targetY: box.homeY, targetWidth: box.width, targetHeight: box.height });
    });

    const rest = restingCamera(camera.pivot, camera.angle);
    camera.x = rest.x;
    camera.y = rest.y;
    scrollMax = rest.scrollMax;
    scroll = scrollTarget = clampScroll(scrollTarget);
}



// ------------------------ LIQUID ------------------------

// subboxes of parent come out of it, or go back in
function startFamily(parent, out, instant) {
    family = {
        parent: parent,
        boxes: [parent].concat(parent.children), // parent, then subboxes
        out: out
    };

    family.boxes.forEach(function (box) {
        box.silhouette = svgElement("rect", liquidShapes, {});
        box.group.classList.add("liquid");
    });

    const origin = boxSpot(parent);
    parent.children.forEach(function (child) {
        if (!out) {
            retractBlob(child.blob);
            return;
        }
        child.blob = makeBlob(origin, { x: child.homeX, y: child.homeY, width: child.width, height: child.height });
        if (instant) Object.assign(child.blob, { phase: "extended", progress: 1, opacity: 1 }); // already out

        stepBlob(child.blob, origin, sceneSize(parent), 0, liquidTime);
        child.angle = child.angleFrom = 0; // upright
        showBox(child, true);
    });
}

// move every subbox that's out, and end the family once its subboxes have finished moving
function updateBlobs(dt) {
    liquidTime += dt;
    allBoxes.forEach(function (box) {
        if (box.blob !== null) stepBlob(box.blob, boxSpot(box.parent), sceneSize(box.parent), dt, liquidTime);
    });

    if (family !== null && family.parent.children.every(function (child) { return isSettled(child.blob); })) endFamily();
}

// size of box along scene's directions
function sceneSize(box) {
    const a = (box.angle - camera.angle) * Math.PI / 180;
    const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a));
    return { width: cos * box.width + sin * box.height, height: sin * box.width + cos * box.height };
}

function endFamily() {
    family.boxes.forEach(function (box) {
        box.group.classList.remove("liquid");
        box.silhouette = null;
    });
    liquidShapes.replaceChildren();

    // back inside
    if (!family.out) family.parent.children.forEach(function (child) {
        child.blob = null;
        showBox(child, false);
    });
    family = null;
}

// liquid stuff
function drawLiquid() {
    let liquidity = 0;
    family.boxes.forEach(function (box) {
        const shape = box.blob || { width: box.width, height: box.height, cornerRadius: 0, liquidity: 0 }; // keep parent in box shape
        liquidity = Math.max(liquidity, shape.liquidity);

        // properties of the blob
        setAttributes(box.silhouette, {
            x: -shape.width / 2,
            y: -shape.height / 2,
            width:  shape.width,
            height: shape.height,
            rx: shape.cornerRadius,
            transform: box.transform
        });
    });
    liquidBlur.setAttribute("stdDeviation", Math.max(0.01, LIQUID_BLUR * liquidity));

    // split colors
    let split = { x: 0, y: 0 };
    family.boxes.forEach(function (box) {
        const spot = screenSpot(box);
        const here = lensSplit(spot.x, spot.y, 1);
        if (Math.hypot(here.x, here.y) > Math.hypot(split.x, split.y)) split = here;
    });
    const local = turn(split.x, split.y, -camera.angle); // turn the liquid layer as the scene turns
    liquidSplitRed ( local.x,  local.y);
    liquidSplitBlue(-local.x, -local.y);
}

// split box toward edges of the screen
function splitBox(box) {
    const spot = screenSpot(box);
    const split = lensSplit(spot.x, spot.y, 1);

    // when not split, no filter
    if (split.x === 0 && split.y === 0) {
        box.group.removeAttribute("filter");
        return;
    }
    if (box.lens === null) box.lens = makeBoxLens(box.lensId, lensColors, lensFilters);

    const local = turn(split.x, split.y, -box.angle);
    box.lens.red ( local.x,  local.y);
    box.lens.blue(-local.x, -local.y);
    box.group.setAttribute("filter", "url(#" + box.lensId + ")");
}



// ------------------------ OPENING ------------------------

// is something running
function busy() {
    return turning !== null || family !== null || steps.length > 0;
}

// turn the scene around box while its subboxes come out
function openBox(box, instant) {
    steps.push(function () {
        path.push(box);
        startTurn(box, null, instant);
        startFamily(box, true, instant);
    });
}

// turn the scene back, also the last opened box's subboxes go back in
function closeBox() {
    steps.push(function () {
        startFamily(path[path.length - 1], false, false);
        const box = path.pop();
        startTurn(box, box, false);
    });
}

function clickBox(box) {
    if (dragged || busy()) return;
    if (box.link) {
        window.location.href = box.link;
        return;
    }

    // opened: close it if it's the last one, otherwise close what's below it
    const depth = path.indexOf(box);
    if (depth !== -1) {
        const keep = depth === path.length - 1 ? depth : depth + 1;
        for (let i = path.length; i > keep; i--) closeBox();
        return;
    }

    // close down to box's level, then open it
    for (let i = path.length; i > box.level; i--) closeBox();
    openBox(box);
}

// #2025/feb
function saveHash() {
    const hash = path.map(function (box) { return box.id; }).join("/");
    history.replaceState(null, "", hash ? "#" + hash : window.location.pathname);
}

function openFromHash() {
    let row = years;
    const ids = decodeURIComponent(window.location.hash.slice(1)).split("/");
    for (const id of ids) {
        const box = row.find(function (box) { return box.id === id && box.link === null; });
        if (!box) break;
        openBox(box, true);
        row = box.children;
    }
}



// ------------------------ DRAWING ------------------------

function draw() {
    scene.setAttribute("transform",
        "translate(" + (camera.x - scroll) + " " + camera.y + ") " +
        "rotate(" + camera.angle + ") " +
        "translate(" + -camera.pivot.homeX + " " + -camera.pivot.homeY + ")");

    allBoxes.forEach(function (box) {
        if (!box.shown) return;
        const spot = boxSpot(box);
        box.transform = "translate(" + spot.x + " " + spot.y + ") rotate(" + (box.angle - camera.angle) + ")"; // its own turn on the screen
        box.group.setAttribute("transform", box.transform);
        if (box.blob !== null) box.text.style.opacity = box.blob.opacity;
        splitBox(box);
    });

    if (family !== null) drawLiquid();
}



// ------------------------ INPUT ------------------------

// wheel scrolls the row sideways
blog.addEventListener("wheel", function (event) {
    event.preventDefault();
    if (turning) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    scrollTarget = clampScroll(scrollTarget + delta);
}, { passive: false });

// dragging scrolls the row sideways
let drag = null;
let dragged = false; // last press was a drag, not a click
blog.addEventListener("pointerdown", function (event) {
    drag = { x: event.clientX, scroll: scrollTarget };
    dragged = false;
});
blog.addEventListener("pointermove", function (event) {
    if (drag === null || turning) return;
    const dx = event.clientX - drag.x;
    if (!dragged && Math.abs(dx) > DRAG_THRESHOLD) {
        dragged = true;
        blog.setPointerCapture(event.pointerId);
    }
    if (dragged) scroll = scrollTarget = clampScroll(drag.scroll - dx);
});
blog.addEventListener("pointerup",     function () { drag = null; });
blog.addEventListener("pointercancel", function () { drag = null; });

// keep a box focused with the keyboard in view
boxLayer.addEventListener("focusin", function (event) {
    const box = allBoxes.find(function (box) { return box.group === event.target; });
    if (!box || turning || currentRow().indexOf(box) === -1) return;

    const x = screenSpot(box).x + scroll - scrollTarget; // once scrolling catches up
    const tooFar  = x + box.width / 2 - (blog.clientWidth - ROW_PADDING);
    const tooNear = ROW_PADDING - (x - box.width / 2);
    if (tooFar > 0)  scrollTarget += tooFar;
    if (tooNear > 0) scrollTarget -= tooNear;
    scrollTarget = clampScroll(scrollTarget);
});

// clicking off the boxes closes the last opened box
blog.addEventListener("click", function (event) {
    if (dragged || busy() || path.length === 0 || event.target.closest(".blog-box")) return;
    closeBox();
});

window.addEventListener("resize", function () { resized = true; });



// ------------------------ LOOP ------------------------

function update(dt) {
    if (turning !== null) updateTurn(dt);
    else scroll += (scrollTarget - scroll) * (1 - Math.exp(-dt / SCROLL_SMOOTH));

    updateBlobs(dt);

    if (turning === null && family === null) {
        if (steps.length > 0) steps.shift()();
        else if (resized) {
            resized = false;
            reframe();
        }
    }
}

let lastTime = null;
function frame(now) {
    const dt = lastTime === null ? 0 : now - lastTime;
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
}

reframe();
openFromHash();
requestAnimationFrame(frame);

// todo add an info thing that says you need mathjacx