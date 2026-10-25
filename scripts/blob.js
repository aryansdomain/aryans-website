// ------------------------ SETTINGS ------------------------

const EXTEND_TIME  = 600; // time subboxes take to come out of  their box
const RETRACT_TIME = 450; // time subboxes take to go back into their box
const LABEL_TIME   = 300; // time labels take to fade in or out

const EXTEND_BOX_AT   = 0.4; // fraction of extending time at which the blob has become a rectangle
const RETRACT_BLOB_AT = 0.9; // fraction of retracting time at which the subbox has become a blob
const RESHAPE_TIME    = 0.2; // fraction of extending or retracting time spent changing between rectangle and blob

const BLOB_SIZE = 1; // diameter of blob between box and subbox, compared to its subbox's height

// SUSPENDING
const SUSPEND_DRIFT = 5;     // how far subboxes drift while hanging there
const SUSPEND_PERIOD = 3800; // time one drift loop takes



// ------------------------ UTILITIES ------------------------

// how far out a blob is
function outAmount(blob) {
    if (blob.phase === "retract" || blob.phase === "retracted") return 1 - smoothstep(Math.min(1, blob.retractProgress * 2));
    if (blob.phase === "extend") return smoothstep(blob.progress);
    return 1;
}

function smoothstep(u) {
    return u * u * (3 - 2 * u);
}

// whether a blob has finished extending/retracting
function isSettled(blob) {
    return blob.phase === "extended" || blob.phase === "retracted";
}



// ------------------------ FILTER ------------------------

// border of the liquid filter
function setLiquidBorderAlpha() {
    const boxBorderAlpha = (function () {
        const parts = getComputedStyle(document.documentElement).getPropertyValue("--box-border").match(/[\d.]+/g);
        return parts && parts.length === 4 ? parseFloat(parts[3]) : 1;
    })();
    document.getElementById("liquid-border-alpha").setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 " + boxBorderAlpha + " 0");
}



// ------------------------ SHAPE ------------------------

// how far a (sub)box reaches from its center along direction
function reach(size, dir) {
    return Math.abs(dir.x) * size.width / 2 + Math.abs(dir.y) * size.height / 2;
}

// where on the parent's edge a blob leaves from
function leavingPoint(blob, origin, parent) {
    let dx = blob.targetX - origin.x, dy = blob.targetY - origin.y;
    const distance = Math.hypot(dx, dy) || 1;
    dx /= distance;
    dy /= distance;
    const edgeDistance = reach({ width: parent.width, height: parent.height }, { x: dx, y: dy });
    return { dx: dx, dy: dy, x: origin.x + dx * edgeDistance, y: origin.y + dy * edgeDistance };
}

// shape when a complete subbox
function finishedSubbox(blob) {
    return {
        x: blob.targetX, y: blob.targetY,
        width: blob.targetWidth, height: blob.targetHeight,
        cornerRadius: 0,
        liquidity: 0
    };
}

// calculate blob's shape from progress
function shapeBlob(blob, origin, parent, from, r, rectUntil, blobFrom) {
    const edge = leavingPoint(blob, origin, parent);
    const radius = BLOB_SIZE * blob.targetHeight / 2;
    const rounding = Math.max(0, Math.min(1, (r - rectUntil) / (blobFrom - rectUntil))); // 0 = from shape, 1 = blob

    const travel = Math.pow(Math.min(1, r / 0.8), 2);
    const round = easeOut(rounding);
    const sink = r > 0.8 ? easeOut((r - 0.8) / 0.2) : 0;
    const shrink = sink * sink;
    const melt   = easeOut(Math.min(1, rounding / 0.6));
    const crisp  = r > 0.9 ? (r - 0.9) / 0.1 : 0;

    // slides into the parent
    blob.x = lerp(from.x, edge.x, travel) - edge.dx * radius * sink;
    blob.y = lerp(from.y, edge.y, travel) - edge.dy * radius * sink;
    blob.width  = lerp(from.width,  2 * radius, round) * (1 - shrink);
    blob.height = lerp(from.height, 2 * radius, round) * (1 - shrink);
    blob.cornerRadius = Math.min(lerp(from.cornerRadius, radius, round) * (1 - shrink), blob.width / 2, blob.height / 2);
    blob.liquidity = lerp(from.liquidity, 1, melt) * (1 - crisp);
}



// ------------------------ LIFE ------------------------

// birth
function makeBlob(origin, target) {
    return {
              x: origin.x,       y: origin.y,
        targetX: target.x, targetY: target.y,

              width: 0,            height: 0,
        targetWidth: target.width, targetHeight: target.height,

        cornerRadius: 0,
        opacity: 0, // of label

        phase: "extend", // extend -> settle -> extended -> retract -> retracted
        progress: 0, // how far along
        liquidity: 0, // how "gooey" it is

        // drift a little whiel suspended
        driftPhase: Math.random() * Math.PI * 2,
        driftPeriod: SUSPEND_PERIOD * (0.8 + Math.random() * 0.4)
    };
}

// send blob back to parent
function retractBlob(blob) {
    if (blob.phase === "retract" || blob.phase === "retracted") return;
    blob.phase = "retract";
    blob.retractProgress = 0;
    blob.from = {
        x: blob.x, y: blob.y,
        width: blob.width, height: blob.height,
        cornerRadius: blob.cornerRadius,
        liquidity: blob.liquidity
    };
}

// move blob, depending on what its phase is
function stepBlob(blob, origin, parent, dt, time) {
    if (blob.phase === "extend") {
        blob.progress = Math.min(1, blob.progress + dt / EXTEND_TIME);
        blob.opacity = Math.max(0, Math.min(blob.opacity + dt / LABEL_TIME, 2 * blob.progress - 1)); // fade in label
        if (blob.progress === 1) blob.phase = "settle";

    } else if (blob.phase === "settle") {
        blob.opacity = Math.min(1, blob.opacity + dt / LABEL_TIME);
        if (blob.opacity === 1) blob.phase = "extended";

    // retracting
    } else if (blob.phase === "retract") {
        blob.retractProgress = Math.min(1, blob.retractProgress + dt / RETRACT_TIME);

        // fade out label
        blob.opacity = Math.max(0, Math.min(blob.opacity - dt / LABEL_TIME, 1 - 2 * blob.retractProgress));
        if (blob.retractProgress === 1) blob.phase = "retracted";
    }

    // control drift, not when retracting or retracted
    if (blob.phase === "retract" || blob.phase === "retracted")
        shapeBlob(blob, origin, parent, blob.from, blob.retractProgress, RETRACT_BLOB_AT - RESHAPE_TIME, RETRACT_BLOB_AT);
    else {
        shapeBlob(blob, origin, parent, finishedSubbox(blob), 1 - blob.progress, 1 - EXTEND_BOX_AT, 1 - EXTEND_BOX_AT + RESHAPE_TIME);

        // drift
        const drift = SUSPEND_DRIFT * outAmount(blob);
        const angle = 2 * Math.PI * time / blob.driftPeriod + blob.driftPhase;
        blob.x += Math.cos(angle) * drift;
        blob.y += Math.sin(2 * angle) * drift / 2;
    }
}
