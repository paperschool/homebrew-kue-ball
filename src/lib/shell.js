import { execSync, spawn, spawnSync } from "child_process";
import { warn } from "./output.js";

function buildEnv() {
    const extraPaths = [
        `${process.env.HOME}/.rd/bin`,
        "/opt/homebrew/bin",
        "/usr/local/bin",
    ].join(":");
    return { ...process.env, PATH: `${extraPaths}:${process.env.PATH}` };
}

export function run(cmd, { silent = false } = {}) {
    try {
        return execSync(cmd, {
            encoding: "utf8",
            stdio: silent ? ["ignore", "pipe", "ignore"] : ["ignore", "pipe", "pipe"],
            timeout: 10_000,
            env: buildEnv(),
        }).trim();
    } catch {
        return null;
    }
}

// Runs a command asynchronously (through a shell) and resolves to whether it
// succeeded (exit code 0). Non-blocking, so the UI event loop stays free to animate.
export function commandSucceeds(cmd) {
    return new Promise((resolve) => {
        const child = spawn(cmd, { shell: true, stdio: "ignore", env: buildEnv() });
        const timer = setTimeout(() => { child.kill(); resolve(false); }, 10_000);
        child.on("exit", (code) => { clearTimeout(timer); resolve(code === 0); });
        child.on("error", () => { clearTimeout(timer); resolve(false); });
    });
}

// Runs a command asynchronously, collecting stdout+stderr into a string. Non-blocking
// (so the UI can animate while it runs) and never throws — resolves { code, output }.
export function captureCommand(cmd, args, timeoutMs = 60_000) {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { env: buildEnv() });
        let output = "";
        const timer = setTimeout(() => child.kill(), timeoutMs);
        child.stdout?.on("data", (chunk) => { output += chunk; });
        child.stderr?.on("data", (chunk) => { output += chunk; });
        child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? 0, output }); });
        child.on("error", (err) => { clearTimeout(timer); resolve({ code: 1, output: output + err.message }); });
    });
}

export function spawnInteractive(cmd, args) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args, { stdio: "inherit" });
        proc.on("exit", (code) => resolve(code ?? 0));
        proc.on("error", (err) => {
            warn(err.message);
            resolve(1);
        });
    });
}

export function spawnInteractiveWithExitKeys(cmd, args) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args, { stdio: ["pipe", "inherit", "inherit"], detached: true });

        const stdinWasRaw = process.stdin.isRaw === true;
        let hasResolved = false;
        let shouldStopPiping = false;

        const cleanup = () => {
            shouldStopPiping = true;
            process.stdin.off("data", onStdinData);
            if (!stdinWasRaw && process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
                process.stdin.setRawMode(false);
            }
            process.stdin.pause();
        };

        const finish = (code) => {
            if (hasResolved) return;
            hasResolved = true;
            cleanup();
            resolve(code ?? 0);
        };

        const stopProc = () => {
            if (proc.killed) return;
            try {
                process.kill(-proc.pid, "SIGTERM");
            } catch {
                proc.kill("SIGTERM");
            }
        };

        const onStdinData = (buf) => {
            const key = buf.toString("utf8");
            if (key === "\u0003" || key.startsWith("\u001b") || key === "q" || key === "Q") {
                stopProc();
                return;
            }
            if (proc.stdin && !shouldStopPiping) {
                proc.stdin.write(buf);
            }
        };

        if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        process.stdin.on("data", onStdinData);

        proc.on("exit", (code) => finish(code));
        proc.on("error", (err) => {
            warn(err.message);
            finish(1);
        });
    });
}
