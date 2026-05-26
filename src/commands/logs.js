import {
    runLivePipedWithExitKeys,
    runLivePiped,
    runShell,
    isJqAvailable,
} from "../lib/runner.js";
import { pickPod } from "../lib/kubectl.js";
import { run } from "../lib/shell.js";
import { ok, warn, DIM, RESET } from "../lib/output.js";
import { APP_NAME } from "../lib/env.js";
import { input } from "@inquirer/prompts";

export function buildLogsCommands(ctx, ns) {
    const appLabel = APP_NAME ? `app=${APP_NAME}` : null;

    return [
        ...(appLabel
            ? [
                {
                    group: "Logs",
                    name: `Stream logs — latest pod  ${DIM}(${appLabel})${RESET}`,
                    run: () =>
                        runLivePipedWithExitKeys("kubectl", [
                            `--context=${ctx}`,
                            `--namespace=${ns}`,
                            "logs",
                            "-f",
                            `--selector=${appLabel}`,
                            "--tail=100",
                            "--max-log-requests=5",
                        ]),
                },
            ]
            : []),
        {
            group: "Logs",
            name: `Stream logs — specific pod  ${DIM}(select from list)${RESET}`,
            run: async () => {
                const pod = await pickPod(ctx, ns);
                if (!pod) return;
                return runLivePipedWithExitKeys("kubectl", [
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "logs",
                    "-f",
                    pod,
                    "--tail=200",
                ]);
            },
        },
        {
            group: "Logs",
            name: `Previous container logs  ${DIM}(crashed / restarted pod)${RESET}`,
            run: async () => {
                const pod = await pickPod(ctx, ns);
                if (!pod) return;
                await runLivePiped("kubectl", [
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "logs",
                    pod,
                    "--previous",
                    "--tail=300",
                ]);
            },
        },
        {
            group: "Logs",
            name: `Dump logs to file  ${DIM}(select pod, saves to ./logs/)${RESET}`,
            run: async () => {
                const pod = await pickPod(ctx, ns);
                if (!pod) return;
                const tail = await input({
                    message: "How many lines? (blank = all):",
                    default: "",
                });
                const tailArgs = tail ? ["--tail", tail] : [];
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const dir = "./logs";
                const filename = `${dir}/${pod}_${timestamp}.log`;
                run(`mkdir -p ${dir}`, { silent: true });
                const fullCmd = [
                    "kubectl",
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "logs",
                    pod,
                    ...tailArgs,
                ].join(" ");
                const jqPipe = isJqAvailable()
                    ? ` | jq -R -r 'try (fromjson | .) catch .'`
                    : "";
                const shellCmd = `${fullCmd}${jqPipe} > ${filename}`;
                const code = await runShell(shellCmd);
                if (code === 0) ok(`Logs saved to ${filename}`);
                else warn(`Command exited with code ${code} — check output above.`);
            },
        },
    ];
}
