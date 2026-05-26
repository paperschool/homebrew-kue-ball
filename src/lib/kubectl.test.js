import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("./shell.js", () => ({
    run: vi.fn(),
}));

vi.mock("./output.js", () => ({
    warn: vi.fn(),
    DIM: "",
    RESET: "",
}));

vi.mock("@inquirer/prompts", () => ({
    select: vi.fn(),
}));

import * as shell from "./shell.js";
import { isKubectlAvailable, getCurrentContext, getContexts, getNamespaces, useContext, pickPod } from "./kubectl.js";

afterEach(() => {
    vi.clearAllMocks();
});

describe("isKubectlAvailable()", () => {
    it("returns true when 'which kubectl' returns a path", () => {
        shell.run.mockReturnValue("/usr/local/bin/kubectl");
        expect(isKubectlAvailable()).toBe(true);
    });

    it("returns false when run returns null", () => {
        shell.run.mockReturnValue(null);
        expect(isKubectlAvailable()).toBe(false);
    });
});

describe("getCurrentContext()", () => {
    it("returns the current context string from kubectl", () => {
        shell.run.mockReturnValue("my-cluster");
        expect(getCurrentContext()).toBe("my-cluster");
    });

    it("returns '(none)' when run returns null", () => {
        shell.run.mockReturnValue(null);
        expect(getCurrentContext()).toBe("(none)");
    });
});

describe("getContexts()", () => {
    it("returns a filtered array of non-empty strings split by newline", () => {
        shell.run.mockReturnValue("ctx-1\nctx-2\nctx-3");
        expect(getContexts()).toEqual(["ctx-1", "ctx-2", "ctx-3"]);
    });

    it("filters out empty lines", () => {
        shell.run.mockReturnValue("ctx-1\n\nctx-2\n");
        expect(getContexts()).toEqual(["ctx-1", "ctx-2"]);
    });

    it("returns [] when run returns null", () => {
        shell.run.mockReturnValue(null);
        expect(getContexts()).toEqual([]);
    });
});

describe("useContext()", () => {
    it("runs kubectl config use-context with the given name", () => {
        shell.run.mockReturnValue("Switched");
        useContext("ctx-b");
        expect(shell.run).toHaveBeenCalledWith("kubectl config use-context ctx-b", { silent: true });
    });
});

describe("getNamespaces()", () => {
    it("returns a filtered array split by space", () => {
        shell.run.mockReturnValue("default kube-system production");
        expect(getNamespaces("my-cluster")).toEqual(["default", "kube-system", "production"]);
    });

    it("filters out empty strings", () => {
        shell.run.mockReturnValue("default  production ");
        expect(getNamespaces("my-cluster")).toEqual(["default", "production"]);
    });

    it("returns [] when run returns null", () => {
        shell.run.mockReturnValue(null);
        expect(getNamespaces("my-cluster")).toEqual([]);
    });
});

describe("pickPod()", () => {
    it("returns null when no pods found", async () => {
        shell.run.mockReturnValue(JSON.stringify({ items: [] }));
        vi.spyOn(process.stdout, "write").mockImplementation(() => { });

        const result = await pickPod("my-cluster", "default");
        expect(result).toBeNull();
    });

    it("calls select when pods are found", async () => {
        const { select } = await import("@inquirer/prompts");
        select.mockResolvedValue("my-pod");

        shell.run.mockReturnValue(
            JSON.stringify({
                items: [
                    {
                        metadata: { name: "my-pod", creationTimestamp: null },
                        status: { phase: "Running" },
                    },
                ],
            })
        );
        vi.spyOn(process.stdout, "write").mockImplementation(() => { });

        const result = await pickPod("my-cluster", "default");
        expect(result).toBe("my-pod");
        expect(select).toHaveBeenCalledOnce();
    });
});
