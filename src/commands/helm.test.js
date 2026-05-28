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
  info: vi.fn(),
  DIM: "",
  RESET: "",
}));

vi.mock("../ui/chrome.js", () => ({
  waitForKeypress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  confirm: vi.fn(),
}));

import { runLive } from "../lib/runner.js";
import { isHelmAvailable, listHelmReleases } from "../lib/helm.js";
import { warn, info } from "../lib/output.js";
import { waitForKeypress } from "../ui/chrome.js";
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

  it("calls runLive with helm list when releases exist", async () => {
    isHelmAvailable.mockReturnValue(true);
    listHelmReleases.mockReturnValue([{ name: "r1" }]);
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

  it("warns and holds for a keypress (no runLive) when no releases exist", async () => {
    isHelmAvailable.mockReturnValue(true);
    listHelmReleases.mockReturnValue([]);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("List Helm"));
    await cmd.run();
    expect(warn).toHaveBeenCalled();
    expect(info).toHaveBeenCalled();
    expect(waitForKeypress).toHaveBeenCalled();
    expect(runLive).not.toHaveBeenCalled();
  });
});

describe("List pending Helm releases", () => {
  it("filters via --pending and runs live when results exist", async () => {
    isHelmAvailable.mockReturnValue(true);
    listHelmReleases.mockReturnValue([{ name: "r1" }]);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("pending"));
    await cmd.run();
    expect(listHelmReleases).toHaveBeenCalledWith(CTX, NS, ["--pending"]);
    expect(runLive).toHaveBeenCalledWith("helm", [
      "list",
      "--pending",
      "--namespace",
      NS,
      "--kube-context",
      CTX,
    ]);
  });

  it("holds an interstitial when no pending releases exist", async () => {
    isHelmAvailable.mockReturnValue(true);
    listHelmReleases.mockReturnValue([]);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("pending"));
    await cmd.run();
    expect(warn).toHaveBeenCalled();
    expect(waitForKeypress).toHaveBeenCalled();
    expect(runLive).not.toHaveBeenCalled();
  });
});

describe("List failed Helm releases", () => {
  it("filters via --failed and runs live when results exist", async () => {
    isHelmAvailable.mockReturnValue(true);
    listHelmReleases.mockReturnValue([{ name: "r1" }]);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("failed"));
    await cmd.run();
    expect(listHelmReleases).toHaveBeenCalledWith(CTX, NS, ["--failed"]);
    expect(runLive).toHaveBeenCalledWith("helm", [
      "list",
      "--failed",
      "--namespace",
      NS,
      "--kube-context",
      CTX,
    ]);
  });

  it("holds an interstitial when no failed releases exist", async () => {
    isHelmAvailable.mockReturnValue(true);
    listHelmReleases.mockReturnValue([]);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("failed"));
    await cmd.run();
    expect(warn).toHaveBeenCalled();
    expect(waitForKeypress).toHaveBeenCalled();
    expect(runLive).not.toHaveBeenCalled();
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

  it("holds an interstitial when no releases found instead of bouncing back silently", async () => {
    isHelmAvailable.mockReturnValue(true);
    listHelmReleases.mockReturnValue([]);
    const cmds = buildHelmCommands(CTX, NS);
    const cmd = cmds.find((c) => c.name.includes("Delete"));
    await cmd.run();
    expect(warn).toHaveBeenCalled();
    expect(waitForKeypress).toHaveBeenCalled();
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
