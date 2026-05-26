import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("./shell.js", () => ({
    run: vi.fn(),
    spawnInteractive: vi.fn(),
}));

vi.mock("child_process", () => ({
    spawnSync: vi.fn(),
}));

vi.mock("./output.js", () => ({
    warn: vi.fn(),
    ok: vi.fn(),
    info: vi.fn(),
    DIM: "",
    RESET: "",
    CYAN: "",
    YELLOW: "",
    BOLD: "",
    stripAnsi: (s) => s,
}));

vi.mock("./prefs.js", () => ({
    loadPrefs: vi.fn(() => ({ subFrequency: {} })),
    savePrefs: vi.fn(),
}));

vi.mock("./kubectl.js", () => ({
    getContexts: vi.fn(() => []),
}));

vi.mock("@inquirer/prompts", () => ({
    confirm: vi.fn(),
    search: vi.fn(),
}));

import * as cp from "child_process";
import * as shell from "./shell.js";
import { loadPrefs } from "./prefs.js";
import {
    isAzCliAvailable,
    isPermissionError,
    showPimReminder,
    listSubscriptions,
    listAksClustersForSub,
    subscriptionForContext,
} from "./azure.js";
import * as output from "./output.js";

afterEach(() => {
    vi.clearAllMocks();
});

describe("subscriptionForContext()", () => {
    it("returns the mapped subscription for a known context", () => {
        vi.mocked(loadPrefs).mockReturnValue({ contextSubscriptions: { "my-ctx": "MySub" } });
        expect(subscriptionForContext("my-ctx")).toBe("MySub");
    });

    it("returns null for an unknown context", () => {
        vi.mocked(loadPrefs).mockReturnValue({ subFrequency: {} });
        expect(subscriptionForContext("missing")).toBeNull();
    });
});

describe("isAzCliAvailable()", () => {
    it("returns true when az version succeeds", () => {
        shell.run.mockReturnValue("2.58.0");
        expect(isAzCliAvailable()).toBe(true);
    });

    it("returns false when run returns null", () => {
        shell.run.mockReturnValue(null);
        expect(isAzCliAvailable()).toBe(false);
    });
});

describe("isPermissionError()", () => {
    it("returns true for 'forbidden'", () => {
        expect(isPermissionError("Access Forbidden to resource")).toBe(true);
    });

    it("returns true for '403'", () => {
        expect(isPermissionError("Error code: 403")).toBe(true);
    });

    it("returns true for '401'", () => {
        expect(isPermissionError("unauthorized 401")).toBe(true);
    });

    it("returns true for 'permission denied'", () => {
        expect(isPermissionError("permission denied on resource")).toBe(true);
    });

    it("returns false for unrelated error messages", () => {
        expect(isPermissionError("resource not found")).toBe(false);
        expect(isPermissionError("network timeout")).toBe(false);
    });

    it("handles null/undefined gracefully", () => {
        expect(isPermissionError(null)).toBe(false);
        expect(isPermissionError(undefined)).toBe(false);
    });
});

describe("showPimReminder()", () => {
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("calls warn and info", () => {
        showPimReminder();
        expect(output.warn).toHaveBeenCalledOnce();
        expect(output.info).toHaveBeenCalled();
    });
});

describe("listSubscriptions()", () => {
    it("returns parsed subscription array on success", () => {
        const subs = [{ id: "sub-1", name: "My Sub" }];
        shell.run.mockReturnValue(JSON.stringify(subs));
        expect(listSubscriptions()).toEqual(subs);
    });

    it("returns [] when run returns null", () => {
        shell.run.mockReturnValue(null);
        expect(listSubscriptions()).toEqual([]);
    });

    it("returns [] when run returns invalid JSON", () => {
        shell.run.mockReturnValue("not-json");
        expect(listSubscriptions()).toEqual([]);
    });
});

describe("listAksClustersForSub()", () => {
    it("returns clusters array on success", () => {
        const clusters = [{ name: "my-cluster", resourceGroup: "rg-1", location: "eastus" }];
        cp.spawnSync.mockReturnValue({
            status: 0,
            stdout: JSON.stringify(clusters),
            stderr: "",
        });
        expect(listAksClustersForSub("sub-1")).toEqual({ clusters, error: null });
    });

    it("returns { clusters: [], error } when exit status is non-zero", () => {
        cp.spawnSync.mockReturnValue({
            status: 1,
            stdout: "",
            stderr: "Error: forbidden to access subscription",
        });
        const result = listAksClustersForSub("sub-1");
        expect(result.clusters).toEqual([]);
        expect(result.error).toBeTruthy();
    });

    it("returns { clusters: [], error } when spawnSync throws", () => {
        cp.spawnSync.mockImplementation(() => {
            throw new Error("spawn failed");
        });
        const result = listAksClustersForSub("sub-1");
        expect(result.clusters).toEqual([]);
        expect(result.error).toBeTruthy();
    });
});
