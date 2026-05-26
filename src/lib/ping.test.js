import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./shell.js", () => ({
    run: vi.fn(),
}));

vi.mock("./env.js", () => ({
    APP_NAME: "",
}));

vi.mock("../ui/chrome.js", () => ({
    setLastCommandRun: vi.fn(),
}));

import * as shell from "./shell.js";
import * as chrome from "../ui/chrome.js";
import { pingOnce, sleep, getIngressInfo, getVirtualServiceInfo } from "./ping.js";

afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

// ── pingOnce ──────────────────────────────────────────────────────────────

describe("pingOnce()", () => {
    it("returns ok:true with status and timing for a successful fetch", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200 }));

        const r = await pingOnce("http://example.com", 5000);

        expect(r.ok).toBe(true);
        expect(r.status).toBe(200);
        expect(typeof r.ms).toBe("number");
    });

    it("treats an HTTP status >= 400 as not ok", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 503 }));

        const r = await pingOnce("http://example.com", 5000);

        expect(r.ok).toBe(false);
        expect(r.status).toBe(503);
    });

    it("returns ok:false with a 'timeout' error on AbortError", async () => {
        const abortError = new Error("aborted");
        abortError.name = "AbortError";
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

        const r = await pingOnce("http://example.com", 5000);

        expect(r.ok).toBe(false);
        expect(r.error).toContain("timeout");
    });

    it("returns ok:false with the error message on non-abort errors", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

        const r = await pingOnce("http://example.com", 5000);

        expect(r.ok).toBe(false);
        expect(r.error).toBe("ECONNREFUSED");
    });
});

describe("sleep()", () => {
    it("resolves after the requested delay", async () => {
        await expect(sleep(1)).resolves.toBeUndefined();
    });
});

// ── getIngressInfo ────────────────────────────────────────────────────────

const INGRESS_WITH_PATHS = JSON.stringify({
    items: [
        {
            metadata: { name: "my-ingress" },
            spec: {
                tls: [],
                rules: [
                    {
                        host: "example.com",
                        http: {
                            paths: [
                                { path: "/api", pathType: "Prefix" },
                                { path: "/health", pathType: "Exact" },
                                { path: "/api", pathType: "Prefix" }, // duplicate — should appear once
                            ],
                        },
                    },
                ],
            },
        },
    ],
});

describe("getIngressInfo()", () => {
    it("records the kubectl get ingress command in the chrome header", () => {
        shell.run.mockReturnValue(INGRESS_WITH_PATHS);

        getIngressInfo("my-ctx", "my-ns");

        expect(chrome.setLastCommandRun).toHaveBeenCalledWith(
            "kubectl --context=my-ctx --namespace=my-ns get ingress -o json"
        );
    });

    it("returns baseUrl and de-duplicated routes", () => {
        shell.run.mockReturnValue(INGRESS_WITH_PATHS);

        const result = getIngressInfo("my-ctx", "my-ns");

        expect(result).not.toBeNull();
        expect(result.baseUrl).toBe("http://example.com");

        const paths = result.routes.map((r) => r.path);
        const apiCount = paths.filter((p) => p === "/api").length;
        expect(apiCount).toBe(1); // deduplicated
    });

    it("appends /liveness and /readiness if not already present", () => {
        shell.run.mockReturnValue(INGRESS_WITH_PATHS);

        const result = getIngressInfo("my-ctx", "my-ns");
        const paths = result.routes.map((r) => r.path);

        expect(paths).toContain("/liveness");
        expect(paths).toContain("/readiness");
    });

    it("does not duplicate /liveness if already in ingress", () => {
        const ingressWithLiveness = JSON.stringify({
            items: [
                {
                    metadata: { name: "my-ingress" },
                    spec: {
                        tls: [],
                        rules: [
                            {
                                host: "example.com",
                                http: { paths: [{ path: "/liveness", pathType: "Exact" }] },
                            },
                        ],
                    },
                },
            ],
        });
        shell.run.mockReturnValue(ingressWithLiveness);

        const result = getIngressInfo("my-ctx", "my-ns");
        const livenessCount = result.routes.filter((r) => r.path === "/liveness").length;
        expect(livenessCount).toBe(1);
    });

    it("returns null when run returns null", () => {
        shell.run.mockReturnValue(null);
        expect(getIngressInfo("ctx", "ns")).toBeNull();
    });

    it("returns null when ingress list is empty", () => {
        shell.run.mockReturnValue(JSON.stringify({ items: [] }));
        expect(getIngressInfo("ctx", "ns")).toBeNull();
    });
});

// ── getVirtualServiceInfo ─────────────────────────────────────────────────

const VIRTUAL_SERVICE = JSON.stringify({
    items: [
        {
            metadata: { name: "my-vs" },
            spec: {
                hosts: ["api.example.com"],
                http: [
                    {
                        match: [
                            { uri: { prefix: "/api/v1" } },
                            { uri: { exact: "/health" } },
                        ],
                    },
                ],
            },
        },
    ],
});

describe("getVirtualServiceInfo()", () => {
    it("returns baseUrl with https for external hosts", () => {
        shell.run.mockReturnValue(VIRTUAL_SERVICE);
        const result = getVirtualServiceInfo("ctx", "ns");
        expect(result.baseUrl).toBe("https://api.example.com");
    });

    it("appends /liveness and /readiness probe paths", () => {
        shell.run.mockReturnValue(VIRTUAL_SERVICE);
        const result = getVirtualServiceInfo("ctx", "ns");
        const paths = result.routes.map((r) => r.path);
        expect(paths).toContain("/liveness");
        expect(paths).toContain("/readiness");
    });

    it("returns null when run returns null", () => {
        shell.run.mockReturnValue(null);
        expect(getVirtualServiceInfo("ctx", "ns")).toBeNull();
    });
});
