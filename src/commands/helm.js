import { runLive } from "../lib/runner.js";
import { isHelmAvailable, listHelmReleases } from "../lib/helm.js";
import { warn, DIM, RESET } from "../lib/output.js";
import { select, confirm } from "@inquirer/prompts";

export function buildHelmCommands(ctx, ns) {
  return [
    {
      group: "Helm",
      name: `List Helm releases  ${DIM}(${ns})${RESET}`,
      run: async () => {
        if (!isHelmAvailable()) {
          warn("helm not found — install it with: brew install helm");
          return;
        }
        await runLive("helm", ["list", "--namespace", ns, "--kube-context", ctx]);
      },
    },
    {
      group: "Helm",
      name: `Delete a Helm release  ${DIM}(${ns})${RESET}`,
      run: async () => {
        if (!isHelmAvailable()) {
          warn("helm not found — install it with: brew install helm");
          return;
        }
        process.stdout.write(`  ${DIM}Fetching Helm releases in ${ns}…${RESET}`);
        const releases = listHelmReleases(ctx, ns);
        process.stdout.write("\r\x1b[2K");
        if (releases.length === 0) {
          warn(`No Helm releases found in namespace "${ns}".`);
          return;
        }
        const chosen = await select({
          message: "Select release to delete:",
          choices: releases.map((r) => ({
            name: `${r.name}  ${DIM}(chart: ${r.chart} · status: ${r.status} · updated: ${r.updated})${RESET}`,
            value: r.name,
          })),
          pageSize: 20,
        });
        const sure = await confirm({
          message: `Delete Helm release "${chosen}" from namespace "${ns}"?`,
          default: false,
        });
        if (!sure) return;
        await runLive("helm", [
          "uninstall",
          "--namespace",
          ns,
          "--kube-context",
          ctx,
          chosen,
        ]);
      },
    },
  ];
}
