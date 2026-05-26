import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/runner.js", () => ({
  runLive: vi.fn(),
  runLiveWithOptionalWatch: vi.fn(),
  runShell: vi.fn(),
}));

vi.mock("../lib/shell.js", () => ({
  run: vi.fn(),
}));

vi.mock("../lib/output.js", () => ({
  warn: vi.fn(),
  printCommand: vi.fn(),
  DIM: "",
  RESET: "",
}));

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
}));

import { runLive, runLiveWithOptionalWatch, runShell } from "../lib/runner.js";
import { run } from "../lib/shell.js";
import { warn } from "../lib/output.js";
import { select } from "@inquirer/prompts";
import { buildConfigCommands } from "./config.js";

const CTX = "test-context";
const NS = "test-namespace";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("buildConfigCommands", () => {
  it("returns 3 commands all with group 'Config'", () => {
    const cmds = buildConfigCommands(CTX, NS);
    expect(cmds).toHaveLength(3);
    expect(cmds.every((c) => c.group === "Config")).toBe(true);
  });
});

describe("List ConfigMaps", () => {
  it("calls runLiveWithOptionalWatch with get configmaps", async () => {
    const cmds = buildConfigCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("List ConfigMaps"));
    await cmd.run();
    expect(runLiveWithOptionalWatch).toHaveBeenCalledWith(
      "kubectl",
      expect.arrayContaining(["get", "configmaps"])
    );
  });
});

describe("List secrets", () => {
  it("calls runLiveWithOptionalWatch with get secrets", async () => {
    const cmds = buildConfigCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("List secrets"));
    await cmd.run();
    expect(runLiveWithOptionalWatch).toHaveBeenCalledWith(
      "kubectl",
      expect.arrayContaining(["get", "secrets"])
    );
  });
});

describe("Describe a ConfigMap", () => {
  it("calls warn and returns early when no ConfigMaps found", async () => {
    run.mockReturnValue(JSON.stringify({ items: [] }));
    const cmds = buildConfigCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Describe"));
    await cmd.run();
    expect(warn).toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("runs the jq+column shell pipeline when table format chosen", async () => {
    const configmaps = [
      { metadata: { name: "my-cm", creationTimestamp: null }, data: { key: "val" } },
    ];
    run.mockReturnValue(JSON.stringify({ items: configmaps }));
    select
      .mockResolvedValueOnce("my-cm")
      .mockResolvedValueOnce("table");
    const cmds = buildConfigCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Describe"));
    await cmd.run();
    const shellCmd = runShell.mock.calls[0][0];
    expect(shellCmd).toContain("jq");
    expect(shellCmd).toContain("column");
  });

  it("calls runLive with describe configmap when describe format chosen", async () => {
    const configmaps = [
      { metadata: { name: "my-cm", creationTimestamp: null }, data: {} },
    ];
    run.mockReturnValue(JSON.stringify({ items: configmaps }));
    select
      .mockResolvedValueOnce("my-cm")
      .mockResolvedValueOnce("describe");
    const cmds = buildConfigCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Describe"));
    await cmd.run();
    expect(runLive).toHaveBeenCalledWith(
      "kubectl",
      expect.arrayContaining(["describe", "configmap", "my-cm"]),
      expect.objectContaining({ onEdit: expect.any(Function) })
    );
  });
});
