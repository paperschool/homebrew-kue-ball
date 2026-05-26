import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    CYAN, YELLOW, GREEN, RED, BLUE, DIM, BOLD, RESET,
    stripAnsi,
    styleDeleteCommandLabel,
    styleVerbLabel,
    ok,
    warn,
    info,
    header,
    printCommand,
} from "./output.js";

describe("ANSI constants", () => {
    it("exports non-empty ANSI escape strings", () => {
        for (const constant of [CYAN, YELLOW, GREEN, RED, BLUE, DIM, BOLD, RESET]) {
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

describe("styleVerbLabel", () => {
    it("colours the delete verb red", () => {
        const result = styleVerbLabel("delete", "Delete");
        expect(result).toContain(RED);
        expect(result).toContain(RESET);
        expect(stripAnsi(result)).toBe("Delete");
    });

    it("colours the edit verb yellow", () => {
        const result = styleVerbLabel("edit", "Edit");
        expect(result).toContain(YELLOW);
        expect(stripAnsi(result)).toBe("Edit");
    });

    it("colours the logs verb blue", () => {
        const result = styleVerbLabel("logs", "Stream logs");
        expect(result).toContain(BLUE);
        expect(stripAnsi(result)).toBe("Stream logs");
    });

    it("also colours logsPrevious and logsToFile blue (prefix match)", () => {
        expect(styleVerbLabel("logsPrevious", "Previous container logs")).toContain(BLUE);
        expect(styleVerbLabel("logsToFile",   "Dump logs to file")).toContain(BLUE);
    });

    it("colours exec verbs green (interactive into the container)", () => {
        expect(styleVerbLabel("exec",       "Shell into pod")).toContain(GREEN);
        expect(styleVerbLabel("execOneOff", "Run one-off command")).toContain(GREEN);
        expect(stripAnsi(styleVerbLabel("exec", "Shell into pod"))).toBe("Shell into pod");
    });

    it("returns the label unchanged for verbs without a colour rule", () => {
        expect(styleVerbLabel("list", "List")).toBe("List");
        expect(styleVerbLabel("describe", "Describe")).toBe("Describe");
        expect(styleVerbLabel("scale", "Scale")).toBe("Scale");
    });

    it("matches the verb KEY, not the label — renaming displayName does not break colouring", () => {
        const renamed = styleVerbLabel("delete", "Remove forever");
        expect(renamed).toContain(RED);
        expect(stripAnsi(renamed)).toBe("Remove forever");
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
