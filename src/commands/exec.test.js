import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/runner.js", () => ({
  runLive: vi.fn(),
}));

vi.mock("../lib/kubectl.js", () => ({
  pickPod: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  input: vi.fn(),
}));

vi.mock("../lib/output.js", () => ({
  DIM: "",
  RESET: "",
}));

import { runLive } from "../lib/runner.js";
import { pickPod } from "../lib/kubectl.js";
import { select, input } from "@inquirer/prompts";
import { buildExecCommands } from "./exec.js";

const CTX = "test-context";
const NS = "test-namespace";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("buildExecCommands", () => {
  it("returns 2 commands all with group 'Exec'", () => {
    const cmds = buildExecCommands(CTX, NS);
    expect(cmds).toHaveLength(2);
    expect(cmds.every((c) => c.group === "Exec")).toBe(true);
  });
});

describe("Shell into a pod", () => {
  it("returns early without calling select when pickPod returns null", async () => {
    pickPod.mockResolvedValue(null);
    const cmds = buildExecCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Shell into"));
    await cmd.run();
    expect(select).not.toHaveBeenCalled();
    expect(runLive).not.toHaveBeenCalled();
  });

  it("calls runLive with exec -it and bash when bash is selected", async () => {
    pickPod.mockResolvedValue("my-pod");
    select.mockResolvedValue("bash");
    const cmds = buildExecCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Shell into"));
    await cmd.run();
    expect(runLive).toHaveBeenCalledWith("kubectl", [
      `--context=${CTX}`,
      `--namespace=${NS}`,
      "exec",
      "-it",
      "my-pod",
      "--",
      "bash",
    ], { interactive: true });
  });

  it("calls runLive with exec -it and sh when sh is selected", async () => {
    pickPod.mockResolvedValue("my-pod");
    select.mockResolvedValue("sh");
    const cmds = buildExecCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Shell into"));
    await cmd.run();
    expect(runLive).toHaveBeenCalledWith("kubectl", [
      `--context=${CTX}`,
      `--namespace=${NS}`,
      "exec",
      "-it",
      "my-pod",
      "--",
      "sh",
    ], { interactive: true });
  });
});

describe("Run a one-off command in a pod", () => {
  it("returns early without calling input when pickPod returns null", async () => {
    pickPod.mockResolvedValue(null);
    const cmds = buildExecCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("one-off"));
    await cmd.run();
    expect(input).not.toHaveBeenCalled();
    expect(runLive).not.toHaveBeenCalled();
  });

  it("calls runLive with exec sh -c and the user-provided command", async () => {
    pickPod.mockResolvedValue("my-pod");
    input.mockResolvedValue("env");
    const cmds = buildExecCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("one-off"));
    await cmd.run();
    expect(runLive).toHaveBeenCalledWith("kubectl", [
      `--context=${CTX}`,
      `--namespace=${NS}`,
      "exec",
      "my-pod",
      "--",
      "sh",
      "-c",
      "env",
    ]);
  });
});
