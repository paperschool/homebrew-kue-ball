import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./searchPrompt.js", () => ({
    searchPrompt: vi.fn(),
    Separator: class Separator {
        constructor(line) {
            this.type = "separator";
            this.separator = line;
        }
    },
}));

vi.mock("../lib/output.js", () => ({
    CYAN: "\x1b[36m",
    DIM: "\x1b[90m",
    RESET: "\x1b[0m",
    stripAnsi: (str) => (str ?? "").replace(/\x1b\[[0-9;]*m/g, ""),
}));

vi.mock("./chrome.js", () => ({
    isActive: vi.fn().mockReturnValue(false),
    getContentRows: vi.fn().mockReturnValue(20),
    getStepHeaderRows: vi.fn().mockReturnValue(0),
}));

import * as prompt from "./searchPrompt.js";
import * as chrome from "./chrome.js";
import { fuzzyMatch, searchableList } from "./searchableList.js";

describe("fuzzyMatch()", () => {
    it("returns true when every character of query appears in order in text", () => {
        expect(fuzzyMatch("pod", "my-pod-abc")).toBe(true);
    });

    it("returns false when query characters are not present in order", () => {
        expect(fuzzyMatch("xyz", "pod")).toBe(false);
    });

    it("returns true for an empty query (matches anything)", () => {
        expect(fuzzyMatch("", "anything")).toBe(true);
    });

    it("strips ANSI escape sequences from text before matching", () => {
        expect(fuzzyMatch("pod", "\x1b[32mmy-pod\x1b[0m")).toBe(true);
        expect(fuzzyMatch("pod", "\x1b[90mpod-name\x1b[0m")).toBe(true);
    });

    it("is case-insensitive", () => {
        expect(fuzzyMatch("POD", "my-pod")).toBe(true);
        expect(fuzzyMatch("pod", "MY-POD")).toBe(true);
    });
});

describe("searchableList()", () => {
    let capturedSource;

    beforeEach(() => {
        vi.clearAllMocks();
        prompt.searchPrompt.mockImplementation(({ source }) => {
            capturedSource = source;
            return Promise.resolve("mocked-value");
        });
    });

    it("calls the prompt with the provided message", async () => {
        await searchableList({ message: "Pick one:", items: [] });
        expect(prompt.searchPrompt).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Pick one:" })
        );
    });

    it("returns all items when query is empty (no groups)", async () => {
        const items = [
            { name: "alpha", value: "a" },
            { name: "beta", value: "b" },
        ];
        await searchableList({ message: "Pick:", items });
        const result = capturedSource("");
        expect(result).toEqual([
            { name: "alpha", value: "a" },
            { name: "beta", value: "b" },
        ]);
    });

    it("filters items by fuzzy match when query is provided (no groups)", async () => {
        const items = [
            { name: "my-pod-abc", value: "pod-abc" },
            { name: "service-xyz", value: "svc-xyz" },
        ];
        await searchableList({ message: "Pick:", items });
        const result = capturedSource("pod");
        expect(result).toHaveLength(1);
        expect(result[0].value).toBe("pod-abc");
    });

    it("groups items under Separator headers when group is set", async () => {
        const items = [
            { name: "pod-a", value: "pod-a", group: "Pods" },
            { name: "svc-a", value: "svc-a", group: "Services" },
        ];
        await searchableList({ message: "Pick:", items });
        const result = capturedSource("");
        const separators = result.filter((r) => r.type === "separator");
        expect(separators).toHaveLength(2);
        expect(separators[0].separator).toContain("Pods");
        expect(separators[1].separator).toContain("Services");
    });

    it("omits a group's Separator when no items in that group match the query", async () => {
        const items = [
            { name: "my-pod", value: "pod", group: "Pods" },
            { name: "my-service", value: "svc", group: "Services" },
        ];
        await searchableList({ message: "Pick:", items });
        const result = capturedSource("pod");
        const separators = result.filter((r) => r.type === "separator");
        expect(separators).toHaveLength(1);
        expect(separators[0].separator).toContain("Pods");
    });
});

describe("searchableList() — chrome-aware behaviour (Story 5.4)", () => {
    let writeSpy;

    function pageSizeOf() {
        return prompt.searchPrompt.mock.calls[0][0].pageSize;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(process.stdout, "rows", { value: 30, configurable: true, writable: true });
        writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        prompt.searchPrompt.mockImplementation(() => Promise.resolve("mocked"));
    });

    afterEach(() => {
        writeSpy.mockRestore();
        vi.mocked(chrome.isActive).mockReturnValue(false);
    });

    it("passes a reactive pageSize function resolving to the chrome formula when active", async () => {
        vi.mocked(chrome.isActive).mockReturnValue(true);
        vi.mocked(chrome.getContentRows).mockReturnValue(25);
        await searchableList({ message: "Pick:", items: [] });
        expect(typeof pageSizeOf()).toBe("function");
        expect(pageSizeOf()()).toBe(Math.max(4, 25 - 3));
    });

    it("reflects the live content height each time the pageSize function is called", async () => {
        vi.mocked(chrome.isActive).mockReturnValue(true);
        vi.mocked(chrome.getContentRows).mockReturnValue(25);
        await searchableList({ message: "Pick:", items: [] });
        const resolve = pageSizeOf();
        expect(resolve()).toBe(22);
        vi.mocked(chrome.getContentRows).mockReturnValue(10);
        expect(resolve()).toBe(7);
    });

    it("writes cursor-positioning escape before the prompt when chrome is active", async () => {
        vi.mocked(chrome.isActive).mockReturnValue(true);
        vi.mocked(chrome.getContentRows).mockReturnValue(20);
        await searchableList({ message: "Pick:", items: [] });
        const expectedRow = 30 - 3;
        expect(writeSpy).toHaveBeenCalledWith(`\x1b[${expectedRow};1H`);
    });

    it("uses the original pageSize formula via the function when chrome is not active", async () => {
        vi.mocked(chrome.isActive).mockReturnValue(false);
        await searchableList({ message: "Pick:", items: [] });
        expect(pageSizeOf()()).toBe(Math.max(8, 30 - 4));
    });

    it("does not write cursor-positioning escape when chrome is not active", async () => {
        vi.mocked(chrome.isActive).mockReturnValue(false);
        await searchableList({ message: "Pick:", items: [] });
        const hasPositioning = writeSpy.mock.calls.some(
            ([a]) => typeof a === "string" && /\x1b\[\d+;1H/.test(a)
        );
        expect(hasPositioning).toBe(false);
    });
});
