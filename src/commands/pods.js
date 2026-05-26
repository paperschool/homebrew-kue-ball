import { runLive, runLiveWithOptionalWatch } from "../lib/runner.js";
import { spawnInteractive } from "../lib/shell.js";
import { pickPod } from "../lib/kubectl.js";
import { confirm } from "@inquirer/prompts";
import { DIM, RESET } from "../lib/output.js";

export function buildPodsCommands(ctx, ns) {
    return [
        {
            group: "Pods",
            name: `List pods  ${DIM}(${ns})${RESET}`,
            run: () =>
                runLiveWithOptionalWatch("kubectl", [
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "get",
                    "pods",
                    "-o",
                    "wide",
                ]),
        },
        {
            group: "Pods",
            name: `List pods — all namespaces  ${DIM}(cluster-wide)${RESET}`,
            run: () =>
                runLiveWithOptionalWatch("kubectl", [
                    `--context=${ctx}`,
                    "get",
                    "pods",
                    "-A",
                    "-o",
                    "wide",
                ]),
        },
        {
            group: "Pods",
            name: `Describe a pod  ${DIM}(select from list)${RESET}`,
            run: async () => {
                const pod = await pickPod(ctx, ns);
                if (!pod) return;
                await runLive("kubectl", [
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "describe",
                    "pod",
                    pod,
                ], {
                    onEdit: () => spawnInteractive("kubectl", [
                        "edit", "pod", pod,
                        `--namespace=${ns}`,
                        `--context=${ctx}`,
                    ], { env: { ...process.env, KUBE_EDITOR: process.env.KUBE_EDITOR ?? "nano" } }),
                });
            },
        },
        {
            group: "Pods",
            name: `Delete a pod  ${DIM}(triggers restart)${RESET}`,
            run: async () => {
                const pod = await pickPod(ctx, ns);
                if (!pod) return;
                const sure = await confirm({
                    message: `Delete pod "${pod}" in namespace "${ns}"?`,
                    default: false,
                });
                if (sure)
                    await runLive("kubectl", [
                        `--context=${ctx}`,
                        `--namespace=${ns}`,
                        "delete",
                        "pod",
                        pod,
                    ]);
            },
        },
    ];
}
