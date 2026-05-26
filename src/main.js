#!/usr/bin/env node
import { buildHelmCommands } from "./commands/helm.js";
import { buildPingCommands } from "./commands/ping.js";
import { getResources } from "./lib/resources.js";
import { UNIVERSAL_VERBS } from "./lib/universalVerbs.js";
import { SPECIFIC_VERBS } from "./lib/specificVerbs.js";
import { isKubectlAvailable, getKubectlVersion, getCurrentContext, getContexts, getNamespaces, useContext } from "./lib/kubectl.js";
import { isHelmAvailable, getHelmVersion } from "./lib/helm.js";
import { ok, warn, CYAN, YELLOW, DIM, RESET, RED, styleDeleteCommandLabel } from "./lib/output.js";
import { APP_NAME, DEFAULT_NAMESPACE, DEFAULT_CONTEXT } from "./lib/env.js";
import { refreshContexts, isPermissionError, showPimReminder, subscriptionForContext, isAzCliAvailable, getAzVersion } from "./lib/azure.js";
import { RETURN_TO_MENU, runLive } from "./lib/runner.js";
import { searchableList } from "./ui/searchableList.js";
import { initChrome, loadIdentity, setAuthStatus, drawSplash, hideSplash, setContextInfo, setLastCommand, setSubscription, step } from "./ui/chrome.js";
import { startAuthPoller, stopAuthPoller } from "./ui/authPoller.js";
import { confirm, input } from "@inquirer/prompts";

export function buildResourceMenu() {
    const resourceItems = getResources().map((r) => ({
        group: r.group,
        name: r.displayName,
        value: { type: "resource", resource: r },
    }));
    const extras = [
        { name: "Helm",     value: { type: "extra", id: "helm" } },
        { name: "Ping",     value: { type: "extra", id: "ping" } },
        { name: "Events",   value: { type: "extra", id: "events" } },
        { name: "Contexts", value: { type: "extra", id: "contexts" } },
        { name: "Exit",     value: { type: "extra", id: "exit" } },
    ];
    return [...resourceItems, ...extras];
}

// Events is a namespace-scoped read-only operation, not a resource the user "acts on" — surfacing it
// as a top-level extra with two sub-commands matches how kubectl users actually reach for events.
function buildEventsExtras(ctx, ns) {
    return [
        {
            name: "Recent events — namespace",
            run: () => runLive("kubectl", [`--context=${ctx}`, `--namespace=${ns}`, "get", "events", "--sort-by=.lastTimestamp"]),
        },
        {
            name: "Warning events only",
            run: () => runLive("kubectl", [`--context=${ctx}`, `--namespace=${ns}`, "get", "events", "--field-selector=type=Warning", "--sort-by=.lastTimestamp"]),
        },
    ];
}

// Contexts extras — return sentinels for "switch context" / "change namespace" so handleSentinel
// owns the picker UI in one place.
function buildContextsExtras() {
    return [
        {
            name: "Refresh contexts (az aks get-credentials)",
            run: async () => {
                const refreshed = await refreshContexts();
                if (refreshed) ok("Contexts updated — restart the wizard to use a new context.");
            },
        },
        {
            name: "List all contexts",
            run: () => runLive("kubectl", ["config", "get-contexts"]),
        },
        { name: "Switch current context", run: () => "change-context" },
        { name: "Change namespace",       run: () => "change-namespace" },
    ];
}

export function buildVerbMenu(resource) {
    const items = [];
    for (const verb of [...resource.universalVerbs, ...resource.specificVerbs]) {
        const entry = UNIVERSAL_VERBS[verb] ?? SPECIFIC_VERBS[verb];
        if (!entry) {
            warn(`Verb "${verb}" not found in registries — check resources.js.`);
            continue;
        }
        items.push({
            name: entry.displayName,
            value: { verb, handler: entry.handler },
        });
    }
    items.push({ name: "← Back to resources", value: { back: true } });
    return items;
}

export async function dispatchVerb(verbName, resource, ctx, ns) {
    const entry = UNIVERSAL_VERBS[verbName] ?? SPECIFIC_VERBS[verbName];
    if (!entry) return null;
    return entry.handler(resource, ctx, ns);
}

async function pickContext() {
    const currentCtx = getCurrentContext();
    let contexts = getContexts();
    if (contexts.length === 0) {
        warn("No kubeconfig contexts found.");
        const refreshed = await refreshContexts();
        if (!refreshed) {
            console.log(`\n  ${DIM}Run the wizard again once you have contexts.${RESET}\n`);
            process.exit(1);
            return null;
        }
        contexts = getContexts();
        if (contexts.length === 0) {
            warn("Contexts still not found after credential pull — run the wizard again.");
            process.exit(1);
            return null;
        }
    }
    if (contexts.length === 1) {
        step("Context selected", `Only one cluster is in your kubeconfig — using it for this session.`);
        ok(`Using context: ${CYAN}${contexts[0]}${RESET}`);
        return contexts[0];
    }
    step("Select context", "Pick which cluster to use for this session.");
    const sorted = DEFAULT_CONTEXT
        ? [...contexts.filter((c) => c.includes(DEFAULT_CONTEXT)), ...contexts.filter((c) => !c.includes(DEFAULT_CONTEXT))]
        : contexts;
    return searchableList({
        message: "Select kubeconfig context:",
        items: sorted.map((c) => ({ name: c === currentCtx ? `${c}  ${DIM}(current)${RESET}` : c, value: c })),
    });
}

async function pickNamespace(ctx) {
    process.stdout.write(`  ${DIM}Fetching namespaces…${RESET}`);
    const namespaces = getNamespaces(ctx);
    process.stdout.write("\r\x1b[2K");
    if (namespaces.length === 0) {
        warn("Could not list namespaces — you may not have permission.");
        return input({ message: "Namespace:", default: DEFAULT_NAMESPACE });
    }
    step("Select namespace", "Pick the default namespace for this session.");
    const preferred =
        namespaces.find((n) => n === DEFAULT_NAMESPACE) ??
        (APP_NAME ? namespaces.find((n) => n.includes(APP_NAME)) : undefined);
    return searchableList({
        message: "Select namespace:",
        items: [
            ...namespaces.filter((n) => n === preferred).map((n) => ({ name: `${n}  ${DIM}(default)${RESET}`, value: n })),
            ...namespaces.filter((n) => n !== preferred).map((n) => ({ name: n, value: n })),
        ],
    });
}

function checkPrerequisites() {
    const probe = (label, available, getVersion) => {
        process.stdout.write(`  ${DIM}Checking for ${label}…${RESET}`);
        const found = available();
        const version = found ? getVersion() : null;
        process.stdout.write("\r\x1b[2K");
        return { found, version };
    };
    const label = (name, version) => version ? `${name} found  ${DIM}(${version})${RESET}` : `${name} found`;

    const kubectl = probe("kubectl", isKubectlAvailable, getKubectlVersion);
    if (!kubectl.found) {
        process.stderr.write(`  ${RED}✗ kubectl not found.${RESET}\n`);
        process.stderr.write(`  ${DIM}  Install it via: brew install kubectl${RESET}\n\n`);
        process.exit(1);
    }
    ok(label("kubectl", kubectl.version));

    const helm = probe("helm", isHelmAvailable, getHelmVersion);
    if (helm.found) ok(label("helm", helm.version));
    else warn("helm not found — Helm commands won't work (brew install helm).");

    const az = probe("az CLI", isAzCliAvailable, getAzVersion);
    if (az.found) ok(label("az CLI", az.version));
    else warn("az CLI not found — refreshing contexts from Azure is unavailable (brew install azure-cli).");

    return { azAvailable: az.found };
}

async function runLegacySubmenu(label, builder, ctx, ns) {
    step(label, "Pick an operation to run.");
    const commands = builder(ctx, ns);
    if (commands.length === 0) {
        warn(`No ${label.toLowerCase()} commands available.`);
        return null;
    }
    const items = [
        ...commands.map((cmd) => ({ name: styleDeleteCommandLabel(cmd.name), value: cmd, group: cmd.group })),
        { name: "← Back", value: { back: true } },
    ];
    const picked = await searchableList({ message: `${label} action:`, items });
    if (!picked || picked.back) return null;
    setLastCommand(picked.name);
    return picked.run();
}

async function handleSentinel(result, context, currentNamespace) {
    if (result === "change-context") {
        const ctxList = getContexts();
        if (ctxList.length === 0) { warn("No contexts found."); return { context, currentNamespace }; }
        const newCtx = await searchableList({
            message: "Switch to context:",
            items: ctxList.map((c) => ({ name: c === context ? `${c}  ${DIM}(current)${RESET}` : c, value: c })),
        });
        if (newCtx && newCtx !== context) {
            useContext(newCtx);
            const newNs = await pickNamespace(newCtx);
            setContextInfo(newCtx, newNs);
            setSubscription(subscriptionForContext(newCtx));
            ok(`Switched to context: ${CYAN}${newCtx}${RESET}`);
            return { context: newCtx, currentNamespace: newNs };
        }
        return { context, currentNamespace };
    }
    if (result === "change-namespace") {
        process.stdout.write(`  ${DIM}Fetching namespaces…${RESET}`);
        const allNs = getNamespaces(context);
        process.stdout.write("\r\x1b[2K");
        if (allNs.length === 0) { warn("Could not list namespaces."); return { context, currentNamespace }; }
        const newNs = await searchableList({ message: "Select namespace:", items: allNs.map((n) => ({ name: n, value: n })) });
        ok(`Switched to namespace: ${YELLOW}${newNs}${RESET}`);
        setContextInfo(context, newNs);
        return { context, currentNamespace: newNs };
    }
    return { context, currentNamespace };
}

async function main() {
    initChrome();
    await loadIdentity();
    setAuthStatus("checking");
    startAuthPoller((status) => setAuthStatus(status));
    process.on("exit", stopAuthPoller);
    drawSplash();
    const { azAvailable } = checkPrerequisites();
    if (azAvailable) {
        setLastCommand(`Refresh contexts  ${DIM}(az aks get-credentials)${RESET}`);
        step("Refresh kubeconfig from Azure?", "Pull fresh AKS credentials and merge them into your kubeconfig.");
        const doRefresh = await confirm({ message: "Refresh contexts now?", default: false, clearPromptOnDone: true });
        if (doRefresh) await refreshContexts();
    }
    let context = await pickContext();
    if (!context) return;
    let currentNamespace = await pickNamespace(context);
    setContextInfo(context, currentNamespace);
    setSubscription(subscriptionForContext(context));
    hideSplash();

    while (true) {
        step("Choose resource", "Pick a kubernetes resource type to act on.");
        const top = await searchableList({ message: "Resource or action:", items: buildResourceMenu() });
        if (!top || (top.type === "extra" && top.id === "exit")) break;

        if (top.type === "extra") {
            let extraResult = null;
            try {
                if (top.id === "helm")     extraResult = await runLegacySubmenu("Helm",     buildHelmCommands,     context, currentNamespace);
                if (top.id === "ping")     extraResult = await runLegacySubmenu("Ping",     buildPingCommands,     context, currentNamespace);
                if (top.id === "events")   extraResult = await runLegacySubmenu("Events",   buildEventsExtras,     context, currentNamespace);
                if (top.id === "contexts") extraResult = await runLegacySubmenu("Contexts", buildContextsExtras,   context, currentNamespace);
            } catch (err) {
                console.error(`\n  ${RED}✗ ${err.message}${RESET}`);
                if (isPermissionError(err.message)) showPimReminder();
                continue;
            }
            ({ context, currentNamespace } = await handleSentinel(extraResult, context, currentNamespace));
            continue;
        }

        const resource = top.resource;
        let stayOnResource = true;
        while (stayOnResource) {
            step(`${resource.displayName} — choose action`, "Pick an operation to run.");
            const picked = await searchableList({ message: "Action:", items: buildVerbMenu(resource) });
            if (!picked || picked.back) { stayOnResource = false; break; }
            setLastCommand(`${resource.displayName}: ${picked.verb}`);
            try {
                const result = await dispatchVerb(picked.verb, resource, context, currentNamespace);
                if (result === RETURN_TO_MENU) continue;
                ({ context, currentNamespace } = await handleSentinel(result, context, currentNamespace));
            } catch (err) {
                console.error(`\n  ${RED}✗ ${err.message}${RESET}`);
                if (isPermissionError(err.message)) showPimReminder();
            }
        }
    }
    console.log(`\n  ${DIM}Goodbye!${RESET}\n`);
}

main().catch((err) => {
    if (err.name === "ExitPromptError") { console.log(`\n  ${DIM}Cancelled.${RESET}\n`); process.exit(0); return; }
    console.error(`\n  ${RED}✗ ${err.message}${RESET}\n`);
    process.exit(1);
});
