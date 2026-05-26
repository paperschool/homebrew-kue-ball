import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_DIR = join(homedir(), ".config", "kue-ball");
export const PREFS_PATH = join(CONFIG_DIR, "prefs.json");

export function loadPrefs() {
    if (!existsSync(PREFS_PATH)) return { subFrequency: {} };
    try {
        return JSON.parse(readFileSync(PREFS_PATH, "utf8"));
    } catch {
        return { subFrequency: {} };
    }
}

export function savePrefs(prefs) {
    try {
        mkdirSync(CONFIG_DIR, { recursive: true });
        writeFileSync(PREFS_PATH, JSON.stringify(prefs, null, 2) + "\n", "utf8");
    } catch {
        // non-fatal
    }
}
