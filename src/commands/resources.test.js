import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/runner.js", () => ({
    runLiveWithOptionalWatch: vi.fn(),
    runLive: vi.fn(),
    runShell: vi.fn(),
}));

vi.mock("../lib/output.js", () => ({
    DIM: "",
    RESET: "",
}));

import { runLiveWithOptionalWatch, runLive, runShell } from "../lib/runner.js";
import { buildResourcesCommands } from "./resources.js";

const CTX = "test-context";
const NS = "test-namespace";

beforeEach(() => {
    vi.resetAllMocks();
});

describe("buildResourcesCommands", () => {
    it("returns 6 commands all with group 'Resources'", () => {
        const cmds = buildResourcesCommands(CTX, NS);
        expect(cmds).toHaveLength(6);
        expect(cmds.every((c) => c.group === "Resources")).toBe(true);
    });
});

describe("Top pods (usage)", () => {
    it("calls runLiveWithOptionalWatch with top pods and namespace flag", async () => {
        const cmds = buildResourcesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name === `Top pods  (CPU/memory usage)`);
        await cmd.run();
        expect(runLiveWithOptionalWatch).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "top",
            "pods",
        ]);
    });
});

describe("Top nodes", () => {
    it("calls runLiveWithOptionalWatch with top nodes and no namespace flag", async () => {
        const cmds = buildResourcesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Top nodes"));
        await cmd.run();
        const [, args] = runLiveWithOptionalWatch.mock.calls[0];
        expect(args).toContain("top");
        expect(args).toContain("nodes");
        expect(args.every((a) => !a.startsWith("--namespace="))).toBe(true);
    });
});

describe("Top pods — per container", () => {
    it("by CPU runs top pods --containers --sort-by=cpu (no watch)", async () => {
        const cmds = buildResourcesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("per container, by CPU"));
        await cmd.run();
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "top",
            "pods",
            "--containers",
            "--sort-by=cpu",
        ]);
    });

    it("by memory sorts with --sort-by=memory", async () => {
        const cmds = buildResourcesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("per container, by memory"));
        await cmd.run();
        const [, args] = runLive.mock.calls[0];
        expect(args).toContain("--containers");
        expect(args).toContain("--sort-by=memory");
    });
});

describe("Pod requests & limits", () => {
    it("runs get pods with a requests/limits custom-columns spec", async () => {
        const cmds = buildResourcesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("requests & limits"));
        await cmd.run();
        const [, args] = runLive.mock.calls[0];
        expect(args).toContain("get");
        expect(args).toContain("pods");
        const colsArg = args.find((a) => a.startsWith("custom-columns="));
        expect(colsArg).toContain("CPU_REQ:.spec.containers[*].resources.requests.cpu");
        expect(colsArg).toContain("MEM_LIM:.spec.containers[*].resources.limits.memory");
    });
});

describe("Pod usage vs requests", () => {
    it("runs a shell pipeline joining top usage with requests", async () => {
        const cmds = buildResourcesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("usage vs requests"));
        await cmd.run();
        const [cmdStr] = runShell.mock.calls[0];
        expect(cmdStr).toContain("top pods --no-headers");
        expect(cmdStr).toContain("get pods --no-headers");
        expect(cmdStr).toContain("awk");
        expect(cmdStr).toContain("column -t");
        expect(cmdStr).toContain(`--context=${CTX}`);
    });
});
