import {
    createPrompt, useState, useEffect, useMemo, useKeypress, usePrefix, usePagination,
    isUpKey, isDownKey, isEnterKey, isTabKey, Separator,
} from "@inquirer/core";
import { CYAN, DIM, RED, RESET } from "../lib/output.js";
import { isActive as chromeActive, onResize as onChromeResize, setSearchText } from "./chrome.js";

// A searchable list built on @inquirer/core (modelled on @inquirer/search) whose
// only behavioural addition is a live-reflowing pageSize: it subscribes to terminal
// resize and recomputes the visible page so the list always fits the content area.
// `pageSize` may be a number (static) or a `() => number` resolved on every resize.

export { Separator };

const POINTER = "❯";
const RESIZE_DEBOUNCE_MS = 80;
const DEFAULT_PAGE_SIZE = 7;
const HELP_LINE = `${DIM}↑↓ navigate · ⏎ select${RESET}`;

export function resolvePageSize(pageSize) {
    const value = typeof pageSize === "function" ? pageSize() : pageSize;
    return Math.max(1, Math.floor(value ?? DEFAULT_PAGE_SIZE));
}

function isSelectable(item) {
    return !Separator.isSeparator(item) && !item.disabled;
}

function renderChoice({ item, isActive }) {
    if (Separator.isSeparator(item)) return ` ${item.separator}`;
    const cursor = isActive ? POINTER : " ";
    const color = isActive ? CYAN : "";
    const reset = isActive ? RESET : "";
    return `${color}${cursor} ${item.name}${reset}`;
}

export const searchPrompt = createPrompt((config, done) => {
    const [status, setStatus] = useState("loading");
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchError, setSearchError] = useState();
    const [layout, setLayout] = useState(() => ({ pageSize: resolvePageSize(config.pageSize) }));
    const prefix = usePrefix({ status });

    const bounds = useMemo(() => ({
        first: searchResults.findIndex(isSelectable),
        last: searchResults.findLastIndex(isSelectable),
    }), [searchResults]);
    const [active = bounds.first, setActive] = useState();

    useEffect(() => {
        const reflow = () => setLayout({ pageSize: resolvePageSize(config.pageSize) });
        // When chrome is active it owns the resize: it clears the content area and the
        // stale status bar, then calls us back to repaint — so ordering is guaranteed.
        // It also owns the header "Search:" field, which we clear when this prompt closes.
        if (chromeActive()) {
            const unsubscribe = onChromeResize(reflow);
            return () => { unsubscribe(); setSearchText(""); };
        }
        // Standalone (no chrome): debounce our own resize handling.
        let timer = null;
        const onResize = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(reflow, RESIZE_DEBOUNCE_MS);
        };
        process.stdout.on("resize", onResize);
        return () => { if (timer) clearTimeout(timer); process.stdout.off("resize", onResize); };
    }, []);

    useEffect(() => {
        if (chromeActive()) setSearchText(searchTerm); // mirror the query into the header
        const controller = new AbortController();
        setStatus("loading");
        setSearchError(undefined);
        (async () => {
            try {
                const results = await config.source(searchTerm || undefined, { signal: controller.signal });
                if (!controller.signal.aborted) {
                    setActive(undefined);
                    setSearchError(undefined);
                    setSearchResults(results);
                    setStatus("idle");
                }
            } catch (error) {
                if (!controller.signal.aborted && error instanceof Error) setSearchError(error.message);
            }
        })();
        return () => controller.abort();
    }, [searchTerm]);

    const selectedChoice = searchResults[active];

    useKeypress((key, rl) => {
        if (isEnterKey(key)) {
            if (selectedChoice) { setStatus("done"); done(selectedChoice.value); }
            else rl.write(searchTerm);
        } else if (isTabKey(key) && selectedChoice) {
            rl.clearLine(0);
            rl.write(selectedChoice.name);
            setSearchTerm(selectedChoice.name);
        } else if (status !== "loading" && (isUpKey(key) || isDownKey(key))) {
            rl.clearLine(0);
            if ((isUpKey(key) && active !== bounds.first) || (isDownKey(key) && active !== bounds.last)) {
                const offset = isUpKey(key) ? -1 : 1;
                let next = active;
                do { next = (next + offset + searchResults.length) % searchResults.length; }
                while (!isSelectable(searchResults[next]));
                setActive(next);
            }
        } else {
            setSearchTerm(rl.line);
        }
    });

    const page = usePagination({
        items: searchResults,
        active,
        renderItem: renderChoice,
        pageSize: layout.pageSize,
        loop: false,
    });

    if (status === "done" && selectedChoice) {
        return `${prefix} ${config.message} ${CYAN}${selectedChoice.name}${RESET}`.trimEnd();
    }

    let error;
    if (searchError) error = `${RED}${searchError}${RESET}`;
    else if (searchResults.length === 0 && searchTerm !== "" && status === "idle") error = `${RED}No results found${RESET}`;

    // The query is shown in the chrome "Search:" header, so it is not echoed here.
    // (@inquirer/core slices rl.line off the end of this line; with a short, non-wrapping
    // prompt the hidden cursor stays consistent, so omitting the query renders cleanly.)
    const header = [prefix, config.message].filter(Boolean).join(" ");
    const body = [error ?? page, " ", HELP_LINE].join("\n");
    return [header, body];
});
