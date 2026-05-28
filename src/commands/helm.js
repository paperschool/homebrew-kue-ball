import { runLive } from "../lib/runner.js";
import { isHelmAvailable, listHelmReleases } from "../lib/helm.js";
import { warn, info, DIM, RESET } from "../lib/output.js";
import { waitForKeypress } from "../ui/chrome.js";
import { select, confirm } from "@inquirer/prompts";

// `helm list` (and its --pending / --failed variants) prints just the column header when there
// are no matching releases — a single line that pageOutput treats as trivial and prints without
// waiting. Combined with the submenu loop, that bounces the user back with nothing to read. So
// we pre-check via `helm list -o json` for each variant; on zero hits we hold a friendly
// "no releases" interstitial until the user dismisses it.
async function listOrReport(ctx, ns, filterFlags, emptyLabel, liveArgs) {
    const releases = listHelmReleases(ctx, ns, filterFlags);
    if (releases.length === 0) {
        warn(`No ${emptyLabel} found in namespace "${ns}".`);
        info("Press any key to return.");
        await waitForKeypress();
        return;
    }
    await runLive("helm", liveArgs);
}

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
        await listOrReport(
          ctx, ns, [],
          "Helm releases",
          ["list", "--namespace", ns, "--kube-context", ctx],
        );
      },
    },
    {
      group: "Helm",
      name: `List pending Helm releases  ${DIM}(${ns})${RESET}`,
      run: async () => {
        if (!isHelmAvailable()) {
          warn("helm not found — install it with: brew install helm");
          return;
        }
        await listOrReport(
          ctx, ns, ["--pending"],
          "pending Helm releases",
          ["list", "--pending", "--namespace", ns, "--kube-context", ctx],
        );
      },
    },
    {
      group: "Helm",
      name: `List failed Helm releases  ${DIM}(${ns})${RESET}`,
      run: async () => {
        if (!isHelmAvailable()) {
          warn("helm not found — install it with: brew install helm");
          return;
        }
        await listOrReport(
          ctx, ns, ["--failed"],
          "failed Helm releases",
          ["list", "--failed", "--namespace", ns, "--kube-context", ctx],
        );
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
          info("Press any key to return.");
          await waitForKeypress();
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
