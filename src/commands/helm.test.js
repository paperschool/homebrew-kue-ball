import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/runner.js", () => ({
  runLive: vi.fn(),
}));

vi.mock("../lib/helm.js", () => ({
  isHelmAvailable: vi.fn(),
  listHelmReleases: vi.fn(),
}));

vi.mock("../lib/output.js", () => ({
  warn: vi.fn(),
  DIM: "",
  RESET: "",
}));

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  confirm: vi.fn(),
}));

import { runLive } from "../lib/runner.js";
import { isHelmAvailable, listHelmReleases } from "../lib/helm.js";
import { warn } from "../lib/output.js";
import { select, confirm } from "@inquirer/prompts";
import { buildHelmCommands } from "./helm.js";

const CTX = "test-context";
const NS = "test-namespace";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("buildHelmCommands", () => {
  it("returns 4 commands all with group 'Helm'", () => {
    const cmds = buildHelmCommands(CTX, NS);
    expect(cmds).toHaveLength(4);
    expect(cmds.every((c) => c.group === "Helm")).toBe(true);
  });
});

describe("List Helm releases", () => {
  it("calls warn and returns early when helm is not available", async () => {
    isHelmAvailable.mockReturnValue(false);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("List Helm"));
    await cmd.run();
    expect(warn).toHaveBeenCalled();
    expect(runLive).not.toHaveBeenCalled();
  });

  it("calls runLive with helm list when helm is available", async () => {
    isHelmAvailable.mockReturnValue(true);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("List Helm"));
    await cmd.run();
    expect(runLive).toHaveBeenCalledWith("helm", [
      "list",
      "--namespace",
      NS,
      "--kube-context",
      CTX,
    ]);
  });
});

describe("Delete a Helm release", () => {
  it("calls warn and returns early when helm is not available", async () => {
    isHelmAvailable.mockReturnValue(false);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Delete"));
    await cmd.run();
    expect(warn).toHaveBeenCalled();
    expect(runLive).not.toHaveBeenCalled();
  });

  it("calls warn and returns early when no releases found", async () => {
    isHelmAvailable.mockReturnValue(true);
    listHelmReleases.mockReturnValue([]);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Delete"));
    await cmd.run();
    expect(warn).toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("does not call runLive when confirm resolves false", async () => {
    isHelmAvailable.mockReturnValue(true);
    listHelmReleases.mockReturnValue([
      { name: "my-release", chart: "my-chart", status: "deployed", updated: "2024-01-01" },
    ]);
    select.mockResolvedValue("my-release");
    confirm.mockResolvedValue(false);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Delete"));
    await cmd.run();
    expect(runLive).not.toHaveBeenCalled();
  });

  it("calls runLive with helm uninstall when confirmed", async () => {
    isHelmAvailable.mockReturnValue(true);
    listHelmReleases.mockReturnValue([
      { name: "my-release", chart: "my-chart", status: "deployed", updated: "2024-01-01" },
    ]);
    select.mockResolvedValue("my-release");
    confirm.mockResolvedValue(true);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Delete"));
    await cmd.run();
    expect(runLive).toHaveBeenCalledWith("helm", [
      "uninstall",
      "--namespace",
      NS,
      "--kube-context",
      CTX,
      "my-release",
    ]);
  });

  it("confirm is called with default: false", async () => {
    isHelmAvailable.mockReturnValue(true);
    listHelmReleases.mockReturnValue([
      { name: "my-release", chart: "my-chart", status: "deployed", updated: "2024-01-01" },
    ]);
    select.mockResolvedValue("my-release");
    confirm.mockResolvedValue(false);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Delete"));
    await cmd.run();
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ default: false })
    );
  });
});
