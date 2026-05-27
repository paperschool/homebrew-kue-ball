import { execSync, spawn, spawnSync } from "child_process";
import { platform } from "node:os";
import { delimiter as pathDelimiter } from "node:path";
import { warn } from "./output.js";

// Platform-aware PATH augmentation. On Mac we shim in the usual Homebrew /
// Rancher Desktop locations because those binaries are NOT on the default GUI-
// inherited PATH; on Linux (including WSL2 Ubuntu) only /usr/local/bin matters;
// on Windows (out-of-scope per NFR8) we leave PATH untouched rather than poison
// it with POSIX paths. The separator is `path.delimiter` (`:` on POSIX, `;` on
// Windows) so a future native-Windows branch wouldn't need to re-find it.
function buildEnv() {
    const plat = platform();
    let extraPaths;
    if (plat === "darwin") {
        extraPaths = [
            `${process.env.HOME}/.rd/bin`,
            "/opt/homebrew/bin",
            "/usr/local/bin",
        ];
    } else if (plat === "linux") {
        extraPaths = ["/usr/local/bin"];
    } else {
        // win32 (or anything else) — don't prepend anything; PATH stays as-is.
        return { ...process.env };
    }
    return {
        ...process.env,
        PATH: `${extraPaths.join(pathDelimiter)}${pathDelimiter}${process.env.PATH ?? ""}`,
    };
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

export function spawnInteractive(cmd, args, { env } = {}) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args, { stdio: "inherit", ...(env && { env }) });
        proc.on("exit", (code) => resolve(code ?? 0));
        proc.on("error", (err) => {
            warn(err.message);
            resolve(1);
        });
    });
}

// Like spawnInteractive, but pipes stderr (rather than inheriting) so the caller can
// inspect what was printed. stderr is tee'd back to process.stderr so the user still
// sees it in real time. Returns { code, stderr }.
// Used by interactive verbs (e.g. `exec`) that need to post-process kubectl errors
// (forbidden, container not found, etc.) for the auth-error page.
export function spawnInteractiveCapturingStderr(cmd, args, { env } = {}) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args, {
            stdio: ["inherit", "inherit", "pipe"],
            ...(env && { env }),
        });
        let stderr = "";
        proc.stderr?.on("data", (chunk) => {
            stderr += chunk;
            process.stderr.write(chunk);
        });
        proc.on("exit", (code) => resolve({ code: code ?? 0, stderr }));
        proc.on("error", (err) => {
            warn(err.message);
            resolve({ code: 1, stderr });
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
            // Exit keys: Ctrl+C ("\u0003"), bare ESC ("\u001b" as a single byte —
            // NOT a CSI sequence like arrow keys "\u001b[A" or scroll-wheel escapes),
            // and q / Q. We must NOT treat any escape-prefixed input as exit — that
            // catches arrow keys and blocks scrolling back through streamed log output.
            const isBareEsc = key === "\u001b";
            if (key === "\u0003" || isBareEsc || key === "q" || key === "Q") {
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
