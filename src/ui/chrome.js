import { run } from "../lib/shell.js";
import { BOLD, CYAN, DIM, RESET, YELLOW, stripAnsi } from "../lib/output.js";

const TITLE = "kue-ball";

// 65-column display-width ASCII art for "KUE-BALL" (ANSI Shadow style)
const SPLASH_ART = [
    "██╗  ██╗ ██╗   ██╗ ███████╗   ██████╗   █████╗  ██╗      ██╗     ",
    "██║ ██╔╝ ██║   ██║ ██╔════╝   ██╔══██╗ ██╔══██╗ ██║      ██║     ",
    "█████╔╝  ██║   ██║ █████╗  ───██████╔╝ ███████║ ██║      ██║     ",
    "██╔═██╗  ██║   ██║ ██╔══╝  ───██╔══██╗ ██╔══██║ ██║      ██║     ",
    "██║  ██╗ ╚██████╔╝ ███████╗   ██████╔╝ ██║  ██║ ███████╗ ███████╗",
    "╚═╝  ╚═╝  ╚═════╝  ╚══════╝   ╚═════╝  ╚═╝  ╚═╝ ╚══════╝ ╚══════╝",
    "By Ono Sendai Runner"
];
const SPLASH_ART_WIDTH = 65;
const CONTENT_BASE = 6;  // first content row when the last-command block is just the summary line
const CMD_INDENT = 2;    // indent for the wrapped actual-command lines under the summary
const CMD_MAX_LINES = 3; // cap on wrapped command lines so the header can't dominate the screen
const RESIZE_DEBOUNCE_MS = 80; // coalesce the burst of resize events fired during a drag

// ── Chrome colour palette ────────────────────────────────────────────────────
const C_BAR_BG = "\x1b[48;5;24m";           // bars bg: dark steel blue (#005f87)
const C_APP = "\x1b[1;97m";              // app name: bold bright white
const C_SEP = "\x1b[0;48;5;24;38;5;75m"; // separator ·: reset + reapply bg + sky blue
const C_CTX = "\x1b[38;5;81m";           // context name: light cyan
const C_NS = "\x1b[38;5;117m";          // namespace: light periwinkle
const C_BAR_TEXT = "\x1b[38;5;252m";          // status bar text: near-white
const C_LABEL = "\x1b[38;5;110m";          // muted label (ctx:/ns:) on the title bar
const C_CMD = "\x1b[38;5;75m";           // last-command detail: the actual command (light blue)
const C_DIV = "\x1b[38;5;239m";          // divider lines: dark grey
const C_RESET = "\x1b[0m";                 // full attribute reset
const C_PROG_ON = "\x1b[38;5;51m";           // progress bar: moving block (bright cyan)
const C_PROG_OFF = "\x1b[38;5;60m";           // progress bar: track (muted slate)
const C_ART_FRONT = "\x1b[1;97m";            // splash art: byline (flat bold bright white)
const C_ART_SHADOW = "\x1b[38;5;75m";         // splash art: bottom-right depth/edges (light blue)

// Letter-face gradient — four tiers stepping from white into progressively saturated blue.
// Sparse band uses a full block (not ░) so it renders as a solid white face, not a dotted
// pattern that lets background through and reads as grey.
// The solid █ uses the same 75 as C_ART_SHADOW so the dense face fuses with the depth.
const GRADIENT_BANDS = [
    { glyph: "█", color: "\x1b[1;97m" },          // sparse  → solid white
    { glyph: "▒", color: "\x1b[1;38;5;153m" },    // medium  → lightest blue (LightSkyBlue1)
    { glyph: "▓", color: "\x1b[1;38;5;117m" },    // dark    → lighter blue (SkyBlue1)
    { glyph: "█", color: "\x1b[1;38;5;75m" },     // solid   → light blue (SteelBlue1, matches depth)
];
const SPLASH_LAST_ART_ROW = 5; // rows 0..5 are art; row 6 is the byline (handled separately)
const AUTH_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]; // auth-check spinner
// ─────────────────────────────────────────────────────────────────────────────

let active = false;
let accountUser = "";       // signed-in az user (footer, left)
let subscription = "";      // subscription shown in the footer (az default, or the current context's)
let identitySegment = "";   // composed footer-left: "<user> · <subscription>"
let _authStatus = "";
let _authSpinnerTimer = null;
let _authSpinnerTick = 0;
let ctxName = "";
let nsName = "";
let lastCmdText = "";
let lastCmdRun = "";
let _renderedDivRow = CONTENT_BASE - 1; // last drawn last-command divider row (for stale-row clearing)
let searchText = "";
let _progressActive = false;
let _progressTimer = null;
let _progressTick = 0;
let _sigintHandler = null;
let _exitHandler = null;
let _resizeTimer = null;
let _lastRows = 0;
let _splashVisible = false;
let _splashAnimTimer = null;
let _splashAnimAngle = Math.PI / 4; // start at the static-look diagonal (top-left → bottom-right)
const SPLASH_ANIM_INTERVAL_MS = 80;
const SPLASH_ANIM_ANGULAR_VELOCITY = (2 * Math.PI) / (8000 / SPLASH_ANIM_INTERVAL_MS); // full revolution per 8s
let _stepHeaderRows = 0; // rows consumed by the active step()'s title block; lets prompts pin below it
const _resizeSubscribers = new Set();

function cols() { return process.stdout.columns ?? 80; }
function rows() { return process.stdout.rows ?? 24; }
function w(str) { process.stdout.write(str); }
function moveTo(row, col) { w(`\x1b[${row};${col}H`); }

function truncate(str, n) {
    if (!str) return "";
    return str.length > n ? str.slice(0, n) + "\u2026" : str;
}

// Char-wraps the actual command into indented lines (capped), ellipsising the last
// line if it still overflows. Empty when no command has run yet.
function _commandLines() {
    if (!lastCmdRun) return [];
    const width = Math.max(8, cols() - CMD_INDENT);
    const out = [];
    for (let i = 0; i < lastCmdRun.length && out.length < CMD_MAX_LINES; i += width) {
        out.push(lastCmdRun.slice(i, i + width));
    }
    if (out.length === CMD_MAX_LINES && lastCmdRun.length > CMD_MAX_LINES * width) {
        out[out.length - 1] = out[out.length - 1].slice(0, width - 1) + "\u2026";
    }
    return out;
}

// First content row \u2014 grows below the title/last-command/search header as the
// actual command wraps onto more lines.
function _contentStart() { return CONTENT_BASE + _commandLines().length; }

function drawTitle() {
    const width = cols();
    const dot = " \u00b7 ";
    const appPlain = ` ${TITLE}`;
    let bar = C_BAR_BG + C_APP + appPlain;
    let barLen = appPlain.length;
    if (ctxName) {
        bar += C_SEP + dot + C_LABEL + "ctx:" + C_CTX + " " + ctxName;
        barLen += dot.length + 5 + ctxName.length; // "ctx:" + space
        if (nsName) {
            bar += C_SEP + dot + C_LABEL + "ns:" + C_NS + " " + nsName;
            barLen += dot.length + 4 + nsName.length; // "ns:" + space
        }
    }
    // Fill to right edge with bg
    const pad = Math.max(0, width - barLen - 1);
    bar += C_BAR_BG + " ".repeat(pad) + " " + C_RESET;
    moveTo(1, 1);
    w("\x1b[2K" + bar);
}

function drawDivider() {
    moveTo(2, 1);
    w("\x1b[2K" + C_DIV + "\u2500".repeat(Math.min(cols(), 500)) + C_RESET);
}

// Draws the last-command block: the summary on row 3, then the actual command
// wrapped across the following rows in light blue. Clears rows the block has
// vacated since the previous draw (when the command shrank or was cleared).
function _drawLastCommandBlock() {
    const label = "Last command:";
    moveTo(3, 1);
    const available = Math.max(0, cols() - label.length - 2);
    const summary = lastCmdText ? truncate(lastCmdText, available) : "";
    w("\x1b[2K\x1b[2m" + label + "\x1b[0m " + summary);
    const cmdLines = _commandLines();
    for (let i = 0; i < cmdLines.length; i++) {
        moveTo(4 + i, 1);
        w("\x1b[2K" + " ".repeat(CMD_INDENT) + C_CMD + cmdLines[i] + C_RESET);
    }
    const divRow = CONTENT_BASE + cmdLines.length - 1;
    for (let r = divRow + 1; r <= _renderedDivRow; r++) { moveTo(r, 1); w("\x1b[2K"); }
    _renderedDivRow = divRow;
}

function _drawSearchBar() {
    const label = "Search:";
    moveTo(_contentStart() - 2, 1);
    const available = cols() - label.length - 2;
    const shown = searchText ? truncate(searchText, Math.max(0, available)) : "";
    w("\x1b[2K\x1b[2m" + label + "\x1b[0m " + C_CTX + shown + C_RESET);
}

function _drawLastCmdDivider() {
    moveTo(_contentStart() - 1, 1);
    w("\x1b[2K" + C_DIV + "\u2500".repeat(Math.min(cols(), 500)) + C_RESET);
}

// Writes the status-bar row in place. Does NOT save/restore the cursor — callers
// that are not already inside a save/restore bracket must wrap it themselves.
function _writeStatusBar(segments, lineBg = "") {
    moveTo(rows(), 1);
    if (lineBg) w(lineBg);
    w("\x1b[2K");
    for (const seg of segments) {
        if (seg.color) w(`\x1b[${seg.color}m`);
        w(seg.text);
        if (seg.color) w("\x1b[0m");
    }
}

// Indeterminate bar that fills the whole gap between the identity and the lock:
// a wide block (a quarter of the track) bounces left↔right to clearly signal activity.
function _progressBar(width) {
    if (width <= 0) return "";
    const block = Math.max(4, Math.floor(width / 4));
    const travel = Math.max(1, width - block);
    const step = Math.max(1, Math.round(width / 18));
    const phase = (_progressTick * step) % (2 * travel);
    const start = phase <= travel ? phase : 2 * travel - phase; // triangle wave (bounce)
    let bar = "";
    for (let i = 0; i < width; i++) {
        const lit = i >= start && i < start + block;
        bar += (lit ? C_PROG_ON : C_PROG_OFF) + "█";
    }
    return bar + "\x1b[39m"; // reset foreground only — keep the bar background
}

// Right-side auth glyph: an animated spinner while confirming, then a coloured lock.
function _authGlyph() {
    if (_authStatus === "checking") return `\x1b[33m${AUTH_SPINNER[_authSpinnerTick % AUTH_SPINNER.length]}\x1b[0m`;
    if (_authStatus === "ok") return "\x1b[32m🔒\x1b[0m";
    if (_authStatus === "error") return "\x1b[31m🔒\x1b[0m";
    return "";
}

function _renderStatusBar(bracket = true) {
    if (!active) return;
    const width = cols();
    const left = identitySegment ? ` ${identitySegment}` : " ";
    const glyph = _authGlyph();
    const lockRaw = glyph ? ` ${glyph} ` : "  ";
    const lockPlain = lockRaw.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
    const available = Math.max(0, width - left.length - lockPlain.length);
    const middle = (_progressActive && available >= 6)
        ? " " + _progressBar(available - 2) + " "
        : " ".repeat(available);
    const segments = [{ text: C_BAR_TEXT + left + middle + lockRaw + C_RESET }];
    if (bracket) w("\x1b[s");
    _writeStatusBar(segments, C_BAR_BG);
    if (bracket) w("\x1b[u");
}

function setScrollRegion() { const top = _contentStart(); w(`\x1b[${top};${Math.max(top, rows() - 1)}r`); }
function resetScrollRegion() { w("\x1b[r"); }

// Subscribe a content owner (an active prompt) to resize. The callback is invoked
// after the chrome frame is redrawn and the content area cleared, so the prompt can
// repaint itself into a clean, correctly-sized region. Returns an unsubscribe fn.
export function onResize(callback) {
    _resizeSubscribers.add(callback);
    return () => _resizeSubscribers.delete(callback);
}

function _notifyResizeSubscribers() {
    for (const callback of _resizeSubscribers) {
        try { callback(); } catch { /* a subscriber must never break the chrome redraw */ }
    }
}

// Redraw the fixed chrome (rows 1–5 and the status bar) at the current dimensions.
// Wrapped in a single cursor save/restore so it never disturbs the prompt's cursor.
// When a prompt is subscribed, the content area is cleared and the prompt is asked to
// repaint (in that order) so a grow never leaves a stale status bar stranded mid-screen.
// With no prompt, only the old status-bar row is cleared so scrolled output is preserved.
function _redrawChrome() {
    _resizeTimer = null;
    if (!active) return;
    const prevRows = _lastRows;
    _lastRows = rows();
    const hasPrompt = _resizeSubscribers.size > 0;
    w("\x1b[s");
    resetScrollRegion();
    if (_splashVisible || hasPrompt) {
        moveTo(_contentStart(), 1);
        w("\x1b[J"); // clear content area to end of screen — the splash/prompt repaints below
    } else if (prevRows >= _contentStart() && prevRows !== _lastRows && prevRows <= _lastRows) {
        moveTo(prevRows, 1);
        w("\x1b[2K"); // a grow left the previous status bar stranded — erase that row
    }
    drawTitle();
    drawDivider();
    _drawLastCommandBlock();
    _drawSearchBar();
    _drawLastCmdDivider();
    _renderStatusBar(false);
    setScrollRegion();
    if (_splashVisible) _drawSplashArt(); // keep the title art centred at the new size
    w("\x1b[u");
    if (hasPrompt) _notifyResizeSubscribers();
}

function _onResize() {
    if (!active) return;
    if (_resizeTimer) clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(_redrawChrome, RESIZE_DEBOUNCE_MS);
}

export function isActive() { return active; }

export function getContentRows() { return Math.max(1, (process.stdout.rows ?? 24) - _contentStart()); }

export function getContentStart() { return _contentStart(); }

export function getIdentitySegment() { return identitySegment; }

export function updateStatusBar(segments, lineBg = "") {
    if (!active) return;
    w("\x1b[s");
    _writeStatusBar(segments, lineBg);
    w("\x1b[u");
}

export function setSearchText(text) {
    searchText = text ?? "";
    if (!active) return;
    w("\x1b[s");
    _drawSearchBar();
    w("\x1b[u");
}

export function startProgress() {
    if (!active || _progressTimer) return;
    _progressActive = true;
    _progressTick = 0;
    _renderStatusBar();
    _progressTimer = setInterval(() => { _progressTick++; _renderStatusBar(); }, 90);
}

export function stopProgress() {
    if (_progressTimer) { clearInterval(_progressTimer); _progressTimer = null; }
    _progressActive = false;
    if (active) _renderStatusBar();
}

export function initChrome() {
    if (active) return;
    _lastRows = rows();
    w("\x1b[?1049h");
    w("\x1b[?25l");
    drawTitle();
    drawDivider();
    _drawLastCommandBlock();
    _drawSearchBar();
    _drawLastCmdDivider();
    moveTo(rows(), 1);
    w(C_BAR_BG + "\x1b[2K" + C_RESET);
    setScrollRegion();
    moveTo(_contentStart(), 1);
    _sigintHandler = () => { destroyChrome(); process.exit(0); };
    _exitHandler = () => destroyChrome();
    process.on("SIGINT", _sigintHandler);
    process.on("exit", _exitHandler);
    process.stdout.on("resize", _onResize);
    active = true;
}

export function destroyChrome() {
    if (!active) return;
    active = false;
    accountUser = "";
    subscription = "";
    identitySegment = "";
    _authStatus = "";
    ctxName = "";
    nsName = "";
    lastCmdText = "";
    lastCmdRun = "";
    _renderedDivRow = CONTENT_BASE - 1;
    searchText = "";
    if (_authSpinnerTimer) { clearInterval(_authSpinnerTimer); _authSpinnerTimer = null; }
    if (_progressTimer) { clearInterval(_progressTimer); _progressTimer = null; }
    if (_splashAnimTimer) { clearInterval(_splashAnimTimer); _splashAnimTimer = null; }
    _splashVisible = false;
    _progressActive = false;
    if (_resizeTimer) { clearTimeout(_resizeTimer); _resizeTimer = null; }
    _resizeSubscribers.clear();
    process.stdout.off("resize", _onResize);
    if (_sigintHandler) { process.removeListener("SIGINT", _sigintHandler); _sigintHandler = null; }
    if (_exitHandler) { process.removeListener("exit", _exitHandler); _exitHandler = null; }
    resetScrollRegion();
    w("\x1b[?25h");
    w("\x1b[?1049l");
}

function _composeIdentity() {
    identitySegment = subscription ? `${accountUser} \u00b7 ${subscription}` : accountUser;
}

export async function loadIdentity() {
    try {
        const raw = run("az account show --output json", { silent: true });
        if (!raw) throw new Error("no result");
        const data = JSON.parse(raw);
        if (!data?.user?.name) throw new Error("missing user.name");
        accountUser = truncate(data.user.name, 28);
        subscription = truncate(data.name ?? "", 20);
    } catch {
        accountUser = "Not signed in";
        subscription = "";
    }
    _composeIdentity();
    _renderStatusBar();
}

// Overrides the footer subscription (e.g. to the current context's subscription).
// Ignored when no subscription is given, so unmapped contexts keep the az default.
export function setSubscription(sub) {
    if (!sub) return;
    subscription = truncate(sub, 20);
    _composeIdentity();
    _renderStatusBar();
}

export function setAuthStatus(status) {
    _authStatus = status;
    if (status === "checking") {
        if (active && !_authSpinnerTimer) {
            _authSpinnerTick = 0;
            _authSpinnerTimer = setInterval(() => { _authSpinnerTick++; _renderStatusBar(); }, 100);
        }
    } else if (_authSpinnerTimer) {
        clearInterval(_authSpinnerTimer);
        _authSpinnerTimer = null;
    }
    _renderStatusBar();
}

export function setContextInfo(ctx, ns) {
    ctxName = ctx ? truncate(ctx, 22) : "";
    nsName = ns ? truncate(ns, 18) : "";
    if (!active) return;
    w("\x1b[s");
    drawTitle();
    w("\x1b[u");
}

// Redraws the last-command block and re-anchors the rows below it (search, divider,
// scroll region), since the wrapped command changes the header height.
function _relayoutHeader() {
    if (!active) return;
    w("\x1b[s");
    _drawLastCommandBlock();
    _drawSearchBar();
    _drawLastCmdDivider();
    setScrollRegion();
    w("\x1b[u");
}

export function setLastCommand(text) {
    lastCmdText = text ?? "";
    lastCmdRun = ""; // new selection — clear the previous actual command until it runs
    _relayoutHeader();
}

// Records the actual command string that ran, shown wrapped under the summary in light blue.
export function setLastCommandRun(text) {
    lastCmdRun = text ?? "";
    _relayoutHeader();
}

// Map a normalized position t ∈ [0,1] to one of the four gradient bands ({glyph, color}).
// Bands are slightly biased toward solid █ so the leading edge reads as a clean block.
function _gradientBand(t) {
    if (t < 0.3) return GRADIENT_BANDS[0]; // ░ + bright white   — sparse end
    if (t < 0.55) return GRADIENT_BANDS[1]; // ▒ + pale blue
    if (t < 0.8) return GRADIENT_BANDS[2]; // ▓ + light periwinkle
    return GRADIENT_BANDS[3];                // █ + light blue      — solid end
}

// Projects (col, row) onto a rotating axis whose angle is _splashAnimAngle.
// t=0 at the trailing edge, t=1 at the leading edge — so as the angle revolves,
// the sparse→solid wash sweeps around the splash.
function _gradientT(row, col) {
    const xc = (col / (SPLASH_ART_WIDTH - 1)) - 0.5;
    const yc = (row / SPLASH_LAST_ART_ROW) - 0.5;
    const cosA = Math.cos(_splashAnimAngle);
    const sinA = Math.sin(_splashAnimAngle);
    const proj = xc * cosA + yc * sinA;
    const maxAbs = 0.5 * (Math.abs(cosA) + Math.abs(sinA));
    if (maxAbs === 0) return 0.5; // degenerate guard
    return (proj + maxAbs) / (2 * maxAbs);
}

// Colourises an ANSI-Shadow art line:
//   - solid █ faces are SWAPPED for a graded block (░/▒/▓/█) based on the cell's
//     diagonal position across the whole splash, producing a wash from top-left
//     (sparse) to bottom-right (full) — all rendered in white
//   - box-drawing depth/edge glyphs (╗ ║ ╔ ╚ ═ ╝ ─ etc.) render in light blue
//   - spaces reset to default so the chrome background shows through
function _colorizeArtLine(line, row) {
    let out = "";
    let lastEscape = "";
    let col = 0;
    for (const ch of line) {
        let escape;
        let glyph = ch;
        if (ch === "█") {
            const band = _gradientBand(_gradientT(row, col));
            escape = band.color;
            glyph = band.glyph;
        } else if (ch === " ") {
            escape = C_RESET;
        } else {
            escape = C_ART_SHADOW;
        }
        if (escape !== lastEscape) {
            out += escape;
            lastEscape = escape;
        }
        out += glyph;
        col++;
    }
    return out + C_RESET;
}

// Computes where the splash art will sit in the current terminal — vStart row, height,
// padding. Returns null when the terminal is too small to render it cleanly.
function _splashLayout() {
    const contentStart = _contentStart();
    const contentHeight = (rows() - 1) - contentStart + 1;
    const artHeight = SPLASH_ART.length;
    if (contentHeight < artHeight || cols() < SPLASH_ART_WIDTH) return null;
    const hPad = Math.floor((cols() - SPLASH_ART_WIDTH) / 2);
    const vStart = contentStart + Math.floor((contentHeight - artHeight) / 2);
    return { vStart, artHeight, hPad };
}

// Draws the splash art centred in the content area. Returns the row just below the
// art, or null when the terminal is too short or too narrow to render it cleanly
// (skipping avoids the 65-column art wrapping into a garbled block on narrow widths).
function _drawSplashArt() {
    const layout = _splashLayout();
    if (!layout) return null;
    const { vStart, artHeight, hPad } = layout;
    const prefix = " ".repeat(hPad);
    for (let i = 0; i < artHeight; i++) {
        const line = SPLASH_ART[i];
        // Only the byline is plain text (flat front colour, no gradient); every block/shadow row
        // — including the all-edge bottom drop-shadow row — runs through the colouriser.
        const body = /[A-Za-z]/.test(line) ? C_ART_FRONT + line + C_RESET : _colorizeArtLine(line, i);
        moveTo(vStart + i, 1);
        w("\x1b[2K" + prefix + body);
    }
    return vStart + artHeight;
}

// Redraws the splash art in place without moving the cursor — used by the animation
// timer so the gradient angle update doesn't bump prereq prints that are happening
// below the art. Save/restore cursor brackets the redraw. Also wipes a couple of rows
// just above the splash so any stale content from an accidental scroll (e.g. console.log
// at the bottom of the scroll region) gets cleaned up on the next tick.
function _animateSplashFrame() {
    if (!active || !_splashVisible) return;
    _splashAnimAngle = (_splashAnimAngle + SPLASH_ANIM_ANGULAR_VELOCITY) % (2 * Math.PI);
    const layout = _splashLayout();
    w("\x1b[s");
    if (layout) {
        // Scrub up to two rows above the splash to wipe any leftover row pushed up by a scroll.
        const top = Math.max(_contentStart(), layout.vStart - 2);
        for (let r = top; r < layout.vStart; r++) {
            moveTo(r, 1);
            w("\x1b[2K");
        }
    }
    _drawSplashArt();
    w("\x1b[u");
}

export function drawSplash() {
    if (!active) return;
    _splashVisible = true;
    const belowArt = _drawSplashArt();
    // Park cursor near the bottom so prereq prints (✓ kubectl/helm/az) lock to the lower
    // portion of the screen — visually balanced under the splash. We pick `rows() - 4` so
    // that 3 prereq lines (each ending in \n via console.log) finish with the cursor on
    // row `rows() - 1` (the row just above the status bar) WITHOUT crossing the scroll
    // region bottom, which would scroll the splash up by a line.
    moveTo(Math.max((belowArt ?? _contentStart()) + 1, rows() - 4), 1);
    if (!_splashAnimTimer) {
        _splashAnimTimer = setInterval(_animateSplashFrame, SPLASH_ANIM_INTERVAL_MS);
        // Kick the first animated frame as soon as the event loop has a moment — otherwise
        // we'd wait a full SPLASH_ANIM_INTERVAL_MS before any motion is visible.
        setImmediate(_animateSplashFrame);
    }
}

export function hideSplash() {
    _splashVisible = false;
    _stepHeaderRows = 0;
    if (_splashAnimTimer) { clearInterval(_splashAnimTimer); _splashAnimTimer = null; }
}

export function getStepHeaderRows() { return _stepHeaderRows; }

// Wipes everything in the content area (between the chrome header and the status bar)
// and parks the cursor at the top of that region. Used by `step()` to give each wizard
// page a clean slate so the previous prompt's leftovers don't accumulate down the screen.
export function clearContent() {
    if (!active) return;
    _stepHeaderRows = 0;
    const top = _contentStart();
    const last = rows() - 1;
    for (let r = top; r <= last; r++) {
        moveTo(r, 1);
        w("\x1b[2K");
    }
    moveTo(top, 1);
}

// ── Auth / permission error page ────────────────────────────────────────────
// Renders a centred yellow warning box, the salient error line, and a checklist
// prompt. Awaits any keypress to dismiss. Used by the runner when a captured
// command exits non-zero with text matching isPermissionError().

function _pullAuthErrorSnippet(output) {
    const lines = stripAnsi(output ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.find((l) => /forbidden|unauthorized|not authorized|permission denied|access denied|\b401\b|\b403\b/i.test(l))
        ?? lines[0]
        ?? "Permission denied (no output).";
}

function _wrap(text, maxWidth) {
    const words = text.split(/\s+/);
    const out = [];
    let current = "";
    for (const word of words) {
        if (!current) { current = word; continue; }
        if (current.length + 1 + word.length <= maxWidth) current += " " + word;
        else { out.push(current); current = word; }
    }
    if (current) out.push(current);
    return out;
}

function _centreLine(rowIdx, text, color = "") {
    const visible = stripAnsi(text);
    const pad = Math.max(0, Math.floor((cols() - visible.length) / 2));
    moveTo(rowIdx, 1);
    w("\x1b[2K" + " ".repeat(pad) + color + text + (color ? RESET : ""));
}

export async function showAuthErrorPage(errorOutput) {
    if (!active) return;
    // Pause any splash animation so the warning page isn't redrawn over.
    const wasSplashVisible = _splashVisible;
    _splashVisible = false;

    clearContent();

    const top = _contentStart();
    const bottom = rows() - 1;
    const contentHeight = bottom - top + 1;
    const snippet = _pullAuthErrorSnippet(errorOutput);
    const wrapWidth = Math.max(40, Math.min(cols() - 8, 72));
    const wrappedSnippet = _wrap(snippet, wrapWidth);
    const question = "Are you logged into Azure, with PIM activated, on the correct network?";
    const wrappedQuestion = _wrap(question, wrapWidth);

    // Small ASCII warning triangle — each row is its own independent centre line,
    // so the slashes form a proper triangle widening from the apex.
    const warningArt = [
        "/█\\",
        "/ █ \\",
        "/  •  \\",
        "‾‾‾‾‾‾‾",
    ];
    const header = "Authentication / Permission Error";
    const dismiss = "Press any key to return.";

    const blockHeight = warningArt.length + 1 /*gap*/ + 1 /*header*/ + 1 /*gap*/ + wrappedSnippet.length + 1 /*gap*/ + wrappedQuestion.length + 1 /*gap*/ + 1 /*dismiss*/;
    const startRow = top + Math.max(1, Math.floor((contentHeight - blockHeight) / 2));

    let r = startRow;
    for (const line of warningArt) _centreLine(r++, line, `${BOLD}${YELLOW}`);
    r++;
    _centreLine(r++, header, `${BOLD}${YELLOW}`);
    r++;
    for (const line of wrappedSnippet) _centreLine(r++, line, DIM);
    r++;
    for (const line of wrappedQuestion) _centreLine(r++, line, YELLOW);
    r++;
    _centreLine(r++, dismiss, DIM);

    // Wait for any keypress, then clean up.
    return new Promise((resolve) => {
        const wasRaw = process.stdin.isRaw === true;
        const onData = () => cleanup();
        const cleanup = () => {
            process.stdin.off("data", onData);
            if (!wasRaw && process.stdin.setRawMode) process.stdin.setRawMode(false);
            process.stdin.pause();
            clearContent();
            // Restore splash animation only if it was running before — verb output normally
            // means we're past the splash phase, so this is just defensive.
            if (wasSplashVisible) { _splashVisible = true; _drawSplashArt(); }
            resolve();
        };
        if (!wasRaw && process.stdin.setRawMode) process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on("data", onData);
    });
}

// Renders a wizard "page": clears the content area and prints a bold title + dim
// description at the top, leaving the cursor positioned for a prompt to render below.
// Records the title-block height in _stepHeaderRows so searchableList can pin the prompt
// directly under it (rather than the default "anchored to bottom" main-menu layout).
export function step(title, description) {
    if (!active) {
        console.log(`\n  ${title}`);
        if (description) console.log(`  ${description}`);
        console.log("");
        return;
    }
    _splashVisible = false;
    clearContent();
    let lines = 0;
    w(`  ${BOLD}${CYAN}${title}${RESET}\r\n`); lines++;
    if (description) { w(`  ${DIM}${description}${RESET}\r\n`); lines++; }
    w("\r\n"); lines++;
    _stepHeaderRows = lines;
}
