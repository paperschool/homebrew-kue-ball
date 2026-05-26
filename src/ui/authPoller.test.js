import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/shell.js", () => ({
    commandSucceeds: vi.fn(),
}));

import { startAuthPoller, stopAuthPoller } from "./authPoller.js";
import { commandSucceeds } from "../lib/shell.js";

// Flush the pending async check (a resolved promise) under fake timers.
const flush = () => vi.advanceTimersByTimeAsync(0);

describe("authPoller", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(commandSucceeds).mockReset();
    });

    afterEach(() => {
        stopAuthPoller();
        vi.useRealTimers();
    });

    it("immediately calls onStatusChange('checking') on start", () => {
        vi.mocked(commandSucceeds).mockResolvedValue(true);
        const cb = vi.fn();
        startAuthPoller(cb);
        expect(cb).toHaveBeenCalledWith("checking");
    });

    it("calls onStatusChange('ok') once the async check succeeds", async () => {
        vi.mocked(commandSucceeds).mockResolvedValue(true);
        const cb = vi.fn();
        startAuthPoller(cb);
        await flush();
        expect(cb).toHaveBeenCalledWith("ok");
    });

    it("calls onStatusChange('error') when the async check fails", async () => {
        vi.mocked(commandSucceeds).mockResolvedValue(false);
        const cb = vi.fn();
        startAuthPoller(cb);
        await flush();
        expect(cb).toHaveBeenCalledWith("error");
    });

    it("re-checks once after advancing 15s", async () => {
        vi.mocked(commandSucceeds).mockResolvedValue(true);
        const cb = vi.fn();
        startAuthPoller(cb);
        await flush();
        cb.mockClear();
        await vi.advanceTimersByTimeAsync(15_000);
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith("ok");
    });

    it("re-checks twice after advancing 30s", async () => {
        vi.mocked(commandSucceeds).mockResolvedValue(true);
        const cb = vi.fn();
        startAuthPoller(cb);
        await flush();
        cb.mockClear();
        await vi.advanceTimersByTimeAsync(30_000);
        expect(cb).toHaveBeenCalledTimes(2);
    });

    it("stops further callbacks after stopAuthPoller()", async () => {
        vi.mocked(commandSucceeds).mockResolvedValue(true);
        const cb = vi.fn();
        startAuthPoller(cb);
        await flush();
        stopAuthPoller();
        cb.mockClear();
        await vi.advanceTimersByTimeAsync(30_000);
        expect(cb).not.toHaveBeenCalled();
    });
});
