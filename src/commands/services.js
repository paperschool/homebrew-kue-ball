import { runLive, runLiveWithOptionalWatch } from "../lib/runner.js";
import { run } from "../lib/shell.js";
import { warn, DIM, RESET } from "../lib/output.js";
import { select, confirm } from "@inquirer/prompts";

export function buildServicesCommands(ctx, ns) {
    return [
        {
            group: "Services & Ingress",
            name: `List services  ${DIM}(${ns})${RESET}`,
            run: () =>
                runLiveWithOptionalWatch("kubectl", [
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "get",
                    "services",
                ]),
        },
        {
            group: "Services & Ingress",
            name: `Delete service  ${DIM}(select from list)${RESET}`,
            run: async () => {
                process.stdout.write(`  ${DIM}Fetching Services in ${ns}…${RESET}`);
                const raw = run(
                    `kubectl --context=${ctx} --namespace=${ns} get services -o json`,
                    { silent: true }
                );
                process.stdout.write("\r\x1b[2K");

                let services = [];
                try {
                    services = JSON.parse(raw ?? "{}").items ?? [];
                } catch {
                    /* fall through */
                }

                if (services.length === 0) {
                    warn(`No Services found in namespace "${ns}".`);
                    return;
                }

                const chosen = await select({
                    message: "Select Service to delete:",
                    choices: services.map((svc) => {
                        const created = svc.metadata?.creationTimestamp
                            ? new Date(svc.metadata.creationTimestamp).toLocaleString()
                            : "";
                        const type = svc.spec?.type ?? "ClusterIP";
                        return {
                            name: `${svc.metadata.name}  ${DIM}(type: ${type} · created: ${created})${RESET}`,
                            value: svc.metadata.name,
                        };
                    }),
                    pageSize: 20,
                });

                const sure = await confirm({
                    message: `Delete Service "${chosen}" in namespace "${ns}"?`,
                    default: false,
                });

                if (sure) {
                    await runLive("kubectl", [
                        `--context=${ctx}`,
                        `--namespace=${ns}`,
                        "delete",
                        "service",
                        chosen,
                    ]);
                }
            },
        },
        {
            group: "Services & Ingress",
            name: `List service accounts  ${DIM}(${ns})${RESET}`,
            run: () =>
                runLiveWithOptionalWatch("kubectl", [
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "get",
                    "serviceaccounts",
                ]),
        },
        {
            group: "Services & Ingress",
            name: `List ingresses  ${DIM}(${ns})${RESET}`,
            run: () =>
                runLiveWithOptionalWatch("kubectl", [
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "get",
                    "ingress",
                ]),
        },
        {
            group: "Services & Ingress",
            name: `List VirtualService  ${DIM}(${ns})${RESET}`,
            run: () =>
                runLiveWithOptionalWatch("kubectl", [
                    `--context=${ctx}`,
                    `--namespace=${ns}`,
                    "get",
                    "virtualservice",
                ]),
        },
        {
            group: "Services & Ingress",
            name: `Delete service account  ${DIM}(select from list)${RESET}`,
            run: async () => {
                process.stdout.write(
                    `  ${DIM}Fetching ServiceAccounts in ${ns}…${RESET}`
                );
                const raw = run(
                    `kubectl --context=${ctx} --namespace=${ns} get serviceaccounts -o json`,
                    { silent: true }
                );
                process.stdout.write("\r\x1b[2K");

                let serviceAccounts = [];
                try {
                    serviceAccounts = JSON.parse(raw ?? "{}").items ?? [];
                } catch {
                    /* fall through */
                }

                if (serviceAccounts.length === 0) {
                    warn(`No ServiceAccounts found in namespace "${ns}".`);
                    return;
                }

                const chosen = await select({
                    message: "Select ServiceAccount to delete:",
                    choices: serviceAccounts.map((sa) => {
                        const created = sa.metadata?.creationTimestamp
                            ? new Date(sa.metadata.creationTimestamp).toLocaleString()
                            : "";
                        return {
                            name: `${sa.metadata.name}  ${DIM}(created: ${created})${RESET}`,
                            value: sa.metadata.name,
                        };
                    }),
                    pageSize: 20,
                });

                const sure = await confirm({
                    message: `Delete ServiceAccount "${chosen}" in namespace "${ns}"?`,
                    default: false,
                });

                if (sure) {
                    await runLive("kubectl", [
                        `--context=${ctx}`,
                        `--namespace=${ns}`,
                        "delete",
                        "serviceaccount",
                        chosen,
                    ]);
                }
            },
        },
    ];
}
