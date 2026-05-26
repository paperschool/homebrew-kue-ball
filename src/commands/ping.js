import { getIngressInfo, getVirtualServiceInfo, pingOnce, sleep } from "../lib/ping.js";
import { info, warn, GREEN, YELLOW, RED, DIM, RESET, BOLD } from "../lib/output.js";
import { startProgress, stopProgress } from "../ui/chrome.js";
import { confirm, input } from "@inquirer/prompts";

const ATTEMPTS = 3;
const TIMEOUT_MS = 5000;
const DELAY_MS = 1000; // pause between rounds (every route is hit once per round)
const DEFAULT_ROUTES = ["/", "/api/health", "/liveness", "/readiness"].map((p) => ({ label: p, path: p }));

export function buildPingCommands(ctx, ns) {
    return [
        {
            group: "Ping",
            name: `Ping all routes  ${DIM}(discovered from ingress/VirtualService · ${ATTEMPTS} attempts each)${RESET}`,
            run: async () => {
                process.stdout.write(`  ${DIM}Querying ingress in ${ns}…${RESET}`);
                const ingressInfo = getIngressInfo(ctx, ns);
                process.stdout.write("\r\x1b[2K");

                let baseUrl;
                let routes;

                if (ingressInfo) {
                    baseUrl = ingressInfo.baseUrl;
                    routes = ingressInfo.routes?.length ? ingressInfo.routes : DEFAULT_ROUTES;
                    info(`Ingress: ${baseUrl}  ${DIM}(${routes.length} route(s) discovered)`);
                    const useIt = await confirm({ message: `Ping ${baseUrl}?`, default: true });
                    if (!useIt) baseUrl = await input({ message: "App base URL:", default: baseUrl });
                } else {
                    process.stdout.write(`  ${DIM}No ingress found, querying VirtualService in ${ns}…${RESET}`);
                    const vsInfo = getVirtualServiceInfo(ctx, ns);
                    process.stdout.write("\r\x1b[2K");
                    if (vsInfo) {
                        baseUrl = vsInfo.baseUrl;
                        routes = vsInfo.routes?.length ? vsInfo.routes : DEFAULT_ROUTES;
                        info(`VirtualService: ${baseUrl}  ${DIM}(${routes.length} route(s) discovered)`);
                        const useIt = await confirm({ message: `Ping ${baseUrl}?`, default: true });
                        if (!useIt) baseUrl = await input({ message: "App base URL:", default: baseUrl });
                    } else {
                        warn("No ingress or VirtualService found — enter the app URL manually.");
                        baseUrl = await input({ message: "App base URL:", default: "http://localhost:3000" });
                        routes = DEFAULT_ROUTES;
                    }
                }
                baseUrl = baseUrl.replace(/\/+$/, "");

                const targets = routes.map((route) => ({ url: `${baseUrl}${route.path}`, results: [] }));
                const urlWidth = Math.max(0, ...targets.map((t) => t.url.length));
                console.log("");
                startProgress();
                try {
                    for (let round = 1; round <= ATTEMPTS; round++) {
                        console.log(`  ${BOLD}Round ${round}/${ATTEMPTS}${RESET}`);
                        for (const target of targets) {
                            const r = await pingOnce(target.url, TIMEOUT_MS);
                            target.results.push(r);
                            const statusColor = r.ok ? GREEN : RED;
                            const statusStr = r.status != null ? `HTTP ${r.status}` : r.error;
                            console.log(`       ${DIM}${target.url.padEnd(urlWidth)}${RESET}  ${statusColor}${statusStr}${RESET}  ${DIM}${r.ms}ms${RESET}`);
                        }
                        if (round < ATTEMPTS) await sleep(DELAY_MS);
                    }
                } finally {
                    stopProgress();
                }

                const divider = `  ${DIM}${"-".repeat(52)}${RESET}`;
                console.log(`\n  ${BOLD}Summary${RESET}`);
                console.log(divider);
                for (const target of targets) {
                    const successes = target.results.filter((r) => r.ok).length;
                    const okTimes = target.results.filter((r) => r.ok).map((r) => r.ms);
                    const avgMs = okTimes.length ? Math.round(okTimes.reduce((s, r) => s + r, 0) / okTimes.length) : null;
                    const icon = successes === ATTEMPTS ? `${GREEN}✓${RESET}` : successes === 0 ? `${RED}✗${RESET}` : `${YELLOW}~${RESET}`;
                    const msStr = avgMs != null ? `avg ${avgMs}ms` : "n/a";
                    console.log(`  ${icon}  ${DIM}${target.url.padEnd(urlWidth)}${RESET}  ${successes}/${ATTEMPTS} ok  ${msStr}`);
                }
                console.log(divider);
            },
        },
    ];
}
