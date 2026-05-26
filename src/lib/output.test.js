import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    CYAN, YELLOW, GREEN, RED, DIM, BOLD, RESET,
    stripAnsi,
    styleDeleteCommandLabel,
    ok,
    warn,
    info,
    header,
    printCommand,
} from "./output.js";

describe("ANSI constants", () => {
    it("exports non-empty ANSI escape strings", () => {
        for (const constant of [CYAN, YELLOW, GREEN, RED, DIM, BOLD, RESET]) {
            expect(typeof constant).toBe("string");
            expect(constant.length).toBeGreaterThan(0);
        }
    });
});

describe("stripAnsi", () => {
    it("removes ANSI escape sequences", () => {
        const coloured = `\x1b[32mhello\x1b[0m world\x1b[90m dim\x1b[0m`;
        expect(stripAnsi(coloured)).toBe("hello world dim");
    });

    it("passes plain strings through unchanged", () => {
        expect(stripAnsi("plain text")).toBe("plain text");
    });

    it("handles null/undefined gracefully", () => {
        expect(stripAnsi(null)).toBe("");
        expect(stripAnsi(undefined)).toBe("");
    });
});

describe("styleDeleteCommandLabel", () => {
    it("wraps the word 'delete' in RED when present", () => {
        const result = styleDeleteCommandLabel("delete pod");
        expect(result).toContain(RED);
        expect(result).toContain(RESET);
        expect(stripAnsi(result)).toBe("delete pod");
    });

    it("handles mixed case 'Delete'", () => {
        const result = styleDeleteCommandLabel("Delete resource");
        expect(result).toContain(RED);
        expect(stripAnsi(result)).toBe("Delete resource");
    });

    it("returns the label unchanged when 'delete' is absent", () => {
        const label = "list pods";
        expect(styleDeleteCommandLabel(label)).toBe(label);
    });
});

describe("logging helpers", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("ok() calls console.log", () => {
        ok("everything fine");
        expect(console.log).toHaveBeenCalledOnce();
        const [msg] = console.log.mock.calls[0];
        expect(stripAnsi(msg)).toContain("everything fine");
    });

    it("warn() calls console.log", () => {
        warn("something wrong");
        expect(console.log).toHaveBeenCalledOnce();
        const [msg] = console.log.mock.calls[0];
        expect(stripAnsi(msg)).toContain("something wrong");
    });

    it("info() calls console.log", () => {
        info("some detail");
        expect(console.log).toHaveBeenCalledOnce();
        const [msg] = console.log.mock.calls[0];
        expect(stripAnsi(msg)).toContain("some detail");
    });

    it("header() calls console.log", () => {
        header("Section Title");
        expect(console.log).toHaveBeenCalledOnce();
        const [msg] = console.log.mock.calls[0];
        expect(stripAnsi(msg)).toContain("Section Title");
    });

    it("printCommand() calls console.log", () => {
        printCommand("kubectl get pods");
        expect(console.log).toHaveBeenCalledOnce();
        const [msg] = console.log.mock.calls[0];
        expect(stripAnsi(msg)).toContain("kubectl get pods");
    });
});
