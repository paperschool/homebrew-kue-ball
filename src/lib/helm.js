import { run } from "./shell.js";

export function isHelmAvailable() {
    return !!run("helm version --short", { silent: true });
}

export function getHelmVersion() {
    const raw = run("helm version --short", { silent: true });
    return raw ? raw.replace(/\+g[a-f0-9]+$/, "") : null;
}

export function listHelmReleases(ctx, ns) {
    const raw = run(
        `helm list --namespace ${ns} --kube-context ${ctx} -o json`,
        { silent: true }
    );
    try {
        return JSON.parse(raw ?? "[]");
    } catch {
        return [];
    }
}
