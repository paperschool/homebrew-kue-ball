import { describe, it, expect } from "vitest";
import { RESOURCES, getResource, getResources } from "./resources.js";

const ALLOWED_GROUPS = ["Workloads", "Config", "Networking", "Cluster", "Storage"];
const ALLOWED_UNIVERSAL_VERBS = ["list", "describe", "edit", "delete"];

describe("resources registry", () => {
    it("exports RESOURCES as a non-empty array", () => {
        expect(Array.isArray(RESOURCES)).toBe(true);
        expect(RESOURCES.length).toBeGreaterThan(0);
    });

    it("includes the nine post-6-6 registered resources", () => {
        const kinds = RESOURCES.map((r) => r.kind).sort();
        expect(kinds).toEqual([
            "configmap",
            "deployment",
            "ingress",
            "pod",
            "replicaset",
            "secret",
            "service",
            "serviceaccount",
            "virtualservice",
        ]);
    });

    it("every entry has all required fields with correct types", () => {
        for (const entry of RESOURCES) {
            expect(typeof entry.kind).toBe("string");
            expect(typeof entry.plural).toBe("string");
            expect(typeof entry.displayName).toBe("string");
            expect(typeof entry.group).toBe("string");
            expect(typeof entry.namespaced).toBe("boolean");
            expect(Array.isArray(entry.universalVerbs)).toBe(true);
            expect(Array.isArray(entry.specificVerbs)).toBe(true);
        }
    });

    it("every entry's group is one of the five allowed values", () => {
        for (const entry of RESOURCES) {
            expect(ALLOWED_GROUPS).toContain(entry.group);
        }
    });

    it("every universalVerb is a recognized verb name", () => {
        for (const entry of RESOURCES) {
            for (const verb of entry.universalVerbs) {
                expect(ALLOWED_UNIVERSAL_VERBS).toContain(verb);
            }
        }
    });

    it("returns entries in group-then-(Pods-pinned/alphabetical) display order", () => {
        const orderedKinds = RESOURCES.map((r) => r.kind);
        expect(orderedKinds).toEqual([
            "pod",
            "deployment",
            "replicaset",
            "configmap",
            "secret",
            "ingress",
            "serviceaccount",
            "service",
            "virtualservice",
        ]);
    });

    it("Pods carries the full specific-verb set", () => {
        const pods = getResource("pod");
        expect(pods.specificVerbs).toEqual([
            "logs", "logsPrevious", "logsToFile", "exec", "execOneOff", "top", "portForward",
        ]);
    });

    it("Deployments carries scale + rollout + set verbs", () => {
        const dep = getResource("deployment");
        expect(dep.specificVerbs).toEqual([
            "scale", "rolloutStatus", "rolloutHistory", "rolloutUndo", "rolloutRestart", "rolloutPause", "rolloutResume", "setImage", "setEnv",
        ]);
    });

    it("VirtualService is registered as a Networking, namespaced resource with universal verbs only", () => {
        const vs = getResource("virtualservice");
        expect(vs).not.toBeNull();
        expect(vs.group).toBe("Networking");
        expect(vs.namespaced).toBe(true);
        expect(vs.universalVerbs).toEqual(["list", "describe", "delete"]);
        expect(vs.specificVerbs).toEqual([]);
        expect(vs.universalVerbs).not.toContain("edit");
    });

    it("no two entries share the same kind", () => {
        const kinds = RESOURCES.map((r) => r.kind);
        expect(new Set(kinds).size).toBe(kinds.length);
    });

    it("Pods carries the conventional kubectl strings", () => {
        const pods = getResource("pod");
        expect(pods).not.toBeNull();
        expect(pods.kind).toBe("pod");
        expect(pods.plural).toBe("pods");
        expect(pods.displayName).toBe("Pods");
        expect(pods.group).toBe("Workloads");
        expect(pods.namespaced).toBe(true);
    });

    it("Secrets intentionally omits the edit verb", () => {
        const secrets = getResource("secret");
        expect(secrets.universalVerbs).not.toContain("edit");
    });

    it("ServiceAccounts intentionally omits the edit verb", () => {
        const sa = getResource("serviceaccount");
        expect(sa.universalVerbs).not.toContain("edit");
    });

    describe("getResource(kind)", () => {
        it("returns the matching entry", () => {
            expect(getResource("deployment").displayName).toBe("Deployments");
            expect(getResource("ingress").displayName).toBe("Ingress");
        });

        it("returns null (not undefined) when no entry matches", () => {
            expect(getResource("nonexistent")).toBeNull();
        });

        it("returns null when called with null or empty string", () => {
            expect(getResource(null)).toBeNull();
            expect(getResource("")).toBeNull();
        });
    });

    describe("getResources()", () => {
        it("returns the RESOURCES array reference", () => {
            expect(getResources()).toBe(RESOURCES);
        });
    });
});
