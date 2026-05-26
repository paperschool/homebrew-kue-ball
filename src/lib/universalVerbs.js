import { runLive, runLiveWithOptionalWatch } from "./runner.js";
import { run, spawnInteractive } from "./shell.js";
import { resourcePicker } from "../ui/resourcePicker.js";
import { DIM, RESET } from "./output.js";
import { confirm } from "@inquirer/prompts";

function baseArgs(resource, ctx, ns) {
    const args = [`--context=${ctx}`];
    if (resource.namespaced) args.push(`--namespace=${ns}`);
    return args;
}

function editArgs(resource, ctx, ns, name) {
    const args = ["edit", resource.kind, name];
    if (resource.namespaced) args.push(`--namespace=${ns}`);
    args.push(`--context=${ctx}`);
    return args;
}

function editEnv() {
    return { env: { ...process.env, KUBE_EDITOR: process.env.KUBE_EDITOR ?? "nano" } };
}

function describeInfo(item) {
    if (item.status?.phase) return item.status.phase;
    if (item.status?.readyReplicas !== undefined) {
        return `ready: ${item.status.readyReplicas ?? 0}/${item.spec?.replicas ?? 0}`;
    }
    if (item.metadata?.creationTimestamp) {
        return `created: ${new Date(item.metadata.creationTimestamp).toLocaleString()}`;
    }
    return "";
}

export async function pickResourceInstance(resource, ctx, ns) {
    const spinnerMessage = resource.namespaced
        ? `Fetching ${resource.displayName} in ${ns}`
        : `Fetching ${resource.displayName}`;
    const emptyMessage = resource.namespaced
        ? `No ${resource.displayName} found in namespace "${ns}".`
        : `No ${resource.displayName} found.`;

    const cmd = [
        "kubectl",
        ...baseArgs(resource, ctx, ns),
        "get",
        resource.plural,
        "-o",
        "json",
    ].join(" ");

    return resourcePicker({
        spinnerMessage,
        emptyMessage,
        fetchFn: async () => {
            const raw = run(cmd, { silent: true });
            try {
                return JSON.parse(raw ?? "{}").items ?? [];
            } catch {
                return [];
            }
        },
        mapFn: (item) => {
            const name = item.metadata?.name ?? "";
            const info = describeInfo(item);
            return {
                name: info ? `${name}  ${DIM}(${info})${RESET}` : name,
                value: name,
            };
        },
        listOptions: {
            message: `Select ${resource.displayName.toLowerCase().replace(/s$/, "")}:`,
        },
    });
}

export const UNIVERSAL_VERBS = {
    list: {
        displayName: "List",
        handler: async (resource, ctx, ns) =>
            runLiveWithOptionalWatch("kubectl", [
                ...baseArgs(resource, ctx, ns),
                "get",
                resource.plural,
                "-o",
                "wide",
            ]),
    },

    describe: {
        displayName: "Describe",
        handler: async (resource, ctx, ns) => {
            const name = await pickResourceInstance(resource, ctx, ns);
            if (!name) return;
            await runLive(
                "kubectl",
                [...baseArgs(resource, ctx, ns), "describe", resource.kind, name],
                { onEdit: () => spawnInteractive("kubectl", editArgs(resource, ctx, ns, name), editEnv()) },
            );
        },
    },

    edit: {
        displayName: "Edit",
        handler: async (resource, ctx, ns) => {
            const name = await pickResourceInstance(resource, ctx, ns);
            if (!name) return;
            await spawnInteractive("kubectl", editArgs(resource, ctx, ns, name), editEnv());
        },
    },

    delete: {
        displayName: "Delete",
        handler: async (resource, ctx, ns) => {
            const name = await pickResourceInstance(resource, ctx, ns);
            if (!name) return;
            const where = resource.namespaced ? ` in namespace "${ns}"` : "";
            const sure = await confirm({
                message: `Delete ${resource.kind} "${name}"${where}?`,
                default: false,
            });
            if (!sure) return;
            await runLive("kubectl", [
                ...baseArgs(resource, ctx, ns),
                "delete",
                resource.kind,
                name,
            ]);
        },
    },
};
