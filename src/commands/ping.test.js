import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/ping.js", () => ({
    getIngressInfo: vi.fn(),
    getVirtualServiceInfo: vi.fn(),
    pingOnce: vi.fn(),
    sleep: vi.fn(() => Promise.resolve()), // skip the real inter-round delay in tests
}));

vi.mock("../lib/output.js", () => ({
    info: vi.fn(),
    warn: vi.fn(),
    GREEN: "",
    YELLOW: "",
    RED: "",
    DIM: "",
    RESET: "",
    BOLD: "",
}));

vi.mock("@inquirer/prompts", () => ({
    confirm: vi.fn(),
    input: vi.fn(),
}));

vi.mock("../ui/chrome.js", () => ({
    startProgress: vi.fn(),
    stopProgress: vi.fn(),
}));

import { getIngressInfo, getVirtualServiceInfo, pingOnce, sleep } from "../lib/ping.js";
import { info } from "../lib/output.js";
import { confirm, input } from "@inquirer/prompts";
import { startProgress, stopProgress } from "../ui/chrome.js";
import { buildPingCommands } from "./ping.js";

const CTX = "test-ctx";
const NS = "test-ns";
const INGRESS = {
    baseUrl: "https://example.com",
    routes: [
        { label: "/", path: "/" },
        { label: "/api/health", path: "/api/health" },
    ],
};
const VS = { baseUrl: "https://vs.example.com", routes: [{ label: "/", path: "/" }] };

beforeEach(() => {
    vi.clearAllMocks();
    getIngressInfo.mockReturnValue(null);
    getVirtualServiceInfo.mockReturnValue(null);
    pingOnce.mockResolvedValue({ status: 200, ms: 50, ok: true });
    confirm.mockResolvedValue(true);
    input.mockResolvedValue("http://localhost:3000");
});

describe("buildPingCommands", () => {
    it("returns exactly 1 command with group 'Ping'", () => {
        const cmds = buildPingCommands(CTX, NS);
        expect(cmds).toHaveLength(1);
        expect(cmds[0].group).toBe("Ping");
        expect(typeof cmds[0].run).toBe("function");
    });
});

describe("progress indicator", () => {
    it("starts and stops the footer progress bar around the ping loop", async () => {
        getIngressInfo.mockReturnValue(INGRESS);
        const cmds = buildPingCommands(CTX, NS);
        await cmds[0].run();
        expect(startProgress).toHaveBeenCalledOnce();
        expect(stopProgress).toHaveBeenCalledOnce();
    });
});

describe("Ping all routes — discovery fallback", () => {
    it("does not call getVirtualServiceInfo when getIngressInfo returns a result", async () => {
        getIngressInfo.mockReturnValue(INGRESS);
        const [cmd] = buildPingCommands(CTX, NS);
        await cmd.run();
        expect(getVirtualServiceInfo).not.toHaveBeenCalled();
    });

    it("calls info with the discovered base URL when ingress is found", async () => {
        getIngressInfo.mockReturnValue(INGRESS);
        const [cmd] = buildPingCommands(CTX, NS);
        await cmd.run();
        expect(info).toHaveBeenCalledWith(expect.stringContaining(INGRESS.baseUrl));
    });

    it("does not call input for manual URL when getVirtualServiceInfo returns a result", async () => {
        getVirtualServiceInfo.mockReturnValue(VS);
        const [cmd] = buildPingCommands(CTX, NS);
        await cmd.run();
        expect(input).not.toHaveBeenCalled();
    });

    it("calls input for manual URL when both discovery methods return null", async () => {
        const [cmd] = buildPingCommands(CTX, NS);
        await cmd.run();
        expect(input).toHaveBeenCalledWith(expect.objectContaining({ message: "App base URL:" }));
    });

    it("pings every discovered route once per round (rounds × routes)", async () => {
        getIngressInfo.mockReturnValue(INGRESS);
        const [cmd] = buildPingCommands(CTX, NS);
        await cmd.run();
        expect(pingOnce).toHaveBeenCalledTimes(INGRESS.routes.length * 3); // 3 rounds
        for (const route of INGRESS.routes) {
            expect(pingOnce).toHaveBeenCalledWith(`${INGRESS.baseUrl}${route.path}`, 5000);
        }
    });

    it("waits between rounds but not after the last one", async () => {
        getIngressInfo.mockReturnValue(INGRESS);
        const [cmd] = buildPingCommands(CTX, NS);
        await cmd.run();
        expect(sleep).toHaveBeenCalledTimes(2); // 3 rounds → 2 inter-round pauses
        expect(sleep).toHaveBeenCalledWith(1000);
    });

    it("uses 4 default routes when both discovery methods return null", async () => {
        const [cmd] = buildPingCommands(CTX, NS);
        await cmd.run();
        expect(pingOnce).toHaveBeenCalledTimes(4 * 3); // 4 default routes × 3 rounds
    });
});
