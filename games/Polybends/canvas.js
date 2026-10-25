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

// pinch to zoom on phones
const fingers = new Map();
let pinch = null;

// middle of two fingers on canvas, how far apart
function pinchSpot() {
    const [a, b] = Array.from(fingers.values());
    const rect = canvas.getBoundingClientRect();
    return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top, apart: Math.hypot(a.x - b.x, a.y - b.y) };
}

// zoom
canvas.addEventListener("pointerdown", function (event) {
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (fingers.size !== 2) return;

    // second finger means to zoom out
    stopDrag();
    const spot = pinchSpot();
    pinch = {
        apart: spot.apart,
        zoom: view.zoom,
        x: (spot.x - view.x) / view.zoom, // point between fingers
        y: (spot.y - view.y) / view.zoom
    };
});
// scroll
document.addEventListener("pointermove", function (event) {
    if (!fingers.has(event.pointerId)) return;
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch === null || fingers.size !== 2) return;

    const spot = pinchSpot();
    view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.zoom * spot.apart / pinch.apart));
    view.x = spot.x - pinch.x * view.zoom;
    view.y = spot.y - pinch.y * view.zoom;
    placeView();
});
// stop
function liftFinger(event) {
    fingers.delete(event.pointerId);
    if (fingers.size < 2) pinch = null;
}
document.addEventListener("pointerup",     liftFinger);
document.addEventListener("pointercancel", liftFinger);



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
    if (drag.turning) canvas.classList.add("turning"); // rotate cursor until let go
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
        if (ended.turning) canvas.classList.remove("turning");
        // under the pointer
        const under = document.elementFromPoint(event.clientX, event.clientY);
        if (!canvas.contains(under)) ended.piece.element.remove(); // if dropped in sidebar, remove
        save();
    }
});

// stop dragging
function stopDrag() {
    if (drag === null) return;
    const ended = drag;
    drag = null;

    if (ended.scrolling) canvas.classList.remove("scrolling");
    else {
        ended.piece.element.classList.remove("dragging");
        if (ended.turning) canvas.classList.remove("turning");
        save();
    }
}

// browser interrupts an event
document.addEventListener("pointercancel", function (event) {
    if (event.isPrimary) stopDrag();
});
