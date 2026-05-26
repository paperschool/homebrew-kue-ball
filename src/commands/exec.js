import { runLive } from "../lib/runner.js";
import { pickPod } from "../lib/kubectl.js";
import { select, input } from "@inquirer/prompts";
import { DIM, RESET } from "../lib/output.js";

export function buildExecCommands(ctx, ns) {
  return [
    {
      group: "Exec",
      name: `Shell into a pod  ${DIM}(interactive bash/sh)${RESET}`,
      run: async () => {
        const pod = await pickPod(ctx, ns);
        if (!pod) return;
        const shell = await select({
          message: "Shell:",
          choices: [
            { name: "sh", value: "sh" },
            { name: "bash", value: "bash" },
          ],
        });
        await runLive("kubectl", [
          `--context=${ctx}`,
          `--namespace=${ns}`,
          "exec",
          "-it",
          pod,
          "--",
          shell,
        ], { interactive: true }); // interactive shell owns the screen — stream, don't capture/page
      },
    },
    {
      group: "Exec",
      name: `Run a one-off command in a pod  ${DIM}(non-interactive)${RESET}`,
      run: async () => {
        const pod = await pickPod(ctx, ns);
        if (!pod) return;
        const cmd = await input({ message: "Command (e.g. env):", default: "env" });
        await runLive("kubectl", [
          `--context=${ctx}`,
          `--namespace=${ns}`,
          "exec",
          pod,
          "--",
          "sh",
          "-c",
          cmd,
        ]);
      },
    },
  ];
}
