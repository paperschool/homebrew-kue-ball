import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./runner.js", () => ({
    runLive: vi.fn(),
    runLiveWithOptionalWatch: vi.fn(),
}));

vi.mock("./shell.js", () => ({
    run: vi.fn(),
    spawnInteractive: vi.fn(),
}));

vi.mock("../ui/resourcePicker.js", () => ({
    resourcePicker: vi.fn(),
}));

vi.mock("../ui/output.js", () => ({}), { virtual: true });

vi.mock("./output.js", () => ({
    DIM: "",
    RESET: "",
    warn: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
    confirm: vi.fn(),
}));

import { runLive, runLiveWithOptionalWatch } from "./runner.js";
import { run, spawnInteractive } from "./shell.js";
import { resourcePicker } from "../ui/resourcePicker.js";
import { confirm } from "@inquirer/prompts";
import { UNIVERSAL_VERBS, pickResourceInstance } from "./universalVerbs.js";

const CTX = "test-ctx";
const NS = "test-ns";

const podsResource = {
    kind: "pod",
    plural: "pods",
    displayName: "Pods",
    group: "Workloads",
    namespaced: true,
    universalVerbs: ["list", "describe", "edit", "delete"],
    specificVerbs: [],
};

const nodesResource = {
    kind: "node",
    plural: "nodes",
    displayName: "Nodes",
    group: "Cluster",
    namespaced: false,
    universalVerbs: ["list", "describe", "edit"],
    specificVerbs: [],
};

beforeEach(() => {
    vi.resetAllMocks();
});

describe("UNIVERSAL_VERBS shape", () => {
    it("exports the four universal verbs with displayName + handler", () => {
        for (const key of ["list", "describe", "edit", "delete"]) {
            expect(UNIVERSAL_VERBS[key]).toBeDefined();
            expect(typeof UNIVERSAL_VERBS[key].displayName).toBe("string");
            expect(typeof UNIVERSAL_VERBS[key].handler).toBe("function");
        }
    });
});

describe("UNIVERSAL_VERBS.list", () => {
    it("for namespaced resource calls runLiveWithOptionalWatch with --context, --namespace, get, plural, -o, wide", async () => {
        await UNIVERSAL_VERBS.list.handler(podsResource, CTX, NS);
        expect(runLiveWithOptionalWatch).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "get",
            "pods",
            "-o",
            "wide",
        ]);
    });

    it("for cluster-scoped resource omits --namespace", async () => {
        await UNIVERSAL_VERBS.list.handler(nodesResource, CTX, NS);
        const [, args] = runLiveWithOptionalWatch.mock.calls[0];
        expect(args.every((a) => !String(a).startsWith("--namespace="))).toBe(true);
        expect(args).toContain("nodes");
    });
});

describe("UNIVERSAL_VERBS.describe", () => {
    it("returns early without calling runLive when pickResourceInstance resolves null", async () => {
        resourcePicker.mockResolvedValueOnce(null);
        await UNIVERSAL_VERBS.describe.handler(podsResource, CTX, NS);
        expect(runLive).not.toHaveBeenCalled();
    });

    it("calls runLive with describe pod args and an onEdit callback", async () => {
        resourcePicker.mockResolvedValueOnce("my-pod");
        await UNIVERSAL_VERBS.describe.handler(podsResource, CTX, NS);
        expect(runLive).toHaveBeenCalledWith(
            "kubectl",
            [`--context=${CTX}`, `--namespace=${NS}`, "describe", "pod", "my-pod"],
            expect.objectContaining({ onEdit: expect.any(Function) }),
        );
    });

    it("onEdit callback invokes spawnInteractive with kubectl edit + KUBE_EDITOR env", async () => {
        resourcePicker.mockResolvedValueOnce("my-pod");
        await UNIVERSAL_VERBS.describe.handler(podsResource, CTX, NS);
        const callOpts = runLive.mock.calls[0][2];
        await callOpts.onEdit();
        expect(spawnInteractive).toHaveBeenCalledWith(
            "kubectl",
            ["edit", "pod", "my-pod", `--namespace=${NS}`, `--context=${CTX}`],
            expect.objectContaining({
                env: expect.objectContaining({ KUBE_EDITOR: expect.any(String) }),
            }),
        );
    });

    it("for cluster-scoped resource omits --namespace from describe args", async () => {
        resourcePicker.mockResolvedValueOnce("worker-1");
        await UNIVERSAL_VERBS.describe.handler(nodesResource, CTX, NS);
        const [, args] = runLive.mock.calls[0];
        expect(args.every((a) => !String(a).startsWith("--namespace="))).toBe(true);
        expect(args).toContain("node");
        expect(args).toContain("worker-1");
    });
});

describe("UNIVERSAL_VERBS.edit", () => {
    it("returns early without calling spawnInteractive when pick resolves null", async () => {
        resourcePicker.mockResolvedValueOnce(null);
        await UNIVERSAL_VERBS.edit.handler(podsResource, CTX, NS);
        expect(spawnInteractive).not.toHaveBeenCalled();
    });

    it("calls spawnInteractive with KUBE_EDITOR set", async () => {
        resourcePicker.mockResolvedValueOnce("my-pod");
        await UNIVERSAL_VERBS.edit.handler(podsResource, CTX, NS);
        expect(spawnInteractive).toHaveBeenCalledWith(
            "kubectl",
            ["edit", "pod", "my-pod", `--namespace=${NS}`, `--context=${CTX}`],
            expect.objectContaining({
                env: expect.objectContaining({ KUBE_EDITOR: expect.any(String) }),
            }),
        );
    });
});

describe("UNIVERSAL_VERBS.delete", () => {
    it("returns early when pickResourceInstance resolves null", async () => {
        resourcePicker.mockResolvedValueOnce(null);
        await UNIVERSAL_VERBS.delete.handler(podsResource, CTX, NS);
        expect(confirm).not.toHaveBeenCalled();
        expect(runLive).not.toHaveBeenCalled();
    });

    it("does not call runLive when confirm resolves false", async () => {
        resourcePicker.mockResolvedValueOnce("my-pod");
        confirm.mockResolvedValueOnce(false);
        await UNIVERSAL_VERBS.delete.handler(podsResource, CTX, NS);
        expect(runLive).not.toHaveBeenCalled();
    });

    it("calls runLive with delete kind name + --timeout=10s when confirmed on a Pod", async () => {
        resourcePicker.mockResolvedValueOnce("my-pod");
        confirm.mockResolvedValueOnce(true);
        await UNIVERSAL_VERBS.delete.handler(podsResource, CTX, NS);
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "delete",
            "pod",
            "my-pod",
            "--timeout=10s",
        ]);
    });

    it("does NOT add --timeout for non-pod resources (deployments etc. legitimately take longer)", async () => {
        const deploymentResource = { ...podsResource, kind: "deployment", plural: "deployments", displayName: "Deployments" };
        resourcePicker.mockResolvedValueOnce("web");
        confirm.mockResolvedValueOnce(true);
        await UNIVERSAL_VERBS.delete.handler(deploymentResource, CTX, NS);
        const [, args] = runLive.mock.calls[0];
        expect(args).not.toContain("--timeout=10s");
        expect(args.some((a) => String(a).startsWith("--timeout"))).toBe(false);
    });

    it("for a Pod, the confirm message warns that the controller will recreate it", async () => {
        resourcePicker.mockResolvedValueOnce("my-pod");
        confirm.mockResolvedValueOnce(false);
        await UNIVERSAL_VERBS.delete.handler(podsResource, CTX, NS);
        expect(confirm).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringMatching(/declarative|controller recreates/i),
            }),
        );
    });

    it("for non-Pod resources, the confirm message has no declarative warning", async () => {
        const deploymentResource = { ...podsResource, kind: "deployment", plural: "deployments", displayName: "Deployments" };
        resourcePicker.mockResolvedValueOnce("web");
        confirm.mockResolvedValueOnce(false);
        await UNIVERSAL_VERBS.delete.handler(deploymentResource, CTX, NS);
        const [{ message }] = confirm.mock.calls[0];
        expect(message).not.toMatch(/declarative|controller recreates/i);
    });

    it("confirm is called with default: false", async () => {
        resourcePicker.mockResolvedValueOnce("my-pod");
        confirm.mockResolvedValueOnce(false);
        await UNIVERSAL_VERBS.delete.handler(podsResource, CTX, NS);
        expect(confirm).toHaveBeenCalledWith(
            expect.objectContaining({ default: false }),
        );
    });

    it("for cluster-scoped resource omits --namespace from delete args", async () => {
        resourcePicker.mockResolvedValueOnce("worker-1");
        confirm.mockResolvedValueOnce(true);
        await UNIVERSAL_VERBS.delete.handler(nodesResource, CTX, NS);
        const [, args] = runLive.mock.calls[0];
        expect(args.every((a) => !String(a).startsWith("--namespace="))).toBe(true);
    });
});

describe("pickResourceInstance", () => {
    it("calls resourcePicker with a fetchFn, mapFn, listOptions, and namespace-aware spinner message", async () => {
        resourcePicker.mockResolvedValueOnce("ignored");
        await pickResourceInstance(podsResource, CTX, NS);
        expect(resourcePicker).toHaveBeenCalledTimes(1);
        const opts = resourcePicker.mock.calls[0][0];
        expect(opts.spinnerMessage).toContain("Pods");
        expect(opts.spinnerMessage).toContain(NS);
        expect(typeof opts.fetchFn).toBe("function");
        expect(typeof opts.mapFn).toBe("function");
        expect(opts.listOptions).toBeDefined();
    });

    it("for cluster-scoped resource produces a spinner message without namespace and a fetch that omits --namespace", async () => {
        resourcePicker.mockResolvedValueOnce("ignored");
        run.mockReturnValueOnce(JSON.stringify({ items: [] }));
        await pickResourceInstance(nodesResource, CTX, NS);
        const opts = resourcePicker.mock.calls[0][0];
        expect(opts.spinnerMessage).not.toContain(NS);
        await opts.fetchFn();
        const cmdString = run.mock.calls[0][0];
        expect(cmdString).not.toContain("--namespace=");
        expect(cmdString).toContain("get nodes");
    });

    it("fetchFn returns parsed items array from kubectl JSON", async () => {
        resourcePicker.mockResolvedValueOnce("ignored");
        run.mockReturnValueOnce(JSON.stringify({ items: [{ metadata: { name: "a" } }, { metadata: { name: "b" } }] }));
        await pickResourceInstance(podsResource, CTX, NS);
        const items = await resourcePicker.mock.calls[0][0].fetchFn();
        expect(items).toHaveLength(2);
        expect(items[0].metadata.name).toBe("a");
    });

    it("fetchFn returns [] on null kubectl output and on JSON parse failure", async () => {
        resourcePicker.mockResolvedValueOnce("ignored");
        run.mockReturnValueOnce(null);
        await pickResourceInstance(podsResource, CTX, NS);
        let items = await resourcePicker.mock.calls[0][0].fetchFn();
        expect(items).toEqual([]);

        vi.resetAllMocks();
        resourcePicker.mockResolvedValueOnce("ignored");
        run.mockReturnValueOnce("not json {");
        await pickResourceInstance(podsResource, CTX, NS);
        items = await resourcePicker.mock.calls[0][0].fetchFn();
        expect(items).toEqual([]);
    });

    it("mapFn produces { name, value } where value is the resource's metadata.name", async () => {
        resourcePicker.mockResolvedValueOnce("ignored");
        await pickResourceInstance(podsResource, CTX, NS);
        const mapFn = resourcePicker.mock.calls[0][0].mapFn;
        const out = mapFn({ metadata: { name: "web-1" }, status: { phase: "Running" } });
        expect(out.value).toBe("web-1");
        expect(out.name).toContain("web-1");
    });

    it("returns whatever resourcePicker returns (string name or null)", async () => {
        resourcePicker.mockResolvedValueOnce("picked-name");
        const out = await pickResourceInstance(podsResource, CTX, NS);
        expect(out).toBe("picked-name");

        resourcePicker.mockResolvedValueOnce(null);
        const out2 = await pickResourceInstance(podsResource, CTX, NS);
        expect(out2).toBeNull();
    });
});
