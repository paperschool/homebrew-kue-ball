import { runLive, runLiveWithOptionalWatch, runShell } from "../lib/runner.js";
import { run } from "../lib/shell.js";
import { warn, DIM, RESET } from "../lib/output.js";
import { select } from "@inquirer/prompts";

export function buildConfigCommands(ctx, ns) {
  return [
    {
      group: "Config",
      name: `List ConfigMaps  ${DIM}(${ns})${RESET}`,
      run: () =>
        runLiveWithOptionalWatch("kubectl", [
          `--context=${ctx}`,
          `--namespace=${ns}`,
          "get",
          "configmaps",
        ]),
    },
    {
      group: "Config",
      name: `Describe a ConfigMap  ${DIM}(select from list)${RESET}`,
      run: async () => {
        process.stdout.write(`  ${DIM}Fetching ConfigMaps in ${ns}…${RESET}`);
        const raw = run(
          `kubectl --context=${ctx} --namespace=${ns} get configmaps -o json`,
          { silent: true }
        );
        process.stdout.write("\r\x1b[2K");
        let configmaps = [];
        try {
          configmaps = JSON.parse(raw ?? "{}").items ?? [];
        } catch {
          /* fall through */
        }
        if (configmaps.length === 0) {
          warn(`No ConfigMaps found in namespace "${ns}".`);
          return;
        }
        const chosen = await select({
          message: "Select ConfigMap:",
          choices: configmaps.map((cm) => {
            const age = cm.metadata?.creationTimestamp
              ? new Date(cm.metadata.creationTimestamp).toLocaleString()
              : "";
            const dataKeys = Object.keys(cm.data ?? {}).length;
            return {
              name: `${cm.metadata.name}  ${DIM}(${dataKeys} key(s) · created: ${age})${RESET}`,
              value: cm.metadata.name,
            };
          }),
          pageSize: 20,
        });
        const format = await select({
          message: "Display format:",
          choices: [
            { name: "Table (data keys/values)", value: "table" },
            { name: "Describe (full YAML)", value: "describe" },
          ],
        });
        if (format === "table") {
          const cmdStr = `kubectl --context=${ctx} --namespace=${ns} get configmap ${chosen} -o json | jq -r '.data | to_entries | (["KEY", "VALUE"], map([.key, .value])[]) | @tsv' | column -t -s $'\\t'`;
          await runShell(cmdStr);
        } else {
          await runLive("kubectl", [
            `--context=${ctx}`,
            `--namespace=${ns}`,
            "describe",
            "configmap",
            chosen,
          ]);
        }
      },
    },
    {
      group: "Config",
      name: `List secrets  ${DIM}(names only)${RESET}`,
      run: () =>
        runLiveWithOptionalWatch("kubectl", [
          `--context=${ctx}`,
          `--namespace=${ns}`,
          "get",
          "secrets",
        ]),
    },
  ];
}
