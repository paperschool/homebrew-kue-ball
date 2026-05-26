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

vi.mock("@inquirer/prompts", () => ({
    select: vi.fn(),
    confirm: vi.fn(),
    input: vi.fn(),
}));

import { runLive, runLiveWithOptionalWatch } from "../lib/runner.js";
import { run } from "../lib/shell.js";
import { warn } from "../lib/output.js";
import { select, confirm, input } from "@inquirer/prompts";
import { buildReplicaSetsCommands } from "./replicasets.js";

const CTX = "test-ctx";
const NS = "test-ns";
const RS_JSON = JSON.stringify({
    items: [
        { metadata: { name: "web-abc123", ownerReferences: [{ name: "web" }] }, spec: { replicas: 3 }, status: { readyReplicas: 3 } },
        { metadata: { name: "api-def456" }, spec: { replicas: 2 }, status: { readyReplicas: 1 } },
    ],
});

beforeEach(() => {
    vi.clearAllMocks();
});

describe("buildReplicaSetsCommands", () => {
    it("returns 4 commands all in the 'ReplicaSets' group", () => {
        const cmds = buildReplicaSetsCommands(CTX, NS);
        expect(cmds).toHaveLength(4);
        expect(cmds.every((c) => c.group === "ReplicaSets")).toBe(true);
    });
});

describe("List replica sets", () => {
    it("runs get replicasets with the namespace flag", async () => {
        const cmd = buildReplicaSetsCommands(CTX, NS).find((c) => c.name.includes("List"));
        await cmd.run();
        expect(runLiveWithOptionalWatch).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "get",
            "replicasets",
        ]);
    });
});

describe("Describe a replica set", () => {
    it("describes the selected replica set", async () => {
        run.mockReturnValue(RS_JSON);
        select.mockResolvedValue("web-abc123");
        const cmd = buildReplicaSetsCommands(CTX, NS).find((c) => c.name.includes("Describe"));
        await cmd.run();
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "describe",
            "replicaset",
            "web-abc123",
        ]);
    });

    it("warns and does nothing when there are no replica sets", async () => {
        run.mockReturnValue(JSON.stringify({ items: [] }));
        const cmd = buildReplicaSetsCommands(CTX, NS).find((c) => c.name.includes("Describe"));
        await cmd.run();
        expect(warn).toHaveBeenCalled();
        expect(runLive).not.toHaveBeenCalled();
    });
});

describe("Scale a replica set", () => {
    it("scales the selected replica set to the entered count", async () => {
        run.mockReturnValue(RS_JSON);
        select.mockResolvedValue("api-def456");
        input.mockResolvedValue("5");
        const cmd = buildReplicaSetsCommands(CTX, NS).find((c) => c.name.includes("Scale"));
        await cmd.run();
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "scale",
            "replicaset",
            "api-def456",
            "--replicas=5",
        ]);
    });
});

describe("Delete a replica set", () => {
    it("deletes after confirmation", async () => {
        run.mockReturnValue(RS_JSON);
        select.mockResolvedValue("web-abc123");
        confirm.mockResolvedValue(true);
        const cmd = buildReplicaSetsCommands(CTX, NS).find((c) => c.name.includes("Delete"));
        await cmd.run();
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "delete",
            "replicaset",
            "web-abc123",
        ]);
    });

    it("does not delete when not confirmed", async () => {
        run.mockReturnValue(RS_JSON);
        select.mockResolvedValue("web-abc123");
        confirm.mockResolvedValue(false);
        const cmd = buildReplicaSetsCommands(CTX, NS).find((c) => c.name.includes("Delete"));
        await cmd.run();
        expect(runLive).not.toHaveBeenCalled();
    });
});
