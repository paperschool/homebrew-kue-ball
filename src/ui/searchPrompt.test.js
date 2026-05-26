import { describe, it, expect, vi } from "vitest";
import { PassThrough } from "node:stream";
import { resolvePageSize, Separator, searchPrompt } from "./searchPrompt.js";
import * as chrome from "./chrome.js";

describe("resolvePageSize()", () => {
    it("returns a static number unchanged", () => {
        expect(resolvePageSize(12)).toBe(12);
    });

    it("invokes a function and returns its value (reactive pageSize)", () => {
        let height = 30;
        const reactive = () => height;
        expect(resolvePageSize(reactive)).toBe(30);
        height = 18;
        expect(resolvePageSize(reactive)).toBe(18);
    });

    it("floors a non-integer value", () => {
        expect(resolvePageSize(() => 9.8)).toBe(9);
    });

    it("never returns less than 1, even for zero or negative sizes", () => {
        expect(resolvePageSize(0)).toBe(1);
        expect(resolvePageSize(-5)).toBe(1);
        expect(resolvePageSize(() => -100)).toBe(1);
    });

    it("falls back to the default page size when value is nullish", () => {
        expect(resolvePageSize(undefined)).toBe(7);
        expect(resolvePageSize(() => undefined)).toBe(7);
    });

    it("re-exports the @inquirer/core Separator", () => {
        expect(typeof Separator.isSeparator).toBe("function");
        expect(Separator.isSeparator(new Separator("x"))).toBe(true);
    });
});

describe("searchPrompt() — render & resize lifecycle (integration)", () => {
    function fakeTerminal() {
        const input = new PassThrough();
        input.isTTY = true;
        input.setRawMode = () => {};
        const output = new PassThrough();
        let buffer = "";
        output.on("data", (chunk) => { buffer += chunk.toString(); });
        return { input, output, read: () => buffer };
    }

    const flush = () => new Promise((resolve) => setImmediate(resolve));

    it("renders the message and items, subscribes to resize while active, and unsubscribes on close", async () => {
        const { input, output, read } = fakeTerminal();
        const controller = new AbortController();
        const baseResizeListeners = process.stdout.listenerCount("resize");

        const promise = searchPrompt(
            {
                message: "Pick a pod:",
                pageSize: 5,
                source: () => [
                    { name: "pod-alpha", value: "a" },
                    { name: "pod-beta", value: "b" },
                ],
            },
            { input, output, signal: controller.signal }
        );

        await flush();
        await flush();
        await flush();

        const frame = read();
        expect(frame).toContain("Pick a pod:");
        expect(frame).toContain("pod-alpha");
        expect(process.stdout.listenerCount("resize")).toBe(baseResizeListeners + 1);

        process.stdout.emit("resize"); // a resize while active must not crash the render loop
        await flush();

        controller.abort();
        await promise.catch(() => {});
        expect(process.stdout.listenerCount("resize")).toBe(baseResizeListeners);
    });

    it("repaints the prompt when chrome drives a resize (end-to-end)", async () => {
        const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        Object.defineProperty(process.stdout, "rows", { value: 24, configurable: true, writable: true });
        Object.defineProperty(process.stdout, "columns", { value: 80, configurable: true, writable: true });
        chrome.initChrome();

        const { input, output, read } = fakeTerminal();
        const controller = new AbortController();
        const promise = searchPrompt(
            {
                message: "Pick:",
                pageSize: () => Math.max(4, chrome.getContentRows() - 2),
                source: () => Array.from({ length: 50 }, (_, i) => ({ name: `item-${i}`, value: i })),
            },
            { input, output, signal: controller.signal }
        );
        await flush();
        await flush();
        await flush();
        const bytesBeforeResize = read().length;

        Object.defineProperty(process.stdout, "rows", { value: 50, configurable: true, writable: true });
        process.stdout.emit("resize");
        await new Promise((resolve) => setTimeout(resolve, 130)); // chrome debounce + repaint
        const bytesAfterResize = read().length;

        controller.abort();
        await promise.catch(() => {});
        chrome.destroyChrome();
        writeSpy.mockRestore();

        expect(bytesAfterResize).toBeGreaterThan(bytesBeforeResize);
    });
});
