import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("child_process", () => ({
    execSync: vi.fn(),
    spawn: vi.fn(),
    spawnSync: vi.fn(),
}));

vi.mock("./output.js", () => ({
    warn: vi.fn(),
}));

import * as cp from "child_process";
import { run, commandSucceeds, captureCommand, spawnInteractive, spawnInteractiveWithExitKeys } from "./shell.js";

describe("run()", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns trimmed stdout on success", () => {
        cp.execSync.mockReturnValue("  hello world  ");
        expect(run("echo hello")).toBe("hello world");
    });

    it("returns null when execSync throws", () => {
        cp.execSync.mockImplementation(() => {
            throw new Error("command not found");
        });
        expect(run("bad-cmd")).toBeNull();
    });

    it("includes ~/.rd/bin, /opt/homebrew/bin, /usr/local/bin in PATH", () => {
        cp.execSync.mockReturnValue("ok");
        run("some-cmd");

        const [, opts] = cp.execSync.mock.calls[0];
        expect(opts.env.PATH).toContain(`${process.env.HOME}/.rd/bin`);
        expect(opts.env.PATH).toContain("/opt/homebrew/bin");
        expect(opts.env.PATH).toContain("/usr/local/bin");
    });

    it("prepends extra paths before the existing PATH", () => {
        cp.execSync.mockReturnValue("ok");
        run("some-cmd");

        const [, opts] = cp.execSync.mock.calls[0];
        const extraEnd = opts.env.PATH.indexOf("/usr/local/bin") + "/usr/local/bin".length;
        const originalStart = opts.env.PATH.indexOf(process.env.PATH ?? "");
        expect(extraEnd).toBeLessThanOrEqual(originalStart);
    });
});

describe("commandSucceeds()", () => {
    afterEach(() => vi.clearAllMocks());

    function mockProc(event, arg) {
        return { kill: vi.fn(), on: vi.fn((e, cb) => { if (e === event) cb(arg); }) };
    }

    it("resolves true when the process exits 0", async () => {
        cp.spawn.mockReturnValue(mockProc("exit", 0));
        await expect(commandSucceeds("az account show")).resolves.toBe(true);
    });

    it("resolves false when the process exits non-zero", async () => {
        cp.spawn.mockReturnValue(mockProc("exit", 1));
        await expect(commandSucceeds("az account show")).resolves.toBe(false);
    });

    it("resolves false when the process errors", async () => {
        cp.spawn.mockReturnValue(mockProc("error", new Error("not found")));
        await expect(commandSucceeds("bad-cmd")).resolves.toBe(false);
    });

    it("runs the command through a shell with an augmented PATH", async () => {
        cp.spawn.mockReturnValue(mockProc("exit", 0));
        await commandSucceeds("az account show");
        const [cmd, opts] = cp.spawn.mock.calls[0];
        expect(cmd).toBe("az account show");
        expect(opts.shell).toBe(true);
        expect(opts.env.PATH).toContain("/opt/homebrew/bin");
    });
});

describe("captureCommand()", () => {
    afterEach(() => vi.clearAllMocks());

    function captureProc({ stdout = "", stderr = "", code = 0 } = {}) {
        return {
            stdout: { on: (ev, cb) => { if (ev === "data" && stdout) cb(Buffer.from(stdout)); } },
            stderr: { on: (ev, cb) => { if (ev === "data" && stderr) cb(Buffer.from(stderr)); } },
            kill: vi.fn(),
            on: (ev, cb) => { if (ev === "close") cb(code); },
        };
    }

    it("resolves with combined stdout+stderr and the exit code", async () => {
        cp.spawn.mockReturnValue(captureProc({ stdout: "out-", stderr: "err", code: 0 }));

        const result = await captureCommand("kubectl", ["get", "pods"]);

        expect(result.code).toBe(0);
        expect(result.output).toBe("out-err");
    });

    it("resolves with code 1 and the message on spawn error", async () => {
        cp.spawn.mockReturnValue({
            stdout: { on: () => {} },
            stderr: { on: () => {} },
            kill: vi.fn(),
            on: (ev, cb) => { if (ev === "error") cb(new Error("nope")); },
        });

        const result = await captureCommand("bad-cmd", []);

        expect(result.code).toBe(1);
        expect(result.output).toContain("nope");
    });

    it("passes the augmented PATH env", async () => {
        cp.spawn.mockReturnValue(captureProc({ code: 0 }));

        await captureCommand("kubectl", ["get", "pods"]);

        const [, , opts] = cp.spawn.mock.calls[0];
        expect(opts.env.PATH).toContain("/opt/homebrew/bin");
    });
});

describe("spawnInteractive()", () => {
    it("returns a Promise", () => {
        const mockProc = {
            on: vi.fn((event, cb) => {
                if (event === "exit") cb(0);
            }),
        };
        cp.spawn.mockReturnValue(mockProc);

        const result = spawnInteractive("kubectl", ["get", "pods"]);
        expect(result).toBeInstanceOf(Promise);
    });

    it("resolves with the exit code", async () => {
        const mockProc = {
            on: vi.fn((event, cb) => {
                if (event === "exit") cb(42);
            }),
        };
        cp.spawn.mockReturnValue(mockProc);

        await expect(spawnInteractive("kubectl", ["get", "pods"])).resolves.toBe(42);
    });
});

describe("spawnInteractiveWithExitKeys()", () => {
    it("returns a Promise", () => {
        const mockProc = {
            stdin: { write: vi.fn() },
            killed: false,
            kill: vi.fn(),
            on: vi.fn((event, cb) => {
                if (event === "exit") cb(0);
            }),
        };
        cp.spawn.mockReturnValue(mockProc);

        const result = spawnInteractiveWithExitKeys("sh", ["-c", "top"]);
        expect(result).toBeInstanceOf(Promise);
    });
});
