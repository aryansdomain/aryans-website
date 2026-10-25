// ------------------------ SETTINGS ------------------------

// LAYOUT
const SUBBOX_SCALE = 0.8;        //      size of subboxes compared to their box
const SUBBOX_GAP = 24;           // px   space between subboxes
const FIRST_SUBBOX_GAP = 56;     // px   space between a box and its first subbox
const MIN_FIRST_SUBBOX_GAP = 16; // px   smallest that space shrinks to in emergencies (longest subbox is still too close to the screen's edge)



// ------------------------ SUBCATEGORIES ------------------------

// subcategory
const subcats = {
    writing: ["Short Stories", "Poetry"],
    projects: ["IGCSE IDE"],
    games: ["Wörtel"]
};

// boxes with no subcategories open directly
const boxLinks = { blog: "pages/blog/" };

// pages subcategories open
const subcatLinks = {
    projects: { "IGCSE IDE": "pages/projects/IGCSE_IDE/" },
    games: { "Wörtel": "pages/games/Wörtel/" }
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
        const blob = Object.assign(makeBlob(origin, { x: subbox.center.x, y: subbox.center.y, width: subbox.width, height: subbox.height }), {
            id:     subbox.id,
            parent: subbox.parent,
            label:  subbox.label,
            link:   subbox.link,

            hover: 0,

            bodyShape: makeSilhouette("rect"),
            hoverShapes: makeHoverShapes(),
            text: makeLabel(subbox.label)
        });
        blob.text.style.font = boxFont(parent, subbox.height / layout.box.height);
        blob.text.style.letterSpacing = getComputedStyle(parent).letterSpacing;
        return blob;
    });
    updateSubcats(0);
}

// send all blobs back to parents
function retractSubcats() {
    blobs.forEach(retractBlob);
}

// move blobs
function updateSubcats(dt) {
    if (blobs.length === 0) return;
    const origin = getBoxCenter(liquidParent.box, false);
    liquidParent.x = origin.x;
    liquidParent.y = origin.y;
    liquidTime += dt;

    blobs.forEach(function (blob) { stepBlob(blob, origin, liquidParent, dt, liquidTime); });

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
    return blobs.every(isSettled);
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
