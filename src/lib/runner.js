import { run, captureCommand, spawnInteractive, spawnInteractiveCapturingStderr, spawnInteractiveWithExitKeys } from "./shell.js";
import { info, DIM, RESET, BOLD } from "./output.js";
import { isPermissionError } from "./azure.js";
import { startProgress, stopProgress, setLastCommandRun, showAuthErrorPage } from "../ui/chrome.js";
import { pageOutput } from "../ui/pager.js";

export const RETURN_TO_MENU = "return-to-menu";

export function isJqAvailable() {
    return !!run("jq --version", { silent: true });
}

// Animates the progress indicator for the lifetime of a streaming child (logs -f, watch).
async function _spawnWithProgress(spawn) {
    startProgress();
    try {
        return await spawn();
    } finally {
        stopProgress();
    }
}

// Runs a one-shot command, animating progress while it runs, then shows its output
// in the scrollable content-area pager. If the command failed with auth/permission
// text in stderr, route to the chrome auth-error page instead of the raw pager.
// Returns the exit code.
async function _runCaptured(cmd, args, onEdit) {
    startProgress();
    let result;
    try {
        result = await captureCommand(cmd, args);
    } finally {
        stopProgress();
    }
    if (result.code !== 0 && isPermissionError(result.output)) {
        await showAuthErrorPage(result.output);
    } else {
        await pageOutput(result.output, { onEdit });
    }
    return result.code;
}

export async function runLive(cmd, args, { interactive = false, onEdit, onStderr } = {}) {
    setLastCommandRun([cmd, ...args].join(" "));
    if (interactive) {
        // When the caller wants to inspect what the interactive child printed (typically
        // to catch a "Forbidden" before the menu re-renders and wipes it), capture stderr
        // alongside the inherited streams. Otherwise fall through to the cheaper inherit-only
        // spawn so the shell session has no overhead.
        if (onStderr) {
            const { code, stderr } = await spawnInteractiveCapturingStderr(cmd, args);
            onStderr(stderr);
            return code;
        }
        return spawnInteractive(cmd, args);
    }
    return _runCaptured(cmd, args, onEdit);
}

// Runs a raw `sh -c` pipeline (for commands that build their own shell string),
// recording it in the header and paging its output.
export async function runShell(cmdStr) {
    setLastCommandRun(cmdStr);
    return _runCaptured("sh", ["-c", cmdStr]);
}

function withWatchFlag(args) {
    if (args.includes("--watch") || args.includes("-w")) return args;
    return [...args, "--watch"];
}

async function promptWatchReplay() {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") return false;

    process.stdout.write(
        `  ${DIM}Press ${BOLD}w${RESET}${DIM} to re-run in watch mode, or any other key to continue.${RESET}`
    );

    return new Promise((resolve) => {
        const stdinWasRaw = process.stdin.isRaw === true;

        const cleanup = () => {
            process.stdin.off("data", onData);
            if (!stdinWasRaw) {
                process.stdin.setRawMode(false);
            }
            process.stdin.pause();
        };

        const onData = (buf) => {
            const key = buf.toString("utf8");
            cleanup();
            process.stdout.write("\n");
            resolve(key === "w" || key === "W");
        };

        if (!stdinWasRaw) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        process.stdin.on("data", onData);
    });
}

export async function runLiveWithOptionalWatch(cmd, args) {
    const code = await runLive(cmd, args);
    if (code !== 0 || cmd !== "kubectl") return code;

    const shouldWatch = await promptWatchReplay();
    if (!shouldWatch) return code;

    const watchArgs = withWatchFlag(args);
    setLastCommandRun([cmd, ...watchArgs].join(" "));
    info("Watch mode active. Use Ctrl+C to exit.");
    return _spawnWithProgress(() => spawnInteractive(cmd, watchArgs));
}

export function runLivePiped(cmd, args) {
    const cmdStr = [cmd, ...args].join(" ");
    if (!isJqAvailable()) {
        setLastCommandRun(cmdStr);
        return _runCaptured(cmd, args);
    }
    const piped = `${cmdStr} | jq -R -r 'try (fromjson | .) catch .'`;
    setLastCommandRun(piped);
    return _runCaptured("sh", ["-c", piped]);
}

export async function runLivePipedWithExitKeys(cmd, args) {
    const cmdStr = [cmd, ...args].join(" ");
    const piped = isJqAvailable()
        ? `${cmdStr} | jq -R -r 'try (fromjson | .) catch .'`
        : cmdStr;
    setLastCommandRun(piped);
    info("Press Esc or q to return to the command menu.");
    await _spawnWithProgress(() => spawnInteractiveWithExitKeys("sh", ["-c", piped]));
    return RETURN_TO_MENU;
}
