import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/runner.js", () => ({ runLive: vi.fn() }));
vi.mock("../lib/azure.js", () => ({ refreshContexts: vi.fn() }));
vi.mock("../lib/output.js", () => ({ ok: vi.fn(), DIM: "", RESET: "" }));

import { runLive } from "../lib/runner.js";
import { refreshContexts } from "../lib/azure.js";
import { ok } from "../lib/output.js";
import { buildContextsCommands } from "./contexts.js";

const CTX = "test-context";
const NS = "test-namespace";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("buildContextsCommands", () => {
  it("returns 4 commands all with group 'Contexts'", () => {
    const cmds = buildContextsCommands(CTX, NS);
    expect(cmds).toHaveLength(4);
    expect(cmds.every((c) => c.group === "Contexts")).toBe(true);
  });
});

describe("Refresh contexts", () => {
  it("calls ok when refreshContexts resolves true", async () => {
    refreshContexts.mockResolvedValue(true);
    const cmd = buildContextsCommands(CTX, NS).find((c) => c.name.includes("Refresh"));
    await cmd.run();
    expect(ok).toHaveBeenCalled();
  });

  it("does not call ok when refreshContexts resolves false", async () => {
    refreshContexts.mockResolvedValue(false);
    const cmd = buildContextsCommands(CTX, NS).find((c) => c.name.includes("Refresh"));
    await cmd.run();
    expect(ok).not.toHaveBeenCalled();
  });
});

describe("List all contexts", () => {
  it("calls runLive with config get-contexts", async () => {
    const cmd = buildContextsCommands(CTX, NS).find((c) => c.name.includes("List all contexts"));
    await cmd.run();
    expect(runLive).toHaveBeenCalledWith("kubectl", ["config", "get-contexts"]);
  });
});

describe("Switch context", () => {
  it("resolves to the 'change-context' sentinel (handled live by main)", async () => {
    const cmd = buildContextsCommands(CTX, NS).find((c) => c.name.includes("Switch"));
    expect(await cmd.run()).toBe("change-context");
  });
});

describe("Change namespace", () => {
  it("resolves to the 'change-namespace' sentinel", async () => {
    const cmd = buildContextsCommands(CTX, NS).find((c) => c.name.includes("Change namespace"));
    expect(await cmd.run()).toBe("change-namespace");
  });
});
