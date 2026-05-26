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
}));

import { runLive, runLiveWithOptionalWatch } from "../lib/runner.js";
import { run } from "../lib/shell.js";
import { warn } from "../lib/output.js";
import { select, confirm } from "@inquirer/prompts";
import { buildServicesCommands } from "./services.js";

const CTX = "test-context";
const NS = "test-namespace";

beforeEach(() => {
    vi.resetAllMocks();
});

describe("buildServicesCommands", () => {
    it("returns 6 commands all with group 'Services & Ingress'", () => {
        const cmds = buildServicesCommands(CTX, NS);
        expect(cmds).toHaveLength(6);
        expect(cmds.every((c) => c.group === "Services & Ingress")).toBe(true);
    });
});

describe("List services", () => {
    it("calls runLiveWithOptionalWatch with get services", async () => {
        const cmds = buildServicesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("List services"));
        await cmd.run();
        expect(runLiveWithOptionalWatch).toHaveBeenCalledWith(
            "kubectl",
            expect.arrayContaining(["get", "services"])
        );
    });
});

describe("List service accounts", () => {
    it("calls runLiveWithOptionalWatch with get serviceaccounts", async () => {
        const cmds = buildServicesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("List service accounts"));
        await cmd.run();
        expect(runLiveWithOptionalWatch).toHaveBeenCalledWith(
            "kubectl",
            expect.arrayContaining(["get", "serviceaccounts"])
        );
    });
});

describe("List ingresses", () => {
    it("calls runLiveWithOptionalWatch with get ingress", async () => {
        const cmds = buildServicesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("List ingresses"));
        await cmd.run();
        expect(runLiveWithOptionalWatch).toHaveBeenCalledWith(
            "kubectl",
            expect.arrayContaining(["get", "ingress"])
        );
    });
});

describe("List VirtualService", () => {
    it("calls runLiveWithOptionalWatch with get virtualservice", async () => {
        const cmds = buildServicesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("List VirtualService"));
        await cmd.run();
        expect(runLiveWithOptionalWatch).toHaveBeenCalledWith(
            "kubectl",
            expect.arrayContaining(["get", "virtualservice"])
        );
    });
});

describe("Delete service", () => {
    it("calls warn and returns early when no services found", async () => {
        run.mockReturnValue(JSON.stringify({ items: [] }));
        const cmds = buildServicesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete service") && !c.name.includes("account"));
        await cmd.run();
        expect(warn).toHaveBeenCalled();
        expect(select).not.toHaveBeenCalled();
    });

    it("does not call runLive when confirm resolves false", async () => {
        const services = [
            { metadata: { name: "my-svc", creationTimestamp: null }, spec: { type: "ClusterIP" } },
        ];
        run.mockReturnValue(JSON.stringify({ items: services }));
        select.mockResolvedValue("my-svc");
        confirm.mockResolvedValue(false);
        const cmds = buildServicesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete service") && !c.name.includes("account"));
        await cmd.run();
        expect(runLive).not.toHaveBeenCalled();
    });

    it("calls runLive with delete service args when confirmed", async () => {
        const services = [
            { metadata: { name: "my-svc", creationTimestamp: null }, spec: { type: "ClusterIP" } },
        ];
        run.mockReturnValue(JSON.stringify({ items: services }));
        select.mockResolvedValue("my-svc");
        confirm.mockResolvedValue(true);
        const cmds = buildServicesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete service") && !c.name.includes("account"));
        await cmd.run();
        expect(runLive).toHaveBeenCalledWith(
            "kubectl",
            expect.arrayContaining(["delete", "service", "my-svc"])
        );
    });
});

describe("Delete service account", () => {
    it("calls warn and returns early when no service accounts found", async () => {
        run.mockReturnValue(JSON.stringify({ items: [] }));
        const cmds = buildServicesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete service account"));
        await cmd.run();
        expect(warn).toHaveBeenCalled();
        expect(select).not.toHaveBeenCalled();
    });

    it("calls runLive with delete serviceaccount args when confirmed", async () => {
        const sas = [
            { metadata: { name: "my-sa", creationTimestamp: null } },
        ];
        run.mockReturnValue(JSON.stringify({ items: sas }));
        select.mockResolvedValue("my-sa");
        confirm.mockResolvedValue(true);
        const cmds = buildServicesCommands(CTX, NS);
        const cmd = cmds.find((c) => c.name.includes("Delete service account"));
        await cmd.run();
        expect(runLive).toHaveBeenCalledWith(
            "kubectl",
            expect.arrayContaining(["delete", "serviceaccount", "my-sa"])
        );
    });
});
