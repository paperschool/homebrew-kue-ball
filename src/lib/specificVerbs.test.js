import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./runner.js", () => ({
    runLive: vi.fn(),
    runLivePiped: vi.fn(),
    runLivePipedWithExitKeys: vi.fn(),
    runLiveWithOptionalWatch: vi.fn(),
    runShell: vi.fn().mockResolvedValue(0),
    isJqAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock("./shell.js", () => ({
    run: vi.fn(),
}));

vi.mock("./universalVerbs.js", () => ({
    pickResourceInstance: vi.fn().mockResolvedValue("web-1"),
}));

vi.mock("./env.js", () => ({
    APP_NAME: "",
}));

vi.mock("./output.js", () => ({
    DIM: "",
    RESET: "",
    ok: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
}));

vi.mock("../ui/chrome.js", () => ({
    waitForKeypress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@inquirer/prompts", () => ({
    select: vi.fn(),
    input: vi.fn(),
    confirm: vi.fn(),
}));

import {
    runLive,
    runLivePiped,
    runLivePipedWithExitKeys,
    runLiveWithOptionalWatch,
    runShell,
} from "./runner.js";
import { run } from "./shell.js";
import { pickResourceInstance } from "./universalVerbs.js";
import { warn, ok } from "./output.js";
import { select, input, confirm } from "@inquirer/prompts";
import { SPECIFIC_VERBS } from "./specificVerbs.js";

const CTX = "test-ctx";
const NS = "test-ns";

const podsResource = {
    kind: "pod", plural: "pods", displayName: "Pods", group: "Workloads",
    namespaced: true, universalVerbs: [], specificVerbs: ["logs", "exec"],
};
const deploymentResource = {
    kind: "deployment", plural: "deployments", displayName: "Deployments", group: "Workloads",
    namespaced: true, universalVerbs: [], specificVerbs: ["scale", "rolloutUndo"],
};
const nodesResource = {
    kind: "node", plural: "nodes", displayName: "Nodes", group: "Cluster",
    namespaced: false, universalVerbs: [], specificVerbs: ["top"],
};
const jobResource = {
    kind: "job", plural: "jobs", displayName: "Jobs", group: "Workloads",
    namespaced: true, universalVerbs: [], specificVerbs: ["logs"],
};
const cronJobResource = {
    kind: "cronjob", plural: "cronjobs", displayName: "CronJobs", group: "Workloads",
    namespaced: true, universalVerbs: [], specificVerbs: ["triggerNow"],
};

beforeEach(() => {
    vi.resetAllMocks();
    pickResourceInstance.mockResolvedValue("web-1");
});

describe("SPECIFIC_VERBS shape", () => {
    it("contains the 21 expected verb keys (16 from 6-3 + 4 node verbs from 6-4 + triggerNow from 6-7)", () => {
        const expected = [
            "logs", "logsPrevious", "logsToFile", "exec", "execOneOff",
            "scale",
            "rolloutStatus", "rolloutHistory", "rolloutUndo",
            "rolloutRestart", "rolloutPause", "rolloutResume",
            "setImage", "setEnv",
            "top", "portForward",
            "cordon", "uncordon", "drain", "taint",
            "triggerNow",
        ];
        for (const key of expected) {
            expect(SPECIFIC_VERBS[key]).toBeDefined();
            expect(typeof SPECIFIC_VERBS[key].displayName).toBe("string");
            expect(typeof SPECIFIC_VERBS[key].handler).toBe("function");
        }
    });
});

describe("logs", () => {
    it("returns early when pickResourceInstance resolves null", async () => {
        pickResourceInstance.mockResolvedValueOnce(null);
        await SPECIFIC_VERBS.logs.handler(podsResource, CTX, NS);
        expect(runLivePipedWithExitKeys).not.toHaveBeenCalled();
    });

    it("streams logs via runLivePipedWithExitKeys with logs -f {pod} --tail=200", async () => {
        await SPECIFIC_VERBS.logs.handler(podsResource, CTX, NS);
        expect(runLivePipedWithExitKeys).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "logs",
            "-f",
            "web-1",
            "--tail=200",
        ]);
    });
});

describe("logs — Job branch", () => {
    it("for a Job resource, resolves the pod via --selector=job-name and then streams its logs", async () => {
        pickResourceInstance.mockResolvedValueOnce("nightly-backup");
        run.mockReturnValueOnce("backup-pod-x9");
        await SPECIFIC_VERBS.logs.handler(jobResource, CTX, NS);
        const lookupCmd = run.mock.calls[0][0];
        expect(lookupCmd).toContain("--selector=job-name=nightly-backup");
        expect(runLivePipedWithExitKeys).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "logs",
            "-f",
            "backup-pod-x9",
            "--tail=200",
        ]);
    });

    it("warns and skips when the Job has no pod (empty jsonpath result)", async () => {
        pickResourceInstance.mockResolvedValueOnce("nightly-backup");
        run.mockReturnValueOnce(null);
        await SPECIFIC_VERBS.logs.handler(jobResource, CTX, NS);
        expect(warn).toHaveBeenCalled();
        expect(runLivePipedWithExitKeys).not.toHaveBeenCalled();
    });

    it("warns when invoked on a resource other than Pod or Job", async () => {
        pickResourceInstance.mockResolvedValueOnce("web-1");
        await SPECIFIC_VERBS.logs.handler(deploymentResource, CTX, NS);
        expect(warn).toHaveBeenCalled();
        expect(runLivePipedWithExitKeys).not.toHaveBeenCalled();
    });
});

describe("triggerNow (CronJobs)", () => {
    it("runs kubectl create job --from=cronjob/{name} {name}-manual-{ts}; ok on exit 0", async () => {
        pickResourceInstance.mockResolvedValueOnce("nightly");
        runLive.mockResolvedValueOnce(0);
        await SPECIFIC_VERBS.triggerNow.handler(cronJobResource, CTX, NS);
        const [, args] = runLive.mock.calls[0];
        expect(args).toContain("create");
        expect(args).toContain("job");
        expect(args.some((a) => a === "--from=cronjob/nightly")).toBe(true);
        expect(args.some((a) => /^nightly-manual-\d+$/.test(a))).toBe(true);
        expect(ok).toHaveBeenCalled();
    });

    it("warns on non-zero exit", async () => {
        pickResourceInstance.mockResolvedValueOnce("nightly");
        runLive.mockResolvedValueOnce(1);
        await SPECIFIC_VERBS.triggerNow.handler(cronJobResource, CTX, NS);
        expect(warn).toHaveBeenCalled();
    });

    it("returns early when pick resolves null", async () => {
        pickResourceInstance.mockResolvedValueOnce(null);
        await SPECIFIC_VERBS.triggerNow.handler(cronJobResource, CTX, NS);
        expect(runLive).not.toHaveBeenCalled();
    });
});

describe("logsPrevious", () => {
    it("uses runLivePiped with --previous --tail=300", async () => {
        await SPECIFIC_VERBS.logsPrevious.handler(podsResource, CTX, NS);
        expect(runLivePiped).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "logs",
            "web-1",
            "--previous",
            "--tail=300",
        ]);
    });
});

describe("exec", () => {
    it("calls runLive with -it pod -- {shell} when shell is picked", async () => {
        select.mockResolvedValueOnce("bash");
        await SPECIFIC_VERBS.exec.handler(podsResource, CTX, NS);
        expect(runLive).toHaveBeenCalledWith(
            "kubectl",
            [`--context=${CTX}`, `--namespace=${NS}`, "exec", "-it", "web-1", "--", "bash"],
            expect.objectContaining({ interactive: true }),
        );
    });
});

describe("execOneOff", () => {
    it("calls runLive with exec pod -- sh -c {cmd}", async () => {
        input.mockResolvedValueOnce("env");
        await SPECIFIC_VERBS.execOneOff.handler(podsResource, CTX, NS);
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "exec",
            "web-1",
            "--",
            "sh",
            "-c",
            "env",
        ]);
    });
});

describe("scale", () => {
    it("runs kubectl scale kind/name --replicas=N for non-zero replicas without confirm", async () => {
        input.mockResolvedValueOnce("3");
        await SPECIFIC_VERBS.scale.handler(deploymentResource, CTX, NS);
        expect(confirm).not.toHaveBeenCalled();
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "scale",
            "deployment/web-1",
            "--replicas=3",
        ]);
    });

    it("for zero replicas prompts confirm; declined → no kubectl scale", async () => {
        input.mockResolvedValueOnce("0");
        confirm.mockResolvedValueOnce(false);
        await SPECIFIC_VERBS.scale.handler(deploymentResource, CTX, NS);
        expect(runLive).not.toHaveBeenCalled();
    });

    it("for zero replicas confirmed → kubectl scale --replicas=0", async () => {
        input.mockResolvedValueOnce("0");
        confirm.mockResolvedValueOnce(true);
        await SPECIFIC_VERBS.scale.handler(deploymentResource, CTX, NS);
        expect(runLive).toHaveBeenCalledWith("kubectl", expect.arrayContaining([
            "scale", "deployment/web-1", "--replicas=0",
        ]));
    });
});

describe("rollout verbs", () => {
    it("rolloutStatus runs kubectl rollout status kind/name (no confirm)", async () => {
        await SPECIFIC_VERBS.rolloutStatus.handler(deploymentResource, CTX, NS);
        expect(confirm).not.toHaveBeenCalled();
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "rollout",
            "status",
            "deployment/web-1",
        ]);
    });

    it("rolloutUndo does NOT call runLive when confirm resolves false", async () => {
        confirm.mockResolvedValueOnce(false);
        await SPECIFIC_VERBS.rolloutUndo.handler(deploymentResource, CTX, NS);
        expect(runLive).not.toHaveBeenCalled();
    });

    it("rolloutUndo calls runLive with rollout undo kind/name when confirmed", async () => {
        confirm.mockResolvedValueOnce(true);
        await SPECIFIC_VERBS.rolloutUndo.handler(deploymentResource, CTX, NS);
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "rollout",
            "undo",
            "deployment/web-1",
        ]);
    });

    it("rolloutRestart also confirms before running", async () => {
        confirm.mockResolvedValueOnce(false);
        await SPECIFIC_VERBS.rolloutRestart.handler(deploymentResource, CTX, NS);
        expect(runLive).not.toHaveBeenCalled();
    });

    it("rolloutPause and rolloutResume do NOT prompt for confirm", async () => {
        await SPECIFIC_VERBS.rolloutPause.handler(deploymentResource, CTX, NS);
        await SPECIFIC_VERBS.rolloutResume.handler(deploymentResource, CTX, NS);
        expect(confirm).not.toHaveBeenCalled();
        expect(runLive).toHaveBeenCalledTimes(2);
    });
});

describe("setImage", () => {
    it("rejects invalid input (missing '=') without calling runLive", async () => {
        input.mockResolvedValueOnce("not-a-valid-spec");
        await SPECIFIC_VERBS.setImage.handler(deploymentResource, CTX, NS);
        expect(warn).toHaveBeenCalled();
        expect(runLive).not.toHaveBeenCalled();
    });

    it("for valid container=image input prompts confirm and runs kubectl set image when accepted", async () => {
        input.mockResolvedValueOnce("app=nginx:1.27");
        confirm.mockResolvedValueOnce(true);
        await SPECIFIC_VERBS.setImage.handler(deploymentResource, CTX, NS);
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "set",
            "image",
            "deployment/web-1",
            "app=nginx:1.27",
        ]);
    });

    it("does not call runLive when confirm resolves false", async () => {
        input.mockResolvedValueOnce("app=nginx:1.27");
        confirm.mockResolvedValueOnce(false);
        await SPECIFIC_VERBS.setImage.handler(deploymentResource, CTX, NS);
        expect(runLive).not.toHaveBeenCalled();
    });
});

describe("setEnv", () => {
    it("rejects invalid KEY=VALUE input without calling runLive", async () => {
        input.mockResolvedValueOnce("MISSING_EQUALS");
        await SPECIFIC_VERBS.setEnv.handler(deploymentResource, CTX, NS);
        expect(warn).toHaveBeenCalled();
        expect(runLive).not.toHaveBeenCalled();
    });

    it("for valid KEY=VALUE input runs kubectl set env (no confirm)", async () => {
        input.mockResolvedValueOnce("DEBUG=true");
        await SPECIFIC_VERBS.setEnv.handler(deploymentResource, CTX, NS);
        expect(confirm).not.toHaveBeenCalled();
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "set",
            "env",
            "deployment/web-1",
            "DEBUG=true",
        ]);
    });
});

describe("top", () => {
    it("for namespaced resource calls runLiveWithOptionalWatch with --namespace + top plural", async () => {
        await SPECIFIC_VERBS.top.handler(podsResource, CTX, NS);
        expect(runLiveWithOptionalWatch).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "top",
            "pods",
        ]);
    });

    it("for cluster-scoped resource omits --namespace", async () => {
        await SPECIFIC_VERBS.top.handler(nodesResource, CTX, NS);
        expect(runLiveWithOptionalWatch).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            "top",
            "nodes",
        ]);
    });

    it("does not pick a resource instance (operates on the resource type, not an instance)", async () => {
        await SPECIFIC_VERBS.top.handler(podsResource, CTX, NS);
        expect(pickResourceInstance).not.toHaveBeenCalled();
    });
});

describe("portForward", () => {
    it("picks → prompts for ports → calls runLivePipedWithExitKeys with kind/name and ports", async () => {
        input.mockResolvedValueOnce("8080:80");
        await SPECIFIC_VERBS.portForward.handler(deploymentResource, CTX, NS);
        expect(runLivePipedWithExitKeys).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            `--namespace=${NS}`,
            "port-forward",
            "deployment/web-1",
            "8080:80",
        ]);
    });
});

describe("logsToFile", () => {
    it("runs runShell with a redirect to ./logs/{pod}_{ts}.log; ok on exit 0", async () => {
        input.mockResolvedValueOnce("");
        runShell.mockResolvedValueOnce(0);
        await SPECIFIC_VERBS.logsToFile.handler(podsResource, CTX, NS);
        expect(runShell).toHaveBeenCalledTimes(1);
        const shellCmd = runShell.mock.calls[0][0];
        expect(shellCmd).toContain("logs");
        expect(shellCmd).toContain("web-1");
        expect(shellCmd).toContain("./logs/");
        expect(shellCmd).toContain(">");
        expect(ok).toHaveBeenCalled();
    });
});

describe("node verbs", () => {
    it("cordon calls runLive with --context, cordon, name; no --namespace", async () => {
        pickResourceInstance.mockResolvedValueOnce("worker-1");
        await SPECIFIC_VERBS.cordon.handler(nodesResource, CTX, NS);
        expect(runLive).toHaveBeenCalledWith("kubectl", [`--context=${CTX}`, "cordon", "worker-1"]);
    });

    it("uncordon calls runLive with --context, uncordon, name; no --namespace", async () => {
        pickResourceInstance.mockResolvedValueOnce("worker-1");
        await SPECIFIC_VERBS.uncordon.handler(nodesResource, CTX, NS);
        expect(runLive).toHaveBeenCalledWith("kubectl", [`--context=${CTX}`, "uncordon", "worker-1"]);
    });

    it("drain prompts confirm; declined → no runner called", async () => {
        pickResourceInstance.mockResolvedValueOnce("worker-1");
        confirm.mockResolvedValueOnce(false);
        await SPECIFIC_VERBS.drain.handler(nodesResource, CTX, NS);
        expect(runLivePipedWithExitKeys).not.toHaveBeenCalled();
        expect(runLive).not.toHaveBeenCalled();
    });

    it("drain confirmed → runLivePipedWithExitKeys with --ignore-daemonsets --delete-emptydir-data", async () => {
        pickResourceInstance.mockResolvedValueOnce("worker-1");
        confirm.mockResolvedValueOnce(true);
        await SPECIFIC_VERBS.drain.handler(nodesResource, CTX, NS);
        expect(runLivePipedWithExitKeys).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            "drain",
            "worker-1",
            "--ignore-daemonsets",
            "--delete-emptydir-data",
        ]);
    });

    it("taint rejects invalid spec without calling runLive", async () => {
        pickResourceInstance.mockResolvedValueOnce("worker-1");
        input.mockResolvedValueOnce("not-a-valid-taint");
        await SPECIFIC_VERBS.taint.handler(nodesResource, CTX, NS);
        expect(warn).toHaveBeenCalled();
        expect(runLive).not.toHaveBeenCalled();
    });

    it("taint accepts key=value:NoSchedule and runs kubectl taint nodes <name> <spec>", async () => {
        pickResourceInstance.mockResolvedValueOnce("worker-1");
        input.mockResolvedValueOnce("dedicated=gpu:NoSchedule");
        await SPECIFIC_VERBS.taint.handler(nodesResource, CTX, NS);
        expect(runLive).toHaveBeenCalledWith("kubectl", [
            `--context=${CTX}`,
            "taint", "nodes", "worker-1", "dedicated=gpu:NoSchedule",
        ]);
    });

    it("taint accepts effect-only spec (no value)", async () => {
        pickResourceInstance.mockResolvedValueOnce("worker-1");
        input.mockResolvedValueOnce("disk:NoSchedule");
        await SPECIFIC_VERBS.taint.handler(nodesResource, CTX, NS);
        expect(runLive).toHaveBeenCalledWith("kubectl", expect.arrayContaining([
            "taint", "nodes", "worker-1", "disk:NoSchedule",
        ]));
    });

    it("all four node verbs return early when pickResourceInstance resolves null", async () => {
        for (const verb of ["cordon", "uncordon", "drain", "taint"]) {
            vi.resetAllMocks();
            pickResourceInstance.mockResolvedValueOnce(null);
            await SPECIFIC_VERBS[verb].handler(nodesResource, CTX, NS);
            expect(runLive).not.toHaveBeenCalled();
            expect(runLivePipedWithExitKeys).not.toHaveBeenCalled();
        }
    });
});

describe("early-return path", () => {
    it.each([
        ["logs"], ["logsPrevious"], ["logsToFile"],
        ["exec"], ["execOneOff"],
        ["scale"], ["setImage"], ["setEnv"], ["portForward"],
        ["rolloutStatus"], ["rolloutUndo"],
    ])("%s returns without dispatching when pickResourceInstance resolves null", async (verbName) => {
        pickResourceInstance.mockResolvedValueOnce(null);
        await SPECIFIC_VERBS[verbName].handler(deploymentResource, CTX, NS);
        expect(runLive).not.toHaveBeenCalled();
        expect(runLivePiped).not.toHaveBeenCalled();
        expect(runLivePipedWithExitKeys).not.toHaveBeenCalled();
        expect(runShell).not.toHaveBeenCalled();
    });
});
