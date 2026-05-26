import { runLive } from "../lib/runner.js";
import { refreshContexts } from "../lib/azure.js";
import { ok, DIM, RESET } from "../lib/output.js";

export function buildContextsCommands(ctx, ns) {
  return [
    {
      group: "Contexts",
      name: `Refresh contexts  ${DIM}(az aks get-credentials)${RESET}`,
      run: async () => {
        const refreshed = await refreshContexts();
        if (refreshed)
          ok("Contexts updated — use 'Switch context' to change cluster.");
      },
    },
    {
      group: "Contexts",
      name: `List all contexts  ${DIM}(kubeconfig)${RESET}`,
      run: () => runLive("kubectl", ["config", "get-contexts"]),
    },
    {
      group: "Contexts",
      name: `Switch context  ${DIM}(switch cluster without restarting)${RESET}`,
      run: () => Promise.resolve("change-context"),
    },
    {
      group: "Contexts",
      name: `Change namespace  ${DIM}(switch without restarting)${RESET}`,
      run: () => Promise.resolve("change-namespace"),
    },
  ];
}
