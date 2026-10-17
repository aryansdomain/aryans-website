// ------------------------ SETTINGS ------------------------

const EXTEND_TIME  = 600; // ms   time subboxes take to come out of  their box
const RETRACT_TIME = 450; // ms   time subboxes take to go back into their box
const LABEL_TIME   = 300; // ms   time labels take to fade in or out

const EXTEND_BOX_AT   = 0.4; // fraction of extending time at which the blob has become a rectangle
const RETRACT_BLOB_AT = 0.9; // fraction of retracting time at which the subbox has become a blob
const RESHAPE_TIME    = 0.2; // fraction of extending or retracting time spent changing between rectangle and blob

const BLOB_SIZE = 1; // diameter of blob between box and subbox, compared to its subbox's height

const GOO_BLUR = 1; // px   how far apart shapes can be and still join



// ------------------------ STATE ------------------------

const SVG_NS = "http://www.w3.org/2000/svg";
const liquidShapes = document.getElementById("liquid-shapes");
const liquidLabels = document.getElementById("liquid-labels");

// goo filter
liquidShapes.setAttribute("filter", "url(#goo)");
const gooBlur = document.querySelector("#goo feGaussianBlur");

// one blob per subcategory, each turning into a subbox
let blobs = [];
let liquidParent = null; // box the blobs come out of



// ------------------------ UTILITIES ------------------------

// silhouette for gooey filter
function makeSilhouette(tag) {
    const shape = document.createElementNS(SVG_NS, tag);
    shape.style.fill = "#000";
    liquidShapes.appendChild(shape);
    return shape;
}

// label in unfiltered layer
function makeLabel(text) {
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("dominant-baseline", "central");
    label.style.fill = "var(--text)";
    label.textContent = text;
    liquidLabels.appendChild(label);
    return label;
}

function setAttributes(element, attributes) {
    for (const name in attributes) element.setAttribute(name, attributes[name]);
}

// font of box's label, scaled
function boxFont(box, scale) {
    const style = getComputedStyle(box);
    return style.fontWeight + " " + parseFloat(style.fontSize) * scale + "px " + style.fontFamily;
}



// ------------------------ FOR HOME.JS ------------------------

// make blobs for the subcategories in layout, starting inside parent and heading to their planned centers
function spawnSubcats(parent, layout) {
    clearBlobs();
    const origin = getBoxCenter(parent, false);

    // draw box here
    liquidParent = {
        box: parent,
        width: layout.box.width, height: layout.box.height,
        shape: makeSilhouette("rect"),
        text: makeLabel(parent.textContent.trim())
    };
    liquidParent.text.style.font = boxFont(parent, 1);
    liquidParent.text.style.letterSpacing = getComputedStyle(parent).letterSpacing;
    parent.classList.add("liquid");

    blobs = layout.subboxes.map(function (subbox) {
        const blob = {
            id:     subbox.id,
            parent: subbox.parent,
            label:  subbox.label,

                  x:        origin.x,       y:        origin.y,
            targetX: subbox.center.x, targetY: subbox.center.y,

                  width: 0,                  height: 0,
            targetWidth: subbox.width, targetHeight: subbox.height,

            cornerRadius: 0,
            opacity: 0, // of label

            phase: "extend", // extend -> settle -> extended -> retract -> retracted
            progress: 0,     // 0 = inside parent, 1 = at target
            gooiness: 0,     // 0 = crisp, 1 = fully liquid

            bodyShape: makeSilhouette("rect"),
            text: makeLabel(subbox.label)
        };
        blob.text.style.font = boxFont(parent, subbox.height / layout.box.height);
        blob.text.style.letterSpacing = getComputedStyle(parent).letterSpacing;
        return blob;
    });
    updateLiquid(0);
}

// send all blobs back to parents
function retractSubcats() {
    blobs.forEach(function (blob) {
        if (blob.phase === "retract" || blob.phase === "retracted") return;
        blob.phase = "retract";
        blob.retractProgress = 0;
        blob.from = {
            x: blob.x, y: blob.y,
            width: blob.width, height: blob.height,
            cornerRadius: blob.cornerRadius,
            gooiness: blob.gooiness
        };
    });
}

// move blobs
function updateLiquid(dt) {
    if (blobs.length === 0) return;
    const origin = getBoxCenter(liquidParent.box, false);

    blobs.forEach(function (blob) {
        if (blob.phase === "extend") {
            blob.progress = Math.min(1, blob.progress + dt / EXTEND_TIME);
            blob.opacity = Math.max(0, Math.min(blob.opacity + dt / LABEL_TIME, 2 * blob.progress - 1)); // label fades in from halfway
            if (blob.progress === 1) blob.phase = "settle";
        } else if (blob.phase === "settle") {
            blob.opacity = Math.min(1, blob.opacity + dt / LABEL_TIME);
            if (blob.opacity === 1) blob.phase = "extended";
        } else if (blob.phase === "retract") {
            blob.retractProgress = Math.min(1, blob.retractProgress + dt / RETRACT_TIME);

            // fade out label, gone by halfway
            blob.opacity = Math.max(0, Math.min(blob.opacity - dt / LABEL_TIME, 1 - 2 * blob.retractProgress));
            if (blob.retractProgress === 1) blob.phase = "retracted";
        }

        if (blob.phase === "retract" || blob.phase === "retracted") shapeBlob(blob, origin, blob.from, blob.retractProgress, RETRACT_BLOB_AT - RESHAPE_TIME, RETRACT_BLOB_AT);
        else shapeBlob(blob, origin, finishedSubbox(blob), 1 - blob.progress, 1 - EXTEND_BOX_AT, 1 - EXTEND_BOX_AT + RESHAPE_TIME);
    });

    // all back inside
    if (blobs.every(function (blob) { return blob.phase === "retracted"; })) {
        clearBlobs();
        return;
    }
    drawLiquid(origin);
}

// smallest rectangle around blobs
function getLiquidBounds() {
    if (blobs.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    blobs.forEach(function (blob) {
        const halfWidth  = blob.width  / 2;
        const halfHeight = blob.height / 2;

        minX = Math.min(minX, blob.x - halfWidth);
        minY = Math.min(minY, blob.y - halfHeight);
        maxX = Math.max(maxX, blob.x + halfWidth);
        maxY = Math.max(maxY, blob.y + halfHeight);
    });

    return {
        minX, minY,
        maxX, maxY,
        centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2,
        width: maxX - minX, height: maxY - minY
    };
}

// whether every blob has finished coming out or going back in
function isStable() {
    return blobs.every(function (blob) { return blob.phase === "extended" || blob.phase === "retracted"; });
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
        gooiness: 0
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
    blob.gooiness = lerp(from.gooiness, 1, melt) * (1 - crisp);
}



// ------------------------ DRAWING ------------------------

function drawLiquid(origin) {
    const gooiness = Math.max.apply(null, blobs.map(function (blob) { return blob.gooiness; }));
    gooBlur.setAttribute("stdDeviation", Math.max(0.01, GOO_BLUR * gooiness));

    // parent, following the ring
    setAttributes(liquidParent.shape, {
        x: origin.x - liquidParent.width / 2,
        y: origin.y - liquidParent.height / 2,
        width: liquidParent.width,
        height: liquidParent.height
    });
    setAttributes(liquidParent.text, { x: origin.x, y: origin.y });

    blobs.forEach(function (blob) {
        setAttributes(blob.bodyShape, {
            x: blob.x - blob.width / 2,
            y: blob.y - blob.height / 2,
            width:  blob.width,
            height: blob.height,
            rx: blob.cornerRadius
        });

        // keep label upright
        blob.text.setAttribute("x", blob.x);
        blob.text.setAttribute("y", blob.y);
        blob.text.style.opacity = blob.opacity;
    });
}

function clearBlobs() {
    if (liquidParent !== null) liquidParent.box.classList.remove("liquid"); // draw box again
    blobs = [];
    liquidParent = null;
    liquidShapes.replaceChildren();
    liquidLabels.replaceChildren();
}
