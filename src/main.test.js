import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./commands/pods.js", () => ({ buildPodsCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./commands/logs.js", () => ({ buildLogsCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./commands/deployments.js", () => ({ buildDeploymentsCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./commands/replicasets.js", () => ({ buildReplicaSetsCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./commands/services.js", () => ({ buildServicesCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./commands/config.js", () => ({ buildConfigCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./commands/events.js", () => ({ buildEventsCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./commands/resources.js", () => ({ buildResourcesCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./commands/contexts.js", () => ({ buildContextsCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./commands/exec.js", () => ({ buildExecCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./commands/helm.js", () => ({ buildHelmCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./lib/helm.js", () => ({ isHelmAvailable: vi.fn().mockReturnValue(true) }));
vi.mock("./commands/ping.js", () => ({ buildPingCommands: vi.fn().mockReturnValue([]) }));

vi.mock("./lib/kubectl.js", () => ({
    isKubectlAvailable: vi.fn().mockReturnValue(true),
    getCurrentContext: vi.fn().mockReturnValue("default-ctx"),
    getContexts: vi.fn().mockReturnValue(["default-ctx"]),
    getNamespaces: vi.fn().mockReturnValue([]),
    useContext: vi.fn(),
}));

vi.mock("./lib/azure.js", () => ({
    refreshContexts: vi.fn().mockResolvedValue(true),
    isPermissionError: vi.fn().mockReturnValue(false),
    showPimReminder: vi.fn(),
    subscriptionForContext: vi.fn().mockReturnValue(null),
    isAzCliAvailable: vi.fn().mockReturnValue(true),
}));

vi.mock("./lib/output.js", () => ({
    ok: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    CYAN: "",
    YELLOW: "",
    DIM: "",
    RESET: "",
    BOLD: "",
    RED: "",
    styleDeleteCommandLabel: vi.fn((x) => x),
}));

vi.mock("./lib/env.js", () => ({
    APP_NAME: "",
    DEFAULT_NAMESPACE: "default",
    DEFAULT_CONTEXT: "",
}));

vi.mock("./lib/runner.js", () => ({ RETURN_TO_MENU: "return-to-menu" }));

vi.mock("./ui/searchableList.js", () => ({
    searchableList: vi.fn().mockResolvedValue("exit"),
}));

vi.mock("./ui/chrome.js", () => ({
    initChrome: vi.fn(),
    loadIdentity: vi.fn().mockResolvedValue(undefined),
    destroyChrome: vi.fn(),
    getIdentitySegment: vi.fn().mockReturnValue(""),
    isActive: vi.fn().mockReturnValue(false),
    getContentRows: vi.fn().mockReturnValue(18),
    setAuthStatus: vi.fn(),
    updateStatusBar: vi.fn(),
    drawSplash: vi.fn(),
    hideSplash: vi.fn(),
    setContextInfo: vi.fn(),
    setLastCommand: vi.fn(),
    setSubscription: vi.fn(),
}));

vi.mock("./ui/authPoller.js", () => ({
    startAuthPoller: vi.fn(),
    stopAuthPoller: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
    confirm: vi.fn().mockResolvedValue(false),
    select: vi.fn().mockResolvedValue("default-ctx"),
    input: vi.fn().mockResolvedValue("default"),
}));

import { buildAllCommands } from "./main.js";
import { buildPodsCommands } from "./commands/pods.js";
import { buildLogsCommands } from "./commands/logs.js";
import { buildDeploymentsCommands } from "./commands/deployments.js";
import { buildReplicaSetsCommands } from "./commands/replicasets.js";
import { buildServicesCommands } from "./commands/services.js";
import { buildConfigCommands } from "./commands/config.js";
import { buildEventsCommands } from "./commands/events.js";
import { buildResourcesCommands } from "./commands/resources.js";
import { buildContextsCommands } from "./commands/contexts.js";
import { buildExecCommands } from "./commands/exec.js";
import { buildHelmCommands } from "./commands/helm.js";
import { buildPingCommands } from "./commands/ping.js";

const ALL_BUILDERS = [
    buildPodsCommands,
    buildLogsCommands,
    buildDeploymentsCommands,
    buildReplicaSetsCommands,
    buildServicesCommands,
    buildConfigCommands,
    buildEventsCommands,
    buildResourcesCommands,
    buildContextsCommands,
    buildExecCommands,
    buildHelmCommands,
    buildPingCommands,
];

const CTX = "test-ctx";
const NS = "test-ns";

beforeEach(() => {
    vi.clearAllMocks();
    ALL_BUILDERS.forEach((fn) => fn.mockReturnValue([]));
});

describe("buildAllCommands", () => {
    it("calls all 12 builders with the provided ctx and ns", () => {
        buildAllCommands(CTX, NS);
        for (const fn of ALL_BUILDERS) {
            expect(fn).toHaveBeenCalledWith(CTX, NS);
        }
    });

    it("calls each builder exactly once per invocation", () => {
        buildAllCommands(CTX, NS);
        for (const fn of ALL_BUILDERS) {
            expect(fn).toHaveBeenCalledOnce();
        }
    });

    it("returns a flat array with no nested sub-arrays", () => {
        buildPodsCommands.mockReturnValue([{ group: "Pods", name: "a", run: vi.fn() }]);
        buildLogsCommands.mockReturnValue([{ group: "Logs", name: "b", run: vi.fn() }]);
        const result = buildAllCommands(CTX, NS);
        expect(Array.isArray(result)).toBe(true);
        expect(result.every((item) => !Array.isArray(item))).toBe(true);
    });

    it("returns Pods commands first and Ping commands last", () => {
        const podsCmd = { group: "Pods", name: "List pods", run: vi.fn() };
        const pingCmd = { group: "Ping", name: "Ping routes", run: vi.fn() };
        buildPodsCommands.mockReturnValue([podsCmd]);
        buildPingCommands.mockReturnValue([pingCmd]);
        const result = buildAllCommands(CTX, NS);
        expect(result[0]).toBe(podsCmd);
        expect(result[result.length - 1]).toBe(pingCmd);
    });

    it("concatenates all builder results into a single array", () => {
        ALL_BUILDERS.forEach((fn) => fn.mockReturnValue([{ group: "X", name: "cmd", run: vi.fn() }]));
        const result = buildAllCommands(CTX, NS);
        expect(result).toHaveLength(ALL_BUILDERS.length);
    });
});
