import { confirm } from "@inquirer/prompts";
import { searchPrompt as search, Separator } from "../ui/searchPrompt.js";
import { spawnSync } from "child_process";
import { run, spawnInteractive } from "./shell.js";
import { warn, ok, info, DIM, CYAN, RESET, YELLOW, BOLD } from "./output.js";
import { loadPrefs, savePrefs } from "./prefs.js";
import { getContexts } from "./kubectl.js";
import { stripAnsi } from "./output.js";

const PIM_ACTIVATION_URL =
    "https://portal.azure.com/?feature.msaljs=true#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade/~/aadgroup/provider/aadgroup";

// The subscription a context belongs to, recorded when its credentials were refreshed.
// Returns null for contexts not pulled through this tool.
export function subscriptionForContext(contextName) {
    return loadPrefs().contextSubscriptions?.[contextName] ?? null;
}

export function isAzCliAvailable() {
    return !!run("az version", { silent: true });
}

export function isPermissionError(errorMsg) {
    const errorText = (errorMsg ?? "").toLowerCase();
    return (
        errorText.includes("forbidden") ||
        errorText.includes("not authorized") ||
        errorText.includes("unauthorized") ||
        errorText.includes("permission denied") ||
        errorText.includes("access denied") ||
        errorText.includes("does not have role") ||
        errorText.includes("insufficient privileges") ||
        errorText.includes("authorizationnotfound") ||
        errorText.includes("403") ||
        errorText.includes("401")
    );
}

export function showPimReminder() {
    warn("Permission/Authorization Issue Detected");
    info(`If you have elevated roles (e.g., group memberships) through PIM,`);
    info(`you may need to activate them in Azure Portal:`);
    console.log(`\n  ${CYAN}${PIM_ACTIVATION_URL}${RESET}\n`);
}

export function listSubscriptions({ refresh = false } = {}) {
    const flag = refresh ? " --refresh" : "";
    const raw = run(
        `az account list${flag} --query "[].{id:id,name:name}" --output json`,
        { silent: true }
    );
    try {
        return JSON.parse(raw ?? "[]");
    } catch {
        return [];
    }
}

export function listAksClustersForSub(subscriptionId) {
    try {
        const result = spawnSync(
            "az",
            [
                "aks",
                "list",
                "--subscription",
                subscriptionId,
                "--query",
                "[].{name:name,resourceGroup:resourceGroup,location:location}",
                "--output",
                "json",
            ],
            { encoding: "utf8", timeout: 30_000 }
        );
        if (result.status !== 0) {
            const lines = (result.stderr ?? "").trim().split("\n").filter(Boolean);
            const useful = lines.filter(
                (l) =>
                    !l.startsWith("Traceback") &&
                    !l.trim().startsWith("File ") &&
                    !l.trim().startsWith("raise ") &&
                    !l.trim().startsWith("az_command")
            );
            const msg =
                useful.slice(0, 3).join(" | ").trim() ||
                lines.slice(0, 3).join(" | ").trim() ||
                `exit ${result.status}`;
            return { clusters: [], error: msg };
        }
        return { clusters: JSON.parse(result.stdout ?? "[]"), error: null };
    } catch {
        return { clusters: [], error: "timed out or unknown error" };
    }
}

export async function listAllAksClusters(subs) {
    const results = [];
    const errors = [];
    const total = subs.length;
    for (let i = 0; i < total; i++) {
        const sub = subs[i];
        const label = sub.name.length > 40 ? sub.name.slice(0, 38) + "…" : sub.name;
        process.stdout.write(`\r\x1b[2K  ${DIM}[${i + 1}/${total}] ${label}${RESET}`);
        const { clusters, error } = listAksClustersForSub(sub.id);
        if (error) {
            if (isPermissionError(error)) {
                errors.push({ sub: sub.name, error, isPermissionError: true });
            } else {
                errors.push({ sub: sub.name, error });
            }
        }
        for (const c of clusters) {
            results.push({ ...c, subscriptionId: sub.id, subscriptionName: sub.name });
        }
    }
    process.stdout.write("\r\x1b[2K");

    if (errors.length > 0) {
        const apiVersionBug = errors.some(({ error }) => error.includes("api_version"));
        if (apiVersionBug) {
            console.log(`\n  \x1b[31m✗  Azure CLI aks extension version mismatch detected.\x1b[0m`);
            console.log(`  ${DIM}The aks-preview extension is out of sync with the core CLI (${RESET}\x1b[1mapi_version\x1b[0m${DIM} attribute missing).${RESET}\n`);
            const doFix = await confirm({
                message: "Reinstall the aks-preview extension now? (az extension remove + add)",
                default: true,
                clearPromptOnDone: true,
            });
            if (doFix) {
                console.log("");
                await spawnInteractive("az", ["extension", "remove", "--name", "aks-preview"]);
                await spawnInteractive("az", ["extension", "add", "--name", "aks-preview"]);
                ok("aks-preview extension reinstalled — re-running cluster scan…\n");
                return { results, retry: true };
            } else {
                console.log(
                    `  ${DIM}Run manually: az extension remove --name aks-preview && az extension add --name aks-preview${RESET}\n`
                );
            }
        } else {
            console.log(`\n  ${YELLOW}⚠  Could not list clusters in ${errors.length} subscription(s):${RESET}`);
            const permissionErrors = errors.filter((e) => e.isPermissionError);
            for (const { sub, error } of errors) {
                console.log(`     ${DIM}${sub}: ${error}${RESET}`);
            }
            if (permissionErrors.length > 0) {
                showPimReminder();
            }
            console.log("");
        }
    }
    return { results, retry: false };
}

function fuzzyMatch(query, text) {
    const q = query.toLowerCase();
    const t = stripAnsi(text).toLowerCase();
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
        if (t[i] === q[qi]) qi++;
    }
    return qi === q.length;
}

export async function refreshContexts() {
    if (!isAzCliAvailable()) {
        warn("Azure CLI (az) not found — install it with: brew install azure-cli");
        return false;
    }

    const existingContexts = getContexts();
    if (existingContexts.length > 0) {
        const doWipe = await confirm({
            message: `Clear all ${existingContexts.length} existing kubeconfig context(s) before pulling fresh credentials?`,
            default: true,
            clearPromptOnDone: true,
        });
        if (doWipe) {
            for (const ctx of existingContexts) {
                run(`kubectl config delete-context "${ctx}"`, { silent: true });
                run(`kubectl config unset "users.${ctx}"`, { silent: true });
            }
            ok(`Cleared ${existingContexts.length} context(s)`);
        }
    }

    console.log("");

    process.stdout.write(`  ${DIM}Fetching subscriptions from Azure (--refresh)…${RESET}`);
    const subs = listSubscriptions({ refresh: true });
    process.stdout.write("\r\x1b[2K");

    if (subs.length === 0) {
        warn("Not logged in to Azure.");
        const doLogin = await confirm({ message: "Run az login now?", default: true, clearPromptOnDone: true });
        if (!doLogin) return false;
        await spawnInteractive("az", ["login"]);
        const retried = listSubscriptions({ refresh: true });
        if (retried.length === 0) {
            warn("Still no subscriptions found — check your account.");
            return false;
        }
        subs.push(...retried);
    }

    ok(`Found ${subs.length} subscription(s)`);
    console.log("");

    const prefs = loadPrefs();
    const freq = prefs.subFrequency ?? {};
    const used = subs
        .filter((s) => freq[s.id] > 0)
        .sort((a, b) => (freq[b.id] ?? 0) - (freq[a.id] ?? 0));

    const subPageSize = () => Math.max(8, (process.stdout.rows ?? 24) - 4);
    const selectedSubs = new Map(
        (used.length > 0 ? used : subs).map((s) => [s.id, s])
    );

    let choosingSubs = true;
    while (choosingSubs) {
        const action = await search({
            message: `Subscriptions to scan  ${DIM}(${selectedSubs.size} selected — pick to toggle)${RESET}:`,
            pageSize: subPageSize,
            source: (input) => {
                const q = stripAnsi(input ?? "").trim().toLowerCase();
                const filtered = q ? subs.filter((s) => fuzzyMatch(q, s.name)) : subs;
                const sorted = [...filtered].sort((a, b) => {
                    const aS = selectedSubs.has(a.id) ? 0 : 1;
                    const bS = selectedSubs.has(b.id) ? 0 : 1;
                    if (aS !== bS) return aS - bS;
                    if (aS === 0) return (freq[b.id] ?? 0) - (freq[a.id] ?? 0);
                    return a.name.localeCompare(b.name);
                });
                const items = [
                    {
                        name: `  ✓  Confirm selection  ${DIM}(${selectedSubs.size} subscription(s))${RESET}`,
                        value: "__confirm__",
                    },
                ];
                for (const s of sorted) {
                    const tick = selectedSubs.has(s.id) ? "◉" : "○";
                    items.push({ name: `  ${tick}  ${s.name}`, value: s });
                }
                return items;
            },
        });

        if (action === "__confirm__") {
            if (selectedSubs.size === 0) {
                warn("Select at least one subscription.");
            } else {
                choosingSubs = false;
            }
        } else {
            if (selectedSubs.has(action.id)) {
                selectedSubs.delete(action.id);
            } else {
                selectedSubs.set(action.id, action);
            }
        }
    }

    const chosenSubs = [...selectedSubs.values()];

    for (const s of chosenSubs) {
        freq[s.id] = (freq[s.id] ?? 0) + 1;
    }
    savePrefs({ ...prefs, subFrequency: freq });
    console.log("");
    console.log(`  ${DIM}Scanning ${chosenSubs.length} subscription(s) for AKS clusters…${RESET}`);

    let { results: clusters, retry } = await listAllAksClusters(chosenSubs);
    if (retry) {
        console.log(`  ${DIM}Scanning ${chosenSubs.length} subscription(s) for AKS clusters…${RESET}`);
        ({ results: clusters } = await listAllAksClusters(chosenSubs));
    }

    if (clusters.length === 0) {
        warn("No AKS clusters found across any subscription.");
        return false;
    }

    const bySub = {};
    for (const c of clusters) {
        (bySub[c.subscriptionName] ??= []).push(c);
    }

    const orderedSubs = Object.keys(bySub).sort((a, b) => a.localeCompare(b));
    const terminalPageSize = () => Math.max(8, (process.stdout.rows ?? 24) - 4);

    const chosen = await search({
        message: "Pull credentials for:",
        pageSize: terminalPageSize,
        source: (input) => {
            const q = stripAnsi(input ?? "").trim().toLowerCase();
            const results = [];

            if (!q || fuzzyMatch(q, "All clusters")) {
                results.push({
                    name: `All clusters  ${DIM}(${clusters.length} across ${orderedSubs.length} subscription(s))${RESET}`,
                    value: "all",
                });
            }

            for (const subName of orderedSubs) {
                const subClusters = bySub[subName] ?? [];
                const matching = q
                    ? subClusters.filter((c) => {
                        const haystack = `${c.name} ${c.resourceGroup} ${c.location} ${c.subscriptionName}`;
                        return fuzzyMatch(q, haystack);
                    })
                    : subClusters;

                if (matching.length > 0) {
                    results.push(new Separator(`  ${CYAN}${DIM}── ${subName} ──${RESET}`));
                    for (const c of matching) {
                        results.push({
                            name: `  ${c.name}  ${DIM}(${c.resourceGroup} · ${c.location})${RESET}`,
                            value: c,
                        });
                    }
                }
            }

            return results;
        },
    });

    const targets = chosen === "all" ? clusters : [chosen];
    // az names each context after the cluster, so same-named clusters would overwrite one
    // another in the kubeconfig. Disambiguate name collisions with the resource group (kept
    // shell/kubeconfig-safe) so every refreshed cluster is saved as its own switchable context.
    const nameCounts = {};
    for (const c of targets) nameCounts[c.name] = (nameCounts[c.name] ?? 0) + 1;
    const safe = (s) => String(s ?? "").replace(/[^A-Za-z0-9._-]/g, "-");
    const contextNameFor = (c) => (nameCounts[c.name] > 1 ? `${c.name}_${safe(c.resourceGroup)}` : c.name);

    let added = 0;
    const contextSubs = {}; // contextName -> subscriptionName, persisted so the footer can show it
    for (const cluster of targets) {
        const contextName = contextNameFor(cluster);
        console.log(
            `\n  ${DIM}▶ az aks get-credentials --subscription ${cluster.subscriptionId} --resource-group ${cluster.resourceGroup} --name ${cluster.name} --context ${contextName} --overwrite-existing${RESET}\n`
        );
        const code = await spawnInteractive("az", [
            "aks",
            "get-credentials",
            "--subscription",
            cluster.subscriptionId,
            "--resource-group",
            cluster.resourceGroup,
            "--name",
            cluster.name,
            "--context",
            contextName,
            "--overwrite-existing",
        ]);
        if (code === 0) {
            added++;
            contextSubs[contextName] = cluster.subscriptionName ?? "";
            ok(`Context added: ${contextName}`);
        } else {
            warn(
                `Failed to get credentials for ${cluster.name} (exit code ${code}) — check your permissions.`
            );
        }
    }

    if (Object.keys(contextSubs).length > 0) {
        const prefs = loadPrefs();
        savePrefs({ ...prefs, contextSubscriptions: { ...(prefs.contextSubscriptions ?? {}), ...contextSubs } });
    }

    console.log("");
    if (added > 0) {
        ok(`${added} context(s) added. Restart the wizard to use them.`);
    } else {
        warn("No contexts were added — see errors above.");
    }
    return added > 0;
}
