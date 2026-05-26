import {
    runLive,
    runLivePiped,
    runLivePipedWithExitKeys,
    runLiveWithOptionalWatch,
    runShell,
    isJqAvailable,
} from "./runner.js";
import { pickResourceInstance } from "./universalVerbs.js";
import { ok, warn } from "./output.js";
import { APP_NAME } from "./env.js";
import { select, input, confirm } from "@inquirer/prompts";

function baseArgs(resource, ctx, ns) {
    const args = [`--context=${ctx}`];
    if (resource.namespaced) args.push(`--namespace=${ns}`);
    return args;
}

function targetRef(resource, name) {
    return `${resource.kind}/${name}`;
}

async function pickOrBail(resource, ctx, ns) {
    const name = await pickResourceInstance(resource, ctx, ns);
    return name || null;
}

function makeRollout(sub, displayName, { requiresConfirm = false } = {}) {
    return {
        displayName,
        handler: async (resource, ctx, ns) => {
            const name = await pickOrBail(resource, ctx, ns);
            if (!name) return;
            if (requiresConfirm) {
                const sure = await confirm({
                    message: `${displayName} ${targetRef(resource, name)} in "${ns}"?`,
                    default: false,
                });
                if (!sure) return;
            }
            await runLive("kubectl", [
                ...baseArgs(resource, ctx, ns),
                "rollout",
                sub,
                targetRef(resource, name),
            ]);
        },
    };
}

const VALID_SPEC = /^[\w.-]+=.+/;

export const SPECIFIC_VERBS = {
    logs: {
        displayName: "Stream logs",
        handler: async (resource, ctx, ns) => {
            const name = await pickOrBail(resource, ctx, ns);
            if (!name) return;
            await runLivePipedWithExitKeys("kubectl", [
                ...baseArgs(resource, ctx, ns),
                "logs",
                "-f",
                name,
                "--tail=200",
            ]);
        },
    },

    logsPrevious: {
        displayName: "Previous container logs",
        handler: async (resource, ctx, ns) => {
            const name = await pickOrBail(resource, ctx, ns);
            if (!name) return;
            await runLivePiped("kubectl", [
                ...baseArgs(resource, ctx, ns),
                "logs",
                name,
                "--previous",
                "--tail=300",
            ]);
        },
    },

    logsToFile: {
        displayName: "Dump logs to file",
        handler: async (resource, ctx, ns) => {
            const name = await pickOrBail(resource, ctx, ns);
            if (!name) return;
            const tail = await input({ message: "How many lines? (blank = all):", default: "" });
            const tailFlag = tail ? ` --tail ${tail}` : "";
            const ts = new Date().toISOString().replace(/[:.]/g, "-");
            const dir = "./logs";
            const file = `${dir}/${name}_${ts}.log`;
            const flags = `--context=${ctx}${resource.namespaced ? ` --namespace=${ns}` : ""}`;
            const jqPipe = isJqAvailable() ? " | jq -R -r 'try (fromjson | .) catch .'" : "";
            const shellCmd = `mkdir -p ${dir} && kubectl ${flags} logs ${name}${tailFlag}${jqPipe} > ${file}`;
            const code = await runShell(shellCmd);
            if (code === 0) ok(`Logs saved to ${file}`);
            else warn(`Command exited with code ${code} — check output above.`);
        },
    },

    exec: {
        displayName: "Shell into pod",
        handler: async (resource, ctx, ns) => {
            const name = await pickOrBail(resource, ctx, ns);
            if (!name) return;
            const shell = await select({
                message: "Shell:",
                choices: [
                    { name: "sh", value: "sh" },
                    { name: "bash", value: "bash" },
                ],
            });
            await runLive(
                "kubectl",
                [...baseArgs(resource, ctx, ns), "exec", "-it", name, "--", shell],
                { interactive: true },
            );
        },
    },

    execOneOff: {
        displayName: "Run one-off command",
        handler: async (resource, ctx, ns) => {
            const name = await pickOrBail(resource, ctx, ns);
            if (!name) return;
            const cmd = await input({ message: "Command (e.g. env):", default: "env" });
            await runLive("kubectl", [
                ...baseArgs(resource, ctx, ns),
                "exec", name, "--", "sh", "-c", cmd,
            ]);
        },
    },

    scale: {
        displayName: "Scale",
        handler: async (resource, ctx, ns) => {
            const name = await pickOrBail(resource, ctx, ns);
            if (!name) return;
            const replicas = await input({ message: "Replicas:", default: "1" });
            if (parseInt(replicas, 10) === 0) {
                const sure = await confirm({
                    message: `Scale ${targetRef(resource, name)} to 0 replicas?`,
                    default: false,
                });
                if (!sure) return;
            }
            await runLive("kubectl", [
                ...baseArgs(resource, ctx, ns),
                "scale",
                targetRef(resource, name),
                `--replicas=${replicas}`,
            ]);
        },
    },

    rolloutStatus:  makeRollout("status",  "Rollout status"),
    rolloutHistory: makeRollout("history", "Rollout history"),
    rolloutUndo:    makeRollout("undo",    "Roll back rollout",  { requiresConfirm: true }),
    rolloutRestart: makeRollout("restart", "Restart rollout",    { requiresConfirm: true }),
    rolloutPause:   makeRollout("pause",   "Pause rollout"),
    rolloutResume:  makeRollout("resume",  "Resume rollout"),

    setImage: {
        displayName: "Set image",
        handler: async (resource, ctx, ns) => {
            const name = await pickOrBail(resource, ctx, ns);
            if (!name) return;
            const spec = await input({ message: "container=image (e.g. app=nginx:1.27):" });
            if (!VALID_SPEC.test(spec)) {
                warn("Invalid image spec. Format: container=image.");
                return;
            }
            const sure = await confirm({
                message: `Apply new image to ${targetRef(resource, name)}?`,
                default: false,
            });
            if (!sure) return;
            await runLive("kubectl", [
                ...baseArgs(resource, ctx, ns),
                "set", "image", targetRef(resource, name), spec,
            ]);
        },
    },

    setEnv: {
        displayName: "Set env var",
        handler: async (resource, ctx, ns) => {
            const name = await pickOrBail(resource, ctx, ns);
            if (!name) return;
            const spec = await input({ message: "KEY=VALUE:" });
            if (!VALID_SPEC.test(spec)) {
                warn("Invalid env spec. Format: KEY=VALUE.");
                return;
            }
            await runLive("kubectl", [
                ...baseArgs(resource, ctx, ns),
                "set", "env", targetRef(resource, name), spec,
            ]);
        },
    },

    top: {
        displayName: "Top",
        handler: async (resource, ctx, ns) =>
            runLiveWithOptionalWatch("kubectl", [
                ...baseArgs(resource, ctx, ns),
                "top",
                resource.plural,
            ]),
    },

    portForward: {
        displayName: "Port-forward",
        handler: async (resource, ctx, ns) => {
            const name = await pickOrBail(resource, ctx, ns);
            if (!name) return;
            const ports = await input({ message: "localPort:remotePort:", default: "8080:80" });
            await runLivePipedWithExitKeys("kubectl", [
                ...baseArgs(resource, ctx, ns),
                "port-forward",
                targetRef(resource, name),
                ports,
            ]);
        },
    },
};

// APP_NAME is intentionally referenced so eslint/test mocks don't drop the import; future work may expose
// an APP_NAME-aware selector-based logs verb for cluster-wide tailing (currently lives in src/commands/logs.js).
void APP_NAME;
