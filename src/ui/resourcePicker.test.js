import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/output.js", () => ({
    DIM: "\x1b[90m",
    RESET: "\x1b[0m",
    warn: vi.fn(),
}));

vi.mock("./searchableList.js", () => ({
    searchableList: vi.fn(),
}));

import * as output from "../lib/output.js";
import * as searchableListModule from "./searchableList.js";
import { resourcePicker } from "./resourcePicker.js";

describe("resourcePicker()", () => {
    let stdoutWrites;

    beforeEach(() => {
        vi.clearAllMocks();
        stdoutWrites = [];
        vi.spyOn(process.stdout, "write").mockImplementation((text) => {
            stdoutWrites.push(text);
            return true;
        });
        searchableListModule.searchableList.mockResolvedValue("selected-item");
    });

    it("writes the spinner message to stdout before fetching", async () => {
        const fetchFn = vi.fn().mockResolvedValue([{ name: "a", value: "a" }]);
        await resourcePicker({
            spinnerMessage: "Fetching pods",
            emptyMessage: "No pods found.",
            fetchFn,
        });

        expect(stdoutWrites[0]).toContain("Fetching pods");
        expect(stdoutWrites[0]).toContain("…");
    });

    it("clears the spinner line after fetchFn resolves", async () => {
        const fetchFn = vi.fn().mockResolvedValue([{ name: "a", value: "a" }]);
        await resourcePicker({
            spinnerMessage: "Fetching",
            emptyMessage: "None.",
            fetchFn,
        });

        expect(stdoutWrites[1]).toBe("\r\x1b[2K");
    });

    it("calls warn and returns null when fetchFn returns an empty array", async () => {
        const fetchFn = vi.fn().mockResolvedValue([]);
        const result = await resourcePicker({
            spinnerMessage: "Fetching",
            emptyMessage: "No items found.",
            fetchFn,
        });

        expect(output.warn).toHaveBeenCalledWith("No items found.");
        expect(result).toBeNull();
    });

    it("delegates to searchableList when items are present and returns its value", async () => {
        const items = [{ name: "pod-a", value: "pod-a" }];
        const fetchFn = vi.fn().mockResolvedValue(items);
        const result = await resourcePicker({
            spinnerMessage: "Fetching",
            emptyMessage: "None.",
            fetchFn,
            listOptions: { message: "Select pod:" },
        });

        expect(searchableListModule.searchableList).toHaveBeenCalledWith(
            expect.objectContaining({ message: "Select pod:", items })
        );
        expect(result).toBe("selected-item");
    });

    it("applies mapFn to each item before passing to searchableList", async () => {
        const raw = [{ podName: "pod-a" }];
        const fetchFn = vi.fn().mockResolvedValue(raw);
        const mapFn = (p) => ({ name: p.podName, value: p.podName });

        await resourcePicker({
            spinnerMessage: "Fetching",
            emptyMessage: "None.",
            fetchFn,
            mapFn,
        });

        const [{ items }] = searchableListModule.searchableList.mock.calls[0];
        expect(items).toEqual([{ name: "pod-a", value: "pod-a" }]);
    });

    it("calls warn with emptyMessage (not spinnerMessage) when result is empty", async () => {
        const fetchFn = vi.fn().mockResolvedValue([]);
        await resourcePicker({
            spinnerMessage: "Fetching pods",
            emptyMessage: "No pods in this namespace.",
            fetchFn,
        });

        expect(output.warn).toHaveBeenCalledWith("No pods in this namespace.");
        expect(output.warn).not.toHaveBeenCalledWith("Fetching pods");
    });
});
