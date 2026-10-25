// ------------------------ SETTINGS ------------------------

const SIDEBAR_PIECE_SIZE = 50; // px    size of pieces in sidebar
const SIDEBAR_PIECE_GAP = 50;  // px    space between pieces in sidebar
const CANVAS_PIECE_SIZE = 50;  // px    size of pieces on canvas

const DOT_RADIUS = 8; // px    radius of the rotating dot

const GRID_SIZE = 25;    // px    size of canvas's grid squares
const MIN_ZOOM = 0.25;   //       furthest the canvas zooms out
const MAX_ZOOM = 4;      //       furthest the canvas zooms in
const ZOOM_SPEED = 0.01; //       how fast ctrl-scrolling zooms

const DEFAULT_SIDES = 5; // number of sides at the start
const MAX_SIDES = 12;    // most sides a polybend can have

const ARC_BUTTON_RADIUS = 0.07; // size of the buttons on the preview arcs
const ARC_BUTTON_OFFSET = 0.01;  // how far the buttons are from a side

const UNDO_LIMIT = 100; //  most steps that can be undone

const DOUBLE_TAP_TIME = 300; // ms   longest time between two clicks/taps on a piece to remove it

const SNAP_DISTANCE = 12; // px    how close an arc gets to another arc before snapping
const SNAP_TURN = 20;     // deg   how much the degrees of arcs can differ for snapping to occur 



// ------------------------ PAGE ------------------------

const SVG_NS = "http://www.w3.org/2000/svg";

const STORAGE_KEY = "polybends_intro_seen"; // localStorage key

const sidebar       = document.getElementById("sidebar");
const shapeList     = document.getElementById("sidebar-shapes");
const addShape      = document.getElementById("add-shape");
const newShape      = document.getElementById("new-shape");
const addShapeDone  = document.getElementById("add-shape-done");
const mirrorToggle  = document.querySelector(".mirror-toggle");
const canvas        = document.getElementById("canvas");
const undoButton    = document.getElementById("undo");
const redoButton    = document.getElementById("redo");
const clearButton   = document.getElementById("clear");
const dotsToggle    = document.querySelector(".dots-toggle");
const shapePreview  = document.getElementById("shape-preview");
const sidesInput    = document.getElementById("sides");
const snapInput     = document.getElementById("snap");
const roundnessText = document.getElementById("roundness");

// everything on the canvas
const world = document.createElementNS(SVG_NS, "g");
canvas.appendChild(world);

// shapes in the sidebar
let shapes = defaultShapes();

// shape being made in the new shape popup: which sides bulge out, and if the mirror is added too
let bulgesOut = alternatingBulges(DEFAULT_SIDES);
let addMirrored = false;



// ------------------------ SHAPE ------------------------

// sides bulge out, in, out, in, ...
function alternatingBulges(sides) {
    return Array.from({ length: sides }, function (_, i) { return i % 2 === 0; });
}

// each vertex, going clockwise
function pieceVertices(sides) {
    const top = Math.ceil(sides / 2), bottom = Math.floor(sides / 2);
    const shift = Math.floor((top - 1) / 2);

    const vertices = [];
    for (let i = 0; i < top; i++)         vertices.push({ x: i - shift,       y: 0              });
    for (let i = bottom - 1; i >= 0; i--) vertices.push({ x: i + 0.5 - shift, y: Math.sqrt(3)/2 });
    return vertices;
}

// create the svg path of a piece
function piecePath(bulges) {
    const vertices = pieceVertices(bulges.length);

    let path = "M " + vertices[0].x + "," + vertices[0].y; // initial position
    for (let i = 0; i < bulges.length; i++) {
        const v = vertices[(i + 1) % bulges.length];
        path += " A 1,1 0 0," + (bulges[i] ? 1 : 0) + " " + v.x + "," + v.y; // 60 degree arc to next vertex, clockwise bulges out
    }
    return path + " Z";
}

// create the shape of a piece, scale to size
function makeShape(reflected, size, bulges) {
    const shape = document.createElementNS(SVG_NS, "path");
    shape.setAttribute("d", piecePath(bulges));
    shape.setAttribute("transform", "scale(" + (reflected ? -size : size) + "," + size + ")");
    return shape;
}



// ------------------------ PIECES ------------------------

// make a new piece
function makePiece(x, y, reflected, bulges) {
    const piece = { x: x, y: y, angle: 0, reflected: reflected, bulges: bulges };

    // element
    piece.element = document.createElementNS(SVG_NS, "g");
    piece.element.classList.add("piece");
    piece.element.piece = piece;

    // rotation dot
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.classList.add("rotate-dot");
    dot.setAttribute("r", DOT_RADIUS);
    piece.element.append(makeShape(reflected, CANVAS_PIECE_SIZE, bulges), dot);

    // add to canvas
    piece.element.setAttribute("transform", "translate(" + piece.x + "," + piece.y + ") rotate(" + piece.angle + ")");
    world.appendChild(piece.element);
    return piece;
}

// the piece under a pointer
function pieceAt(event) {
    const element = event.target.closest(".piece");
    return element === null ? null : element.piece;
}



// ------------------------ SCROLLING AND ZOOMING ------------------------

const view = { x: 0, y: 0, zoom: 1 }; // how far the canvas is scrolled and how zoomed in

// move the pieces and grid to canvas position
function placeView() {
    world.setAttribute("transform", "translate(" + view.x + "," + view.y + ") scale(" + view.zoom + ")");
    canvas.style.backgroundSize = GRID_SIZE * view.zoom + "px " + GRID_SIZE * view.zoom + "px";
    canvas.style.backgroundPosition = view.x + "px " + view.y + "px";
}

// pointer position
function canvasPoint(event) {
    const point = canvas.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(world.getScreenCTM().inverse());
}

// scrolling and zooming
canvas.addEventListener("wheel", function (event) {
    event.preventDefault();
    const lines = event.deltaMode === 1 ? 16 : 1;
    const dx = event.deltaX * lines, dy = event.deltaY * lines;

    if (event.ctrlKey || event.metaKey) {
        // zoom
        const rect = canvas.getBoundingClientRect();
        const px = event.clientX - rect.left, py = event.clientY - rect.top;
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * Math.exp(-dy * ZOOM_SPEED)));

        view.x = px - (px - view.x) * zoom / view.zoom;
        view.y = py - (py - view.y) * zoom / view.zoom;
        view.zoom = zoom;
    } else {
        // scroll
        view.x -= dx;
        view.y -= dy;
    }
    placeView();
}, { passive: false });



// ------------------------ SNAPPING ------------------------

// each side of a piece on the canvas
function pieceSides(piece, x, y, angle) {
    const turn = angle * Math.PI / 180
    const cos = Math.cos(turn), sin = Math.sin(turn);

    // move vertices to x, y, turn to angle
    const points = pieceVertices(piece.bulges.length).map(function (v) {
        const vx = (piece.reflected ? -v.x : v.x) * CANVAS_PIECE_SIZE
        const vy =                     v.y        * CANVAS_PIECE_SIZE;
        return { x: x + vx*cos - vy*sin, y: y + vx*sin + vy*cos };
    });

    return piece.bulges.map(function (out, i) {
        return { a: points[i], b: points[(i + 1) % points.length], out: out };
    });
}

// where a piece snaps
function snapPlace(piece, x, y, angle) {
    const sides = pieceSides(piece, x, y, angle);
    let best = null;

    Array.from(world.children).forEach(function (element) {
        const other = element.piece;
        if (other === piece) return;

        const sameWay = piece.reflected !== other.reflected;

        pieceSides(other, other.x, other.y, other.angle).forEach(function (t) {
            sides.forEach(function (s, i) {
                if (s.out === t.out) return; // concave fits convex

                // if centers of the sides close enough
                const distance = Math.hypot((s.a.x + s.b.x - t.a.x - t.b.x) / 2, (s.a.y + s.b.y - t.a.y - t.b.y) / 2);
                if (distance > SNAP_DISTANCE || (best !== null && distance >= best.distance)) return;

                // turn so side lies against other side
                const to   = sameWay ? t.a : t.b;
                const from = sameWay ? t.b : t.a;
                const want = Math.atan2(from.y - to.y, from.x - to.x) * 180 / Math.PI;
                const have = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) * 180 / Math.PI;

                const turn = ((want - have) % 360 + 540) % 360 - 180; // between -180 and 180
                if (Math.abs(turn) > SNAP_TURN) return;

                best = { distance: distance, side: i, turn: turn, to: to };
            });
        });
    });
    if (best === null) return null;

    // turn, then move
    const turned = pieceSides(piece, x, y, angle + best.turn)[best.side].a;
    return { x: x + best.to.x - turned.x, y: y + best.to.y - turned.y, angle: angle + best.turn };
}



// ------------------------ DRAGGING ------------------------

let drag = null; // the piece being moved/turned, or if the canvas is being zoomed/scrolled
let lastTap = null; // the piece last pressed and when

// direction from a piece to a point
function dir(piece, point) {
    return Math.atan2(point.y - piece.y, point.x - piece.x) * 180 / Math.PI;
}

// drag a piece out of the sidebar
sidebar.addEventListener("pointerdown", function (event) {
    // detect piece targeted
    const item = event.target.closest(".sidebar-piece");
    if (event.button !== 0 || !event.isPrimary || item === null) return;
    event.preventDefault();

    // make piece
    const point = canvasPoint(event);
    const shape = shapes[Number(item.dataset.index)];
    const piece = makePiece(point.x, point.y, shape.reflected, shape.bulges.slice());
    piece.element.classList.add("dragging");
    drag = { piece: piece, turning: false, offsetX: 0, offsetY: 0, startAngle: 0 };
});

// start to turn/move a piece, or scroll the canvas
canvas.addEventListener("pointerdown", function (event) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();

    // drag empty space
    const piece = pieceAt(event);
    if (piece === null) {
        drag = { scrolling: true, startX: event.clientX - view.x, startY: event.clientY - view.y };
        canvas.classList.add("scrolling");
        return;
    }

    // second press on the same piece removes it
    if (lastTap !== null && lastTap.piece === piece && event.timeStamp - lastTap.time < DOUBLE_TAP_TIME) {
        lastTap = null;
        piece.element.remove();
        save();
        return;
    }
    lastTap = { piece: piece, time: event.timeStamp };
    const point = canvasPoint(event);

    if (event.target.classList.contains("rotate-dot")) drag = { piece: piece, turning: true, grab: null                                                                       }; // turn
    else                                               drag = { piece: piece, turning: false, offsetX: point.x - piece.x, offsetY: point.y - piece.y, startAngle: piece.angle }; // move
});
// turn/move a piece
document.addEventListener("pointermove", function (event) {
    // detect piece targeted
    if (drag === null || !event.isPrimary) return;
    if (drag.scrolling) {
        view.x = event.clientX - drag.startX;
        view.y = event.clientY - drag.startY;
        placeView();
        return;
    }
    const point = canvasPoint(event);
    const piece = drag.piece;

    if (drag.turning) {
        // turn around the dot
        if (Math.hypot(point.x - piece.x, point.y - piece.y) < DOT_RADIUS) return;
        if (drag.grab === null) drag.grab = dir(piece, point) - piece.angle;
        piece.angle = dir(piece, point) - drag.grab;
        if (snapAngle > 0) piece.angle = Math.round(piece.angle / snapAngle) * snapAngle;
    } else {
        piece.x = point.x - drag.offsetX;
        piece.y = point.y - drag.offsetY;
        piece.angle = drag.startAngle;

        // snap onto a piece
        const snap = snapPlace(piece, piece.x, piece.y, piece.angle);
        if (snap !== null) {
            piece.x = snap.x;
            piece.y = snap.y;
            piece.angle = snap.angle;
        }
    }

    piece.element.setAttribute("transform", "translate(" + piece.x + "," + piece.y + ") rotate(" + piece.angle + ")");
});
// end turning/moving a piece
document.addEventListener("pointerup", function (event) {
    if (drag === null || !event.isPrimary) return;
    const ended = drag;
    drag = null;

    if (ended.scrolling) canvas.classList.remove("scrolling");
    else {
        ended.piece.element.classList.remove("dragging");
        // under the pointer
        const under = document.elementFromPoint(event.clientX, event.clientY);
        if (!canvas.contains(under)) ended.piece.element.remove(); // if dropped in sidebar, remove
        save();
    }
});

// browser interrupts an event
document.addEventListener("pointercancel", function (event) {
    if (drag === null || !event.isPrimary) return;
    const ended = drag;
    drag = null;

    if (ended.scrolling) canvas.classList.remove("scrolling");
    else {
        ended.piece.element.classList.remove("dragging");
        save();
    }
});



// ------------------------ HISTORY ------------------------

let saves = [[]]; // every piece's position after each step
let step = 0; // which step of saves we are on

// every piece on the canvas
function snapshot() {
    return Array.from(world.children).map(function (element) {
        const piece = element.piece;
        return { x: piece.x, y: piece.y, angle: piece.angle, reflected: piece.reflected, bulges: piece.bulges };
    });
}

// remember canvas after a step
function save() {
    const state = snapshot();
    if (JSON.stringify(state) === JSON.stringify(saves[step])) return;

    // add to saves
    saves = saves.slice(0, step + 1);
    saves.push(state);
    if (saves.length > UNDO_LIMIT + 1) saves.shift();
    step = saves.length - 1;
    updateButtons();
    updateRoundness();
    store();
}

// restore the canvas to a step
function goTo(newStep) {
    step = newStep;
    world.replaceChildren();

    // update pieces and buttons
    saves[step].forEach(function (saved) {
        const piece = makePiece(saved.x, saved.y, saved.reflected, saved.bulges);
        piece.angle = saved.angle;
        piece.element.setAttribute("transform", "translate(" + piece.x + "," + piece.y + ") rotate(" + piece.angle + ")");
    });
    updateButtons();
    updateRoundness();
    store();
}

// remember the canvas and its undo/redo history
function store() {
    try { localStorage.setItem("polybends_canvas", JSON.stringify({ saves: saves, step: step })); } catch (error) {}
}

function updateButtons() {
    undoButton.disabled = step === 0;
    redoButton.disabled = step === saves.length - 1;
}

function undo() { if (step > 0)                  goTo(step - 1); }
function redo() { if (step < saves.length - 1) goTo(step + 1); }

undoButton.addEventListener("click", function () { undoButton.blur(); undo(); });
redoButton.addEventListener("click", function () { redoButton.blur(); redo(); });

// remove every piece
clearButton.addEventListener("click", function () {
    world.replaceChildren();
    save();
});

// keyboard shortcuts
document.addEventListener("keydown", function (event) {
    // cmd/ctrl+z to undo, not while dragging or while a popup is open
    if (!(event.metaKey || event.ctrlKey) || drag !== null) return;
    if (document.querySelector(".popup:not([hidden])")) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) undo();

    // shift+cmd/ctrl+z or ctrl+y to redo
    else if ((key === "z" && event.shiftKey) || key === "y") redo();

    else return;
    event.preventDefault();
});



// ------------------------ ROUNDNESS ------------------------

// roundness of shape on canvas
function updateRoundness() {
    const pieces = Array.from(world.children).map(function (element) { return element.piece; });
    roundnessText.hidden = pieces.length === 0; // hide if no pieces
    if (pieces.length === 0) return;

    // count each arc, subtract 2 for arcs that are joined
    const sides = pieces.map(function (piece) { return pieceSides(piece, piece.x, piece.y, piece.angle); });
    let arcs = 0;
    sides.forEach(function (list) { arcs += list.length; });
    for (let i = 0; i < sides.length; i++) {
        for (let j = i + 1; j < sides.length; j++) {
            sides[i].forEach(function (s) {
                sides[j].forEach(function (t) {
                    if (s.out !== t.out && joined(s, t)) arcs -= 2;
                });
            });
        }
    }

    // calculate roundness
    const num = 3 * pieces.length, den = arcs;

    // calculate gcd using euclidean algorithm
    let a = num, b = den;
    while (b !== 0) [a, b] = [b, a % b];
    const divisor = a;

    const numText = num / divisor;
    const denText = den / divisor === 1 ? "" : den / divisor;
    const frac = numText + "/" + denText + "π";
    roundnessText.textContent = "Roundness: " + frac + " ≈ " + (num / (den * Math.PI)).toFixed(3);
}

// are two sides connected
function joined(s, t) {
    function same(p, q) { return Math.hypot(p.x - q.x, p.y - q.y) < 1e-6; }
    return (same(s.a, t.a) && same(s.b, t.b)) || (same(s.a, t.b) && same(s.b, t.a));
}



// ------------------------ SIDEBAR ------------------------

// pentabend and mirror
function defaultShapes() {
    return [
        { bulges: alternatingBulges(DEFAULT_SIDES), reflected: false },
        { bulges: alternatingBulges(DEFAULT_SIDES), reflected: true  }
    ];
}

// each shape, with remove button
function drawSidebar() {
    shapeList.replaceChildren();
    shapes.forEach(function (shape, i) {
        const row = document.createElement("div");
        row.className = "sidebar-item";
        shapeList.appendChild(row);

        // make item
        const item = document.createElementNS(SVG_NS, "svg");
        item.classList.add("sidebar-piece");
        item.dataset.index = i;

        // add item
        item.appendChild(makeShape(shape.reflected, SIDEBAR_PIECE_SIZE, shape.bulges));
        row.appendChild(item);

        // fit picture to piece
        const box = item.getBBox();
        item.setAttribute("viewBox", (box.x - 1) + " " + (box.y - 1) + " " + (box.width + 2) + " " + (box.height + 2));
        item.setAttribute("width",                                            box.width + 2                          );
        item.setAttribute("height",                                                                   box.height + 2 );

        // remove button
        const remove = document.createElement("button");
        remove.className = "sidebar-remove";
        remove.setAttribute("aria-label", "Remove Shape");
        remove.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        remove.addEventListener("click", function () {
            shapes.splice(i, 1);
            storeShapes();
            drawSidebar();
        });
        row.prepend(remove);
    });
}

// remember sidebar contents
function storeShapes() {
    try { localStorage.setItem("polybends_sidebar", JSON.stringify(shapes)); } catch (error) {}
}



// ------------------------ SETTINGS POPUP ------------------------

// show dots switch
let showDots = true;

function setShowDots(on) {
    showDots = on;
    dotsToggle.setAttribute("aria-checked", on);
    document.body.classList.toggle("hide-dots", !on);
}
// save
dotsToggle.addEventListener("click", function () {
    setShowDots(!showDots);
    try { localStorage.setItem("polybends_show_dots", showDots); } catch (error) {}
});

// snap rotation
let snapAngle = 0;
snapInput.addEventListener("input", function () {
    const angle = Number(snapInput.value);
    if (!Number.isFinite(angle) || angle < 0 || angle > 180) return; // in range
    snapAngle = angle;
    try { localStorage.setItem("polybends_snap_angle", snapAngle); } catch (error) {} // save
});
snapInput.addEventListener("change", function () { snapInput.value = snapAngle; }); // reject out of range numbers



// ------------------------ NEW SHAPE POPUP ------------------------

// preview of the new shape, a button on each arc that flips the bulge
function drawPreview() {
    shapePreview.replaceChildren(makeShape(false, 1, bulgesOut));

    const vertices = pieceVertices(bulgesOut.length);
    bulgesOut.forEach(function (out, i) {
        const a = vertices[i], b = vertices[(i + 1) % vertices.length];
        const nx = -(b.y-a.y), ny = b.x-a.x; // normals pointing into shape
        const side = out ? 1 : -1; // inside if bulge is out, outside if it bulges in

        // button
        const button = document.createElementNS(SVG_NS, "circle");
        button.classList.add("arc-button");
        button.setAttribute("cx", (a.x + b.x) / 2 + nx * ARC_BUTTON_OFFSET * side);
        button.setAttribute("cy", (a.y + b.y) / 2 + ny * ARC_BUTTON_OFFSET * side);
        button.setAttribute("r", ARC_BUTTON_RADIUS);
        button.addEventListener("click", function () {
            bulgesOut[i] = !bulgesOut[i];
            drawPreview();
        });
        shapePreview.appendChild(button);
    });
    fitPreview();
}

// fit preview to the shape
function fitPreview() {
    const box = shapePreview.getBBox();
    if (box.width === 0) return;
    shapePreview.setAttribute("viewBox", (box.x - 0.05) + " " + (box.y - 0.05) + " " + (box.width + 0.1) + " " + (box.height + 0.1));
}

// number of sides
sidesInput.addEventListener("input", function () {
    const sides = Number(sidesInput.value);
    if (!Number.isInteger(sides) || sides < 3 || sides > MAX_SIDES) return; // needs integer in range
    bulgesOut = alternatingBulges(sides);
    drawPreview();
});
sidesInput.addEventListener("change", function () { sidesInput.value = bulgesOut.length; }); // reject out of range numbers

// add mirrored switch
mirrorToggle.addEventListener("click", function () {
    addMirrored = !addMirrored;
    mirrorToggle.setAttribute("aria-checked", addMirrored);
});

// add button
addShapeDone.addEventListener("click", function () {
    shapes.push({ bulges: bulgesOut.slice(), reflected: false });
    if (addMirrored) shapes.push({ bulges: bulgesOut.slice(), reflected: true });
    storeShapes();
    drawSidebar();
});



// ------------------------ START ------------------------

// restore sidebar and settings from last time
try {
    const saved = JSON.parse(localStorage.getItem("polybends_sidebar"));
    const valid = Array.isArray(saved) && saved.every(function (shape) { // shape is ok
        return shape && Array.isArray(shape.bulges) && shape.bulges.length >= 3 && shape.bulges.length <= MAX_SIDES;
    });
    if (valid) shapes = saved.map(function (shape) { return { bulges: shape.bulges.map(Boolean), reflected: Boolean(shape.reflected) }; });
} catch (error) {}
try { showDots = localStorage.getItem("polybends_show_dots") !== "false"; } catch (error) {}
setShowDots(showDots);
try {
    const saved = Number(localStorage.getItem("polybends_snap_angle"));
    if (Number.isFinite(saved) && saved >= 0 && saved <= 180) snapAngle = saved;
} catch (error) {}
snapInput.value = snapAngle;

// shape
sidesInput.value = bulgesOut.length;
sidesInput.max   = MAX_SIDES;
shapeList.style.gap = SIDEBAR_PIECE_GAP + "px";
drawSidebar();
drawPreview();

// restore canvas from last time
try {
    const stored = JSON.parse(localStorage.getItem("polybends_canvas"));
    if (stored && Array.isArray(stored.saves) && stored.saves.length > 0 && Number.isInteger(stored.step) && stored.step >= 0 && stored.step < stored.saves.length) {
        saves = stored.saves;
        goTo(stored.step);
    }
} catch (error) {
    // the entry is broken, so start again
    saves = [[]];
    step = 0;
    world.replaceChildren();
    updateButtons();
}
updateRoundness();
placeView();

// popups, then fit preview
setUpPopups(STORAGE_KEY);
setUpPopup(newShape, addShape);
addShape.addEventListener("click", fitPreview);
