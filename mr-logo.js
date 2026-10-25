// The "MR" pixel logo shared by the page loader (index.html) and the offline
// page (offline.html): its letters, its animations and their settings.
//
//   var logo = MRLogo.create(element);  // draws the tile and its pixels
//   logo.fill(delay);    // the letters drop into place once
//   logo.loop(delay);    // keeps swapping the letters (falling out while new
//                        // ones drop in) until stopped
//   logo.stop(done);     // stops once the fill or swap under way has ended,
//                        // so the letters are never cut off halfway, then
//                        // calls done (at once if nothing is moving)
//
// The offline page is shown by the service worker without a connection, so
// service-worker.js caches this file too: bump its CACHE name whenever this
// file changes.
(function () {
    // ---------- Settings ----------

    // The tile and the letters
    var TILE_COLOR = "#FF6B35";
    var INK_COLOR = "#14110F";
    

    // Filling: each pixel drops into place, column by column from the left,
    // FILL_STAGGER_MS after the one before, taking FILL_MOVE_MS
    var FILL_STAGGER_MS = 28;
    var FILL_MOVE_MS = 550;

    // Falling out: column by column from the left, the lowest pixel of each
    // column first so none falls through another, DROP_STAGGER_MS apart and
    // each taking DROP_MOVE_MS
    var DROP_STAGGER_MS = 22;
    var DROP_MOVE_MS = 500;

    // In a swap, a new pixel drops into its spot this long before the old one
    // in its column has finished falling (by then it is out of the way)
    var SWAP_OVERLAP_MS = 50;

    // The letters rest, complete, this long between two swaps
    var REST_MS = 500;

    // The "MR" letters of icons/favicon.svg as [x, y, width, height] blocks
    // on its 16 x 16 grid, split below into single pixels
    var BLOCKS = [
        [2, 4, 1, 8], [6, 4, 1, 8], [3, 5, 1, 1], [5, 5, 1, 1],
        [4, 6, 1, 2], [9, 4, 1, 8], [10, 4, 3, 1], [13, 5, 1, 3],
        [10, 8, 3, 1], [11, 9, 1, 1], [12, 10, 1, 1], [13, 11, 1, 1],
    ];

    // ---------- Pixels and their timing ----------

    var cells = [];
    BLOCKS.forEach(function (b) {
        for (var x = b[0]; x < b[0] + b[2]; x++) {
            for (var y = b[1]; y < b[1] + b[3]; y++) {
                cells.push([x, y]);
            }
        }
    });

    // Filling order: column by column, left to right, top to bottom
    cells.sort(function (a, b) {
        return a[0] - b[0] || a[1] - b[1];
    });

    // Falling order: column by column, left to right, bottom to top
    var dropOrder = cells.slice().sort(function (a, b) {
        return a[0] - b[0] || b[1] - a[1];
    });

    // When each column's last falling pixel is out of the way
    var columnClear = {};
    dropOrder.forEach(function (cell, j) {
        columnClear[cell[0]] = Math.max(
            columnClear[cell[0]] || 0,
            j * DROP_STAGGER_MS + DROP_MOVE_MS - SWAP_OVERLAP_MS
        );
    });

    // In a swap, each pixel drops in once its column is clear, top to bottom
    var rowInColumn = {};
    var swapDelays = cells.map(function (cell) {
        rowInColumn[cell[0]] = (rowInColumn[cell[0]] || 0) + 1;
        return columnClear[cell[0]] + (rowInColumn[cell[0]] - 1) * FILL_STAGGER_MS;
    });

    // How long the first fill and a swap last, until their last pixel stops
    var FILL_MS = (cells.length - 1) * FILL_STAGGER_MS + FILL_MOVE_MS;
    var SWAP_MS = Math.max(
        (cells.length - 1) * DROP_STAGGER_MS + DROP_MOVE_MS,
        Math.max.apply(null, swapDelays) + FILL_MOVE_MS
    );

    // ---------- Styles ----------

    // Built from the settings above, so the animations and the script's
    // timers always agree. Pixels wait above the tile, unseen (pixels that
    // have fallen out jump back there at once); .is-filled drops them into
    // place, .is-swapping-in times that for a swap, and .is-dropping drops
    // them out through the bottom, where the tile's rounded edge (its rx of 3
    // on the 16 x 16 grid) hides them.
    var CSS = [
        ".mr-logo { position: relative; }",
        ".mr-logo svg { position: absolute; inset: 0; width: 100%; height: 100%; }",
        ".mr-logo-tile { fill: " + TILE_COLOR + "; }",
        ".mr-logo-pixels { clip-path: inset(0 round 18.75%); }",
        ".mr-logo-pixels rect {",
        "    fill: " + INK_COLOR + ";",
        "    transform-box: fill-box;",
        "    transform-origin: center;",
        "    opacity: 0;",
        "    transform: translateY(-7px) scale(0.4);",
        "    transition: none;",
        "}",
        ".mr-logo-pixels.is-filled rect {",
        "    opacity: 1;",
        "    transform: none;",
        "    transition: opacity " + FILL_MOVE_MS + "ms cubic-bezier(0.22, 1.4, 0.36, 1),",
        "        transform " + FILL_MOVE_MS + "ms cubic-bezier(0.22, 1.4, 0.36, 1);",
        "    transition-delay: calc(var(--i) * " + FILL_STAGGER_MS + "ms);",
        "}",
        ".mr-logo-pixels.is-filled.is-swapping-in rect {",
        "    transition-delay: calc(var(--k) * 1ms);",
        "}",
        // Falling like a dropped block: slow at first, then faster, far
        // enough to leave the tile from any row
        ".mr-logo-pixels.is-dropping rect {",
        "    opacity: 1;",
        "    transform: translateY(14px);",
        "    transition: transform " + DROP_MOVE_MS + "ms cubic-bezier(0.55, 0, 1, 0.45);",
        "    transition-delay: calc(var(--j) * " + DROP_STAGGER_MS + "ms);",
        "}",
        "@media (prefers-reduced-motion: reduce) {",
        "    .mr-logo-pixels rect { opacity: 1; transform: none; transition: none; }",
        "}",
    ].join("\n");

    var addStyles = function () {
        if (document.getElementById("mr-logo-styles")) return;

        var style = document.createElement("style");
        style.id = "mr-logo-styles";
        style.textContent = CSS;
        document.head.appendChild(style);
    };

    // ---------- The logo ----------

    var SVG_NS = "http://www.w3.org/2000/svg";

    var makeSvg = function (className) {
        var svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("class", className);
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("shape-rendering", "crispEdges");
        svg.setAttribute("aria-hidden", "true");
        return svg;
    };

    var create = function (container) {
        addStyles();
        container.classList.add("mr-logo");

        var tile = makeSvg("mr-logo-tile");
        var tileRect = document.createElementNS(SVG_NS, "rect");
        tileRect.setAttribute("width", 16);
        tileRect.setAttribute("height", 16);
        tileRect.setAttribute("rx", 3);
        tile.appendChild(tileRect);
        container.appendChild(tile);

        // Two identical sets of pixels that take turns: one shows the
        // letters while the other waits above the tile
        var layers = [makeSvg("mr-logo-pixels"), makeSvg("mr-logo-pixels")];
        layers.forEach(function (layer) {
            cells.forEach(function (cell, i) {
                var rect = document.createElementNS(SVG_NS, "rect");
                rect.setAttribute("x", cell[0]);
                rect.setAttribute("y", cell[1]);
                rect.setAttribute("width", 1);
                rect.setAttribute("height", 1);
                rect.style.setProperty("--i", i);
                rect.style.setProperty("--j", dropOrder.indexOf(cell));
                rect.style.setProperty("--k", swapDelays[i]);
                layer.appendChild(rect);
            });
            container.appendChild(layer);
        });

        var reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        // "empty"     nothing shown yet
        // "filling"   about to fill (its delay), or filling
        // "full"      the letters complete and still
        // "swapping"  falling out while new letters drop in
        var state = "empty";
        var shown = 0; // the layer showing the letters
        var isLooping = false;
        var onStopped = null;
        var timer;

        // The letters are complete: report a stop that was asked for, or
        // rest and swap again while looping
        var settle = function () {
            state = "full";

            if (onStopped) {
                var done = onStopped;
                onStopped = null;
                done();
                return;
            }

            if (isLooping) timer = setTimeout(swap, REST_MS);
        };

        var swap = function () {
            var leaving = layers[shown];
            var arriving = layers[1 - shown];

            state = "swapping";
            leaving.classList.remove("is-filled", "is-swapping-in");
            leaving.classList.add("is-dropping");
            arriving.classList.add("is-filled", "is-swapping-in");
            shown = 1 - shown;

            timer = setTimeout(function () {
                // All fallen out: back above the tile, unseen, ready to drop
                // in at the next swap
                leaving.classList.remove("is-dropping");
                settle();
            }, SWAP_MS);
        };

        var fill = function (delay) {
            if (state !== "empty") return;

            if (reduceMotion) {
                // Shown at once and still
                layers[shown].classList.add("is-filled");
                settle();
                return;
            }

            state = "filling";
            timer = setTimeout(function () {
                layers[shown].classList.add("is-filled");
                timer = setTimeout(settle, FILL_MS);
            }, delay || 0);
        };

        var loop = function (delay) {
            if (reduceMotion) {
                fill();
                return;
            }

            isLooping = true;
            onStopped = null;

            if (state === "empty") fill(delay);
            else if (state === "full") swap();
            // Filling or swapping: carries on from settle() when it ends
        };

        var stop = function (done) {
            isLooping = false;

            if (state === "filling" || state === "swapping") {
                onStopped = done;
                return;
            }

            // Complete and resting (or never shown): nothing to wait for
            clearTimeout(timer);
            done();
        };

        return {
            fill: fill,
            loop: loop,
            stop: stop,
            getState: function () {
                return state;
            },
        };
    };

    window.MRLogo = {
        create: create,
        FILL_MS: FILL_MS,
        SWAP_MS: SWAP_MS,
        REST_MS: REST_MS,
    };
})();
