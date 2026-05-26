import { describe, it, expect, vi, beforeEach } from "vitest";

describe("env constants", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it("APP_NAME defaults to empty string when KUBECTL_WIZARD_APP is unset", async () => {
        vi.stubEnv("KUBECTL_WIZARD_APP", undefined);
        const { APP_NAME } = await import("./env.js");
        expect(APP_NAME).toBe("");
    });

    it("APP_NAME reflects KUBECTL_WIZARD_APP when set", async () => {
        vi.stubEnv("KUBECTL_WIZARD_APP", "my-service");
        const { APP_NAME } = await import("./env.js");
        expect(APP_NAME).toBe("my-service");
    });

    it("DEFAULT_NAMESPACE defaults to 'default' when KUBECTL_WIZARD_NAMESPACE is unset", async () => {
        vi.stubEnv("KUBECTL_WIZARD_NAMESPACE", undefined);
        const { DEFAULT_NAMESPACE } = await import("./env.js");
        expect(DEFAULT_NAMESPACE).toBe("default");
    });

    it("DEFAULT_NAMESPACE reflects KUBECTL_WIZARD_NAMESPACE when set", async () => {
        vi.stubEnv("KUBECTL_WIZARD_NAMESPACE", "production");
        const { DEFAULT_NAMESPACE } = await import("./env.js");
        expect(DEFAULT_NAMESPACE).toBe("production");
    });

    it("DEFAULT_CONTEXT defaults to empty string when KUBECTL_WIZARD_CONTEXT is unset", async () => {
        vi.stubEnv("KUBECTL_WIZARD_CONTEXT", undefined);
        const { DEFAULT_CONTEXT } = await import("./env.js");
        expect(DEFAULT_CONTEXT).toBe("");
    });

    it("DEFAULT_CONTEXT reflects KUBECTL_WIZARD_CONTEXT when set", async () => {
        vi.stubEnv("KUBECTL_WIZARD_CONTEXT", "my-cluster");
        const { DEFAULT_CONTEXT } = await import("./env.js");
        expect(DEFAULT_CONTEXT).toBe("my-cluster");
    });
});
