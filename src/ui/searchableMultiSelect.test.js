import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@inquirer/prompts", () => ({
    checkbox: vi.fn(),
    Separator: class Separator {
        constructor() {
            this.type = "separator";
            this.separator = "─────────────────";
        }
    },
}));

import * as prompts from "@inquirer/prompts";
import { searchableMultiSelect } from "./searchableMultiSelect.js";

describe("searchableMultiSelect()", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prompts.checkbox.mockResolvedValue(["value-a"]);
    });

    it("places checked items before unchecked items in choices", async () => {
        const items = [
            { name: "unchecked-b", value: "b", checked: false },
            { name: "checked-a", value: "a", checked: true },
            { name: "unchecked-c", value: "c", checked: false },
        ];
        await searchableMultiSelect({ message: "Pick:", items });

        const [{ choices }] = prompts.checkbox.mock.calls[0];
        const nonSeparators = choices.filter((c) => c.type !== "separator");
        expect(nonSeparators[0].value).toBe("a");
        expect(nonSeparators[1].value).toBe("b");
        expect(nonSeparators[2].value).toBe("c");
    });

    it("inserts a Separator between checked and unchecked groups when both are present", async () => {
        const items = [
            { name: "checked-a", value: "a", checked: true },
            { name: "unchecked-b", value: "b", checked: false },
        ];
        await searchableMultiSelect({ message: "Pick:", items });

        const [{ choices }] = prompts.checkbox.mock.calls[0];
        const separators = choices.filter((c) => c.type === "separator");
        expect(separators).toHaveLength(1);
    });

    it("does not insert a Separator when all items are checked", async () => {
        const items = [
            { name: "a", value: "a", checked: true },
            { name: "b", value: "b", checked: true },
        ];
        await searchableMultiSelect({ message: "Pick:", items });

        const [{ choices }] = prompts.checkbox.mock.calls[0];
        const separators = choices.filter((c) => c.type === "separator");
        expect(separators).toHaveLength(0);
    });

    it("does not insert a Separator when all items are unchecked", async () => {
        const items = [
            { name: "a", value: "a", checked: false },
            { name: "b", value: "b", checked: false },
        ];
        await searchableMultiSelect({ message: "Pick:", items });

        const [{ choices }] = prompts.checkbox.mock.calls[0];
        const separators = choices.filter((c) => c.type === "separator");
        expect(separators).toHaveLength(0);
    });

    it("uses default validate that rejects empty selection", async () => {
        await searchableMultiSelect({
            message: "Pick:",
            items: [{ name: "a", value: "a", checked: false }],
        });

        const [{ validate }] = prompts.checkbox.mock.calls[0];
        expect(validate([])).not.toBe(true);
        expect(validate(["a"])).toBe(true);
    });

    it("forwards a caller-supplied validate function to checkbox", async () => {
        const customValidate = vi.fn(() => true);
        await searchableMultiSelect({
            message: "Pick:",
            items: [{ name: "a", value: "a", checked: false }],
            validate: customValidate,
        });

        const [{ validate }] = prompts.checkbox.mock.calls[0];
        expect(validate).toBe(customValidate);
    });

    it("returns the resolved value from checkbox", async () => {
        prompts.checkbox.mockResolvedValue(["a", "b"]);
        const result = await searchableMultiSelect({
            message: "Pick:",
            items: [
                { name: "a", value: "a", checked: true },
                { name: "b", value: "b", checked: true },
            ],
        });
        expect(result).toEqual(["a", "b"]);
    });
});
