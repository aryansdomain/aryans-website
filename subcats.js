// ------------------------ SETTINGS ------------------------

const EXTEND_TIME  = 600; // ms   time subboxes take to come out of  their box
const RETRACT_TIME = 450; // ms   time subboxes take to go back into their box
const LABEL_TIME   = 300; // ms   time labels take to fade in or out

// LAYOUT
const SUBBOX_SCALE = 0.8;        //      size of subboxes compared to their box
const SUBBOX_GAP = 24;           // px   space between subboxes
const FIRST_SUBBOX_GAP = 56;     // px   space between a box and its first subbox
const MIN_FIRST_SUBBOX_GAP = 16; // px   smallest that space shrinks to in emergencies (longest subbox is still too close to the screen's edge)

// SUSPENDING
const SUSPEND_DRIFT = 5;     // px   how far subboxes drift while hanging there
const SUSPEND_PERIOD = 3800; // ms   time one drift loop takes



// ------------------------ SUBCATEGORIES ------------------------

// labels for subcategories in order
const subcats = {
    writing: ["Essays", "Short Stories", "Poetry"],
    research: ["2026", "2027"],
    games: ["Wörtel"]
};

// pages boxes with no subcategories open directly
const boxLinks = {
    about: "about/"
};

// pages subcategories open
const subcatLinks = {
    games: { "Wörtel": "games/Wörtel/" }
};

function getSubcats(box) {
    const parent = box.dataset.cat;
    return subcats[parent].map(function (label) {
        return {
            id: parent + "-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            label: label,
            parent: parent,
            link: (subcatLinks[parent] || {})[label] || null
        };
    });
}



// ------------------------ LAYOUT ------------------------

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



// ------------------------ STATE ------------------------

// one blob per subcategory, each turning into a subbox
let blobs = [];
let liquidParent = null; // box the blobs come out of
let liquidTime = 0;      // time since blobs came out



// ------------------------ UTILITIES ------------------------

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

// font of box's label, scaled
function boxFont(box, scale) {
    const style = getComputedStyle(box);
    return style.fontWeight + " " + parseFloat(style.fontSize) * scale + "px " + style.fontFamily;
}

// how far out a blob is
function outAmount(blob) {
    if (blob.phase === "retract" || blob.phase === "retracted") return 1 - smoothstep(Math.min(1, blob.retractProgress * 2));
    if (blob.phase === "extend") return smoothstep(blob.progress);
    return 1;
}

function smoothstep(u) {
    return u * u * (3 - 2 * u);
}



// ------------------------ FOR HOME.JS ------------------------

// make blobs for the subcategories in layout, starting inside parent and heading to their planned centers
function spawnSubcats(parent, layout) {
    clearBlobs();
    const origin = getBoxCenter(parent, false);

    // draw box here
    liquidParent = {
        box: parent,
        x: origin.x, y: origin.y,
        width: layout.box.width, height: layout.box.height,
        hover: 0,
        shape: makeSilhouette("rect"),
        hoverShapes: makeHoverShapes(),
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
            link:   subbox.link,

                  x:        origin.x,       y:        origin.y,
            targetX: subbox.center.x, targetY: subbox.center.y,

                  width: 0,                  height: 0,
            targetWidth: subbox.width, targetHeight: subbox.height,

            cornerRadius: 0,
            opacity: 0, // of label

            phase: "extend", // extend -> settle -> extended -> retract -> retracted
            progress: 0,     // 0 = inside parent, 1 = at target
            liquidity: 0,    // 0 = crisp, 1 = fully liquid

            // own drift while suspended
            driftPhase: Math.random() * Math.PI * 2,
            driftPeriod: SUSPEND_PERIOD * (0.8 + Math.random() * 0.4),

            hover: 0,

            bodyShape: makeSilhouette("rect"),
            hoverShapes: makeHoverShapes(),
            text: makeLabel(subbox.label)
        };
        blob.text.style.font = boxFont(parent, subbox.height / layout.box.height);
        blob.text.style.letterSpacing = getComputedStyle(parent).letterSpacing;
        return blob;
    });
    updateSubcats(0);
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
            liquidity: blob.liquidity
        };
    });
}

// move blobs
function updateSubcats(dt) {
    if (blobs.length === 0) return;
    const origin = getBoxCenter(liquidParent.box, false);
    liquidParent.x = origin.x;
    liquidParent.y = origin.y;
    liquidTime += dt;

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
        else {
            shapeBlob(blob, origin, finishedSubbox(blob), 1 - blob.progress, 1 - EXTEND_BOX_AT, 1 - EXTEND_BOX_AT + RESHAPE_TIME);

            // drift in a slow loop
            const drift = SUSPEND_DRIFT * outAmount(blob);
            const angle = 2 * Math.PI * liquidTime / blob.driftPeriod + blob.driftPhase;
            blob.x += Math.cos(angle) * drift;
            blob.y += Math.sin(2 * angle) * drift / 2;
        }
    });

    updateHover(dt);

    // all back inside
    if (blobs.every(function (blob) { return blob.phase === "retracted"; })) {
        clearBlobs();
        return;
    }
    drawLiquid(origin);
    drawHovers();
    drawLabels(origin);
}

// whether every blob has finished coming out or going back in
function isStable() {
    return blobs.every(function (blob) { return blob.phase === "extended" || blob.phase === "retracted"; });
}



// ------------------------ DRAWING ------------------------

function drawLabels(origin) {
    setAttributes(liquidParent.text, { x: origin.x, y: origin.y });

    blobs.forEach(function (blob) {
        // keep label upright
        blob.text.setAttribute("x", blob.x);
        blob.text.setAttribute("y", blob.y);
        blob.text.style.opacity = blob.opacity;
    });
}

function clearBlobs() {
    clearLiquid();
    if (liquidParent !== null) liquidParent.box.classList.remove("liquid"); // draw box again
    blobs = [];
    liquidParent = null;
    liquidTime = 0;
    home.style.cursor = "";
    liquidLabels.replaceChildren();
}
