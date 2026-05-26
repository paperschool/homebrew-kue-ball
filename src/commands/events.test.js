import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/runner.js", () => ({
  runLive: vi.fn(),
}));

vi.mock("../lib/output.js", () => ({
  DIM: "",
  RESET: "",
}));

import { runLive } from "../lib/runner.js";
import { buildEventsCommands } from "./events.js";

const CTX = "test-context";
const NS = "test-namespace";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("buildEventsCommands", () => {
  it("returns 2 commands all with group 'Events'", () => {
    const cmds = buildEventsCommands(CTX, NS);
    expect(cmds).toHaveLength(2);
    expect(cmds.every((c) => c.group === "Events")).toBe(true);
  });
});

describe("Recent events", () => {
  it("calls runLive with get events --sort-by=.lastTimestamp", async () => {
    const cmds = buildEventsCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Recent events"));
    await cmd.run();
    expect(runLive).toHaveBeenCalledWith("kubectl", [
      `--context=${CTX}`,
      `--namespace=${NS}`,
      "get",
      "events",
      "--sort-by=.lastTimestamp",
    ]);
  });
});

describe("Warning events only", () => {
  it("calls runLive with get events --field-selector=type=Warning", async () => {
    const cmds = buildEventsCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Warning events"));
    await cmd.run();
    expect(runLive).toHaveBeenCalledWith("kubectl", [
      `--context=${CTX}`,
      `--namespace=${NS}`,
      "get",
      "events",
      "--field-selector=type=Warning",
      "--sort-by=.lastTimestamp",
    ]);
  });
});
