import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadPrefs, savePrefs, CONFIG_DIR, PREFS_PATH } from "./prefs.js";

vi.mock("node:fs", () => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
}));

import * as fs from "node:fs";

describe("CONFIG_DIR / PREFS_PATH", () => {
    it("CONFIG_DIR ends with .config/kue-ball", () => {
        expect(CONFIG_DIR).toMatch(/\.config[\\/]kue-ball$/);
    });

    it("PREFS_PATH ends with prefs.json", () => {
        expect(PREFS_PATH).toMatch(/prefs\.json$/);
    });
});

describe("loadPrefs()", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns { subFrequency: {} } when prefs file does not exist", () => {
        fs.existsSync.mockReturnValue(false);
        expect(loadPrefs()).toEqual({ subFrequency: {} });
    });

    it("returns { subFrequency: {} } when prefs file contains invalid JSON", () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue("not-valid-json{{");
        expect(loadPrefs()).toEqual({ subFrequency: {} });
    });

    it("returns parsed prefs when file contains valid JSON", () => {
        const prefs = { subFrequency: { "abc-123": 3 } };
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(JSON.stringify(prefs));
        expect(loadPrefs()).toEqual(prefs);
    });
});

describe("savePrefs()", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("calls mkdirSync before writeFileSync", () => {
        const callOrder = [];
        fs.mkdirSync.mockImplementation(() => callOrder.push("mkdir"));
        fs.writeFileSync.mockImplementation(() => callOrder.push("write"));

        savePrefs({ subFrequency: {} });

        expect(callOrder[0]).toBe("mkdir");
        expect(callOrder[1]).toBe("write");
    });

    it("calls mkdirSync with recursive: true", () => {
        savePrefs({ subFrequency: {} });
        expect(fs.mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
    });

    it("writes pretty-printed JSON followed by a newline", () => {
        const prefs = { subFrequency: { "sub-1": 2 } };
        savePrefs(prefs);

        const [, content] = fs.writeFileSync.mock.calls[0];
        expect(content).toBe(JSON.stringify(prefs, null, 2) + "\n");
    });
});
