import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./shell.js", () => ({
    run: vi.fn(),
}));

import * as shell from "./shell.js";
import { isHelmAvailable, listHelmReleases } from "./helm.js";

afterEach(() => {
    vi.clearAllMocks();
});

describe("isHelmAvailable()", () => {
    it("returns true when helm version --short returns a version string", () => {
        shell.run.mockReturnValue("v3.14.0+gcf9b4f0");
        expect(isHelmAvailable()).toBe(true);
    });

    it("returns false when run returns null", () => {
        shell.run.mockReturnValue(null);
        expect(isHelmAvailable()).toBe(false);
    });
});

describe("listHelmReleases()", () => {
    it("passes exact helm args to shell.run", () => {
        shell.run.mockReturnValue("[]");
        listHelmReleases("my-ctx", "my-ns");

        const [cmd] = shell.run.mock.calls[0];
        expect(cmd).toContain("helm list");
        expect(cmd).toContain("--namespace my-ns");
        expect(cmd).toContain("--kube-context my-ctx");
        expect(cmd).toContain("-o json");
    });

    it("appends extra filter flags when provided (e.g. --pending, --failed)", () => {
        shell.run.mockReturnValue("[]");
        listHelmReleases("my-ctx", "my-ns", ["--pending"]);
        const [cmd] = shell.run.mock.calls[0];
        expect(cmd).toContain("--pending");
    });

    it("returns parsed array of release objects on valid JSON", () => {
        const releases = [
            { name: "my-release", namespace: "my-ns", status: "deployed" },
        ];
        shell.run.mockReturnValue(JSON.stringify(releases));
        expect(listHelmReleases("ctx", "ns")).toEqual(releases);
    });

    it("returns [] when run returns null", () => {
        shell.run.mockReturnValue(null);
        expect(listHelmReleases("ctx", "ns")).toEqual([]);
    });

    it("returns [] when run returns invalid JSON", () => {
        shell.run.mockReturnValue("not-json{{");
        expect(listHelmReleases("ctx", "ns")).toEqual([]);
    });
});
