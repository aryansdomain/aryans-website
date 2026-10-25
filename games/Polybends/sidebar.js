// ------------------------ SIDEBAR ------------------------

// pentabend and mirror
function defaultShapes() {
    return [
        { bulges: alternatingBulges(DEFAULT_SIDES), reflected: false },
        { bulges: alternatingBulges(DEFAULT_SIDES), reflected: true  }
    ];
}

// shapes in the sidebar
let shapes = defaultShapes();

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



// ------------------------ NEW SHAPE POPUP ------------------------

// shape being made in the new shape popup: which sides bulge out, and if the mirror is added too
let bulgesOut = alternatingBulges(DEFAULT_SIDES);
let addMirrored = false;

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
