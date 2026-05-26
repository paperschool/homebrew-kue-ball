#!/usr/bin/env node
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
import { isKubectlAvailable, getKubectlVersion, getCurrentContext, getContexts, getNamespaces, useContext } from "./lib/kubectl.js";
import { isHelmAvailable, getHelmVersion } from "./lib/helm.js";
import { ok, warn, CYAN, YELLOW, DIM, RESET, BOLD, RED, styleDeleteCommandLabel } from "./lib/output.js";
import { APP_NAME, DEFAULT_NAMESPACE, DEFAULT_CONTEXT } from "./lib/env.js";
import { refreshContexts, isPermissionError, showPimReminder, subscriptionForContext, isAzCliAvailable, getAzVersion } from "./lib/azure.js";
import { RETURN_TO_MENU } from "./lib/runner.js";
import { searchableList } from "./ui/searchableList.js";
import { initChrome, loadIdentity, setAuthStatus, drawSplash, hideSplash, setContextInfo, setLastCommand, setSubscription, step } from "./ui/chrome.js";
import { startAuthPoller, stopAuthPoller } from "./ui/authPoller.js";
import { confirm, input } from "@inquirer/prompts";

export function buildAllCommands(ctx, ns) {
    return [
        ...buildPodsCommands(ctx, ns),
        ...buildLogsCommands(ctx, ns),
        ...buildDeploymentsCommands(ctx, ns),
        ...buildReplicaSetsCommands(ctx, ns),
        ...buildServicesCommands(ctx, ns),
        ...buildConfigCommands(ctx, ns),
        ...buildEventsCommands(ctx, ns),
        ...buildResourcesCommands(ctx, ns),
        ...buildContextsCommands(ctx, ns),
        ...buildExecCommands(ctx, ns),
        ...buildHelmCommands(ctx, ns),
        ...buildPingCommands(ctx, ns),
    ];
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

// Verifies the required (kubectl) and optional (helm, az) CLIs up front. kubectl is fatal;
// helm/az just warn. Returns whether az is available so the caller can gate the Azure refresh.
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
    const namespace = await pickNamespace(context);
    setContextInfo(context, namespace);
    setSubscription(subscriptionForContext(context));
    hideSplash(); // entering the menu — the title art should no longer redraw on resize
    let currentNamespace = namespace;
    while (true) {
        console.log("");
        const pageSize = Math.max(5, (process.stdout.rows ?? 24) - 4);
        const commands = buildAllCommands(context, currentNamespace);
        const chosen = await searchableList({
            message: "Run a command:",
            items: [
                ...commands.map((cmd) => ({ name: `  ${styleDeleteCommandLabel(cmd.name)}`, value: cmd, group: cmd.group })),
                { name: "  Exit wizard", value: "exit" },
            ],
            pageSize,
        });
        if (chosen === "exit" || chosen === null) break;
        console.log("");
        setLastCommand(chosen.name);
        try {
            const result = await chosen.run();
            if (result === "change-context") {
                const ctxList = getContexts();
                if (ctxList.length === 0) { warn("No contexts found."); }
                else {
                    const newCtx = await searchableList({
                        message: "Switch to context:",
                        items: ctxList.map((c) => ({ name: c === context ? `${c}  ${DIM}(current)${RESET}` : c, value: c })),
                    });
                    if (newCtx && newCtx !== context) {
                        context = newCtx;
                        useContext(context);
                        currentNamespace = await pickNamespace(context);
                        setContextInfo(context, currentNamespace);
                        setSubscription(subscriptionForContext(context));
                        ok(`Switched to context: ${CYAN}${context}${RESET}`);
                    }
                }
                console.log("");
                continue;
            }
            if (result === "change-namespace") {
                process.stdout.write(`  ${DIM}Fetching namespaces…${RESET}`);
                const allNs = getNamespaces(context);
                process.stdout.write("\r\x1b[2K");
                if (allNs.length === 0) { warn("Could not list namespaces."); }
                else {
                    currentNamespace = await searchableList({ message: "Select namespace:", items: allNs.map((n) => ({ name: n, value: n })) });
                    ok(`Switched to namespace: ${YELLOW}${currentNamespace}${RESET}`);
                    setContextInfo(context, currentNamespace);
                }
                console.log("");
                continue;
            }
            if (result === RETURN_TO_MENU) { console.log(""); continue; }
        } catch (err) {
            console.error(`\n  ${RED}✗ ${err.message}${RESET}`);
            if (isPermissionError(err.message)) showPimReminder();
        }
        console.log("");
        const again = await confirm({ message: "Run another command?", default: true });
        if (!again) break;
    }
    console.log(`\n  ${DIM}Goodbye!${RESET}\n`);
}

main().catch((err) => {
    if (err.name === "ExitPromptError") { console.log(`\n  ${DIM}Cancelled.${RESET}\n`); process.exit(0); return; }
    console.error(`\n  ${RED}✗ ${err.message}${RESET}\n`);
    process.exit(1);
});
