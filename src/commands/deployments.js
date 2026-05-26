import { runLive, runLiveWithOptionalWatch } from "../lib/runner.js";
import { run } from "../lib/shell.js";
import { warn, DIM, RESET } from "../lib/output.js";
import { APP_NAME } from "../lib/env.js";
import { select, confirm } from "@inquirer/prompts";

export function buildDeploymentsCommands(ctx, ns) {
    const appDeployment = APP_NAME || null;

    return [
        {
            group: "Deployments",
            name: `List deployments  ${DIM}(${ns})${RESET}`,
            run: () =>
                runLiveWithOptionalWatch("kubectl", [
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "get",
                    "deployments",
                ]),
        },
        ...(appDeployment
            ? [
                {
                    group: "Deployments",
                    name: `Describe deployment  ${DIM}(${appDeployment})${RESET}`,
                    run: () =>
                        runLive("kubectl", [
                            `--context=${ctx}`,
                            `--namespace=${ns}`,
                            "describe",
                            "deployment",
                            appDeployment,
                        ]),
                },
                {
                    group: "Deployments",
                    name: `Rollout status  ${DIM}(${appDeployment})${RESET}`,
                    run: () =>
                        runLive("kubectl", [
                            `--context=${ctx}`,
                            `--namespace=${ns}`,
                            "rollout",
                            "status",
                            `deployment/${appDeployment}`,
                        ]),
                },
                {
                    group: "Deployments",
                    name: `Rollout history  ${DIM}(${appDeployment})${RESET}`,
                    run: () =>
                        runLive("kubectl", [
                            `--context=${ctx}`,
                            `--namespace=${ns}`,
                            "rollout",
                            "history",
                            `deployment/${appDeployment}`,
                        ]),
                },
                {
                    group: "Deployments",
                    name: `Rollback deployment  ${DIM}(undo last rollout)${RESET}`,
                    run: async () => {
                        const sure = await confirm({
                            message: `Roll back "${appDeployment}" in "${ns}"?`,
                            default: false,
                        });
                        if (sure)
                            await runLive("kubectl", [
                                `--context=${ctx}`,
                                `--namespace=${ns}`,
                                "rollout",
                                "undo",
                                `deployment/${appDeployment}`,
                            ]);
                    },
                },
                {
                    group: "Deployments",
                    name: `Restart deployment  ${DIM}(rolling restart)${RESET}`,
                    run: async () => {
                        const sure = await confirm({
                            message: `Rolling-restart "${appDeployment}" in "${ns}"?`,
                            default: false,
                        });
                        if (sure)
                            await runLive("kubectl", [
                                `--context=${ctx}`,
                                `--namespace=${ns}`,
                                "rollout",
                                "restart",
                                `deployment/${appDeployment}`,
                            ]);
                    },
                },
            ]
            : []),
        {
            group: "Deployments",
            name: `Delete a deployment  ${DIM}(pick from list, removes deployment + orphaned SA)${RESET}`,
            run: async () => {
                process.stdout.write(`  ${DIM}Fetching deployments in ${ns}…${RESET}`);
                const raw = run(
                    `kubectl --context=${ctx} --namespace=${ns} get deployments -o json`,
                    { silent: true }
                );
                process.stdout.write("\r\x1b[2K");
                let deployments = [];
                try {
                    deployments = JSON.parse(raw ?? "{}").items ?? [];
                } catch {
                    /* fall through */
                }
                if (deployments.length === 0) {
                    warn(`No deployments found in namespace "${ns}".`);
                    return;
                }
                const chosen = await select({
                    message: "Select deployment to delete:",
                    choices: deployments.map((d) => {
                        const ready = `${d.status?.readyReplicas ?? 0}/${d.spec?.replicas ?? 0}`;
                        const age = d.metadata?.creationTimestamp
                            ? new Date(d.metadata.creationTimestamp).toLocaleString()
                            : "";
                        return {
                            name: `${d.metadata.name}  ${DIM}(ready: ${ready} · created: ${age})${RESET}`,
                            value: d.metadata.name,
                        };
                    }),
                    pageSize: 20,
                });

                const saRaw = run(
                    `kubectl --context=${ctx} --namespace=${ns} get serviceaccounts -o json`,
                    { silent: true }
                );
                let orphanedSAs = [];
                try {
                    const releaseName = deployments
                        .find((d) => d.metadata.name === chosen)
                        ?.metadata?.annotations?.["meta.helm.sh/release-name"];
                    if (releaseName) {
                        const allSAs = JSON.parse(saRaw ?? "{}").items ?? [];
                        orphanedSAs = allSAs
                            .filter(
                                (sa) =>
                                    sa.metadata?.annotations?.["meta.helm.sh/release-name"] ===
                                    releaseName
                            )
                            .map((sa) => sa.metadata.name);
                    }
                } catch {
                    /* non-fatal */
                }

                const saNote =
                    orphanedSAs.length > 0
                        ? `\n  Also deletes ServiceAccount(s): ${orphanedSAs.join(", ")}`
                        : "";
                const sure = await confirm({
                    message: `Delete deployment "${chosen}" in "${ns}"?${saNote}`,
                    default: false,
                });
                if (!sure) return;

                await runLive("kubectl", [
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "delete",
                    "deployment",
                    chosen,
                ]);

                for (const sa of orphanedSAs) {
                    await runLive("kubectl", [
                        `--context=${ctx}`,
                        `--namespace=${ns}`,
                        "delete",
                        "serviceaccount",
                        sa,
                    ]);
                }
            },
        },
    ];
}
