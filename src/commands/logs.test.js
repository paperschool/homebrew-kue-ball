import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/runner.js", () => ({
    runLivePipedWithExitKeys: vi.fn(),
    runLivePiped: vi.fn(),
    runShell: vi.fn(),
    isJqAvailable: vi.fn(),
}));

vi.mock("../lib/kubectl.js", () => ({
    pickPod: vi.fn(),
}));

vi.mock("../lib/shell.js", () => ({
    run: vi.fn(),
    spawnInteractive: vi.fn(),
}));

vi.mock("../lib/output.js", () => ({
    ok: vi.fn(),
    warn: vi.fn(),
    printCommand: vi.fn(),
    DIM: "",
    RESET: "",
}));

let mockAppName = "";
vi.mock("../lib/env.js", () => ({
    get APP_NAME() {
        return mockAppName;
    },
}));

vi.mock("@inquirer/prompts", () => ({
    input: vi.fn(),
}));

import { runLivePipedWithExitKeys, runLivePiped, runShell, isJqAvailable } from "../lib/runner.js";
import { pickPod } from "../lib/kubectl.js";
import { run } from "../lib/shell.js";
import { ok, warn } from "../lib/output.js";
import { input } from "@inquirer/prompts";

const CTX = "test-context";
const NS = "test-namespace";

beforeEach(() => {
    vi.resetAllMocks();
    mockAppName = "";
});

describe("buildLogsCommands — APP_NAME unset", () => {
    it("returns 3 commands when APP_NAME is empty", async () => {
        mockAppName = "";
        const { buildLogsCommands } = await import("./logs.js");
        const cmds = buildLogsCommands(CTX, NS);
        expect(cmds).toHaveLength(3);
        expect(cmds.every((c) => c.group === "Logs")).toBe(true);
    });
});

describe("buildLogsCommands — APP_NAME set", () => {
    it("returns 4 commands when APP_NAME is set", async () => {
        mockAppName = "my-app";
        const { buildLogsCommands } = await import("./logs.js");
        const cmds = buildLogsCommands(CTX, NS);
        expect(cmds).toHaveLength(4);
    });

    it("first command streams logs with selector", async () => {
        mockAppName = "my-app";
        const { buildLogsCommands } = await import("./logs.js");
        const cmds = buildLogsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("latest pod"));
        await cmd.run();
        expect(runLivePipedWithExitKeys).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "logs",
            "-f",
            "--selector=app=my-app",
            "--tail=100",
            "--max-log-requests=5",
        ]);
    });
});

describe("Stream logs — specific pod", () => {
    it("returns early when pickPod returns null", async () => {
        const { buildLogsCommands } = await import("./logs.js");
        pickPod.mockResolvedValue(null);
        const cmds = buildLogsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("specific pod"));
        await cmd.run();
        expect(runLivePipedWithExitKeys).not.toHaveBeenCalled();
    });

    it("calls runLivePipedWithExitKeys with pod and follow flags", async () => {
        const { buildLogsCommands } = await import("./logs.js");
        pickPod.mockResolvedValue("my-pod");
        const cmds = buildLogsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("specific pod"));
        await cmd.run();
        expect(runLivePipedWithExitKeys).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "logs",
            "-f",
            "my-pod",
            "--tail=200",
        ]);
    });
});

describe("Previous container logs", () => {
    it("returns early when pickPod returns null", async () => {
        const { buildLogsCommands } = await import("./logs.js");
        pickPod.mockResolvedValue(null);
        const cmds = buildLogsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Previous"));
        await cmd.run();
        expect(runLivePiped).not.toHaveBeenCalled();
    });

    it("calls runLivePiped with --previous flag", async () => {
        const { buildLogsCommands } = await import("./logs.js");
        pickPod.mockResolvedValue("crash-pod");
        const cmds = buildLogsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Previous"));
        await cmd.run();
        expect(runLivePiped).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "logs",
            "crash-pod",
            "--previous",
            "--tail=300",
        ]);
    });
});

describe("Dump logs to file", () => {
    it("returns early when pickPod returns null", async () => {
        const { buildLogsCommands } = await import("./logs.js");
        pickPod.mockResolvedValue(null);
        const cmds = buildLogsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Dump"));
        await cmd.run();
        expect(runShell).not.toHaveBeenCalled();
    });

    it("runs the shell pipeline and calls ok on exit code 0", async () => {
        const { buildLogsCommands } = await import("./logs.js");
        pickPod.mockResolvedValue("my-pod");
        input.mockResolvedValue("50");
        isJqAvailable.mockReturnValue(false);
        runShell.mockResolvedValue(0);
        const cmds = buildLogsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Dump"));
        await cmd.run();
        expect(runShell).toHaveBeenCalledWith(expect.stringContaining("logs"));
        expect(ok).toHaveBeenCalled();
    });

    it("calls warn when the shell pipeline exits non-zero", async () => {
        const { buildLogsCommands } = await import("./logs.js");
        pickPod.mockResolvedValue("my-pod");
        input.mockResolvedValue("");
        isJqAvailable.mockReturnValue(false);
        runShell.mockResolvedValue(1);
        const cmds = buildLogsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Dump"));
        await cmd.run();
        expect(warn).toHaveBeenCalled();
    });

    it("includes jq pipe when isJqAvailable returns true", async () => {
        const { buildLogsCommands } = await import("./logs.js");
        pickPod.mockResolvedValue("my-pod");
        input.mockResolvedValue("");
        isJqAvailable.mockReturnValue(true);
        runShell.mockResolvedValue(0);
        const cmds = buildLogsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Dump"));
        await cmd.run();
        const shellCmd = runShell.mock.calls[0][0];
        expect(shellCmd).toContain("jq");
    });
});
