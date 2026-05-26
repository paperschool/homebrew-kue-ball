import { runLive, runLiveWithOptionalWatch } from "../lib/runner.js";
import { run } from "../lib/shell.js";
import { warn, DIM, RESET } from "../lib/output.js";
import { select, confirm, input } from "@inquirer/prompts";

// Fetches replica sets in the namespace and lets the user pick one. Returns the chosen
// name, or null when there are none. The label shows ready/desired replicas and the
// owning controller (replica sets are usually managed by a Deployment).
async function pickReplicaSet(ctx, ns, message) {
    process.stdout.write(`  ${DIM}Fetching replica sets in ${ns}…${RESET}`);
    const raw = run(`kubectl --context=${ctx} --namespace=${ns} get replicasets -o json`, { silent: true });
    process.stdout.write("\r\x1b[2K");
    let items = [];
    try {
        items = JSON.parse(raw ?? "{}").items ?? [];
    } catch {
        /* fall through */
    }
    if (items.length === 0) {
        warn(`No replica sets found in namespace "${ns}".`);
        return null;
    }
    return select({
        message,
        choices: items.map((rs) => {
            const replicas = `${rs.status?.readyReplicas ?? 0}/${rs.spec?.replicas ?? 0}`;
            const owner = rs.metadata?.ownerReferences?.[0]?.name;
            const meta = [`replicas: ${replicas}`, owner ? `owner: ${owner}` : null].filter(Boolean).join(" · ");
            return { name: `${rs.metadata.name}  ${DIM}(${meta})${RESET}`, value: rs.metadata.name };
        }),
        pageSize: 20,
    });
}

export function buildReplicaSetsCommands(ctx, ns) {
    return [
        {
            group: "ReplicaSets",
            name: `List replica sets  ${DIM}(${ns})${RESET}`,
            run: () =>
                runLiveWithOptionalWatch("kubectl", [`--context=${ctx}`, `--namespace=${ns}`, "get", "replicasets"]),
        },
        {
            group: "ReplicaSets",
            name: `Describe a replica set  ${DIM}(select from list)${RESET}`,
            run: async () => {
                const rs = await pickReplicaSet(ctx, ns, "Describe replica set:");
                if (!rs) return;
                await runLive("kubectl", [`--context=${ctx}`, `--namespace=${ns}`, "describe", "replicaset", rs]);
            },
        },
        {
            group: "ReplicaSets",
            name: `Scale a replica set  ${DIM}(set replica count)${RESET}`,
            run: async () => {
                const rs = await pickReplicaSet(ctx, ns, "Scale replica set:");
                if (!rs) return;
                const replicas = await input({
                    message: `Replicas for "${rs}":`,
                    default: "1",
                    validate: (v) => /^\d+$/.test(v.trim()) || "Enter a non-negative integer.",
                });
                await runLive("kubectl", [
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "scale",
                    "replicaset",
                    rs,
                    `--replicas=${replicas.trim()}`,
                ]);
            },
        },
        {
            group: "ReplicaSets",
            name: `Delete a replica set  ${DIM}(select from list)${RESET}`,
            run: async () => {
                const rs = await pickReplicaSet(ctx, ns, "Delete replica set:");
                if (!rs) return;
                const sure = await confirm({ message: `Delete replica set "${rs}" in "${ns}"?`, default: false });
                if (sure)
                    await runLive("kubectl", [`--context=${ctx}`, `--namespace=${ns}`, "delete", "replicaset", rs]);
            },
        },
    ];
}
