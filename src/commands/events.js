import { runLive } from "../lib/runner.js";
import { DIM, RESET } from "../lib/output.js";

export function buildEventsCommands(ctx, ns) {
  return [
    {
      group: "Events",
      name: `Recent events — namespace  ${DIM}(${ns})${RESET}`,
      run: () =>
        runLive("kubectl", [
          `--context=${ctx}`,
          `--namespace=${ns}`,
          "get",
          "events",
          "--sort-by=.lastTimestamp",
        ]),
    },
    {
      group: "Events",
      name: `Warning events only  ${DIM}(${ns})${RESET}`,
      run: () =>
        runLive("kubectl", [
          `--context=${ctx}`,
          `--namespace=${ns}`,
          "get",
          "events",
          "--field-selector=type=Warning",
          "--sort-by=.lastTimestamp",
        ]),
    },
  ];
}
