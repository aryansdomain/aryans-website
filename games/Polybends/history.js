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
