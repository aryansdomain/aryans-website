// ------------------------ SETTINGS ------------------------

const SUBBOX_HOVER_TIME = 300; // time hover glow takes to fade in or out (same as box-shadow transition in style.css)



// ------------------------ STATE ------------------------

// mouse, for hovering subboxes like boxes
let hoverPointer = null; // where the mouse is on the screen
home.addEventListener("pointermove", function (event) {
    hoverPointer = { x: event.clientX, y: event.clientY };
});
home.addEventListener("pointerleave", function () { hoverPointer = null; });



// ------------------------ UTILITIES ------------------------

// hover glow and border in unfiltered layer, under label
function makeHoverShapes() {
    const glow = document.createElementNS(SVG_NS, "rect");
    glow.setAttribute("filter", "url(#subbox-glow)");
    glow.style.fill = "#000";

    const border = document.createElementNS(SVG_NS, "rect");
    border.style.fill = "none";
    border.style.stroke = "var(--text)";
    border.style.strokeWidth = "1";

    for (const shape of [glow, border]) {
        shape.style.opacity = 0;
        liquidLabels.appendChild(shape);
    }
    return { glow: glow, border: border };
}

// parent/finished subbox under the mouse
function hoveredShape() {
    if (hoverPointer === null) return null;
    return shapeAt(hoverPointer);
}

// parent/finished subbox at a point on the screen
function shapeAt(point) {
    if (liquidParent === null) return null;
    const rect = home.getBoundingClientRect();
    const x = (point.x - rect.left - worldCamera.x) / worldCamera.scale; // in the world
    const y = (point.y - rect.top  - worldCamera.y) / worldCamera.scale;

    return [liquidParent].concat(blobs).find(function (shape) {
        if (shape !== liquidParent && shape.phase !== "settle" && shape.phase !== "extended") return false;
        return Math.abs(x - shape.x) <= shape.width / 2 && Math.abs(y - shape.y) <= shape.height / 2;
    }) || null;
}



// ------------------------ FOR SUBCATS.JS ------------------------

// fade hover in on the subbox
function updateHover(dt) {
    const hovered = hoveredShape();
    [liquidParent].concat(blobs).forEach(function (shape) {
        const step = dt / SUBBOX_HOVER_TIME;
        shape.hover = shape === hovered ? Math.min(1, shape.hover + step) : Math.max(0, shape.hover - step);
    });
    home.style.cursor = hovered ? "pointer" : "";
}

function drawHovers() {
    drawHover(liquidParent);
    blobs.forEach(function (blob) { drawHover(blob); });
}



// ------------------------ DRAWING ------------------------

// hover glow, and border
function drawHover(shape) {
    setAttributes(shape.hoverShapes.glow, {
        x: shape.x - shape.width / 2,
        y: shape.y - shape.height / 2,
        width:  shape.width,
        height: shape.height
    });
    setAttributes(shape.hoverShapes.border, {
        x: shape.x - shape.width / 2 - 0.5,
        y: shape.y - shape.height / 2 - 0.5,
        width:  shape.width + 1,
        height: shape.height + 1
    });
    shape.hoverShapes.glow.style.opacity   = shape.hover;
    shape.hoverShapes.border.style.opacity = shape.hover;
}
