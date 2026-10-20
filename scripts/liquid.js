// ------------------------ SETTINGS ------------------------

const EXTEND_BOX_AT   = 0.4; // fraction of extending time at which the blob has become a rectangle
const RETRACT_BLOB_AT = 0.9; // fraction of retracting time at which the subbox has become a blob
const RESHAPE_TIME    = 0.2; // fraction of extending or retracting time spent changing between rectangle and blob

const BLOB_SIZE = 1; // diameter of blob between box and subbox, compared to its subbox's height

const LIQUID_BLUR = 1; // px   how far apart shapes can be and still join



// ------------------------ STATE ------------------------

const SVG_NS = "http://www.w3.org/2000/svg";
const liquidShapes    = document.getElementById("liquid-shapes");
const liquidLabels    = document.getElementById("liquid-labels");

// liquid filter
liquidShapes.setAttribute("filter", "url(#liquid-filter)");
const liquidBlur = document.querySelector("#liquid-filter feGaussianBlur");

// chromatic aberration toward screen edges
const splitRed  = smoothOffset(document.querySelector("#liquid-filter .split-red") )
const splitBlue = smoothOffset(document.querySelector("#liquid-filter .split-blue"));

const boxBorderAlpha = (function () {
    const parts = getComputedStyle(document.documentElement).getPropertyValue("--box-border").match(/[\d.]+/g);
    return parts && parts.length === 4 ? parseFloat(parts[3]) : 1;
})();
document.getElementById("liquid-border-alpha").setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 " + boxBorderAlpha + " 0");



// ------------------------ UTILITIES ------------------------

// silhouette for liquid filter
function makeSilhouette(tag) {
    const shape = document.createElementNS(SVG_NS, tag);
    shape.style.fill = "#000";
    liquidShapes.appendChild(shape);
    return shape;
}

function setAttributes(element, attributes) {
    for (const name in attributes) element.setAttribute(name, attributes[name]);
}



// ------------------------ SHAPE ------------------------

// where on the parent's edge a blob leaves from
function leavingPoint(blob, origin) {
    let dx = blob.targetX - origin.x, dy = blob.targetY - origin.y;
    const distance = Math.hypot(dx, dy) || 1;
    dx /= distance;
    dy /= distance;
    const edgeDistance = reach({ width: liquidParent.width, height: liquidParent.height }, { x: dx, y: dy });
    return { dx: dx, dy: dy, x: origin.x + dx * edgeDistance, y: origin.y + dy * edgeDistance };
}

// how a blob looks once it's a finished subbox
function finishedSubbox(blob) {
    return {
        x: blob.targetX, y: blob.targetY,
        width: blob.targetWidth, height: blob.targetHeight,
        cornerRadius: 0,
        liquidity: 0
    };
}

// calculate blob's shape from its progress
function shapeBlob(blob, origin, from, r, rectUntil, blobFrom) {
    const edge = leavingPoint(blob, origin);
    const radius = BLOB_SIZE * blob.targetHeight / 2;
    const rounding = Math.max(0, Math.min(1, (r - rectUntil) / (blobFrom - rectUntil))); // 0 = from shape, 1 = blob

    const travel = Math.pow(Math.min(1, r / 0.8), 2);          // to the edge: first 80%, speeding up so it doesn't stall before collapsing
    const round  = easeOut(rounding);                          // into a blob: between rectUntil and blobFrom
    const sink   = r > 0.8 ? easeOut((r - 0.8) / 0.2) : 0;     // into the parent once at the edge: last 20%, fast then slowing
    const shrink = sink * sink;                                // shrinks only near the end, mostly it sinks in
    const melt   = easeOut(Math.min(1, rounding / 0.6));       // liquid: over the first 60% of rounding
    const crisp  = r > 0.9 ? (r - 0.9) / 0.1 : 0;              // crisp: last 10%, once it's almost all inside

    // slides to the edge, then sinks past it into the parent, where the parent's shape hides it
    blob.x = lerp(from.x, edge.x, travel) - edge.dx * radius * sink;
    blob.y = lerp(from.y, edge.y, travel) - edge.dy * radius * sink;
    blob.width  = lerp(from.width,  2 * radius, round) * (1 - shrink);
    blob.height = lerp(from.height, 2 * radius, round) * (1 - shrink);
    blob.cornerRadius = Math.min(lerp(from.cornerRadius, radius, round) * (1 - shrink), blob.width / 2, blob.height / 2);
    blob.liquidity = lerp(from.liquidity, 1, melt) * (1 - crisp);
}



// ------------------------ DRAWING ------------------------

function drawLiquid(origin) {
    const liquidity = Math.max.apply(null, blobs.map(function (blob) { return blob.liquidity; }));
    liquidBlur.setAttribute("stdDeviation", Math.max(0.01, LIQUID_BLUR * liquidity));
    splitByLens(origin);

    // parent, following the ring
    setAttributes(liquidParent.shape, {
        x: origin.x - liquidParent.width / 2,
        y: origin.y - liquidParent.height / 2,
        width: liquidParent.width,
        height: liquidParent.height
    });

    blobs.forEach(function (blob) {
        setAttributes(blob.bodyShape, {
            x: blob.x - blob.width / 2,
            y: blob.y - blob.height / 2,
            width:  blob.width,
            height: blob.height,
            rx: blob.cornerRadius
        });
    });
}

// split the border
function splitByLens(origin) {
    let split = { x: 0, y: 0 };
    [origin].concat(blobs).forEach(function (spot) {
        const x = spot.x * worldCamera.scale + worldCamera.x; // on the screen
        const y = spot.y * worldCamera.scale + worldCamera.y;
        const here = lensSplit(x, y, 1);
        if (Math.hypot(here.x, here.y) > Math.hypot(split.x, split.y)) split = here;
    });
    setSplit(split.x, split.y);
}

// red and blue movement
function setSplit(dx, dy) {
    splitRed ( dx,  dy);
    splitBlue(-dx, -dy);
}

// take away all liquid shapes
function clearLiquid() {
    setSplit(0, 0);
    liquidShapes.replaceChildren();
}
