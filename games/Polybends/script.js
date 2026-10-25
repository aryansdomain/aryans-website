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



// ------------------------ PAGE ------------------------

const SVG_NS = "http://www.w3.org/2000/svg";

const STORAGE_KEY = "polybends_intro_seen"; // localStorage key

const sidebar      = document.getElementById("sidebar");
const canvas       = document.getElementById("canvas");
const undoButton   = document.getElementById("undo");
const redoButton   = document.getElementById("redo");
const clearButton  = document.getElementById("clear");
const dotsToggle   = document.querySelector(".dots-toggle");
const shapePreview = document.getElementById("shape-preview");
const sidesInput   = document.getElementById("sides");
const snapInput    = document.getElementById("snap");

// everything on the canvas
const world = document.createElementNS(SVG_NS, "g");
canvas.appendChild(world);

// which sides of new pieces bulge out
let bulgesOut = alternatingBulges(DEFAULT_SIDES);



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
    const piece = makePiece(point.x, point.y, item.dataset.reflected === "true", bulgesOut.slice());
    piece.element.classList.add("dragging");
    drag = { piece: piece, turning: false, offsetX: 0, offsetY: 0 };
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

    if (event.target.classList.contains("rotate-dot")) drag = { piece: piece, turning: true, grab: null                                              }; // turn
    else                                               drag = { piece: piece, turning: false, offsetX: point.x - piece.x, offsetY: point.y - piece.y }; // move
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
    }

    piece.element.setAttribute("transform", "translate(" + piece.x + "," + piece.y + ") rotate(" + piece.angle + ")");
});
// end turning/moving a piece
document.addEventListener("pointerup", function (event) {
    if (drag === null || !event.isPrimary) return;

    if (drag.scrolling) canvas.classList.remove("scrolling");
    else {
        drag.piece.element.classList.remove("dragging");
        // under the pointer
        const under = document.elementFromPoint(event.clientX, event.clientY);
        if (!canvas.contains(under)) drag.piece.element.remove(); // if dropped in sidebar, remove
        save();
    }
    drag = null;
});

// browser interrupts an event
document.addEventListener("pointercancel", function (event) {
    if (drag === null || !event.isPrimary) return;
    if (drag.scrolling) canvas.classList.remove("scrolling");
    else {
        drag.piece.element.classList.remove("dragging");
        save();
    }
    drag = null;
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



// ------------------------ SIDEBAR ------------------------

// one of each piece
function drawSidebar() {
    sidebar.replaceChildren();
    [false, true].forEach(function (reflected) {
        // make item
        const item = document.createElementNS(SVG_NS, "svg");
        item.classList.add("sidebar-piece");
        item.dataset.reflected = reflected;

        // add item
        item.appendChild(makeShape(reflected, SIDEBAR_PIECE_SIZE, bulgesOut));
        sidebar.appendChild(item);

        // fit picture to piece
        const box = item.getBBox();
        item.setAttribute("viewBox", (box.x - 1) + " " + (box.y - 1) + " " + (box.width + 2) + " " + (box.height + 2));
        item.setAttribute("width",                                            box.width + 2                          );
        item.setAttribute("height",                                                                   box.height + 2 );
    });
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

// preview of the current polybend, a button on each arc that flips the bulge
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
            drawShape();
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

// redraw everything that shows the shape
function drawShape() {
    drawSidebar();
    drawPreview();
    try { localStorage.setItem("polybends_shape", JSON.stringify(bulgesOut)); } catch (error) {} // save
}

// number of sides
sidesInput.addEventListener("input", function () {
    const sides = Number(sidesInput.value);
    if (!Number.isInteger(sides) || sides < 3 || sides > MAX_SIDES) return; // needs integer in range
    bulgesOut = alternatingBulges(sides);
    drawShape();
});
sidesInput.addEventListener("change", function () { sidesInput.value = bulgesOut.length; }); // reject out of range numbers



// ------------------------ START ------------------------

// restore settings from last time
try {
    const saved = JSON.parse(localStorage.getItem("polybends_shape"));
    if (Array.isArray(saved) && saved.length >= 3 && saved.length <= MAX_SIDES) bulgesOut = saved.map(Boolean);
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
sidebar.style.gap = SIDEBAR_PIECE_GAP + "px";
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
placeView();

// popups, then fit preview
setUpPopups(STORAGE_KEY);
document.querySelector(".settings-button").addEventListener("click", fitPreview);
