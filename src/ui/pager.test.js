import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./chrome.js", () => ({
    getContentStart: vi.fn(() => 6),
    getContentRows: vi.fn(() => 18),
    isActive: vi.fn(() => false),
    onResize: vi.fn(() => () => {}),
}));

vi.mock("../lib/output.js", () => ({
    DIM: "",
    RESET: "",
    BOLD: "",
    CYAN: "",
}));

import { isQuitKey, scrollFor, hScrollFor, filterLines, pageOutput } from "./pager.js";

describe("isQuitKey()", () => {
    it("treats q, Esc, Enter and Ctrl-C as quit", () => {
        for (const key of ["q", "\x1b", "\r", "\x03"]) {
            expect(isQuitKey(key)).toBe(true);
        }
    });

    it("does not treat arrow keys or navigation keys as quit", () => {
        for (const key of ["\x1b[A", "\x1b[B", "j", "k", " ", "g", "G"]) {
            expect(isQuitKey(key)).toBe(false);
        }
    });
});

describe("scrollFor()", () => {
    it("scrolls one line with arrows / j / k", () => {
        expect(scrollFor("\x1b[B", 0, 10, 50)).toBe(1); // down
        expect(scrollFor("j", 0, 10, 50)).toBe(1);
        expect(scrollFor("\x1b[A", 5, 10, 50)).toBe(4); // up
        expect(scrollFor("k", 5, 10, 50)).toBe(4);
    });

    it("pages by the viewport height with PgUp/PgDn/space", () => {
        expect(scrollFor("\x1b[6~", 0, 10, 50)).toBe(10); // PgDn
        expect(scrollFor(" ", 0, 10, 50)).toBe(10);
        expect(scrollFor("\x1b[5~", 20, 10, 50)).toBe(10); // PgUp
    });

    it("jumps to top/bottom with g/G", () => {
        expect(scrollFor("g", 30, 10, 50)).toBe(0);
        expect(scrollFor("G", 0, 10, 50)).toBe(50);
    });

    it("clamps to [0, maxScroll]", () => {
        expect(scrollFor("\x1b[A", 0, 10, 50)).toBe(0);   // can't go above the top
        expect(scrollFor("\x1b[B", 50, 10, 50)).toBe(50); // can't go below the bottom
    });

    it("returns the current scroll for unrecognised keys", () => {
        expect(scrollFor("x", 7, 10, 50)).toBe(7);
    });

    it("ignores horizontal keys", () => {
        expect(scrollFor("\x1b[C", 5, 10, 50)).toBe(5);
        expect(scrollFor("\x1b[D", 5, 10, 50)).toBe(5);
    });
});

describe("hScrollFor()", () => {
    it("pans right/left with arrows and h/l", () => {
        expect(hScrollFor("\x1b[C", 0, 20, 100)).toBe(20); // right
        expect(hScrollFor("l", 0, 20, 100)).toBe(20);
        expect(hScrollFor("\x1b[D", 40, 20, 100)).toBe(20); // left
        expect(hScrollFor("h", 40, 20, 100)).toBe(20);
    });

    it("resets to the left edge with 0", () => {
        expect(hScrollFor("0", 80, 20, 100)).toBe(0);
    });

    it("clamps to [0, maxHScroll]", () => {
        expect(hScrollFor("\x1b[D", 0, 20, 100)).toBe(0);
        expect(hScrollFor("\x1b[C", 100, 20, 100)).toBe(100);
    });

    it("ignores vertical keys", () => {
        expect(hScrollFor("\x1b[B", 30, 20, 100)).toBe(30);
        expect(hScrollFor("j", 30, 20, 100)).toBe(30);
    });
});

describe("filterLines()", () => {
    const table = ["NAME READY STATUS", "web 1/1 Running", "api 0/1 Pending", "db 1/1 Running"];

    it("returns all lines and no sticky header when the query is empty", () => {
        const { sticky, body } = filterLines(table, "");
        expect(sticky).toBeNull();
        expect(body).toEqual(table);
    });

    it("filters case-insensitively by substring and pins the column header", () => {
        const { sticky, body } = filterLines(table, "running");
        expect(sticky).toBe("NAME READY STATUS");
        expect(body).toEqual(["web 1/1 Running", "db 1/1 Running"]);
    });

    it("does not pin a non-header first line (e.g. log output)", () => {
        const logs = ["2026 starting up", "2026 request ok", "2026 request fail"];
        const { sticky, body } = filterLines(logs, "request");
        expect(sticky).toBeNull();
        expect(body).toEqual(["2026 request ok", "2026 request fail"]);
    });

    it("returns an empty body when nothing matches", () => {
        const { body } = filterLines(table, "zzz-nope");
        expect(body).toEqual([]);
    });
});

describe("pageOutput()", () => {
    afterEach(() => vi.restoreAllMocks());

    it("prints the output (no interactive paging) when stdin is not a TTY", async () => {
        const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

        await pageOutput("line1\nline2\nline3");

        const written = writeSpy.mock.calls.map(([a]) => a).join("");
        expect(written).toContain("line1\nline2\nline3");
    });
});
