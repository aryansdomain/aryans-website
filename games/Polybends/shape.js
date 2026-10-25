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
        path += " A 1,1 0 0," + (bulges[i] ? 1 : 0) + " " + v.x + "," + v.y; // arc to next vertex
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



// ------------------------ SNAPPING ------------------------

// each side of a piece on the canvas
function pieceSides(piece, x, y, angle) {
    const turn = angle * Math.PI / 180
    const cos = Math.cos(turn), sin = Math.sin(turn);

    // move vertices to x, y, turn to angle
    const points = pieceVertices(piece.bulges.length).map(function (v) {
        const vx = (piece.reflected ? -v.x : v.x) * CANVAS_PIECE_SIZE
        const vy =                     v.y        * CANVAS_PIECE_SIZE;
        return { x: x + vx*cos - vy*sin, y: y + vx*sin + vy*cos };
    });

    return piece.bulges.map(function (out, i) {
        return { a: points[i], b: points[(i + 1) % points.length], out: out };
    });
}

// where a piece snaps
function snapPlace(piece, x, y, angle) {
    const sides = pieceSides(piece, x, y, angle);
    let best = null;

    Array.from(world.children).forEach(function (element) {
        const other = element.piece;
        if (other === piece) return;

        const sameWay = piece.reflected !== other.reflected;

        pieceSides(other, other.x, other.y, other.angle).forEach(function (t) {
            sides.forEach(function (s, i) {
                if (s.out === t.out) return; // concave fits convex

                // if centers of the sides close enough
                const distance = Math.hypot((s.a.x + s.b.x - t.a.x - t.b.x) / 2, (s.a.y + s.b.y - t.a.y - t.b.y) / 2);
                if (distance > SNAP_DISTANCE || (best !== null && distance >= best.distance)) return;

                // turn so side lies against other side
                const to   = sameWay ? t.a : t.b;
                const from = sameWay ? t.b : t.a;
                const want = Math.atan2(from.y - to.y, from.x - to.x) * 180 / Math.PI;
                const have = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) * 180 / Math.PI;

                const turn = ((want - have) % 360 + 540) % 360 - 180; // between -180 and 180
                if (Math.abs(turn) > SNAP_TURN) return;

                best = { distance: distance, side: i, turn: turn, to: to };
            });
        });
    });
    if (best === null) return null;

    // turn, then move
    const turned = pieceSides(piece, x, y, angle + best.turn)[best.side].a;
    return { x: x + best.to.x - turned.x, y: y + best.to.y - turned.y, angle: angle + best.turn };
}
