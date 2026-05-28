import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./commands/helm.js", () => ({ buildHelmCommands: vi.fn().mockReturnValue([]) }));
vi.mock("./commands/ping.js", () => ({ buildPingCommands: vi.fn().mockReturnValue([]) }));

vi.mock("./lib/helm.js", () => ({
    isHelmAvailable: vi.fn().mockReturnValue(true),
    getHelmVersion: vi.fn().mockReturnValue("v3.14.0"),
}));

vi.mock("./lib/kubectl.js", () => ({
    isKubectlAvailable: vi.fn().mockReturnValue(true),
    getKubectlVersion: vi.fn().mockReturnValue("v1.30.0"),
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
    getAzVersion: vi.fn().mockReturnValue("v2.56.0"),
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
    BLUE: "",
    styleDeleteCommandLabel: vi.fn((x) => x),
    // Apply a sentinel wrapper so tests can assert the colouring path was taken,
    // without coupling to ANSI escape sequences.
    styleVerbLabel: vi.fn((verb, label) => `[${verb}]${label}`),
}));

vi.mock("./lib/env.js", () => ({
    APP_NAME: "",
    DEFAULT_NAMESPACE: "default",
    DEFAULT_CONTEXT: "",
}));

vi.mock("./lib/runner.js", () => ({
    RETURN_TO_MENU: "return-to-menu",
    runLive: vi.fn(),
}));



vi.mock("./ui/searchableList.js", () => ({
    searchableList: vi.fn(),
    BACK_SIGNAL: Symbol.for("kueball.searchPrompt.back"),
}));

vi.mock("./ui/chrome.js", () => ({
    initChrome: vi.fn(),
    loadIdentity: vi.fn().mockResolvedValue(undefined),
    destroyChrome: vi.fn(),
    confirmExit: vi.fn().mockResolvedValue(true),
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
    step: vi.fn(),
    getStepHeaderRows: vi.fn().mockReturnValue(0),
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

const { podsResource, deploymentsResource, handlers } = vi.hoisted(() => {
    const podsResource = {
        kind: "pod", plural: "pods", displayName: "Pods", group: "Workloads",
        namespaced: true, universalVerbs: ["list", "describe", "delete"], specificVerbs: ["logs", "exec"],
    };
    const deploymentsResource = {
        kind: "deployment", plural: "deployments", displayName: "Deployments", group: "Workloads",
        namespaced: true, universalVerbs: ["list", "describe", "edit", "delete"], specificVerbs: ["scale"],
    };
    return {
        podsResource,
        deploymentsResource,
        handlers: {
            list:     vi.fn().mockResolvedValue(undefined),
            describe: vi.fn().mockResolvedValue(undefined),
            edit:     vi.fn().mockResolvedValue(undefined),
            delete:   vi.fn().mockResolvedValue(undefined),
            logs:     vi.fn().mockResolvedValue(undefined),
            exec:     vi.fn().mockResolvedValue(undefined),
            scale:    vi.fn().mockResolvedValue(undefined),
        },
    };
});

vi.mock("./lib/resources.js", () => ({
    getResources: vi.fn().mockReturnValue([podsResource, deploymentsResource]),
}));

vi.mock("./lib/universalVerbs.js", () => ({
    UNIVERSAL_VERBS: {
        list:     { displayName: "List",     handler: handlers.list },
        describe: { displayName: "Describe", handler: handlers.describe },
        edit:     { displayName: "Edit",     handler: handlers.edit },
        delete:   { displayName: "Delete",   handler: handlers.delete },
    },
}));

vi.mock("./lib/specificVerbs.js", () => ({
    SPECIFIC_VERBS: {
        logs:  { displayName: "Stream logs",    handler: handlers.logs },
        exec:  { displayName: "Shell into pod", handler: handlers.exec },
        scale: { displayName: "Scale",          handler: handlers.scale },
    },
}));

const listHandler = handlers.list;
const scaleHandler = handlers.scale;

import { buildResourceMenu, buildVerbMenu, dispatchVerb } from "./main.js";

const CTX = "test-ctx";
const NS = "test-ns";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("buildResourceMenu", () => {
    it("returns items for every registered resource plus the five extras", () => {
        const items = buildResourceMenu();
        const resources = items.filter((i) => i.value?.type === "resource");
        const extras = items.filter((i) => i.value?.type === "extra");
        expect(resources).toHaveLength(2);
        expect(extras.map((e) => e.value.id)).toEqual(["helm", "ping", "events", "contexts", "exit"]);
    });

    it("resource items carry the resource entry on value.resource and use the displayName as the visible name", () => {
        const items = buildResourceMenu();
        const podsItem = items.find((i) => i.name === "Pods");
        expect(podsItem.value).toEqual({ type: "resource", resource: podsResource });
    });

    it("resource items carry a group; extras have no group (so they render flat below the grouped resources)", () => {
        const items = buildResourceMenu();
        const resources = items.filter((i) => i.value?.type === "resource");
        const extras = items.filter((i) => i.value?.type === "extra");
        for (const r of resources) expect(typeof r.group).toBe("string");
        for (const e of extras) expect(e.group).toBeUndefined();
    });
});

describe("buildVerbMenu(resource)", () => {
    it("returns one item per universal + specific verb in declaration order, plus a trailing back item", () => {
        const items = buildVerbMenu(podsResource);
        expect(items).toHaveLength(podsResource.universalVerbs.length + podsResource.specificVerbs.length + 1);
        expect(items[items.length - 1].value).toEqual({ back: true });
        expect(items[items.length - 1].name).toContain("Back");
    });

    it("passes each verb's displayName through styleVerbLabel for colouring", () => {
        // The mock wraps as `[verb]Label`; assert the wrapper was invoked per verb.
        const items = buildVerbMenu(podsResource);
        expect(items[0].name).toBe("[list]List");
        expect(items.find((i) => i.value?.verb === "logs").name).toBe("[logs]Stream logs");
        expect(items.find((i) => i.value?.verb === "delete").name).toBe("[delete]Delete");
    });

    it("skips unknown verb names with a warn instead of crashing", () => {
        const broken = { ...podsResource, universalVerbs: ["list", "garbageVerb"] };
        const items = buildVerbMenu(broken);
        const verbNames = items.map((i) => i.value?.verb).filter(Boolean);
        expect(verbNames).toContain("list");
        expect(verbNames).not.toContain("garbageVerb");
    });
});

describe("dispatchVerb(verbName, resource, ctx, ns)", () => {
    it("calls the matching UNIVERSAL_VERBS handler with (resource, ctx, ns)", async () => {
        await dispatchVerb("list", podsResource, CTX, NS);
        expect(listHandler).toHaveBeenCalledWith(podsResource, CTX, NS);
    });

    it("falls through to SPECIFIC_VERBS when the verb is not universal", async () => {
        await dispatchVerb("scale", deploymentsResource, CTX, NS);
        expect(scaleHandler).toHaveBeenCalledWith(deploymentsResource, CTX, NS);
    });

    it("returns whatever the handler resolves to (sentinels like RETURN_TO_MENU)", async () => {
        listHandler.mockResolvedValueOnce("return-to-menu");
        const result = await dispatchVerb("list", podsResource, CTX, NS);
        expect(result).toBe("return-to-menu");
    });

    it("returns null when neither registry contains the verb", async () => {
        const result = await dispatchVerb("nonexistent", podsResource, CTX, NS);
        expect(result).toBeNull();
    });
});
