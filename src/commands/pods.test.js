import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/runner.js", () => ({
    runLive: vi.fn(),
    runLiveWithOptionalWatch: vi.fn(),
}));

vi.mock("../lib/kubectl.js", () => ({
    pickPod: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
    confirm: vi.fn(),
}));

vi.mock("../lib/output.js", () => ({
    DIM: "",
    RESET: "",
}));

import { runLive, runLiveWithOptionalWatch } from "../lib/runner.js";
import { pickPod } from "../lib/kubectl.js";
import { confirm } from "@inquirer/prompts";
import { buildPodsCommands } from "./pods.js";

const CTX = "test-context";
const NS = "test-namespace";

beforeEach(() => {
    vi.resetAllMocks();
});

describe("buildPodsCommands", () => {
    it("returns 4 commands all with group 'Pods'", () => {
        const cmds = buildPodsCommands(CTX, NS);
        expect(cmds).toHaveLength(4);
        for (const cmd of cmds) {
            expect(cmd.group).toBe("Pods");
            expect(typeof cmd.name).toBe("string");
            expect(cmd.name.length).toBeGreaterThan(0);
            expect(typeof cmd.run).toBe("function");
        }
    });

    it("is a pure factory — two calls return independent arrays", () => {
        const a = buildPodsCommands(CTX, NS);
        const b = buildPodsCommands(CTX, NS);
        expect(a).not.toBe(b);
    });
});

describe("List pods command", () => {
    it("calls runLiveWithOptionalWatch with kubectl and namespace flag", async () => {
        const cmds = buildPodsCommands(CTX, NS);
        const cmd = cmds.find((c) => /^List pods\b/.test(c.name) && !c.name.includes("all"));
        await cmd.run();
        expect(runLiveWithOptionalWatch).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "get",
            "pods",
            "-o",
            "wide",
        ]);
    });
});

describe("List pods — all namespaces command", () => {
    it("calls runLiveWithOptionalWatch with -A flag and no --namespace flag", async () => {
        const cmds = buildPodsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("all namespaces"));
        await cmd.run();
        const [, args] = runLiveWithOptionalWatch.mock.calls[0];
        expect(args).toContain("-A");
        expect(args.every((a) => !a.startsWith("--namespace="))).toBe(true);
    });
});

describe("Describe a pod command", () => {
    it("returns early without calling runLive when pickPod returns null", async () => {
        pickPod.mockResolvedValue(null);
        const cmds = buildPodsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Describe"));
        await cmd.run();
        expect(runLive).not.toHaveBeenCalled();
    });

    it("calls runLive with describe pod args when pickPod returns a pod name", async () => {
        pickPod.mockResolvedValue("my-pod");
        const cmds = buildPodsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Describe"));
        await cmd.run();
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "describe",
            "pod",
            "my-pod",
        ]);
    });
});

describe("Delete a pod command", () => {
    it("returns early without calling confirm when pickPod returns null", async () => {
        pickPod.mockResolvedValue(null);
        const cmds = buildPodsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete"));
        await cmd.run();
        expect(confirm).not.toHaveBeenCalled();
        expect(runLive).not.toHaveBeenCalled();
    });

    it("does not call runLive when confirm resolves false", async () => {
        pickPod.mockResolvedValue("my-pod");
        confirm.mockResolvedValue(false);
        const cmds = buildPodsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete"));
        await cmd.run();
        expect(runLive).not.toHaveBeenCalled();
    });

    it("calls runLive with delete pod args when confirmed", async () => {
        pickPod.mockResolvedValue("my-pod");
        confirm.mockResolvedValue(true);
        const cmds = buildPodsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete"));
        await cmd.run();
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "delete",
            "pod",
            "my-pod",
        ]);
    });

    it("confirm is called with default: false", async () => {
        pickPod.mockResolvedValue("my-pod");
        confirm.mockResolvedValue(false);
        const cmds = buildPodsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete"));
        await cmd.run();
        expect(confirm).toHaveBeenCalledWith(
            expect.objectContaining({ default: false })
        );
    });
});
