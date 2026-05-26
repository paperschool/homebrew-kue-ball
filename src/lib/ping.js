import { run } from "./shell.js";
import { APP_NAME } from "./env.js";
import { setLastCommandRun } from "../ui/chrome.js";

// Sends a single request to `url`, returning its status and timing. Never throws —
// failures (including timeout) come back as { ok: false, error }.
export async function pingOnce(url, timeoutMs = 5000) {
    const start = Date.now();
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return { status: res.status, ms: Date.now() - start, ok: res.status < 400 };
    } catch (err) {
        return {
            status: null,
            ms: Date.now() - start,
            ok: false,
            error: err.name === "AbortError" ? `timeout (${timeoutMs}ms)` : err.message,
        };
    }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getIngressInfo(ctx, ns) {
    const cmd = `kubectl --context=${ctx} --namespace=${ns} get ingress -o json`;
    setLastCommandRun(cmd);
    const raw = run(cmd, { silent: true });
    try {
        const items = JSON.parse(raw ?? "{}").items ?? [];
        const ingress =
            items.find(
                (i) =>
                    (APP_NAME && i.metadata?.name?.includes(APP_NAME)) ||
                    i.spec?.rules?.some((r) => r.host)
            ) ?? items[0];
        if (!ingress) return null;

        const rule = ingress.spec?.rules?.[0];
        const host = rule?.host;
        if (!host) return null;

        const hasTls = (ingress.spec?.tls?.length ?? 0) > 0;
        const baseUrl = `${hasTls ? "https" : "http"}://${host}`;

        const seenPaths = new Set();
        const ingressRoutes = [];
        for (const r of ingress.spec?.rules ?? []) {
            for (const p of r.http?.paths ?? []) {
                const path = p.path?.replace(/\(.*\)$/, "").replace(/\*$/, "") || "/";
                const normalised = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
                if (!seenPaths.has(normalised)) {
                    seenPaths.add(normalised);
                    ingressRoutes.push({ label: normalised, path: normalised });
                }
            }
        }

        for (const probePath of ["/liveness", "/readiness"]) {
            if (!seenPaths.has(probePath)) {
                ingressRoutes.push({ label: probePath, path: probePath });
            }
        }

        return { baseUrl, routes: ingressRoutes.length ? ingressRoutes : null };
    } catch {
        return null;
    }
}

export function getVirtualServiceInfo(ctx, ns) {
    const cmd = `kubectl --context=${ctx} --namespace=${ns} get virtualservice -o json`;
    setLastCommandRun(cmd);
    const raw = run(cmd, { silent: true });
    try {
        const items = JSON.parse(raw ?? "{}").items ?? [];
        const vs =
            items.find(
                (item) =>
                    (APP_NAME && item.metadata?.name?.includes(APP_NAME)) ||
                    (APP_NAME && item.spec?.hosts?.some((h) => h?.includes(APP_NAME)))
            ) ?? items[0];
        if (!vs) return null;

        const hosts = (vs.spec?.hosts ?? []).filter(Boolean);
        if (hosts.length === 0) return null;

        const host =
            hosts.find((h) => !h.includes("*") && !h.endsWith(".svc.cluster.local")) ??
            hosts.find((h) => !h.includes("*")) ??
            hosts[0];

        if (!host) return null;

        const scheme = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
        const baseUrl = `${scheme}://${host}`;

        const seenPaths = new Set();
        const routes = [];
        for (const httpRule of vs.spec?.http ?? []) {
            for (const match of httpRule.match ?? []) {
                const path = match.uri?.exact ?? match.uri?.prefix ?? null;
                if (!path) continue;
                const normalised = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
                if (!seenPaths.has(normalised)) {
                    seenPaths.add(normalised);
                    routes.push({ label: normalised, path: normalised });
                }
            }
        }

        for (const probePath of ["/liveness", "/readiness"]) {
            if (!seenPaths.has(probePath)) {
                routes.push({ label: probePath, path: probePath });
            }
        }

        return { baseUrl, routes: routes.length ? routes : null };
    } catch {
        return null;
    }
}
