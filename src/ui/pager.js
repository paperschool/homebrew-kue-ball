import { getContentStart, getContentRows, isActive as chromeActive, onResize as onChromeResize } from "./chrome.js";
import { DIM, RESET, BOLD, CYAN } from "../lib/output.js";

// Keys that dismiss the pager (in normal mode): q, Esc (lone), Enter, Ctrl-C.
const QUIT_KEYS = new Set(["q", "\x1b", "\r", "\x03"]);

export function isQuitKey(key) {
    return QUIT_KEYS.has(key);
}

// Computes the next vertical scroll offset for a key press, clamped to [0, maxScroll].
export function scrollFor(key, scroll, viewportH, maxScroll) {
    let next = scroll;
    if (key === "\x1b[A" || key === "k") next = scroll - 1;
    else if (key === "\x1b[B" || key === "j") next = scroll + 1;
    else if (key === "\x1b[5~" || key === "b") next = scroll - viewportH;
    else if (key === "\x1b[6~" || key === " " || key === "f") next = scroll + viewportH;
    else if (key === "g") next = 0;
    else if (key === "G") next = maxScroll;
    return Math.max(0, Math.min(maxScroll, next));
}

// Computes the next horizontal (column) offset for a key press, clamped to [0, maxHScroll].
export function hScrollFor(key, hscroll, step, maxHScroll) {
    let next = hscroll;
    if (key === "\x1b[C" || key === "l") next = hscroll + step;
    else if (key === "\x1b[D" || key === "h") next = hscroll - step;
    else if (key === "0") next = 0;
    return Math.max(0, Math.min(maxHScroll, next));
}

// A column header looks like 2+ whitespace tokens that all start uppercase
// (e.g. "NAME READY STATUS" or "NAME CPU(cores) MEMORY(bytes)").
function looksLikeHeader(line) {
    const tokens = line.trim().split(/\s+/);
    return tokens.length >= 2 && tokens.every((token) => /^[A-Z]/.test(token));
}

// Filters output lines by a case-insensitive substring. When the first line looks like
// a column header it is pinned (returned as `sticky`) and excluded from the matched body.
export function filterLines(lines, query) {
    if (!query) return { sticky: null, body: lines };
    const sticky = lines.length > 1 && looksLikeHeader(lines[0]) ? lines[0] : null;
    const needle = query.toLowerCase();
    const body = lines.slice(sticky ? 1 : 0).filter((line) => line.toLowerCase().includes(needle));
    return { sticky, body };
}

// Shows command output in the content area. If it fits (or stdin is not a TTY) it is
// printed normally; otherwise it becomes a scrollable viewport — with vertical/horizontal
// scroll, resize reflow, and a `/` grep filter — that keeps the chrome header/footer visible.
export function pageOutput(text, { onEdit } = {}) {
    const lines = (text ?? "").replace(/\n+$/, "").split("\n");
    const maxLineLen = lines.reduce((longest, line) => Math.max(longest, line.length), 0);

    // A single, narrow line prints inline; any multi-line (or over-wide) output opens the
    // scrollable/greppable pager — so lists like events are always searchable, even when
    // they'd fit the screen. (Non-TTY always prints.)
    const trivial = lines.length <= 1 && maxLineLen <= (process.stdout.columns ?? 80);
    if (trivial || !process.stdout.isTTY || !process.stdin.isTTY) {
        process.stdout.write(lines.join("\n") + "\n");
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        let mode = "normal"; // "normal" | "filter"
        let query = "";
        let sticky = null;   // pinned header line, or null
        let body = lines;    // the scrollable (possibly filtered) lines
        let bodyMaxLen = maxLineLen;
        let top, viewportH, width, bodyTop, bodyH, maxScroll, maxHScroll, hStep;
        let scroll = 0;
        let hscroll = 0;
        const w = (s) => process.stdout.write(s);
        const moveTo = (row) => w(`\x1b[${row};1H`);

        const refilter = () => {
            const result = filterLines(lines, query);
            sticky = result.sticky;
            body = result.body;
            bodyMaxLen = body.reduce((m, l) => Math.max(m, l.length), sticky ? sticky.length : 0);
            scroll = 0;
        };

        // Geometry from the live terminal size; re-clamps the offsets so the viewport
        // reflows on resize and on filter changes. A sticky header consumes one body row.
        const recompute = () => {
            top = getContentStart();
            viewportH = Math.max(1, getContentRows() - 1); // reserve the last row for the hint/input
            width = process.stdout.columns ?? 80;
            hStep = Math.max(1, Math.floor(width / 2));
            bodyTop = sticky ? top + 1 : top;
            bodyH = sticky ? Math.max(1, viewportH - 1) : viewportH;
            maxScroll = Math.max(0, body.length - bodyH);
            maxHScroll = Math.max(0, bodyMaxLen - width);
            scroll = Math.min(scroll, maxScroll);
            hscroll = Math.min(hscroll, maxHScroll);
        };

        const slice = (line) => (line ?? "").slice(hscroll, hscroll + width);

        const render = () => {
            w("\x1b[s");
            if (sticky) {
                moveTo(top);
                w("\x1b[2K" + BOLD + slice(sticky) + RESET);
            }
            for (let i = 0; i < bodyH; i++) {
                moveTo(bodyTop + i);
                w("\x1b[2K" + slice(body[scroll + i]) + RESET);
            }
            moveTo(top + viewportH);
            if (mode === "filter") {
                w("\x1b[2K  " + CYAN + "/" + query + "▏" + RESET + DIM + `   Enter apply · Esc clear · ${body.length} match${body.length === 1 ? "" : "es"}` + RESET);
            } else {
                const pos = body.length === 0
                    ? "no matches"
                    : `${scroll + 1}-${Math.min(scroll + bodyH, body.length)}/${body.length}`;
                const pan = maxHScroll ? " · ←→ pan" : "";
                const filt = query ? ` · filter:${query}` : "";
                const edit = onEdit ? " · e edit" : "";
                w("\x1b[2K" + DIM + `  ↑↓ scroll${pan} · / filter${edit} · q return   ${pos}${filt}` + RESET);
            }
            w("\x1b[u");
        };

        const onResize = () => { recompute(); render(); };
        const unsubscribeResize = chromeActive() ? onChromeResize(onResize) : () => {};

        const wasRaw = process.stdin.isRaw === true;
        const cleanup = async (editMode = false) => {
            unsubscribeResize();
            process.stdin.off("data", onData);
            if (!wasRaw && process.stdin.setRawMode) process.stdin.setRawMode(false);
            process.stdin.pause();
            w("\x1b[?7h"); // restore line wrap
            for (let r = top; r <= top + viewportH; r++) { moveTo(r); w("\x1b[2K"); }
            moveTo(top);
            if (editMode && onEdit) await onEdit();
            resolve();
        };

        const onData = (buf) => {
            const key = buf.toString("utf8");
            if (mode === "filter") {
                if (key === "\r") mode = "normal";                              // apply, keep filter
                else if (key === "\x1b") { query = ""; refilter(); mode = "normal"; } // cancel filter
                else if (key === "\x03") { cleanup(); return; }                 // Ctrl-C quits
                else if (key === "\x7f" || key === "\b") { query = query.slice(0, -1); refilter(); }
                else if (key.length === 1 && key >= " ") { query += key; refilter(); }
                else return; // ignore arrows etc. while typing
                recompute();
                render();
                return;
            }
            if (key === "/") { mode = "filter"; render(); return; }
            if (key === "\x1b" && query) { query = ""; refilter(); recompute(); render(); return; } // Esc clears active filter
            if (isQuitKey(key)) { cleanup(); return; }
            if (onEdit && key === "e") { cleanup(true); return; }
            const nextScroll = scrollFor(key, scroll, bodyH, maxScroll);
            const nextHscroll = hScrollFor(key, hscroll, hStep, maxHScroll);
            if (nextScroll !== scroll || nextHscroll !== hscroll) {
                scroll = nextScroll;
                hscroll = nextHscroll;
                render();
            }
        };

        refilter();
        recompute();
        if (process.stdin.setRawMode) process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on("data", onData);
        w("\x1b[?7l"); // disable line wrap so each output line stays on one row
        render();
    });
}
