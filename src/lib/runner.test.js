import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("./shell.js", () => ({
    run: vi.fn(),
    captureCommand: vi.fn(),
    spawnInteractive: vi.fn(),
    spawnInteractiveWithExitKeys: vi.fn(),
}));

vi.mock("./output.js", () => ({
    info: vi.fn(),
    DIM: "",
    RESET: "",
    BOLD: "",
}));

vi.mock("../ui/chrome.js", () => ({
    startProgress: vi.fn(),
    stopProgress: vi.fn(),
    setLastCommandRun: vi.fn(),
    showAuthErrorPage: vi.fn().mockResolvedValue(undefined),
    showNetworkErrorPage: vi.fn().mockResolvedValue(undefined),
    suspendChromeForStreaming: vi.fn(),
    resumeChromeAfterStreaming: vi.fn(),
}));

vi.mock("./azure.js", () => ({
    isPermissionError: vi.fn().mockReturnValue(false),
    isNetworkError: vi.fn().mockReturnValue(false),
}));

vi.mock("../ui/pager.js", () => ({
    pageOutput: vi.fn().mockResolvedValue(undefined),
}));

import * as shell from "./shell.js";
import * as chrome from "../ui/chrome.js";
import { isPermissionError, isNetworkError } from "./azure.js";
import { showAuthErrorPage, showNetworkErrorPage } from "../ui/chrome.js";
import { pageOutput } from "../ui/pager.js";
import {
    isJqAvailable,
    runLive,
    runShell,
    runLivePiped,
    runLivePipedWithExitKeys,
    runLiveWithOptionalWatch,
    RETURN_TO_MENU,
} from "./runner.js";

beforeEach(() => {
    shell.captureCommand.mockResolvedValue({ code: 0, output: "" });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("RETURN_TO_MENU", () => {
    it("is a non-empty string", () => {
        expect(typeof RETURN_TO_MENU).toBe("string");
        expect(RETURN_TO_MENU.length).toBeGreaterThan(0);
    });
});

describe("isJqAvailable()", () => {
    it("returns true when jq --version returns output", () => {
        shell.run.mockReturnValue("jq-1.7.1");
        expect(isJqAvailable()).toBe(true);
    });

    it("returns false when run returns null", () => {
        shell.run.mockReturnValue(null);
        expect(isJqAvailable()).toBe(false);
    });
});

describe("runLive()", () => {
    it("captures the command output, pages it, and returns the exit code", async () => {
        shell.captureCommand.mockResolvedValue({ code: 0, output: "pod-a\npod-b" });

        const code = await runLive("kubectl", ["get", "pods"]);

        expect(shell.captureCommand).toHaveBeenCalledWith("kubectl", ["get", "pods"]);
        expect(pageOutput).toHaveBeenCalledWith("pod-a\npod-b", expect.objectContaining({}));
        expect(code).toBe(0);
    });

    it("routes to the auth-error page (not the pager) when exit is non-zero and output looks like a permission error", async () => {
        shell.captureCommand.mockResolvedValue({
            code: 1,
            output: 'Error from server (Forbidden): deployments.apps "foo" is forbidden',
        });
        isPermissionError.mockReturnValueOnce(true);

        const code = await runLive("kubectl", ["get", "deployments"]);

        expect(showAuthErrorPage).toHaveBeenCalledWith(expect.stringContaining("Forbidden"));
        expect(pageOutput).not.toHaveBeenCalled();
        expect(code).toBe(1);
    });

    it("uses the pager (not the auth page) when exit is non-zero but it is NOT a permission error", async () => {
        shell.captureCommand.mockResolvedValue({ code: 1, output: "some other failure" });
        isPermissionError.mockReturnValueOnce(false);

        const code = await runLive("kubectl", ["get", "pods"]);

        expect(pageOutput).toHaveBeenCalledWith("some other failure", expect.objectContaining({}));
        expect(showAuthErrorPage).not.toHaveBeenCalled();
        expect(code).toBe(1);
    });

    it("uses the pager when exit is zero even if output happens to contain permission keywords", async () => {
        shell.captureCommand.mockResolvedValue({ code: 0, output: "Forbidden in field" });
        // Even if isPermissionError would say true, exit=0 should never trigger the warning page.
        isPermissionError.mockReturnValueOnce(true);

        await runLive("kubectl", ["get", "pods"]);

        expect(showAuthErrorPage).not.toHaveBeenCalled();
        expect(pageOutput).toHaveBeenCalled();
    });

    it("routes to the network-error page (not pager / auth) when exit is non-zero and output looks like a connectivity failure", async () => {
        shell.captureCommand.mockResolvedValue({
            code: 1,
            output: 'Error: kubernetes cluster unreachable: Get "https://x.azmk8s.io:443/version": dial tcp: lookup x.azmk8s.io: no such host',
        });
        isNetworkError.mockReturnValueOnce(true);

        const code = await runLive("kubectl", ["get", "pods"]);

        expect(showNetworkErrorPage).toHaveBeenCalledWith(expect.stringContaining("no such host"));
        expect(showAuthErrorPage).not.toHaveBeenCalled();
        expect(pageOutput).not.toHaveBeenCalled();
        expect(code).toBe(1);
    });

    it("prefers the network-error page over the auth-error page when both classifiers match", async () => {
        // Real-world case: kubelogin can't reach login.microsoftonline.com — output mentions
        // both "failed to get token" (could read as auth) and "no such host" (network). The
        // root cause is network, so we route there to avoid sending users to the PIM checklist.
        shell.captureCommand.mockResolvedValue({
            code: 1,
            output: "Error: failed to get token: unable to resolve an endpoint: dial tcp: lookup login.microsoftonline.com: no such host",
        });
        isNetworkError.mockReturnValueOnce(true);
        isPermissionError.mockReturnValueOnce(true);

        await runLive("kubectl", ["get", "pods"]);

        expect(showNetworkErrorPage).toHaveBeenCalledOnce();
        expect(showAuthErrorPage).not.toHaveBeenCalled();
    });

    it("records the actual command in the chrome header", async () => {
        await runLive("kubectl", ["get", "pods", "-o", "wide"]);
        expect(chrome.setLastCommandRun).toHaveBeenCalledWith("kubectl get pods -o wide");
    });

    it("streams (does not capture or page) an interactive shell", async () => {
        shell.spawnInteractive.mockResolvedValue(0);

        await runLive("kubectl", ["exec", "-it", "pod", "--", "sh"], { interactive: true });

        expect(shell.spawnInteractive).toHaveBeenCalledWith("kubectl", ["exec", "-it", "pod", "--", "sh"]);
        expect(shell.captureCommand).not.toHaveBeenCalled();
        expect(pageOutput).not.toHaveBeenCalled();
    });
});

describe("progress indicator", () => {
    it("starts and stops progress around the capture", async () => {
        await runLive("kubectl", ["get", "pods"]);
        expect(chrome.startProgress).toHaveBeenCalledOnce();
        expect(chrome.stopProgress).toHaveBeenCalledOnce();
    });

    it("does not animate progress for an interactive shell", async () => {
        shell.spawnInteractive.mockResolvedValue(0);
        await runLive("kubectl", ["exec", "-it", "p", "--", "sh"], { interactive: true });
        expect(chrome.startProgress).not.toHaveBeenCalled();
        expect(chrome.stopProgress).not.toHaveBeenCalled();
    });

    it("stops progress even if the capture rejects", async () => {
        shell.captureCommand.mockRejectedValue(new Error("boom"));
        await expect(runLive("kubectl", ["get", "pods"])).rejects.toThrow("boom");
        expect(chrome.startProgress).toHaveBeenCalledOnce();
        expect(chrome.stopProgress).toHaveBeenCalledOnce();
    });
});

describe("runShell()", () => {
    it("captures the sh -c pipeline, pages it, and records the header", async () => {
        shell.captureCommand.mockResolvedValue({ code: 0, output: "table" });

        const code = await runShell("kubectl get cm | jq .");

        expect(shell.captureCommand).toHaveBeenCalledWith("sh", ["-c", "kubectl get cm | jq ."]);
        expect(pageOutput).toHaveBeenCalledWith("table", expect.objectContaining({}));
        expect(chrome.setLastCommandRun).toHaveBeenCalledWith("kubectl get cm | jq .");
        expect(code).toBe(0);
    });
});

describe("runLivePiped()", () => {
    it("captures sh -c with the jq pipe when jq is available", async () => {
        shell.run.mockReturnValue("jq-1.7.1"); // isJqAvailable = true

        await runLivePiped("kubectl", ["logs", "my-pod"]);

        const [cmd, args] = shell.captureCommand.mock.calls[0];
        expect(cmd).toBe("sh");
        expect(args[0]).toBe("-c");
        expect(args[1]).toContain("kubectl logs my-pod");
        expect(args[1]).toContain("jq");
    });

    it("captures the original command when jq is NOT available", async () => {
        shell.run.mockReturnValue(null); // isJqAvailable = false

        await runLivePiped("kubectl", ["logs", "my-pod"]);

        const [cmd, args] = shell.captureCommand.mock.calls[0];
        expect(cmd).toBe("kubectl");
        expect(args).toEqual(["logs", "my-pod"]);
    });
});

describe("runLivePipedWithExitKeys()", () => {
    it("streams via the exit-keys spawn and returns RETURN_TO_MENU", async () => {
        shell.run.mockReturnValue(null); // jq unavailable
        shell.spawnInteractiveWithExitKeys.mockResolvedValue(0);

        const result = await runLivePipedWithExitKeys("kubectl", ["get", "pods"]);

        expect(shell.spawnInteractiveWithExitKeys).toHaveBeenCalledOnce();
        expect(result).toBe(RETURN_TO_MENU);
    });
});

describe("runLiveWithOptionalWatch()", () => {
    it("returns the exit code without watching when command is not kubectl", async () => {
        const result = await runLiveWithOptionalWatch("helm", ["list"]);

        expect(result).toBe(0);
        expect(shell.captureCommand).toHaveBeenCalledOnce();
        expect(shell.spawnInteractive).not.toHaveBeenCalled(); // no watch re-run
    });

    it("returns the exit code without watching when kubectl exits non-zero", async () => {
        shell.captureCommand.mockResolvedValue({ code: 1, output: "" });

        const result = await runLiveWithOptionalWatch("kubectl", ["get", "pods"]);

        expect(result).toBe(1);
        expect(shell.spawnInteractive).not.toHaveBeenCalled();
    });

    it("does not re-run in watch mode when stdin is not a TTY", async () => {
        const originalIsTTY = process.stdin.isTTY;
        Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });

        const result = await runLiveWithOptionalWatch("kubectl", ["get", "pods"]);

        Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });

        expect(result).toBe(0);
        expect(shell.spawnInteractive).not.toHaveBeenCalled();
    });
});
