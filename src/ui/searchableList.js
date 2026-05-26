import { searchPrompt, Separator } from "./searchPrompt.js";
import { CYAN, DIM, RESET, stripAnsi } from "../lib/output.js";
import { isActive, getContentRows } from "./chrome.js";

export function fuzzyMatch(query, text) {
    const q = (query ?? "").toLowerCase();
    const t = stripAnsi(text).toLowerCase();
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
        if (t[i] === q[qi]) qi++;
    }
    return qi === q.length;
}

// Resolved live on every resize so the list always fits the content area.
function computePageSize(pageSize) {
    if (isActive()) return Math.max(4, getContentRows() - 2);
    return pageSize ?? Math.max(8, (process.stdout.rows ?? 24) - 4);
}

export async function searchableList({ message, items, pageSize }) {
    if (isActive()) {
        const row = (process.stdout.rows ?? 24) - 3;
        process.stdout.write(`\x1b[${row};1H`);
    }

    return searchPrompt({
        message,
        pageSize: () => computePageSize(pageSize),
        source: (input) => {
            const q = stripAnsi(input ?? "").trim();
            const hasGroups = items.some((item) => item.group != null);

            if (!hasGroups) {
                const matching = q ? items.filter((item) => fuzzyMatch(q, item.name)) : items;
                return matching.map((item) => ({ name: item.name, value: item.value }));
            }

            const groups = [...new Set(items.map((item) => item.group).filter(Boolean))];
            const results = [];

            for (const group of groups) {
                const groupItems = items.filter((item) => item.group === group);
                const matching = q ? groupItems.filter((item) => fuzzyMatch(q, item.name)) : groupItems;

                if (matching.length > 0) {
                    results.push(new Separator(`  ${CYAN}${DIM}── ${group} ──${RESET}`));
                    for (const item of matching) {
                        results.push({ name: item.name, value: item.value });
                    }
                }
            }

            const ungrouped = items.filter((item) => item.group == null);
            const ungroupedMatching = q ? ungrouped.filter((item) => fuzzyMatch(q, item.name)) : ungrouped;
            for (const item of ungroupedMatching) {
                results.push({ name: item.name, value: item.value });
            }

            return results;
        },
    });
}
