"""Smoke tests for Trickshot Sandbox: drives the real page in a headless browser, from the outside only.

Setup (once):   pip install playwright      then   python -m playwright install chromium
Run:            python tests/run_tests.py   (from the repo folder)

It serves the repo on a local port (127.0.0.1 only), opens the game and the sound lab, and checks the things
that most often break: the page loads without errors, every loadout fires and reloads, weapon switching,
the trickshot list popup, settings saving and resetting, a full Score Attack run, and every sound in the
sound lab playing.
Screenshots of failures go to tests/output/ (ignored by git).
"""
import functools
import http.server
import os
import sys
import threading
import traceback

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tests", "output")

# The game wants pointer lock and a running clock. Headless browsers can't lock the pointer, so it's faked,
# and the clock is frozen so tests advance it frame by frame with __step(frames, ms).
INIT = """
Object.defineProperty(Document.prototype, 'pointerLockElement', { get() { return window.__pl || null; } });
Element.prototype.requestPointerLock = function () { window.__pl = this; document.dispatchEvent(new Event('pointerlockchange')); };
window.__unlock = () => { window.__pl = null; document.dispatchEvent(new Event('pointerlockchange')); };
Document.prototype.exitPointerLock = function () { window.__unlock(); };
let __t = 1000; performance.now = () => __t;
window.__step = (n, ms) => new Promise((res) => { let i = 0; (function f() { if (i++ >= n) return res(); __t += ms; requestAnimationFrame(f); })(); });
window.__played = 0;
const __start = AudioBufferSourceNode.prototype.start;
AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer) window.__played++; return __start.apply(this, a); };
"""
GPU_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=ROOT))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def launch(p):
    # use an installed Edge or Chrome if there is one, else Playwright's own Chromium
    for channel in (os.environ.get("TSB_BROWSER"), "msedge", "chrome", None):
        try:
            return p.chromium.launch(channel=channel, headless=True, args=GPU_ARGS) if channel else p.chromium.launch(headless=True, args=GPU_ARGS)
        except Exception:
            continue
    raise RuntimeError("no browser found: run  python -m playwright install chromium")


results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def open_page(browser, url, w=1280, h=720):
    page = browser.new_page(viewport={"width": w, "height": h})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.add_init_script(INIT)
    page.goto(url)
    page.wait_for_timeout(1000)
    return page, errors


def step(page, n):
    page.evaluate(f"__step({n}, 16)")


def test_game(browser, base):
    page, errors = open_page(browser, base + "/index.html")
    check("three.js loads from lib/", page.evaluate("typeof THREE !== 'undefined' && THREE.REVISION === '128'"))
    guns = page.eval_on_selector_all("#loadout button", "els => els.map(e => e.dataset.gun)")
    check("loadout menu lists five guns", len(guns) == 5, ", ".join(guns))

    for gun in guns:
        page.click(f"#loadout button[data-gun={gun}]")
        page.click("#start-btn")
        step(page, 45)
        ammo_before = page.inner_text("#ammo-count")
        page.dispatch_event("canvas", "mousedown", {"button": 0})
        step(page, 1)
        page.dispatch_event("canvas", "mouseup", {"button": 0})
        step(page, 3)
        ammo_after = page.inner_text("#ammo-count")
        slots = page.eval_on_selector_all("#hotbar .slot", "els => els.map(e => e.textContent)")
        check(f"{gun}: fires (ammo {ammo_before.split('/')[0].strip()} -> {ammo_after.split('/')[0].strip()})", ammo_before != ammo_after)
        check(f"{gun}: hotbar shows the gun and the knife", len(slots) == 2 and "KNIFE" in slots[1], " | ".join(slots))
        page.keyboard.press("KeyR")
        step(page, 220)
        page.evaluate("__unlock()")
        step(page, 5)

    page.click("#start-btn")
    step(page, 30)
    page.keyboard.press("Digit2")
    step(page, 40)
    knife = page.eval_on_selector("#hotbar .slot.active", "e => e.textContent")
    page.keyboard.press("KeyQ")
    step(page, 40)
    back = page.eval_on_selector("#hotbar .slot.active", "e => e.textContent")
    check("2 switches to the knife, Q switches back", "KNIFE" in knife and "KNIFE" not in back, f"{knife} / {back}")
    page.evaluate("__unlock()")
    step(page, 5)

    # trickshot list: opens over the menu without starting the game, closes with Esc
    page.click("#glossary-open")
    page.wait_for_timeout(150)
    opened = page.evaluate("!document.getElementById('glossary').hidden")
    rows = page.evaluate("document.querySelectorAll('.g-row').length")
    started = page.evaluate("!!window.__pl")
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    closed = page.evaluate("document.getElementById('glossary').hidden")
    check("trickshot list opens, lists the tricks, closes with Esc", opened and rows > 20 and closed and not started, f"{rows} rows")

    # settings: every tab opens, a change survives a reload, reset restores it
    tabs = page.eval_on_selector_all(".stab", "els => els.map(e => e.dataset.tab)")
    shown = []
    for t in tabs:
        page.click(f".stab[data-tab={t}]")
        shown.append(page.evaluate(f"!document.querySelector('.spanel[data-panel={t}]').hidden"))
    check("every settings tab opens", all(shown), ", ".join(tabs))
    page.click(".stab[data-tab=view]")
    page.select_option("#quality", "low")
    page.check("#show-fps")
    low_ok = page.input_value("#quality") == "low"
    page.select_option("#quality", "auto")
    page.uncheck("#show-fps")
    check("the graphics setting switches levels", low_ok)
    page.click(".stab[data-tab=sound]")
    page.fill("#vol-move", "0.4")
    page.dispatch_event("#vol-move", "input")
    page.reload()
    page.wait_for_timeout(900)
    kept = page.input_value("#vol-move")
    page.click("#settings-reset")
    reset = page.input_value("#vol-move")
    check("a setting survives a reload, and Reset restores it", kept == "0.4" and reset == "1", f"{kept} -> {reset}")

    # sensitivity import: CS2 sens 1.0 matches 0.53 here (0.022 / 0.0418 degrees per count)
    page.click(".stab[data-tab=mouse]")
    page.select_option("#si-game", "cs2")
    page.fill("#si-sens", "1")
    page.fill("#si-dpi", "800")
    page.click("#si-apply")
    check("sensitivity import converts CS2 1.0 to 0.53 (52.0 cm/360 at 800 DPI)",
          page.inner_text("#sens-x-val") == "0.53" and "52.0 cm" in page.inner_text("#si-result"), page.inner_text("#si-result"))
    page.click("#settings-reset")

    # stats: the shots fired above are counted, survive a reload, and show in the Stats popup
    page.reload()
    page.wait_for_timeout(900)
    page.click("#stats-open")
    page.wait_for_timeout(150)
    rows = page.eval_on_selector_all("#stats-list .g-row", "rs => rs.map(r => r.textContent)")
    acc = next((r for r in rows if r.startswith("Accuracy")), "")
    check("stats count the shots fired and show them after a reload", "of 0 shots" not in acc and "shots and throws" in acc, acc)
    page.keyboard.press("Escape")

    # achievements: the popup lists every goal and the menu button shows the count
    page.click("#ach-open")
    page.wait_for_timeout(150)
    goals = page.evaluate("document.querySelectorAll('.ach-row').length")
    count = page.inner_text("#ach-count")
    check("achievements popup lists the goals and the menu shows the count", goals >= 20 and count.endswith("/" + str(goals)), f"{goals} goals, {count}")
    page.keyboard.press("Escape")

    check("no errors in the game page", not errors, "; ".join(errors[:3]))
    if not all(ok for _, ok, _ in results):
        page.screenshot(path=os.path.join(OUT, "game.png"))
    page.close()


def test_score_attack(browser, base):
    page, errors = open_page(browser, base + "/index.html")
    timer = lambda: page.inner_text("#mp-timer-val") if page.is_visible("#mp-timer") else "-"
    page.click("[data-play-mode=sa60]")
    page.click("#start-btn")
    step(page, 5)
    check("Score Attack starts with a countdown and a 1:00 clock", timer() == "1:00" and page.inner_text("#run-count") == "3", timer())
    step(page, 260)   # through the countdown and about a second of the run
    check("the clock runs after GO", timer() == "0:59", timer())
    page.evaluate("__unlock()")
    step(page, 5)
    before = page.inner_text("#start-btn")
    step(page, 120)
    check("the menu pauses the run", before.startswith("Resume run") and page.inner_text("#start-btn") == before, before)
    page.click("#start-btn")
    page.evaluate("__step(1250, 50)")   # the rest of the minute
    shown = page.evaluate("!document.getElementById('results').hidden")
    saved = page.evaluate("JSON.parse(localStorage.getItem('tsb-score-attack') || '{}').sa60 || []")
    check("time up shows the results and saves the score", shown and len(saved) == 1, page.inner_text("#r-score") if shown else "no results")
    page.keyboard.press("Enter")
    step(page, 5)
    check("Enter on the results starts a new run", timer() == "1:00" and page.evaluate("document.getElementById('results').hidden"))
    page.evaluate("__unlock()")
    step(page, 3)
    page.click("[data-play-mode=free]")
    check("switching back to free play ends the run", not page.is_visible("#mp-timer") and page.inner_text("#start-btn") == "Click to play")
    check("no errors in Score Attack", not errors, "; ".join(errors[:3]))
    page.close()


def test_sound_lab(browser, base):
    page, errors = open_page(browser, base + "/tools/sound-lab.html", 1366, 768)
    check("sound lab fits the window (no page scroll)", not page.evaluate("document.documentElement.scrollHeight > innerHeight + 1"))
    page.click(".group button")   # unfold the old synth sounds too
    count = page.evaluate("document.querySelectorAll('.item').length")
    silent = []
    for i in range(count):
        before = page.evaluate("window.__played")
        page.evaluate(f"document.querySelectorAll('.item')[{i}].click()")
        page.wait_for_timeout(120)
        if page.evaluate("window.__played") == before:
            silent.append(page.evaluate(f"document.querySelectorAll('.item')[{i}].querySelector('b').textContent"))
    check(f"every sound in the lab plays ({count})", not silent, ", ".join(silent))
    check("no errors in the sound lab", not errors, "; ".join(errors[:3]))
    page.close()


def main():
    os.makedirs(OUT, exist_ok=True)
    server, base = serve()
    with sync_playwright() as p:
        browser = launch(p)
        for test in (test_game, test_score_attack, test_sound_lab):
            try:
                test(browser, base)
            except Exception:
                check(test.__name__ + " ran to the end", False, traceback.format_exc().splitlines()[-1])
        browser.close()
    server.shutdown()
    failed = [n for n, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
