import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/runner.js", () => ({
    runLive: vi.fn(),
    runLiveWithOptionalWatch: vi.fn(),
}));

vi.mock("../lib/shell.js", () => ({
    run: vi.fn(),
}));

vi.mock("../lib/output.js", () => ({
    warn: vi.fn(),
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
    select: vi.fn(),
    confirm: vi.fn(),
}));

import { runLive, runLiveWithOptionalWatch } from "../lib/runner.js";
import { run } from "../lib/shell.js";
import { warn } from "../lib/output.js";
import { select, confirm } from "@inquirer/prompts";

const CTX = "test-context";
const NS = "test-namespace";

beforeEach(() => {
    vi.resetAllMocks();
    mockAppName = "";
});

describe("buildDeploymentsCommands — APP_NAME unset", () => {
    it("returns 2 commands when APP_NAME is empty", async () => {
        mockAppName = "";
        const { buildDeploymentsCommands } = await import("./deployments.js");
        const cmds = buildDeploymentsCommands(CTX, NS);
        expect(cmds).toHaveLength(2);
        expect(cmds.every((c) => c.group === "Deployments")).toBe(true);
    });
});

describe("buildDeploymentsCommands — APP_NAME set", () => {
    it("returns 7 commands when APP_NAME is set", async () => {
        mockAppName = "my-app";
        const { buildDeploymentsCommands } = await import("./deployments.js");
        const cmds = buildDeploymentsCommands(CTX, NS);
        expect(cmds).toHaveLength(7);
    });

    it("Rollback deployment does not call runLive when confirm is false", async () => {
        mockAppName = "my-app";
        confirm.mockResolvedValue(false);
        const { buildDeploymentsCommands } = await import("./deployments.js");
        const cmds = buildDeploymentsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Rollback"));
        await cmd.run();
        expect(runLive).not.toHaveBeenCalled();
    });

    it("Rollback deployment calls runLive with rollout undo when confirmed", async () => {
        mockAppName = "my-app";
        confirm.mockResolvedValue(true);
        const { buildDeploymentsCommands } = await import("./deployments.js");
        const cmds = buildDeploymentsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Rollback"));
        await cmd.run();
        expect(runLive).toHaveBeenCalledWith(
            "kubectl",
            expect.arrayContaining(["rollout", "undo", "deployment/my-app"])
        );
    });

    it("Restart deployment calls runLive with rollout restart when confirmed", async () => {
        mockAppName = "my-app";
        confirm.mockResolvedValue(true);
        const { buildDeploymentsCommands } = await import("./deployments.js");
        const cmds = buildDeploymentsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Restart"));
        await cmd.run();
        expect(runLive).toHaveBeenCalledWith(
            "kubectl",
            expect.arrayContaining(["rollout", "restart", "deployment/my-app"])
        );
    });
});

describe("List deployments command", () => {
    it("calls runLiveWithOptionalWatch with get deployments args", async () => {
        const { buildDeploymentsCommands } = await import("./deployments.js");
        const cmds = buildDeploymentsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("List deployments"));
        await cmd.run();
        expect(runLiveWithOptionalWatch).toHaveBeenCalledWith(
            "kubectl",
            expect.arrayContaining(["get", "deployments"])
        );
    });
});

describe("Delete a deployment command", () => {
    it("calls warn and returns early when no deployments found", async () => {
        run.mockReturnValue(JSON.stringify({ items: [] }));
        const { buildDeploymentsCommands } = await import("./deployments.js");
        const cmds = buildDeploymentsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete"));
        await cmd.run();
        expect(warn).toHaveBeenCalled();
        expect(select).not.toHaveBeenCalled();
    });

    it("does not call runLive when confirm resolves false", async () => {
        const deployments = [
            {
                metadata: { name: "my-deploy", creationTimestamp: null, annotations: {} },
                status: { readyReplicas: 1 },
                spec: { replicas: 1 },
            },
        ];
        run.mockReturnValueOnce(JSON.stringify({ items: deployments }));
        run.mockReturnValueOnce(JSON.stringify({ items: [] }));
        select.mockResolvedValue("my-deploy");
        confirm.mockResolvedValue(false);
        const { buildDeploymentsCommands } = await import("./deployments.js");
        const cmds = buildDeploymentsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete"));
        await cmd.run();
        expect(runLive).not.toHaveBeenCalled();
    });

    it("deletes deployment and orphaned SAs when confirmed", async () => {
        const deployments = [
            {
                metadata: {
                    name: "my-deploy",
                    creationTimestamp: null,
                    annotations: { "meta.helm.sh/release-name": "my-release" },
                },
                status: { readyReplicas: 1 },
                spec: { replicas: 1 },
            },
        ];
        const serviceAccounts = [
            {
                metadata: {
                    name: "my-sa",
                    annotations: { "meta.helm.sh/release-name": "my-release" },
                },
            },
        ];
        run.mockReturnValueOnce(JSON.stringify({ items: deployments }));
        run.mockReturnValueOnce(JSON.stringify({ items: serviceAccounts }));
        select.mockResolvedValue("my-deploy");
        confirm.mockResolvedValue(true);
        const { buildDeploymentsCommands } = await import("./deployments.js");
        const cmds = buildDeploymentsCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete"));
        await cmd.run();
        expect(runLive).toHaveBeenCalledWith(
            "kubectl",
            expect.arrayContaining(["delete", "deployment", "my-deploy"])
        );
        expect(runLive).toHaveBeenCalledWith(
            "kubectl",
            expect.arrayContaining(["delete", "serviceaccount", "my-sa"])
        );
    });
});
