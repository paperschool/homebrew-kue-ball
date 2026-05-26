import { select } from "@inquirer/prompts";
import { run } from "./shell.js";
import { warn, DIM, RESET } from "./output.js";

export function isKubectlAvailable() {
    return !!run("which kubectl", { silent: true });
}

export function getKubectlVersion() {
    const raw = run("kubectl version --client", { silent: true });
    const match = raw?.match(/v\d+\.\d+\.\d+[\w.-]*/);
    return match?.[0] ?? null;
}

export function getCurrentContext() {
    return run("kubectl config current-context", { silent: true }) ?? "(none)";
}

export function getContexts() {
    const raw = run("kubectl config get-contexts --no-headers -o name", { silent: true });
    return raw ? raw.split("\n").filter(Boolean) : [];
}

export function useContext(name) {
    return run(`kubectl config use-context ${name}`, { silent: true });
}

export function getNamespaces(context) {
    const raw = run(
        `kubectl --context=${context} get namespaces -o jsonpath='{.items[*].metadata.name}'`,
        { silent: true }
    );
    return raw ? raw.split(" ").filter(Boolean) : [];
}

export async function pickPod(ctx, ns) {
    process.stdout.write(`  ${DIM}Fetching pods in ${ns}…${RESET}`);
    const raw = run(`kubectl --context=${ctx} --namespace=${ns} get pods -o json`, { silent: true });
    process.stdout.write("\r\x1b[2K");
    let pods = [];
    try {
        pods = JSON.parse(raw ?? "{}").items ?? [];
    } catch {
        // fall through
    }
    if (pods.length === 0) {
        warn(`No pods found in namespace "${ns}".`);
        return null;
    }
    return select({
        message: "Select pod:",
        choices: pods.map((p) => {
            const created = p.metadata?.creationTimestamp
                ? new Date(p.metadata.creationTimestamp).toLocaleString()
                : "";
            const status = p.status?.phase ?? "";
            return {
                name: `${p.metadata.name}  ${DIM}(${status} · created: ${created})${RESET}`,
                value: p.metadata.name,
            };
        }),
        pageSize: 20,
    });
}
