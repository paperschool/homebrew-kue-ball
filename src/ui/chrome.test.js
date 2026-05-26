import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/shell.js", () => ({
    run: vi.fn(),
}));

describe("chrome", () => {
    let chrome;
    let shell;
    let writeSpy;

    function allWritten() {
        return writeSpy.mock.calls.map(([a]) => (typeof a === "string" ? a : "")).join("");
    }

    function writtenWith(str) {
        return writeSpy.mock.calls.some(([a]) => typeof a === "string" && a.includes(str));
    }

    // Everything written, with ANSI colour codes stripped — for asserting on art glyphs
    // that the per-character colouriser would otherwise split across colour runs.
    function strippedWritten() {
        return allWritten().replace(/\x1b\[[0-9;]*m/g, "");
    }

    beforeEach(async () => {
        vi.resetModules();
        Object.defineProperty(process.stdout, "columns", { value: 80, configurable: true, writable: true });
        Object.defineProperty(process.stdout, "rows", { value: 24, configurable: true, writable: true });
        writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        chrome = await import("./chrome.js");
        shell = await import("../lib/shell.js");
        vi.mocked(shell.run).mockReset();
    });

    afterEach(() => {
        chrome.destroyChrome();
        writeSpy.mockRestore();
    });

    // ── isActive ─────────────────────────────────────────────────────────────

    describe("isActive()", () => {
        it("returns false before initChrome()", () => {
            expect(chrome.isActive()).toBe(false);
        });

        it("returns true after initChrome()", () => {
            chrome.initChrome();
            expect(chrome.isActive()).toBe(true);
        });

        it("returns false after destroyChrome()", () => {
            chrome.initChrome();
            chrome.destroyChrome();
            expect(chrome.isActive()).toBe(false);
        });
    });

    // ── getContentRows ───────────────────────────────────────────────────────

    describe("getContentRows()", () => {
        it("returns (process.stdout.rows - 6)", () => {
            expect(chrome.getContentRows()).toBe(18); // 24 - 6
        });

        it("never returns less than 1 when the terminal is very short", () => {
            Object.defineProperty(process.stdout, "rows", { value: 4, configurable: true, writable: true });
            expect(chrome.getContentRows()).toBe(1);
        });
    });

    // ── initChrome ───────────────────────────────────────────────────────────

    describe("initChrome()", () => {
        it("emits the alternate-screen-enter escape", () => {
            chrome.initChrome();
            expect(writtenWith("\x1b[?1049h")).toBe(true);
        });

        it("hides the cursor", () => {
            chrome.initChrome();
            expect(writtenWith("\x1b[?25l")).toBe(true);
        });

        it("writes the title bar at row 1 containing 'kue-ball'", () => {
            chrome.initChrome();
            expect(writtenWith("\x1b[1;1H")).toBe(true);
            expect(writtenWith("kue-ball")).toBe(true);
        });

        it("writes a divider line at row 2", () => {
            chrome.initChrome();
            expect(writtenWith("\x1b[2;1H")).toBe(true);
            expect(writtenWith("\u2500")).toBe(true);
        });

        it("is idempotent — second call does nothing", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.initChrome();
            expect(writtenWith("\x1b[?1049h")).toBe(false);
        });

        it("sets scroll region confining scrolling to the content rows", () => {
            chrome.initChrome();
            // With rows=24, scroll region should be \x1b[6;23r (rows 6–23)
            expect(writtenWith("\x1b[6;23r")).toBe(true);
        });
    });

    // ── destroyChrome ────────────────────────────────────────────────────────

    describe("destroyChrome()", () => {
        it("emits the alternate-screen-exit escape", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.destroyChrome();
            expect(writtenWith("\x1b[?1049l")).toBe(true);
        });

        it("shows the cursor", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.destroyChrome();
            expect(writtenWith("\x1b[?25h")).toBe(true);
        });

        it("is idempotent — second call does not re-emit restore escape", () => {
            chrome.initChrome();
            chrome.destroyChrome();
            writeSpy.mockClear();
            chrome.destroyChrome();
            expect(writtenWith("\x1b[?1049l")).toBe(false);
        });

        it("resets the scroll region before exiting", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.destroyChrome();
            expect(writtenWith("\x1b[r")).toBe(true);
        });
    });

    // ── updateStatusBar ──────────────────────────────────────────────────────

    describe("updateStatusBar()", () => {
        it("saves cursor, positions to last row, clears, writes text, restores cursor", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.updateStatusBar([{ text: "hello" }]);
            expect(writtenWith("\x1b[s")).toBe(true);
            expect(writtenWith("\x1b[2K")).toBe(true);
            expect(writtenWith("hello")).toBe(true);
            expect(writtenWith("\x1b[u")).toBe(true);
        });

        it("wraps segment in ANSI color codes when color is provided", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.updateStatusBar([{ text: "test", color: 32 }]);
            expect(writtenWith("\x1b[32m")).toBe(true);
            expect(writtenWith("test")).toBe(true);
            expect(writtenWith("\x1b[0m")).toBe(true);
        });

        it("is a no-op when chrome is not active", () => {
            chrome.updateStatusBar([{ text: "hello" }]);
            expect(writeSpy).not.toHaveBeenCalled();
        });
    });

    // ── getIdentitySegment ───────────────────────────────────────────────────

    describe("getIdentitySegment()", () => {
        it("returns empty string before loadIdentity() is called", () => {
            expect(chrome.getIdentitySegment()).toBe("");
        });
    });

    // ── loadIdentity ─────────────────────────────────────────────────────────

    describe("loadIdentity()", () => {
        it("populates the status bar with email and subscription name", async () => {
            vi.mocked(shell.run).mockReturnValue(
                '{"user":{"name":"dom@contoso.com"},"name":"my-prod-sub"}'
            );
            chrome.initChrome();
            writeSpy.mockClear();
            await chrome.loadIdentity();
            expect(allWritten()).toContain("dom@contoso.com");
            expect(allWritten()).toContain("my-prod-sub");
        });

        it("truncates user.name longer than 28 chars", async () => {
            vi.mocked(shell.run).mockReturnValue(
                '{"user":{"name":"first.last@very-long-company-domain.com"},"name":"sub"}'
            );
            chrome.initChrome();
            await chrome.loadIdentity();
            const seg = chrome.getIdentitySegment();
            expect(seg).toContain("first.last@very-long-company\u2026");
        });

        it("truncates subscription name longer than 20 chars", async () => {
            vi.mocked(shell.run).mockReturnValue(
                '{"user":{"name":"user@x.com"},"name":"my-very-long-subscription-name-here"}'
            );
            chrome.initChrome();
            await chrome.loadIdentity();
            const seg = chrome.getIdentitySegment();
            expect(seg).toContain("my-very-long-subscri\u2026");
        });

        it("falls back to 'Not signed in' when shell.run returns null", async () => {
            vi.mocked(shell.run).mockReturnValue(null);
            chrome.initChrome();
            await chrome.loadIdentity();
            expect(chrome.getIdentitySegment()).toBe("Not signed in");
        });

        it("falls back to 'Not signed in' when JSON is unparseable", async () => {
            vi.mocked(shell.run).mockReturnValue("not-json");
            chrome.initChrome();
            await chrome.loadIdentity();
            expect(chrome.getIdentitySegment()).toBe("Not signed in");
        });
    });

    // ── setSubscription ────────────────────────────────────────────────────────

    describe("setSubscription()", () => {
        beforeEach(() => {
            vi.mocked(shell.run).mockReturnValue('{"user":{"name":"dom@x.com"},"name":"default-sub"}');
        });

        it("replaces the footer subscription while keeping the user", async () => {
            chrome.initChrome();
            await chrome.loadIdentity();
            chrome.setSubscription("OtherSub");
            const seg = chrome.getIdentitySegment();
            expect(seg).toContain("dom@x.com");
            expect(seg).toContain("OtherSub");
            expect(seg).not.toContain("default-sub");
        });

        it("is ignored when no subscription is given (keeps the az default)", async () => {
            chrome.initChrome();
            await chrome.loadIdentity();
            chrome.setSubscription(null);
            expect(chrome.getIdentitySegment()).toContain("default-sub");
        });
    });

    // ── setAuthStatus ────────────────────────────────────────────────────────

    describe("setAuthStatus()", () => {
        it("renders green lock for 'ok'", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.setAuthStatus("ok");
            const written = allWritten();
            expect(written).toContain("\x1b[32m");
            expect(written).toContain("🔒");
        });

        it("renders red lock for 'error'", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.setAuthStatus("error");
            const written = allWritten();
            expect(written).toContain("\x1b[31m");
            expect(written).toContain("🔒");
        });

        it("renders an animated spinner (not the lock) for 'checking'", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.setAuthStatus("checking");
            const written = allWritten();
            expect(written).toContain("\x1b[33m");   // spinner colour
            expect(written).toContain("⠋");          // first spinner frame
            expect(written).not.toContain("🔒");     // no lock while confirming
            chrome.setAuthStatus("ok");              // stop the spinner timer
        });
    });

    // ── setAuthStatus('checking') spinner animation ────────────────────────────

    describe("setAuthStatus('checking') spinner", () => {
        beforeEach(() => { vi.useFakeTimers(); });
        afterEach(() => { vi.useRealTimers(); });

        it("animates the spinner on a timer while checking", () => {
            chrome.initChrome();
            chrome.setAuthStatus("checking");
            writeSpy.mockClear();
            vi.advanceTimersByTime(300); // 3 frames at 100ms
            expect(writeSpy.mock.calls.length).toBeGreaterThan(0);
            chrome.setAuthStatus("ok");
        });

        it("stops animating once status becomes ok", () => {
            chrome.initChrome();
            chrome.setAuthStatus("checking");
            chrome.setAuthStatus("ok");
            writeSpy.mockClear();
            vi.advanceTimersByTime(500);
            expect(writeSpy).not.toHaveBeenCalled();
        });
    });

    // ── setContextInfo ────────────────────────────────────────────────────────

    describe("setContextInfo()", () => {
        it("is a no-op when chrome is not active", () => {
            writeSpy.mockClear();
            chrome.setContextInfo("my-cluster", "default");
            expect(writeSpy).not.toHaveBeenCalled();
        });

        it("updates the title bar to include context and namespace when active", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.setContextInfo("my-cluster", "default");
            const written = allWritten();
            expect(written).toContain("my-cluster");
            expect(written).toContain("default");
        });

        it("uses cursor save/restore around the title redraw", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.setContextInfo("ctx", "ns");
            expect(writtenWith("\x1b[s")).toBe(true);
            expect(writtenWith("\x1b[u")).toBe(true);
        });

        it("prefixes context and namespace with ctx: and ns: labels", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.setContextInfo("my-cluster", "default");
            const written = allWritten();
            expect(written).toContain("ctx:");
            expect(written).toContain("ns:");
            expect(written).toContain("my-cluster");
            expect(written).toContain("default");
        });
    });

    // ── setSearchText ─────────────────────────────────────────────────────────

    describe("setSearchText()", () => {
        it("is a no-op when chrome is not active", () => {
            writeSpy.mockClear();
            chrome.setSearchText("foo");
            expect(writeSpy).not.toHaveBeenCalled();
        });

        it("draws the 'Search:' label and the query on row 4 when active", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.setSearchText("my-pod");
            const written = allWritten();
            expect(written).toContain("\x1b[4;1H"); // row 4, below the last-command row
            expect(written).toContain("Search:");
            expect(written).toContain("my-pod");
        });

        it("uses cursor save/restore around the search-bar redraw", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.setSearchText("x");
            expect(writtenWith("\x1b[s")).toBe(true);
            expect(writtenWith("\x1b[u")).toBe(true);
        });
    });

    // ── progress indicator ────────────────────────────────────────────────────

    describe("startProgress() / stopProgress()", () => {
        beforeEach(() => { vi.useFakeTimers(); });
        afterEach(() => { vi.useRealTimers(); });

        it("is a no-op when chrome is not active", () => {
            writeSpy.mockClear();
            chrome.startProgress();
            expect(writeSpy).not.toHaveBeenCalled();
        });

        it("renders immediately and draws the progress glyphs while active", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.startProgress();
            expect(writtenWith("█")).toBe(true);
            expect(writtenWith("\x1b[38;5;51m")).toBe(true); // bright moving-block colour
            chrome.stopProgress();
        });

        it("fills the gap between identity and lock (bar spans most of the width)", () => {
            chrome.initChrome(); // cols = 80
            writeSpy.mockClear();
            chrome.startProgress();
            const blockCount = (allWritten().match(/█/g) || []).length;
            expect(blockCount).toBeGreaterThan(50); // not the old fixed 10-cell strip
            chrome.stopProgress();
        });

        it("animates on a timer while active", () => {
            chrome.initChrome();
            chrome.startProgress();
            writeSpy.mockClear();
            vi.advanceTimersByTime(360); // 3 ticks at 120ms
            expect(writeSpy.mock.calls.length).toBeGreaterThan(0);
            chrome.stopProgress();
        });

        it("stops animating after stopProgress()", () => {
            chrome.initChrome();
            chrome.startProgress();
            chrome.stopProgress();
            writeSpy.mockClear();
            vi.advanceTimersByTime(500);
            expect(writeSpy).not.toHaveBeenCalled();
        });

        it("is idempotent — a second startProgress does not stack a second interval", () => {
            chrome.initChrome();
            chrome.startProgress();
            chrome.startProgress();
            chrome.stopProgress();
            writeSpy.mockClear();
            vi.advanceTimersByTime(500);
            expect(writeSpy).not.toHaveBeenCalled();
        });
    });

    // ── setLastCommand ───────────────────────────────────────────────────────

    describe("setLastCommand()", () => {
        it("is a no-op when chrome is not active", () => {
            writeSpy.mockClear();
            chrome.setLastCommand("Get pods");
            expect(writeSpy).not.toHaveBeenCalled();
        });

        it("writes the command text to the last-command bar when active", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.setLastCommand("Tail logs");
            const written = allWritten();
            expect(written).toContain("Last command:");
            expect(written).toContain("Tail logs");
        });

        it("renders the empty label when text is cleared", () => {
            chrome.initChrome();
            chrome.setLastCommand("Get pods");
            writeSpy.mockClear();
            chrome.setLastCommand("");
            const written = allWritten();
            expect(written).toContain("Last command:");
        });

        it("uses cursor save/restore around the bar redraw", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.setLastCommand("Get pods");
            expect(writtenWith("\x1b[s")).toBe(true);
            expect(writtenWith("\x1b[u")).toBe(true);
        });
    });

    // ── setLastCommandRun ──────────────────────────────────────────────────────

    describe("setLastCommandRun()", () => {
        it("draws the actual command on the row below the summary, in light blue", () => {
            chrome.initChrome();
            chrome.setLastCommand("List pods");
            writeSpy.mockClear();
            chrome.setLastCommandRun("kubectl get pods -o wide");
            const written = allWritten();
            expect(written).toContain("\x1b[4;1H");      // command starts on row 4 (under the summary)
            expect(written).toContain("\x1b[38;5;75m");  // light-blue command colour
            expect(strippedWritten()).toContain("kubectl get pods -o wide");
        });

        it("wraps a long command across multiple rows instead of truncating it", () => {
            chrome.initChrome(); // cols = 80 → 78 chars/line after the 2-space indent
            const long = "kubectl --context=my-np-eun-engineering-aks --namespace=my-engineering-namespace-main get pods -o wide";
            chrome.setLastCommand("List pods");
            writeSpy.mockClear();
            chrome.setLastCommandRun(long);
            expect(writtenWith("\x1b[4;1H")).toBe(true); // first wrapped row
            expect(writtenWith("\x1b[5;1H")).toBe(true); // second wrapped row
            const stripped = strippedWritten();
            expect(stripped).toContain(long.slice(0, 78)); // first wrapped line, intact
            expect(stripped).toContain(long.slice(78));    // remainder on the next line, not dropped
        });

        it("grows the content area downward to fit the wrapped command", () => {
            chrome.initChrome();
            expect(chrome.getContentRows()).toBe(18); // 24 - 6, no command yet
            chrome.setLastCommandRun(
                "kubectl --context=my-np-eun-engineering-aks --namespace=my-engineering-namespace-main get pods -o wide"
            );
            expect(chrome.getContentRows()).toBe(16); // header grew by 2 wrapped rows → 24 - 8
        });

        it("is cleared when a new command summary is set", () => {
            chrome.initChrome();
            chrome.setLastCommand("List pods");
            chrome.setLastCommandRun("kubectl get pods -o wide");
            writeSpy.mockClear();
            chrome.setLastCommand("Tail logs"); // new selection clears the previous detail
            expect(strippedWritten()).not.toContain("kubectl get pods -o wide");
        });

        it("is a no-op when chrome is not active", () => {
            writeSpy.mockClear();
            chrome.setLastCommandRun("kubectl get pods");
            expect(writeSpy).not.toHaveBeenCalled();
        });
    });

    // ── drawSplash ────────────────────────────────────────────────────────────
    describe("drawSplash()", () => {
        it("is a no-op when chrome is not active", () => {
            writeSpy.mockClear();
            chrome.drawSplash();
            expect(writeSpy).not.toHaveBeenCalled();
        });

        it("writes a white→blue gradient face (░→█) with light-blue depth edges for the KUE-BALL blocks", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.drawSplash();
            const written = allWritten();
            const stripped = strippedWritten();
            // The gradient walks white → lightest blue → lighter blue → light blue (solid).
            expect(written).toContain("\x1b[1;97m");        // bright white (░ band + byline)
            expect(written).toContain("\x1b[1;38;5;153m");  // lightest blue (▒ band)
            expect(written).toContain("\x1b[1;38;5;117m");  // lighter blue (▓ band)
            expect(written).toContain("\x1b[1;38;5;75m");   // light blue (█ band, matches depth)
            expect(written).toContain("\x1b[38;5;75m");     // light-blue depth/shadow edges
            // Glyph bands: sparse uses solid █ in white, middle bands use ▒/▓, solid uses █ in blue.
            expect(stripped).toContain("▒");
            expect(stripped).toContain("▓");
            expect(stripped).toContain("███████╗");          // solid blocks near bottom-right preserved
            // All-edge bottom drop-shadow row uses the shadow colour, never the face colour.
            expect(written).not.toContain("\x1b[1;97m╚");
            expect(written).toContain("\x1b[38;5;75m╚");
        });

        it("positions cursor after the art block", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            chrome.drawSplash();
            // Should emit a cursor-positioning escape after the art rows
            const written = allWritten();
            expect(written).toMatch(/\x1b\[\d+;\d+H/);
        });

        it("skips the art when the content area is too short to fit it", () => {
            chrome.initChrome();
            Object.defineProperty(process.stdout, "rows", { value: 8, configurable: true, writable: true });
            writeSpy.mockClear();
            chrome.drawSplash();
            expect(strippedWritten().includes("██╗  ██╗")).toBe(false);
        });

        it("skips the art on a terminal narrower than the art width", () => {
            chrome.initChrome();
            Object.defineProperty(process.stdout, "columns", { value: 40, configurable: true, writable: true });
            writeSpy.mockClear();
            chrome.drawSplash();
            expect(strippedWritten().includes("██╗  ██╗")).toBe(false);
        });
    });

    // ── resize handling ────────────────────────────────────────────────────────
    describe("resize handling", () => {
        beforeEach(() => { vi.useFakeTimers(); });
        afterEach(() => { vi.useRealTimers(); });

        it("debounces — no redraw until the debounce window elapses", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            process.stdout.emit("resize");
            vi.advanceTimersByTime(50);
            expect(writtenWith("kue-ball")).toBe(false);
            vi.advanceTimersByTime(50);
            expect(writtenWith("kue-ball")).toBe(true);
        });

        it("coalesces a burst of resize events into a single redraw", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            for (let i = 0; i < 5; i++) process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            const titleRedraws = writeSpy.mock.calls.filter(
                ([a]) => typeof a === "string" && a.includes("kue-ball")
            ).length;
            expect(titleRedraws).toBe(1);
        });

        it("wraps the redraw in cursor save/restore so it never disturbs an active prompt", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            expect(writtenWith("\x1b[s")).toBe(true);
            expect(writtenWith("\x1b[u")).toBe(true);
        });

        it("does not home the cursor into the content area on redraw", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            expect(writtenWith("\x1b[6;1H")).toBe(false);
        });

        it("re-sets a valid scroll region after redraw", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            expect(writtenWith("\x1b[6;23r")).toBe(true); // rows 6..(24-1)
        });

        it("clamps the scroll-region bottom to the content start on a tiny terminal", () => {
            chrome.initChrome();
            Object.defineProperty(process.stdout, "rows", { value: 5, configurable: true, writable: true });
            writeSpy.mockClear();
            process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            expect(writtenWith("\x1b[6;6r")).toBe(true);
        });

        it("invokes resize subscribers after the redraw when a prompt is subscribed", () => {
            chrome.initChrome();
            const subscriber = vi.fn();
            chrome.onResize(subscriber);
            process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            expect(subscriber).toHaveBeenCalledTimes(1);
        });

        it("clears the content area (home to content start, erase to end) when a prompt is subscribed", () => {
            chrome.initChrome();
            chrome.onResize(() => {});
            writeSpy.mockClear();
            process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            expect(writtenWith("\x1b[6;1H")).toBe(true);
            expect(writtenWith("\x1b[J")).toBe(true);
        });

        it("does not wipe the content area when no prompt is subscribed", () => {
            chrome.initChrome();
            writeSpy.mockClear();
            process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            expect(writtenWith("\x1b[J")).toBe(false);
        });

        it("erases the stranded status-bar row on grow when no prompt is subscribed", () => {
            chrome.initChrome(); // rows=24 → previous bottom is row 24
            Object.defineProperty(process.stdout, "rows", { value: 40, configurable: true, writable: true });
            writeSpy.mockClear();
            process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            expect(writtenWith("\x1b[24;1H")).toBe(true);
        });

        it("onResize returns an unsubscribe that stops further callbacks", () => {
            chrome.initChrome();
            const subscriber = vi.fn();
            const unsubscribe = chrome.onResize(subscriber);
            unsubscribe();
            process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            expect(subscriber).not.toHaveBeenCalled();
        });

        it("re-centres the splash art on resize while the title screen is showing", () => {
            chrome.initChrome(); // rows=24
            chrome.drawSplash();
            Object.defineProperty(process.stdout, "rows", { value: 40, configurable: true, writable: true });
            writeSpy.mockClear();
            process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            // 40 rows → contentHeight 34, vStart = 6 + floor((34-7)/2) = 19
            expect(writtenWith("\x1b[19;1H")).toBe(true);
            // Bottom-right of the gradient is always solid █; the all-edge bottom row is unchanged
            // (it carries no █). Either substring proves the splash was redrawn.
            expect(strippedWritten().includes("╚══════╝")).toBe(true);
        });

        it("stops redrawing the splash art on resize once hideSplash() is called", () => {
            chrome.initChrome();
            chrome.drawSplash();
            chrome.hideSplash();
            writeSpy.mockClear();
            process.stdout.emit("resize");
            vi.advanceTimersByTime(100);
            expect(strippedWritten().includes("╚══════╝")).toBe(false);
        });
    });
});
