import { DIM, RESET, warn } from "../lib/output.js";
import { searchableList } from "./searchableList.js";

export async function resourcePicker({
    spinnerMessage,
    emptyMessage,
    fetchFn,
    mapFn,
    listOptions = {},
}) {
    process.stdout.write(`  ${DIM}${spinnerMessage}…${RESET}`);
    let raw;
    try {
        raw = await fetchFn();
    } finally {
        process.stdout.write("\r\x1b[2K");
    }

    const items = mapFn ? (raw ?? []).map(mapFn) : (raw ?? []);

    if (items.length === 0) {
        warn(emptyMessage);
        return null;
    }

    return searchableList({ ...listOptions, items });
}
