/**
 * @typedef {Object} Resource
 * @property {string} kind         singular kubectl name, e.g. "pod", "deployment"
 * @property {string} plural       kubectl plural, e.g. "pods", "deployments"
 * @property {string} displayName  user-facing label, e.g. "Pods"
 * @property {"Workloads"|"Config"|"Networking"|"Cluster"|"Storage"} group
 * @property {boolean} namespaced  true for namespace-scoped, false for cluster-scoped
 * @property {string[]} universalVerbs  subset of ["list","describe","edit","delete"]
 * @property {string[]} specificVerbs   names from src/lib/specificVerbs.js
 */

// Within each group, entries are alphabetical EXCEPT in Workloads where Pods is pinned first
// (most-used resource for an interactive CLI; everything else in Workloads is alphabetical).

/** @type {Resource[]} */
export const RESOURCES = [
    { kind: "pod",            plural: "pods",            displayName: "Pods",            group: "Workloads",  namespaced: true,
      universalVerbs: ["list", "describe", "edit", "delete"],
      specificVerbs: ["logs", "logsPrevious", "logsToFile", "exec", "execOneOff", "top", "portForward"] },
    { kind: "deployment",     plural: "deployments",     displayName: "Deployments",     group: "Workloads",  namespaced: true,
      universalVerbs: ["list", "describe", "edit", "delete"],
      specificVerbs: ["scale", "rolloutStatus", "rolloutHistory", "rolloutUndo", "rolloutRestart", "rolloutPause", "rolloutResume", "setImage", "setEnv"] },
    { kind: "replicaset",     plural: "replicasets",     displayName: "ReplicaSets",     group: "Workloads",  namespaced: true,
      universalVerbs: ["list", "describe", "edit", "delete"],
      specificVerbs: ["scale"] },
    { kind: "cronjob",        plural: "cronjobs",        displayName: "CronJobs",        group: "Workloads",  namespaced: true,
      universalVerbs: ["list", "describe", "edit", "delete"],
      specificVerbs: ["triggerNow"] },
    { kind: "daemonset",      plural: "daemonsets",      displayName: "DaemonSets",      group: "Workloads",  namespaced: true,
      universalVerbs: ["list", "describe", "edit", "delete"],
      specificVerbs: ["rolloutStatus", "rolloutHistory", "rolloutUndo", "rolloutRestart"] },
    // why: Job spec fields are mostly immutable post-creation — kubectl edit silently no-ops most changes, so we omit it
    { kind: "job",            plural: "jobs",            displayName: "Jobs",            group: "Workloads",  namespaced: true,
      universalVerbs: ["list", "describe", "delete"],
      specificVerbs: ["logs"] },
    { kind: "statefulset",    plural: "statefulsets",    displayName: "StatefulSets",    group: "Workloads",  namespaced: true,
      universalVerbs: ["list", "describe", "edit", "delete"],
      specificVerbs: ["scale", "rolloutStatus", "rolloutHistory", "rolloutUndo", "rolloutRestart", "portForward"] },

    { kind: "configmap",      plural: "configmaps",      displayName: "ConfigMaps",      group: "Config",     namespaced: true,
      universalVerbs: ["list", "describe", "edit", "delete"],
      specificVerbs: [] },
    // why: kubectl edit on secrets exposes base64 values in the editor — use a shell if you really need it
    { kind: "secret",         plural: "secrets",         displayName: "Secrets",         group: "Config",     namespaced: true,
      universalVerbs: ["list", "describe", "delete"],
      specificVerbs: [] },

    { kind: "ingress",        plural: "ingresses",       displayName: "Ingress",         group: "Networking", namespaced: true,
      universalVerbs: ["list", "describe", "edit", "delete"],
      specificVerbs: [] },
    { kind: "serviceaccount", plural: "serviceaccounts", displayName: "ServiceAccounts", group: "Networking", namespaced: true,
      universalVerbs: ["list", "describe", "delete"],
      specificVerbs: [] },
    { kind: "service",        plural: "services",        displayName: "Services",        group: "Networking", namespaced: true,
      universalVerbs: ["list", "describe", "edit", "delete"],
      specificVerbs: ["portForward"] },
    // why: Istio CRD — generic universal verbs work, no editing in-place (most VS edits go through git/CD)
    { kind: "virtualservice", plural: "virtualservices", displayName: "VirtualServices", group: "Networking", namespaced: true,
      universalVerbs: ["list", "describe", "delete"],
      specificVerbs: [] },
];

const _seen = new Set();
for (const r of RESOURCES) {
    if (_seen.has(r.kind)) throw new Error(`Duplicate resource kind in registry: "${r.kind}"`);
    _seen.add(r.kind);
}

export function getResource(kind) {
    if (!kind) return null;
    return RESOURCES.find((r) => r.kind === kind) ?? null;
}

// why: callers must treat the return value as read-only — mutating it corrupts the registry for the rest of the session
export function getResources() {
    return RESOURCES;
}
