// ── ANSI colour constants ─────────────────────────────────────────────────

export const CYAN = "\x1b[36m";
export const YELLOW = "\x1b[33m";
export const GREEN = "\x1b[32m";
export const RED = "\x1b[31m";
export const DIM = "\x1b[90m";
export const BOLD = "\x1b[1m";
export const RESET = "\x1b[0m";

// ── String helpers ────────────────────────────────────────────────────────

export function stripAnsi(str) {
    return (str ?? "").replace(/\x1b\[[0-9;]*m/g, "");
}

export function styleDeleteCommandLabel(label) {
    if (!/\bdelete\b/i.test(stripAnsi(label))) return label;
    return label.replace(/delete/gi, (match) => `${RED}${match}${RESET}`);
}

// ── Logging helpers ───────────────────────────────────────────────────────

export function ok(text) {
    console.log(`${GREEN}✓${RESET} ${text}`);
}

export function warn(text) {
    console.log(`${YELLOW}⚠${RESET} ${text}`);
}

export function info(text) {
    console.log(`  ${DIM}${text}${RESET}`);
}

export function header(text) {
    console.log(`\n${BOLD}  ${text}${RESET}\n`);
}

export function printCommand(cmd) {
    console.log(`\n  ${DIM}▶ ${cmd}${RESET}\n`);
}
