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
import { isKubectlAvailable, getCurrentContext, getContexts, getNamespaces, useContext } from "./lib/kubectl.js";
import { isHelmAvailable } from "./lib/helm.js";
import { ok, warn, CYAN, YELLOW, DIM, RESET, BOLD, RED, styleDeleteCommandLabel } from "./lib/output.js";
import { APP_NAME, DEFAULT_NAMESPACE, DEFAULT_CONTEXT } from "./lib/env.js";
import { refreshContexts, isPermissionError, showPimReminder, subscriptionForContext, isAzCliAvailable } from "./lib/azure.js";
import { RETURN_TO_MENU } from "./lib/runner.js";
import { searchableList } from "./ui/searchableList.js";
import { initChrome, loadIdentity, setAuthStatus, drawSplash, hideSplash, setContextInfo, setLastCommand, setSubscription } from "./ui/chrome.js";
import { startAuthPoller, stopAuthPoller } from "./ui/authPoller.js";
import { confirm, select, input } from "@inquirer/prompts";

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
        console.log("");
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
        ok(`Using context: ${CYAN}${contexts[0]}${RESET}`);
        return contexts[0];
    }
    const sorted = DEFAULT_CONTEXT
        ? [...contexts.filter((c) => c.includes(DEFAULT_CONTEXT)), ...contexts.filter((c) => !c.includes(DEFAULT_CONTEXT))]
        : contexts;
    return select({
        message: "Select kubeconfig context:",
        choices: sorted.map((c) => ({ name: c === currentCtx ? `${c}  ${DIM}(current)${RESET}` : c, value: c })),
        default: currentCtx,
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
    const probe = (label, available) => {
        process.stdout.write(`  ${DIM}Checking for ${label}…${RESET}`);
        const found = available();
        process.stdout.write("\r\x1b[2K");
        return found;
    };

    if (!probe("kubectl", isKubectlAvailable)) {
        process.stderr.write(`  ${RED}✗ kubectl not found.${RESET}\n`);
        process.stderr.write(`  ${DIM}  Install it via: brew install kubectl${RESET}\n\n`);
        process.exit(1);
    }
    ok("kubectl found");

    if (probe("helm", isHelmAvailable)) ok("helm found");
    else warn("helm not found — Helm commands won't work (brew install helm).");

    const azAvailable = probe("az CLI", isAzCliAvailable);
    if (azAvailable) ok("az CLI found");
    else warn("az CLI not found — refreshing contexts from Azure is unavailable (brew install azure-cli).");

    return { azAvailable };
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
        const doRefresh = await confirm({ message: "Refresh contexts from Azure first? (az aks get-credentials)", default: false, clearPromptOnDone: true });
        if (doRefresh) { console.log(""); await refreshContexts(); console.log(""); }
    }
    let context = await pickContext();
    if (!context) return;
    console.log("");
    const namespace = await pickNamespace(context);
    console.log("");
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
                    const newCtx = await select({
                        message: "Switch to context:",
                        choices: ctxList.map((c) => ({ name: c === context ? `${c}  ${DIM}(current)${RESET}` : c, value: c })),
                        default: context,
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
