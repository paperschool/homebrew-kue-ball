import { commandSucceeds } from "../lib/shell.js";

let intervalId = null;
let polling = false;

async function runCheck(onStatusChange) {
    if (polling) return;
    polling = true;
    try {
        const ok = await commandSucceeds("az account show");
        onStatusChange(ok ? "ok" : "error");
    } finally {
        polling = false;
    }
}

export function startAuthPoller(onStatusChange) {
    stopAuthPoller();
    onStatusChange("checking");
    runCheck(onStatusChange);
    intervalId = setInterval(() => runCheck(onStatusChange), 15_000);
}

export function stopAuthPoller() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    polling = false;
}
