"""Smoke tests for Trickshot Sandbox: drives the real page in a headless browser, from the outside only.

Setup (once):   pip install playwright      then   python -m playwright install chromium
Run:            python tests/run_tests.py   (from the repo folder; the full suite takes a while)
                python tests/run_tests.py --list | --quick | --small | --only bots,maps | --browser firefox|webkit

It serves the repo on a local port (127.0.0.1 only), opens the game and the sound lab, and checks the things
that most often break: the page loads without errors, every loadout fires and reloads, weapon switching,
the trickshot list popup, settings saving and resetting, a full Score Attack run, and every sound in the
sound lab playing.
Screenshots of failures go to tests/output/ (ignored by git).
"""
import argparse
import functools
import http.server
import os
import shutil
import sys
import tempfile
import threading
import time
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
window.__noFullscreen = true;   // fullscreen would resize the test browser
window.__noForceTutorial = true;   // a first visit would otherwise start the tutorial on the first click to play
if (typeof AudioBufferSourceNode !== 'undefined') {   // (Playwright's WebKit on Windows has no Web Audio at all)
  const __start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...a) { if (this.buffer) window.__played++; return __start.apply(this, a); };
}
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
    engine = os.environ.get("TSB_ENGINE", "chromium")
    if engine in ("firefox", "webkit"):   # Playwright's own build (python -m playwright install firefox webkit)
        return getattr(p, engine).launch(headless=True)
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


def view_size(default=(1280, 720)):
    """The page size tests use. The browser draws every frame in software, so a smaller page is much faster:
    TSB_VIEW=800x450 python tests/run_tests.py ... (a few checks that depend on layout want the default size)."""
    try:
        w, h = os.environ.get("TSB_VIEW", "").lower().split("x")
        return int(w), int(h)
    except ValueError:
        return default


def open_page(browser, url, w=None, h=None):
    if w is None or h is None:
        w, h = view_size()
    page = browser.new_page(viewport={"width": w, "height": h})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.add_init_script(INIT)
    page.goto(url)
    page.wait_for_timeout(1000)
    return page, errors


def show_settings(page):
    """Settings is a popup over the menu: open it if it isn't."""
    if page.is_hidden("#settings-popup"):
        page.click("#settings-open")
        page.wait_for_timeout(100)


def click_tab(page, tab):
    show_settings(page)
    page.click(f".stab[data-tab={tab}]")


def step(page, n):
    page.evaluate(f"__step({n}, 16)")


def pick_gun(page, gun):
    """Choose a loadout gun, through the More popup when it is not one of the favourites in the menu row."""
    if not page.is_visible(f"#loadout button[data-gun={gun}]"):
        page.click("#loadout-more")
        page.click(f"#loadout-popup button[data-gun={gun}]")
    else:
        page.click(f"#loadout button[data-gun={gun}]")


def test_game(browser, base):
    """Every loadout fires and reloads, weapons switch, the trickshot list, settings tabs and graphics levels, and the menu."""
    page, errors = open_page(browser, base + "/index.html")
    # before any shooting: nothing to watch yet
    check("replay buttons stay hidden until there's something to watch",
          not page.is_visible("#watch-best") and not page.is_visible("#watch-last"))
    check("three.js loads from lib/", page.evaluate("typeof THREE !== 'undefined' && THREE.REVISION === '128'"))
    quick = page.eval_on_selector_all("#loadout button[data-gun]", "els => els.map(e => e.dataset.gun)")
    check("the menu shows three favourite guns and a More button", quick == ["rifle", "ar", "shotgun"] and page.is_visible("#loadout-more"), ", ".join(quick))
    page.click("#loadout-more")
    guns = page.eval_on_selector_all("#loadout-popup button[data-gun]", "els => els.map(e => e.dataset.gun)")
    check("the More popup lists all ten guns", sorted(guns) == sorted(["rifle", "ar", "ak", "shotgun", "pistol", "smg", "dmr", "burst", "lmg", "crossbow"]), ", ".join(guns))
    page.click("#loadout-popup button[data-gun=dmr]")
    check("picking from More closes it, keeps the gun in the row and selects it",
          not page.is_visible("#loadout-popup") and page.is_visible("#loadout button.active[data-gun=dmr]"))

    for gun in guns:
        pick_gun(page, gun)
        page.click("#start-btn")
        step(page, 45)
        ammo_before = page.inner_text("#ammo-count")
        page.dispatch_event("body > canvas", "mousedown", {"button": 0})
        step(page, 1)
        page.dispatch_event("body > canvas", "mouseup", {"button": 0})
        step(page, 3)
        ammo_after = page.inner_text("#ammo-count")
        slots = page.eval_on_selector_all("#hotbar .slot", "els => els.map(e => e.textContent)")
        check(f"{gun}: fires (ammo {ammo_before.split('/')[0].strip()} -> {ammo_after.split('/')[0].strip()})", ammo_before != ammo_after)
        if gun == "burst":
            step(page, 20)
            left = page.inner_text("#ammo-count").split("/")[0].strip()
            check("the burst rifle fires three rounds from one pull", left == "27", f"{left} of 30 left")
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
    has_unrealistic = page.evaluate("document.getElementById('glossary').textContent.toUpperCase().includes('UNREALISTIC')")
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    closed = page.evaluate("document.getElementById('glossary').hidden")
    check("trickshot list opens, lists the tricks, closes with Esc", opened and rows > 20 and closed and not started, f"{rows} rows")
    check("the trickshot list includes the UNREALISTIC penalty", has_unrealistic)
    # perfect accuracy is worth half: the penalty is in the list, and it only applies with Realistic shooting off
    page.click("#glossary-open")
    page.wait_for_timeout(150)
    listed = "UNREALISTIC" in page.inner_text("#glossary").upper()
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    check("trickshot list includes the UNREALISTIC penalty", listed)

    # settings: every tab opens, a change survives a reload, reset restores it
    tabs = page.eval_on_selector_all(".stab", "els => els.map(e => e.dataset.tab)")
    shown = []
    for t in tabs:
        click_tab(page, t)
        shown.append(page.evaluate(f"!document.querySelector('.spanel[data-panel={t}]').hidden"))
    check("every settings tab opens", all(shown), ", ".join(tabs))
    click_tab(page, "view")
    page.select_option("#quality", "low")
    page.check("#show-fps")
    low_ok = page.input_value("#quality") == "low"
    page.select_option("#quality", "auto")
    page.uncheck("#show-fps")
    check("the graphics setting switches levels", low_ok)
    click_tab(page, "sound")
    page.fill("#vol-move", "0.4")
    page.dispatch_event("#vol-move", "input")
    page.reload()
    page.wait_for_timeout(900)
    kept = page.input_value("#vol-move")
    show_settings(page)
    page.click("#settings-reset")
    reset = page.input_value("#vol-move")
    check("a setting survives a reload, and Reset restores it", kept == "0.4" and reset == "1", f"{kept} -> {reset}")

    # sensitivity import: CS2 sens 1.0 matches 0.53 here (0.022 / 0.0418 degrees per count)
    click_tab(page, "mouse")
    page.select_option("#si-game", "cs2")
    page.fill("#si-sens", "1")
    page.fill("#si-dpi", "800")
    page.click("#si-apply")
    check("sensitivity import converts CS2 1.0 to 0.53 (52.0 cm/360 at 800 DPI)",
          page.inner_text("#sens-x-val") == "0.53" and "52.0 cm" in page.inner_text("#si-result"), page.inner_text("#si-result"))
    show_settings(page)
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
    """A full 1:00 Score Attack run: countdown, scoring, the results screen, the top 5 and Enter for a new run."""
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
    check("switching back to free play ends the run", not page.is_visible("#mp-timer") and page.inner_text("#start-btn") in ("Click to play", "Click to resume"))
    check("no errors in Score Attack", not errors, "; ".join(errors[:3]))
    page.close()


def test_controls(browser, base):
    """Key rebinding, reset, and the controls shown in the help line."""
    page, errors = open_page(browser, base + "/index.html", 1280, 900)
    slot = lambda a, i: page.locator(f'.bind-slot[data-action="{a}"][data-slot="{i}"]')
    ammo = lambda: page.inner_text("#ammo-count").split("/")[0].strip()
    click_tab(page, "controls")
    check("the Controls tab lists every action with two boxes each",
          page.locator(".bind-row").count() >= 14 and page.locator(".bind-slot").count() == 2 * page.locator(".bind-row").count()
          and slot("jump", 0).inner_text() == "Space" and slot("fire", 0).inner_text() == "Left Mouse")

    slot("reload", 0).click()
    page.keyboard.press("KeyG")
    check("clicking a box and pressing a key rebinds it", slot("reload", 0).inner_text() == "G", slot("reload", 0).inner_text())
    slot("jump", 0).click()
    page.keyboard.press("KeyG")
    check("a key moves between actions instead of doing two things",
          slot("jump", 0).inner_text() == "G" and slot("reload", 0).inner_text() == "–", slot("reload", 0).inner_text())
    slot("reload", 0).click()
    page.keyboard.press("Enter")
    check("keys the menus need can't be bound", slot("reload", 0).inner_text() != "Enter" and "can't be used" in page.inner_text("#bind-note"))
    page.keyboard.press("KeyT")
    slot("fire", 1).click()
    page.mouse.click(640, 780, button="right")
    check("a mouse button can be bound too (taken from Aim)", slot("fire", 1).inner_text() == "Right Mouse" and slot("aim", 0).inner_text() == "–")
    page.reload()
    page.wait_for_timeout(900)
    click_tab(page, "controls")
    check("the bindings survive a reload", slot("reload", 0).inner_text() == "T" and slot("fire", 1).inner_text() == "Right Mouse")
    page.keyboard.press("Escape")   # close the settings popup before playing

    page.click("#start-btn")
    step(page, 45)
    before = ammo()
    page.dispatch_event("body > canvas", "mousedown", {"button": 2})
    step(page, 2)
    page.dispatch_event("body > canvas", "mouseup", {"button": 2})
    step(page, 5)
    fired = ammo() != before
    after = ammo()
    page.keyboard.press("KeyR")
    step(page, 220)
    r_idle = ammo() == after
    page.keyboard.press("KeyT")
    step(page, 250)
    check("in the game the new bindings work (right mouse fires, T reloads, R doesn't)", fired and r_idle and ammo() == before, f"{before} -> {after} -> {ammo()}")
    page.evaluate("__unlock()")
    step(page, 5)
    click_tab(page, "controls")
    page.click("#bind-reset")
    check("Reset controls restores the defaults", slot("reload", 0).inner_text() == "R" and slot("jump", 0).inner_text() == "Space"
          and slot("aim", 0).inner_text() == "Right Mouse")
    check("no errors in the controls test", not errors, "; ".join(errors[:3]))
    page.close()


def test_grapple(browser, base):
    """The grapple hook flies out, pulls you, and lets go."""
    page, errors = open_page(browser, base + "/index.html")
    page.click("#start-btn")
    step(page, 60)
    speed = lambda: float(page.inner_text("#speed-val"))
    page.keyboard.down("KeyW"); page.keyboard.down("ShiftLeft"); step(page, 90); page.keyboard.up("KeyW"); page.keyboard.up("ShiftLeft")   # close enough to the north wall to reach it
    before = speed()
    page.keyboard.down("KeyE"); step(page, 3); page.keyboard.up("KeyE"); step(page, 40)
    check("tapping E hooks the wall ahead and reels you in (leaves the ground, speeds up)",
          speed() > before + 6 and "AIR" in page.inner_text("#state-val"), f"{before} -> {speed()}")
    step(page, 10)
    page.evaluate("__unlock()")
    step(page, 5)
    check("no errors in the grapple test", not errors, "; ".join(errors[:3]))
    page.close()


def test_first_visit(browser, base):
    """A brand-new visitor is walked through the tutorial on the first click to play; a returning one isn't."""
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script(INIT)
    page.add_init_script("window.__noForceTutorial = false;")
    page.goto(base + "/index.html")
    page.wait_for_timeout(1000)
    check("a first-time visitor's play button says the tutorial comes first", "tutorial" in page.inner_text("#start-btn").lower(), page.inner_text("#start-btn"))
    page.click("#start-btn")
    step(page, 30)
    check("their first click to play starts the tutorial", page.is_visible("#tutorial") and "1/" in page.inner_text("#tut-count"), page.inner_text("#tut-count"))
    page.evaluate("__unlock()")
    step(page, 5)
    page.reload()
    page.wait_for_timeout(1000)
    check("on the next visit the play button is plain again", "tutorial" not in page.inner_text("#start-btn").lower(), page.inner_text("#start-btn"))
    page.click("#start-btn")
    step(page, 20)
    check("and clicking it plays without the tutorial", not page.is_visible("#tutorial"))
    check("no errors on a first visit", not errors, "; ".join(errors[:3]))
    page.close()


def test_erase(browser, base):
    """Erase all data: two clicks, then every saved thing is gone and the game starts fresh."""
    page, errors = open_page(browser, base + "/index.html")
    click_tab(page, "sound")
    page.fill("#vol-move", "0.4")
    page.dispatch_event("#vol-move", "input")
    page.evaluate("localStorage.setItem('tsb-stats', JSON.stringify({ hits: 12 })); localStorage.setItem('tsb-achievements', JSON.stringify({ first: '2026-10-06' }))")
    click_tab(page, "other")
    page.click("#erase-all")
    armed = "again" in page.inner_text("#erase-all").lower()
    still = page.evaluate("!!localStorage.getItem('tsb-settings') && !!localStorage.getItem('tsb-stats')")
    check("the first click only asks to be sure (nothing is deleted yet)", armed and still)
    with page.expect_navigation():
        page.click("#erase-all")
    page.wait_for_timeout(900)
    left = page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('tsb-'))")
    click_tab(page, "sound")
    check("the second click erases every saved setting, stat and achievement",
          not any(k in left for k in ("tsb-stats", "tsb-achievements")) and page.input_value("#vol-move") == "1", str(left))   # (the game rewrites its settings key on load, with defaults)
    check("no errors in the erase test", not errors, "; ".join(errors[:3]))
    page.close()


def start_practice(page, mode=None, map_id=None, bots=None, level=None, limit=None):
    """Open the practice window (from the Multiplayer tab), set what's asked, and press Start."""
    if mode == "range":   # the range is started from the single player menu
        page.click('#mode-tabs .tab[data-mode="solo"]')
        page.click("#range-start")
        page.wait_for_timeout(300)
        page.evaluate("__unlock()")   # the click starts playing straight away; back to the menu, where the tests expect to press play
        page.wait_for_timeout(100)
        return
    if page.is_hidden("#panel-mp"):
        page.click('#mode-tabs .tab[data-mode="mp"]')
    page.click("#mp-card-practice")
    page.wait_for_timeout(100)
    if mode:
        page.click(f'#ps-modes .ps-card[data-mode="{mode}"]')
    if map_id:
        page.click(f'#ps-maps button[data-map="{map_id}"]')
    if bots or level or limit is not None:
        page.evaluate("document.getElementById('ps-rules').open = true")
        if bots:
            page.select_option("#ps-bots", str(bots))
        if level:
            page.select_option("#ps-level", level)
        if limit is not None:
            page.select_option("#ps-limit", str(limit))
    page.click("#ps-go")


def test_bots(browser, base):
    """Practice vs bots: an offline deathmatch room with AI players."""
    page, errors = open_page(browser, base + "/index.html")
    page.click('#mode-tabs .tab[data-mode="mp"]')
    check("the loadout picker shows on the Multiplayer tab too", page.is_visible("#loadout"))
    start_practice(page, bots=2, level="hard")
    page.wait_for_timeout(300)
    names = page.eval_on_selector_all("#mp-players li", "els => els.map(e => e.textContent)")
    check("practice starts a room with you and the bots", len(names) == 3 and sum("BOT" in n for n in names) == 2 and any("YOU" in n for n in names), "; ".join(names))
    page.click("#mp-play-btn")
    step(page, 40)
    hp_shown = page.is_visible("#hpbar")   # (hard bots can kill a player who stands still within seconds, and the bar goes with them)
    step(page, 660)
    check("in practice the health bar shows and the game runs without errors", hp_shown and not errors, "; ".join(errors[:3]))
    check("the round timer shows while you play", page.is_visible("#mp-timer") and "first to" in page.inner_text("#mp-timer-mode").lower(), page.inner_text("#mp-timer-mode"))
    check("the Esc hint shows top-left during play", page.is_visible("#esc-hint") and "Esc" in page.inner_text("#esc-hint"))
    page.evaluate("__unlock()")
    step(page, 5)
    page.click("#mp-leave-btn")
    page.wait_for_timeout(200)
    check("leaving practice returns to the multiplayer menu", page.is_visible("#mp-connect") and page.is_hidden("#mp-room"))
    # team deathmatch against bots, first to 5
    start_practice(page, mode="tdm", bots=3, limit=5)
    page.wait_for_timeout(300)
    page.click("#mp-play-btn")
    step(page, 120)
    hud = page.inner_text("#mp-timer-mode").lower()
    check("team deathmatch shows the mode, the kill limit and the team scores", "team deathmatch" in hud and "first to 5" in hud and "blue" in hud and "red" in hud, hud)
    check("no errors in the bots test", not errors, "; ".join(errors[:3]))
    page.close()


def test_crosshair(browser, base):
    """Crosshair presets and the hit-marker style apply, and survive a reload; the new achievements are listed."""
    page, errors = open_page(browser, base + "/index.html")
    click_tab(page, "crosshair")
    names = page.eval_on_selector_all("#xh-presets button", "els => els.map(e => e.textContent)")
    check("the crosshair tab offers presets", len(names) >= 5, ", ".join(names))
    page.click('#xh-presets button:has-text("Ring")')
    page.select_option("#hit-style", "x")
    page.reload()
    page.wait_for_timeout(300)
    click_tab(page, "crosshair")
    now = page.evaluate("[document.getElementById('xh-style').value, document.getElementById('hit-style').value]")
    check("a preset and the hit-marker style survive a reload", now == ["circle", "x"], str(now))
    count = page.evaluate("document.getElementById('ach-count').textContent")
    check("the achievements include the map and King of the Hill ones", int(count.split("/")[1]) >= 36, count)
    # the bigger map: clicking the map that is already chosen opens it; Esc closes it
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    page.click('#map-picker button[data-map="summit"]')
    page.click('#map-picker button[data-map="summit"]')
    page.wait_for_timeout(150)
    shown = page.evaluate("!document.getElementById('map-popup').hidden && document.getElementById('map-popup-title').textContent")
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    gone = page.evaluate("document.getElementById('map-popup').hidden")
    check("clicking the chosen map opens a bigger map, and Esc closes it", shown == "Summit" and gone, str(shown))
    # in a game, holding M shows the map with you on it
    page.click("#start-btn")
    step(page, 300)
    page.keyboard.down("KeyM")
    step(page, 3)
    live = page.evaluate("!document.getElementById('map-popup').hidden && document.getElementById('map-popup').classList.contains('ingame')")
    page.keyboard.up("KeyM")
    step(page, 3)
    off = page.evaluate("document.getElementById('map-popup').hidden")
    check("holding M in a game shows the map, and letting go hides it", live and off, f"{live} {off}")
    page.keyboard.down("KeyL")
    step(page, 3)
    rec = page.evaluate("[!document.getElementById('scoreboard').hidden, document.getElementById('sb-title').textContent]")
    page.keyboard.up("KeyL")
    step(page, 3)
    check("holding L on your own shows your records for the map", rec[0] and rec[1].startswith("Records"), str(rec))
    check("crosshair and achievements run without errors", not errors, "; ".join(errors[:2]))
    page.close()


def test_scoring_extras(browser, base):
    """The newer tricks are listed, and the best-shot card saves as a PNG."""
    page, errors = open_page(browser, base + "/index.html")
    page.click("#glossary-open")
    page.wait_for_timeout(150)
    text = page.evaluate("document.getElementById('glossary').textContent.toUpperCase()")
    missing = [k for k in ("PORTAL SHOT", "STRIP SHOT", "PLATFORM SHOT", "ZERO-G", "CHAIN", "NEW") if k not in text]
    check("the trickshot list includes the portal, strip, platform, zero-g, chain and new-trick bonuses", not missing, ", ".join(missing))
    check("a no-scope is a sniper hit from the hip (the sniper has iron sights unless a scope is fitted)", "SNIPER, FIRED FROM THE HIP" in text)
    page.keyboard.press("Escape")
    # a saved best shot (made up here) is enough for the card
    clip = {"v": 1, "map": "summit", "snap": [], "hitT": 1, "meta": {"points": 1234, "mult": 12.3, "tags": ["AIR x1.40", "SLIDING x1.30", "LONG SHOT x1.55"],
            "pens": ["STANDING STILL x0.75"], "dist": 55},
            "frames": [{"t": 0, "c": [0, 2, 30, 0, 0, 0, 1, 78, 0], "w": "ar"}, {"t": 2, "c": [0, 2, 30, 0, 0, 0, 1, 78, 0], "w": "ar"}],
            "events": [{"type": "hit", "t": 1, "i": 0, "o": [0, 2, 30], "p": [10, 2, -20], "knife": False}]}
    page.evaluate("(c) => localStorage.setItem('tsb-best-replay', JSON.stringify(c))", clip)
    page.reload()
    page.wait_for_timeout(300)
    check("a best shot shows the Save card button", page.is_visible("#card-best"))
    with page.expect_download() as dl:
        page.click("#card-best")
    d = dl.value
    path = d.path()
    size = os.path.getsize(path) if path else 0
    check("the best-shot card downloads as a PNG", d.suggested_filename.endswith(".png") and size > 3000, f"{d.suggested_filename} {size} bytes")
    check("scoring extras run without errors", not errors, "; ".join(errors[:2]))
    page.close()


def test_access_and_backup(browser, base):
    """Accessibility settings apply and persist; a data backup exports, rejects bad files, and restores a good one."""
    import json
    page, errors = open_page(browser, base + "/index.html")
    click_tab(page, "access")
    page.check("#reduce-motion")
    page.check("#high-contrast")
    page.evaluate("(() => { const el = document.getElementById('hud-scale'); el.value = '1.3'; el.dispatchEvent(new Event('input', { bubbles: true })); })()")
    hc = page.evaluate("document.body.classList.contains('hc')")
    scale = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--hud-scale').trim()")
    page.reload()
    page.wait_for_timeout(300)
    click_tab(page, "access")
    again = page.evaluate("[document.getElementById('reduce-motion').checked, document.getElementById('high-contrast').checked, document.getElementById('hud-scale').value]")
    check("accessibility settings apply and survive a reload", hc and scale == "1.3" and again == [True, True, "1.3"], f"{hc} {scale} {again}")
    # backup
    click_tab(page, "other")
    with page.expect_download() as dl:
        page.click("#data-export")
    doc = json.load(open(dl.value.path(), encoding="utf-8"))
    check("Export my data saves a backup file", doc.get("app") == "trickshot-sandbox" and "tsb-settings" in doc.get("data", {}), ", ".join(doc.get("data", {}).keys()))
    page.set_input_files("#data-import-file", {"name": "bad.json", "mimeType": "application/json", "buffer": b"not json at all"})
    page.wait_for_timeout(200)
    bad_note = page.inner_text("#data-import-note")
    check("a file that isn't a backup is refused", "isn't" in bad_note and page.is_hidden("#data-import-apply"), bad_note)
    page.set_input_files("#data-import-file", {"name": "evil.json", "mimeType": "application/json",
        "buffer": json.dumps({"app": "trickshot-sandbox", "v": 1, "data": {"tsb-name": "<img src=x onerror=alert(1)>"}}).encode()})
    page.wait_for_timeout(200)
    check("a backup with a bad value is refused", page.is_hidden("#data-import-apply"), page.inner_text("#data-import-note"))
    good = {"app": "trickshot-sandbox", "v": 1, "exported": "2026-10-11", "data": {"tsb-name": "Tester", "tsb-tutorial": "done", "tsb-stats": json.dumps({"since": "2026-01-01", "kinds": {}, "guns": {}, "tricks": {}})}}
    page.set_input_files("#data-import-file", {"name": "good.json", "mimeType": "application/json", "buffer": json.dumps(good).encode()})
    page.wait_for_timeout(200)
    shown = page.is_visible("#data-import-apply")
    page.click("#data-import-apply")
    page.wait_for_timeout(500)
    name = page.evaluate("localStorage.getItem('tsb-name')")
    kept_old = page.evaluate("localStorage.getItem('tsb-settings')")
    check("a good backup replaces the saved data", shown and name == "Tester" and kept_old is None or (shown and name == "Tester"), f"{shown} {name}")
    check("accessibility and backup run without errors", not errors, "; ".join(errors[:2]))
    page.close()


def test_map_records(browser, base):
    """Each map keeps its own best trickshot and longest streak: they load, show in Stats, and a bad entry is ignored."""
    page, errors = open_page(browser, base + "/index.html")
    rec = {"canyon": {"shot": {"points": 4321, "mult": 7.5, "tags": ["AIR"], "pens": [], "dist": 60}, "streak": 9},
           "nowhere": {"shot": {"points": 99999, "mult": 9, "tags": [], "pens": []}, "streak": 50},
           "summit": {"shot": {"points": "lots", "mult": 2, "tags": []}, "streak": 4}}
    page.evaluate("(r) => localStorage.setItem('tsb-map-records', JSON.stringify(r))", rec)
    page.reload()
    page.wait_for_timeout(300)
    page.click("#stats-open")
    page.wait_for_timeout(150)
    text = page.evaluate("document.getElementById('stats-list').textContent")
    check("Stats lists the records by map", "Records by map" in text and "Canyon" in text and ("4,321" in text or "4321" in text) and "longest streak 9" in text, text[:200])
    check("a record for a map that doesn't exist is ignored", "99,999" not in text and "99999" not in text and "nowhere" not in text.lower())
    check("a record with a bad number keeps only what is valid (Summit: the streak, no shot)", "longest streak 4" in text)
    page.keyboard.press("Escape")
    exported = page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('tsb-')).includes('tsb-map-records')")
    check("the map records are saved with the rest of the game's data", exported)
    check("map records run without errors", not errors, "; ".join(errors[:2]))
    page.close()


def test_play_setup(browser, base):
    """The multiplayer menu: three big choices, a setup window for practice and hosting, and the last choices remembered."""
    page, errors = open_page(browser, base + "/index.html")
    page.click('#mode-tabs .tab[data-mode="mp"]')
    check("the multiplayer menu shows Practice, Host and Join", page.is_visible("#mp-card-practice") and page.is_visible("#mp-card-host") and page.is_visible("#mp-join-btn"))
    page.click("#mp-card-practice")
    page.wait_for_timeout(100)
    modes = page.eval_on_selector_all("#ps-modes .ps-card", "els => els.map(e => e.dataset.mode)")
    check("the practice window lists the modes (no score race: it needs real people, no range: that is in single player)", modes == ["dm", "tdm", "koth", "tkoth", "br", "ctf", "gungame"], ", ".join(modes))
    page.click('#ps-modes .ps-card[data-mode="koth"]')
    active_map = page.evaluate("document.querySelector('#ps-maps button.active').dataset.map")
    off = page.eval_on_selector_all("#ps-maps button.off", "els => els.map(e => e.dataset.map)")
    check("King of the Hill picks the hill map and switches the others off", active_map == "summit" and "arena" in off and "summit" not in off, f"{active_map} / {len(off)} off")
    page.click('#ps-modes .ps-card[data-mode="ctf"]')
    off = page.eval_on_selector_all("#ps-maps button.off", "els => els.map(e => e.dataset.map)")
    check("capture the flag switches off the maps without flag bases (Arena, Ice Lake, Summit)", {"arena", "icelake", "summit"} <= set(off) and not ({"courtyard", "foundry", "moonbase", "rooftops", "canyon"} & set(off)), ", ".join(off))
    page.click('#ps-modes .ps-card[data-mode="koth"]')
    page.evaluate("document.getElementById('ps-rules').open = true")
    page.select_option("#ps-bots", "4")
    page.select_option("#ps-level", "easy")
    check("the rules are all out in the open (no hidden section)", all(page.is_visible(sel) for sel in ("#ps-bots", "#ps-level", "#ps-r-lowgrav", "#ps-r-oneshot", "#ps-r-siphon")))
    sip = {}
    for mode in ("dm", "tdm", "koth", "tkoth", "br", "ctf", "gungame"):
        page.click(f'#ps-modes .ps-card[data-mode="{mode}"]')
        sip[mode] = page.is_checked("#ps-r-siphon")
    check("siphon starts on for deathmatch, King of the Hill, battle royale and gun game, off for the team modes", sip == {"dm": True, "tdm": False, "koth": True, "tkoth": False, "br": True, "ctf": False, "gungame": True}, str(sip))
    page.click('#ps-modes .ps-card[data-mode="koth"]')
    page.check("#ps-r-lowgrav")
    page.check("#ps-r-oneshot")
    page.click("#ps-go")
    page.wait_for_timeout(300)
    page.click("#mp-play-btn")
    step(page, 60)
    label = page.inner_text("#mp-timer-mode").lower()
    check("a room with match rules names them in the timer", "low gravity" in label and "one-shot kills" in label, label)
    page.evaluate("__unlock()")
    step(page, 3)
    page.click("#mp-leave-btn")
    page.wait_for_timeout(200)
    page.click("#mp-card-practice")
    page.wait_for_timeout(100)
    page.uncheck("#ps-r-lowgrav")
    page.uncheck("#ps-r-oneshot")
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    check("Esc closes the setup window", page.is_hidden("#play-setup"))
    # start one, then see that the choices come back after a reload
    start_practice(page, mode="tdm", map_id="foundry", bots=4, level="easy", limit=5)
    page.wait_for_timeout(300)
    names = page.eval_on_selector_all("#mp-players li", "els => els.map(e => e.textContent)")
    check("Start practice makes a room with the bots", len(names) == 5, str(len(names)))
    page.click("#mp-leave-btn")
    page.reload()
    page.wait_for_timeout(300)
    page.click('#mode-tabs .tab[data-mode="mp"]')
    sub = page.inner_text("#mp-card-practice-sub")
    check("the three big choices say nothing about the last match", sub == "Play offline against AI players" and "Foundry" not in page.inner_text("#mp-card-host-sub"), sub)
    # the shooting range: started from single player, on its own map, with what the gun does in the corner
    page.click("#mp-card-practice")
    page.wait_for_timeout(100)
    check("the practice window does not offer the shooting range (it is in single player)", page.query_selector('#ps-modes .ps-card[data-mode="range"]') is None)
    page.keyboard.press("Escape")
    page.wait_for_timeout(100)
    page.click('#mode-tabs .tab[data-mode="solo"]')
    page.click("#range-start")
    page.wait_for_timeout(300)
    step(page, 90)
    rmap = page.evaluate("document.querySelector('canvas') ? 'range' : ''")
    check("the Shooting range button in single player starts the range", page.is_visible("#range-info"), rmap)
    info = page.evaluate("[!document.getElementById('range-info').hidden, document.getElementById('range-info').textContent]")
    check("the range shows what your gun does", info[0] and "body" in info[1], str(info))
    page.evaluate("__unlock()")
    step(page, 3)
    page.click("#mp-leave-btn")
    page.wait_for_timeout(200)
    check("leaving the range goes back to single player", page.is_visible("#panel-solo") and page.is_hidden("#panel-mp"))
    page.click('#mode-tabs .tab[data-mode="mp"]')
    # battle royale: one life, a closing zone, and who is left across the top
    start_practice(page, mode="br", bots=2)
    page.wait_for_timeout(300)
    page.click("#mp-play-btn")
    step(page, 60)
    br_hud = page.inner_text("#mp-timer-mode").lower()
    br_bar = page.evaluate("!document.getElementById('koth-bar').hidden && document.getElementById('kb-left').textContent.toLowerCase()")
    check("battle royale shows who is alive and the zone", "battle royale" in br_hud and "alive" in str(br_bar), f"{br_hud} / {br_bar}")
    page.evaluate("__unlock()")
    step(page, 3)
    page.click("#mp-leave-btn")
    page.wait_for_timeout(200)
    # capture the flag: a team game with a flag on each side and the captures across the top
    start_practice(page, mode="ctf", map_id="courtyard", bots=2)
    page.wait_for_timeout(300)
    page.click("#mp-play-btn")
    step(page, 60)
    ctf_hud = page.inner_text("#mp-timer-mode").lower()
    ctf_bar = page.evaluate("!document.getElementById('koth-bar').hidden && document.getElementById('kb-mid').textContent.toLowerCase()")
    check("capture the flag shows the mode and what to do", "capture the flag" in ctf_hud and "flag" in str(ctf_bar), f"{ctf_hud} / {ctf_bar}")
    page.evaluate("__unlock()")
    step(page, 3)
    page.click("#mp-leave-btn")
    page.wait_for_timeout(200)
    # gun game: the label shows your level and the gun in your hand is the first of the ladder
    start_practice(page, mode="gungame", bots=2)
    page.wait_for_timeout(300)
    page.click("#mp-play-btn")
    step(page, 60)
    gg_label = page.inner_text("#mp-timer-mode").lower()
    check("gun game shows your level in the timer", "gun game" in gg_label and "0 / 11 guns" in gg_label, gg_label)
    page.evaluate("__unlock()")
    step(page, 3)
    check("in a gun game the loadout buttons and attachments are locked", page.evaluate("document.querySelectorAll('#loadout button:not([disabled])').length === 0 && document.getElementById('attach-open').disabled"))
    hot = page.eval_on_selector_all("#hotbar .slot", "els => els.map(e => e.textContent)")
    check("and the gun in your hand is the ladder's first (the SMG), whatever you picked", any("SMG" in h for h in hot), " | ".join(hot))
    page.click("#mp-leave-btn")
    page.wait_for_timeout(200)
    page.click("#mp-card-host")
    page.wait_for_timeout(100)
    modes = page.eval_on_selector_all("#ps-modes .ps-card", "els => els.map(e => e.dataset.mode)")
    title = page.inner_text("#ps-title")
    check("the host window offers every mode, including the score race", "race" in modes and len(modes) == 8 and title.lower() == "host a room", f"{title} {modes}")
    page.keyboard.press("Escape")
    check("the setup windows run without errors", not errors, "; ".join(errors[:2]))
    page.close()


def test_attachments(browser, base):
    """Attachments: locked until you have landed hits with the gun, then fitted, saved, and they change the gun."""
    import json
    page, errors = open_page(browser, base + "/index.html")
    page.click("#attach-open")
    page.wait_for_timeout(150)
    locked = page.eval_on_selector_all("#attach-slots .at-opt.locked", "els => els.length")
    opts_n = page.eval_on_selector_all("#attach-slots .at-opt", "els => els.length")
    check("the attachments window lists the options, the dearer ones locked until you land more hits with the gun", opts_n >= 6 and locked > 0, f"{opts_n} options, {locked} locked")
    page.keyboard.press("Escape")
    # pretend 200 hits with the AR, then fit the extended magazine
    stats = {"since": "2026-01-01", "kinds": {}, "guns": {"ar": {"shots": 400, "hits": 200, "points": 0}}, "tricks": {}}
    page.evaluate("(s) => localStorage.setItem('tsb-stats', JSON.stringify(s))", stats)
    page.reload()
    page.wait_for_timeout(300)
    page.click('#loadout button[data-gun="ar"]')
    page.click("#attach-open")
    page.wait_for_timeout(150)
    opt = page.query_selector('#attach-slots .at-opt[data-opt="extmag"]')
    check("an attachment unlocks once the gun has enough hits", opt is not None and "locked" not in (opt.get_attribute("class") or ""))
    page.click('#attach-slots .at-opt[data-opt="extmag"]')
    active = page.evaluate("document.querySelector('#attach-slots .at-opt.active[data-opt=\"extmag\"]') !== null")
    page.keyboard.press("Escape")
    ammo = page.inner_text("#ammo-count")
    check("a fitted attachment changes the gun (the extended magazine holds 45)", active and "45" in ammo, ammo)
    page.reload()
    page.wait_for_timeout(300)
    ammo2 = page.inner_text("#ammo-count")
    check("the fitted attachment is remembered", "45" in ammo2, ammo2)
    # the dev tools window (the ` key) opens every attachment
    page.keyboard.press("Escape")
    page.keyboard.press("Backquote")
    check("the ` key opens the dev tools window", page.is_visible("#dev-popup"))
    page.click('#dev-list button[data-dev="unlock"]')
    page.keyboard.press("Backquote")
    check("the dev tools window closes with ` again", not page.is_visible("#dev-popup"))
    page.click("#attach-open")
    page.wait_for_timeout(150)
    check("Unlock all attachments opens every option", page.eval_on_selector_all("#attach-slots .at-opt.locked", "els => els.length") == 0)
    # switching guns in the window selects that gun; a second click on your gun in the menu opens the window
    page.click('#attach-guns button[data-gun="ak"]')
    check("choosing a gun in the attachments window makes it your gun", page.evaluate("document.querySelector('#loadout .lo-gun.active').dataset.gun") == "ak")
    page.click("#attach-close")
    page.click('#loadout .lo-gun.active')
    check("clicking your gun a second time opens the attachments window", page.is_visible("#attach-popup"))
    page.click("#attach-close")
    page.click("#attach-open")
    # the barrels and the magnified scopes
    page.click('#attach-guns button[data-gun="ar"]')
    check("the rifle offers two barrels and a 2x scope",
          all(page.query_selector(f'#attach-slots .at-opt[data-opt="{o}"]') is not None for o in ("longbarrel", "heavybarrel", "optic-2x")))
    page.click('#attach-slots .at-opt[data-opt="optic-2x"]')
    page.click('#attach-slots .at-opt[data-opt="longbarrel"]')
    check("a scope and a barrel can be fitted together", page.eval_on_selector_all('#attach-slots .at-opt.active', "els => els.map(e => e.dataset.opt)").count("optic-2x") == 1)
    # a grip and a magazine can be fitted together, and an old save with the magazine in the grip slot still works
    page.click('#attach-guns button[data-gun="dmr"]')
    page.click('#attach-slots .at-opt[data-opt="vgrip"]')
    page.click('#attach-slots .at-opt[data-opt="extmag"]')
    both = page.eval_on_selector_all('#attach-slots .at-opt.active', "els => els.map(e => e.dataset.opt)")
    check("a vertical grip and an extended magazine can be fitted together", "vgrip" in both and "extmag" in both, ", ".join(both))
    page.evaluate("localStorage.setItem('tsb-settings', JSON.stringify({attach: {dmr: {grip: 'extmag'}}}))")
    page.reload()
    page.wait_for_timeout(300)
    page.click("#attach-open")
    page.click('#attach-guns button[data-gun="dmr"]')
    check("an old save with the magazine in the grip slot moves it to the magazine slot",
          page.query_selector('#attach-slots .at-opt.active[data-opt="extmag"]') is not None)
    check("attachments run without errors", not errors, "; ".join(errors[:2]))
    page.close()


def test_gamepad(browser, base):
    """A (pretend) gamepad moves, aims and fires like the keys once the game is running."""
    page, errors = open_page(browser, base + "/index.html")
    page.evaluate("""() => {
      window.__pad = { id: 'test pad', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      navigator.getGamepads = () => [window.__pad];
    }""")
    page.click("#start-btn")
    step(page, 300)
    speed0 = float(page.inner_text("#speed-val") or 0)
    page.evaluate("window.__pad.axes[1] = -1")   # the left stick forward
    step(page, 90)
    speed1 = float(page.inner_text("#speed-val") or 0)
    page.evaluate("window.__pad.axes[1] = 0")
    check("the left stick moves you", speed1 > speed0 + 2, f"{speed0} -> {speed1}")
    before = page.inner_text("#ammo-count")
    page.evaluate("window.__pad.buttons[7] = { pressed: true, value: 1 }")   # the right trigger fires
    step(page, 4)
    page.evaluate("window.__pad.buttons[7] = { pressed: false, value: 0 }")
    step(page, 6)
    after = page.inner_text("#ammo-count")
    check("the right trigger fires", before != after, f"{before} -> {after}")
    page.evaluate("window.__pad.buttons[9] = { pressed: true, value: 1 }")   # Start opens the menu
    step(page, 4)
    menu = page.evaluate("!window.__pl")
    check("Start opens the menu", menu)
    check("the gamepad runs without errors", not errors, "; ".join(errors[:2]))
    page.close()


def test_maps(browser, base):
    """Every map builds, shows up in the picker, and can be played with bots."""
    page, errors = open_page(browser, base + "/index.html")
    ids = page.eval_on_selector_all("#map-picker button", "els => els.map(e => e.dataset.map)")
    check("the menu offers every map", len(ids) >= 3 and "arena" in ids and "courtyard" in ids and "foundry" in ids, ", ".join(ids))
    for mid in ids:
        page.click(f'#map-picker button[data-map="{mid}"]')
        page.wait_for_timeout(150)
        if page.evaluate("!document.getElementById('map-popup').hidden"):   # clicking the chosen map again opens the bigger map
            page.keyboard.press("Escape")
            page.wait_for_timeout(100)
        page.click("#start-btn")
        step(page, 90)
        page.evaluate("__unlock()")
        step(page, 3)
        check(f"{mid}: picking it and playing runs without errors", page.eval_on_selector(f'#map-picker button[data-map="{mid}"]', "e => e.classList.contains('active')") and not errors, "; ".join(errors[:2]))
    page.click('#mode-tabs .tab[data-mode="mp"]')
    for mid in ids:
        start_practice(page, mode="range" if mid == "range" else "dm", map_id=mid, bots=3)
        page.wait_for_timeout(250)
        page.click("#mp-play-btn")
        step(page, 200)
        page.evaluate("__unlock()")
        step(page, 3)
        page.click("#mp-leave-btn")
        page.wait_for_timeout(150)
        check(f"{mid}: a practice match with bots runs without errors", not errors, "; ".join(errors[:2]))
    # King of the Hill always plays on a map with a hill, whatever map was picked
    start_practice(page, mode="koth", map_id="arena")   # (the arena is switched off for this mode, so the hill map stays picked)
    page.wait_for_timeout(250)
    page.click("#mp-play-btn")
    step(page, 200)
    label = page.inner_text("#mp-timer-mode") if page.query_selector("#mp-timer-mode") else ""
    bar = page.evaluate("!document.getElementById('koth-bar').hidden && document.getElementById('kb-mid').textContent")
    check("King of the Hill: starts on the hill map with the progress bar showing", "king of the hill" in label.lower() and bool(bar), f"{label} / {bar}")
    page.keyboard.down("KeyL")
    step(page, 3)
    cols = page.evaluate("[!document.getElementById('scoreboard').hidden, document.querySelectorAll('#sb-head th').length]")
    page.keyboard.up("KeyL")
    step(page, 3)
    check("holding L in a room shows the leaderboard with the extra stats", cols[0] and cols[1] >= 6, str(cols))
    check("King of the Hill: runs without errors", not errors, "; ".join(errors[:2]))
    page.close()


def test_tutorial(browser, base):
    """The tutorial starts, ticks steps off, can be skipped with Enter, and is remembered when finished."""
    page, errors = open_page(browser, base + "/index.html")
    glows = page.evaluate("document.getElementById('tutorial-btn').classList.contains('glow')")
    check("the tutorial button glows on a first visit and the panel is hidden in the menu",
          glows and not page.is_visible("#tutorial"))
    page.click("#tutorial-btn")
    step(page, 30)
    check("starting the tutorial shows step 1 over the game", page.is_visible("#tutorial") and "1/" in page.inner_text("#tut-count"),
          page.inner_text("#tut-count"))
    for _ in range(40):   # look around: a big sweep with the mouse
        page.evaluate("document.dispatchEvent(new MouseEvent('mousemove', {movementX: 100, movementY: 0}))")
        step(page, 1)
    step(page, 90)
    check("turning the view completes the look-around step", page.inner_text("#tut-title") == "Move", page.inner_text("#tut-title"))
    for _ in range(30):   # skip ahead to the map and records step
        if page.inner_text("#tut-title") == "Map and records":
            break
        page.keyboard.press("Enter")
        step(page, 12)
    check("the tutorial has a step for the map and records keys", page.inner_text("#tut-title") == "Map and records", page.inner_text("#tut-title"))
    page.keyboard.down("m"); step(page, 20)
    page.keyboard.down("l"); step(page, 20)
    page.keyboard.up("m"); page.keyboard.up("l")
    step(page, 120)
    check("holding the map and records keys ticks that step off", page.inner_text("#tut-title") == "Trickshot", page.inner_text("#tut-title"))
    for _ in range(40):   # Enter skips whatever is left
        if "complete" in page.inner_text("#tut-count").lower():
            break
        page.keyboard.press("Enter")
        step(page, 12)
    check("Enter skips steps through to the end", "complete" in page.inner_text("#tut-count").lower(), page.inner_text("#tut-count"))
    ends = page.inner_text("#tut-text")
    check("the last card points at what to try next (Score Attack, attachments, practice, maps)", all(k in ends for k in ("Score Attack", "Attachments", "Practice", "Moonbase")), ends[:120])
    page.evaluate("__unlock()")
    step(page, 5)
    done = page.evaluate("localStorage.getItem('tsb-tutorial')") == "done" and page.inner_text("#tutorial-btn") == "Tutorial"
    check("finishing is remembered and the button goes plain", done, page.inner_text("#tutorial-btn"))
    check("no errors in the tutorial", not errors, "; ".join(errors[:3]))
    page.close()


def test_sound_lab(browser, base):
    """Every sound in the sound lab plays."""
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


def test_problem_report(browser, base):
    """The version shows in Settings, Copy debug info builds a readable report, and an error the game throws shows a bar and goes in the report."""
    page, errors = open_page(browser, base + "/index.html")
    click_tab(page, "other")
    about = page.inner_text("#about-line")
    check("Settings shows the game version", about.startswith("Trickshot Sandbox v20") and "three.js r" in about, about)
    check("no error bar before anything goes wrong", page.is_hidden("#problem-bar"))
    page.click("#debug-copy")
    page.wait_for_timeout(200)
    report = page.input_value("#debug-info")
    check("Copy debug info fills the box with the version, browser, graphics and map", "Trickshot Sandbox v20" in report and "Browser:" in report and "Graphics:" in report and "Map:" in report and "Errors: none" in report, report[:120])
    check("the report has nothing personal in it (no name, no saved data)", "tsb-" not in report and "localStorage" not in report)
    page.evaluate("window.__boom = () => { throw new Error('boom test'); }; setTimeout(window.__boom, 0)")   # (one place, so repeats count together)
    page.wait_for_timeout(700)
    shown = page.is_visible("#problem-bar")
    msg = page.inner_text("#problem-msg") if shown else ""
    check("an error the game throws shows the bar with its message", shown and "boom test" in msg and "Copy debug info" in msg, msg)
    page.evaluate("for (let i = 0; i < 3; i++) setTimeout(window.__boom, 0)")
    page.wait_for_timeout(1500)
    msg2 = page.inner_text("#problem-msg")
    check("the same error repeating is counted, not shown again and again", "(4 errors)" in msg2, msg2)
    page.click("#debug-copy")
    page.wait_for_timeout(200)
    report2 = page.input_value("#debug-info")
    check("the report lists the error and how often it happened", "boom test" in report2 and "x4" in report2 and "Errors: none" not in report2, report2[-160:])
    page.click("#problem-close")
    check("the bar can be dismissed", page.is_hidden("#problem-bar"))
    check("only the errors this test threw were raised", errors and all("boom test" in e for e in errors), "; ".join(errors[:3]))
    page.close()


GUNS_JS = """() => {
  const D = window.__dbg, out = { problems: [], facts: {} };
  const bad = (m) => out.problems.push(m);
  const oldOrder = ["rifle", "ar", "ak", "shotgun", "pistol", "knife"];
  // a gun travels over the network as its place in this list: the original six must not move, new guns go after them
  if (JSON.stringify(D.WEAPON_ORDER.slice(0, 6)) !== JSON.stringify(oldOrder)) bad("the first six places in WEAPON_ORDER changed: " + D.WEAPON_ORDER.slice(0, 6).join(","));
  out.facts.order = D.WEAPON_ORDER.join(",");
  for (const id of D.GUNS) {
    const w = D.WEAPONS[id];
    if (!D.DAMAGE[id]) bad(id + " has no damage numbers");
    if (!D.WEAPON_ICONS[id]) bad(id + " has no hotbar icon");
    if (!D.ATTACHMENTS[id]) bad(id + " has no attachments");
    if (!w.sound || !(w.sound.rate > 0) || !(w.sound.length > 0)) bad(id + " has no usable sound profile");
    if (!(w.fireRate > 0) || !(w.magSize > 0) || !w.group || !w.muzzle) bad(id + " is missing fire rate, magazine, model or muzzle");
    if (w.action !== "pump" && (w.mag === undefined || w.magRestY === undefined)) bad(id + " has no magazine part for the reload");   // (the pump shotgun loads shells instead)
    if (!D.GG_ORDER.includes(id)) bad(id + " is not on the gun game ladder");
  }
  const dm = (g, d, head) => D.hostDamage({ x: 0, z: 0 }, { x: d, z: 0 }, { head: !!head, n: 1, h: head ? 1 : 0 }, g);
  out.facts.smg = [dm("smg", 5), dm("smg", 12), dm("smg", 23.5), dm("smg", 35), dm("smg", 80), dm("smg", 5, true), dm("smg", 80, true)];
  out.facts.dmr = [dm("dmr", 5), dm("dmr", 80), dm("dmr", 5, true)];
  out.facts.lmg = [D.WEAPONS.lmg.magSize, dm("lmg", 5), dm("lmg", 5, true)];
  out.facts.burst = [D.WEAPONS.burst.burst, dm("burst", 5), dm("burst", 5, true)];
  out.facts.knife = dm("knife", 1);
  out.facts.ggLen = D.GG_ORDER.length;
  return out;
}"""


def test_guns(browser, base):
    """Every gun is complete (damage, icon, sound, attachments, model, gun game), the original six keep their network order, and the SMG's damage fades with distance."""
    server, dbase, tmp = debug_site()
    try:
        page, errors = open_page(browser, dbase + "/index.html")
        res = page.evaluate(GUNS_JS)
        f = res["facts"]
        check("the original six guns keep their places in the network order, new guns come after", not [x for x in res["problems"] if "WEAPON_ORDER" in x], f["order"])
        check("every gun has damage, an icon, attachments, a sound, a model, a magazine and a place in gun game", not [x for x in res["problems"] if "WEAPON_ORDER" not in x], "; ".join(res["problems"][:4]))
        check("the SMG hits for 20 up close, fades from 12 m to half by 35 m, and stays at half beyond", f["smg"][:2] == [20, 20] and abs(f["smg"][2] - 15) < 0.5 and f["smg"][3] == 10 and f["smg"][4] == 10, str(f["smg"]))
        check("the SMG's head hit is 30 and fades the same way", f["smg"][5] == 30 and f["smg"][6] == 15, str(f["smg"][5:]))
        check("the DMR does 60 to the body (two to kill) and 100 to the head at any range", f["dmr"] == [60, 60, 100], str(f["dmr"]))
        check("a knife swing kills in one hit", f["knife"] >= 100, str(f["knife"]))
        check("gun game has ten guns before the knife", f["ggLen"] == 10, str(f["ggLen"]))
        check("the LMG holds 100 rounds and the burst rifle fires three rounds a pull", f["lmg"] == [100, 24, 34] and f["burst"] == [3, 28, 42], str(f["lmg"]) + " " + str(f["burst"]))
        check("the gun checks run without errors", not errors, "; ".join(errors[:2]))
        page.close()
    finally:
        server.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)


def test_crossbow(browser, base):
    """The crossbow's bolt flies, scores on a target, and hurts a dummy through the host's checks (55 body, a head kills); the bolt is gone until the reload brings the next one."""
    server, dbase, tmp = debug_site()
    try:
        page, errors = open_page(browser, dbase + "/index.html", 900, 560)
        pick_gun(page, "crossbow")
        page.click("#start-btn")
        step(page, 60)
        # a plate in the open (a wall or a pillar in the way is not the bolt's fault, so a few plates are tried)
        g = None
        for attempt in range(4):
            step(page, 200)   # (the last bolt reloaded)
            page.evaluate("""(n) => {
              const d = window.__dbg, ts = d.targets.filter((x) => x.userData.alive && !x.userData.motion && x.userData.type === "normal"), t = ts[n % ts.length], tp = t.position;
              d.yawObject.position.set(tp.x, d.player.feetY + 1.6, tp.z + 20);
              const dx = tp.x - d.yawObject.position.x, dy = tp.y - d.yawObject.position.y, dz = tp.z - d.yawObject.position.z;
              d.yawObject.rotation.y = Math.atan2(-dx, -dz); d.pitchObject.rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
            }""", attempt)
            step(page, 3)
            page.dispatch_event("body > canvas", "mousedown", {"button": 0})
            step(page, 2)
            page.dispatch_event("body > canvas", "mouseup", {"button": 0})
            if attempt == 0:
                flying = page.evaluate("window.__dbg.thrownPool.filter((k) => k.state === 'flying' && k.bolt).length")
                check("a click launches a bolt that flies", flying == 1, str(flying))
                check("the bolt is out of the groove (one bolt, none left)", page.evaluate("window.__dbg.WEAPONS.crossbow.ammo === 0 && !window.__dbg.WEAPONS.crossbow.mag.visible"))
            step(page, 80)
            g = page.evaluate("window.__dbg.stats.guns.crossbow")
            if g and g["hits"] >= 1:
                break
        check("the bolt hit a plate and scored for the crossbow", g and g["hits"] >= 1 and g["points"] > 0, str(g))
        step(page, 200)
        check("the reload brings the next bolt", page.evaluate("window.__dbg.WEAPONS.crossbow.ammo === 1 && window.__dbg.WEAPONS.crossbow.mag.visible"))
        page.close()
        # a dummy at the range, through the host's checks
        page, errors2 = open_page(browser, dbase + "/index.html", 900, 560)
        pick_gun(page, "crossbow")
        page.click("#mode-tabs .tab[data-mode=mp]")
        start_practice(page, mode="range")
        page.click("#mp-play-btn")
        step(page, 90)
        bot = page.evaluate("""() => {
          const d = window.__dbg, b = [...d.net.players.values()].find((p) => p.bot && p.alive);
          d.yawObject.position.set(b.x, b.y + 1.6, b.z + 25);
          const dx = b.x - d.yawObject.position.x, dy = (b.y + 1.2) - d.yawObject.position.y, dz = b.z - d.yawObject.position.z;
          d.yawObject.rotation.y = Math.atan2(-dx, -dz); d.pitchObject.rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
          return b.id;
        }""")
        step(page, 3)
        page.dispatch_event("body > canvas", "mousedown", {"button": 0})
        step(page, 2)
        page.dispatch_event("body > canvas", "mouseup", {"button": 0})
        step(page, 70)
        hp = page.evaluate("(id) => window.__dbg.net.players.get(id).hp", bot)
        check("a bolt to the body takes 55 (the host believes the hit)", hp == 45, f"hp {hp}")
        step(page, 200)   # reloaded; aim at the head this time (a little high: the bolt drops about 20 cm over 25 m)
        page.evaluate("""(id) => {
          const d = window.__dbg, b = d.net.players.get(id);
          const dx = b.x - d.yawObject.position.x, dy = (b.y + 1.75) - d.yawObject.position.y, dz = b.z - d.yawObject.position.z;
          d.yawObject.rotation.y = Math.atan2(-dx, -dz); d.pitchObject.rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
        }""", bot)
        step(page, 3)
        page.dispatch_event("body > canvas", "mousedown", {"button": 0})
        step(page, 2)
        page.dispatch_event("body > canvas", "mouseup", {"button": 0})
        step(page, 70)
        check("a bolt to the head kills", page.evaluate("(id) => !window.__dbg.net.players.get(id).alive", bot))
        page.close()
        # a bot's crossbow: its bolt flies where everyone can see it, and it can kill
        page, errors3 = open_page(browser, dbase + "/index.html", 800, 450)
        page.click("#mode-tabs .tab[data-mode=mp]")
        start_practice(page, mode="dm", bots=1, level="hard")
        page.click("#mp-play-btn")
        step(page, 90)
        page.evaluate("""() => {
          const d = window.__dbg, bot = [...d.net.players.values()].find((p) => p.bot), me = d.net.players.get('you');
          bot.ai.gun = 'crossbow'; bot.g = d.WEAPON_ORDER.indexOf('crossbow'); bot.ai.ammo = 1; bot.ai.reloadT = 0; bot.ai.fireT = 0;
          bot.x = me.x; bot.z = me.z - 18; bot.y = me.y;
          d.net.cd = 0; me.protectUntil = 0; bot.protectUntil = 0; bot.ai.errK = 0.05;   // (a bot that aims true, so a missed shot is not what this checks)
             // (no countdown or spawn protection: this checks the bolt)
        }""")
        seen, lowest = 0, 100
        for i in range(120):
            step(page, 5)
            if i % 25 == 24: page.evaluate("() => { const b = [...window.__dbg.net.players.values()].find((p) => p.bot); b.ai.ammo = 1; b.ai.reloadT = 0; b.ai.fireT = 0; }")   # (a hard bot can miss: let it try again)
            r = page.evaluate("() => ({ f: window.__dbg.thrownPool.filter((k) => k.state === 'flying' && k.bolt && k.remote).length, hp: window.__dbg.net.players.get('you').hp })")
            seen, lowest = max(seen, r["f"]), min(lowest, r["hp"])
        check("a bot's crossbow bolt flies where you can see it", seen >= 1, str(seen))
        check("and a bolt that arrives on a still target hurts", lowest < 100, f"hp {lowest}")
        check("the crossbow runs without errors", not errors and not errors2 and not errors3, "; ".join((errors + errors2 + errors3)[:2]))
        page.close()
    finally:
        server.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)


def debug_site():
    """A throw-away copy of the game with a window.__dbg hook added just before the last `animate();`, so a test can look at the
    level data from inside. The repo itself is never touched. Returns (server, base, folder); delete the folder when done."""
    tmp = tempfile.mkdtemp(prefix="tsb-debug-")
    for f in ("index.html", "style.css", "game.js", "sounds.js"):
        shutil.copy(os.path.join(ROOT, f), tmp)
    shutil.copytree(os.path.join(ROOT, "lib"), os.path.join(tmp, "lib"))
    path = os.path.join(tmp, "game.js")
    with open(path, encoding="utf-8", newline="") as fh:
        src = fh.read().replace("\r\n", "\n")
    hook = ("  window.__dbg = { wallBoxes, ramps, ladders, jumpPads, portals, boosts, movers, MAPS, MAP_ORDER, loadMap, navBuild, navPath, navLevelFor, "
            "WEAPONS, WEAPON_ORDER, GUNS, DAMAGE, GG_ORDER, ATTACHMENTS, WEAPON_ICONS, hostDamage, "
            "targets, camera, yawObject, pitchObject, thrownPool, stats, vm, run, player, net, "
            "hostStartRound, pickSpawn, hostRespawn, resolveWalls, rayHitBox, wallBoxes, hostCtfTick, ctfBase, surfaceBelow, showKillBanner, ggLevelHtml, ggBotGun, botFire, hostHandle, makeGgPreset, ggParsePreset, "
            "FLOOR_Y, CFG, get currentMap() { return currentMap; }, get navLv() { return navLv; }, get navLinks() { return navLinks; }, "
            "get SPAWNS() { return SPAWNS; } };\n")
    i = src.rindex("  animate();\n})();")
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(src[:i] + hook + src[i:])
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=tmp))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}", tmp


# Map problems already known and waiting for a decision: they are reported as notes, not failures. Each is a piece of the message.
# Remove an entry once the map is fixed (the test says so when an entry no longer matches anything).
KNOWN_MAP_ISSUES = {}   # (Canyon's two buried pads were fixed when its raised bases came out)

# Runs inside the page for one map; returns the problems (things that are wrong) and notes (things worth knowing).
MAP_CHECK_JS = """(id) => {
  const D = window.__dbg;
  D.loadMap(id); D.navBuild();
  const m = D.MAPS[id], probs = [], notes = [];
  const H = D.CFG.playerHeight, STEP = D.CFG.stepHeight, F = D.FLOOR_Y, r1 = (v) => +v.toFixed(1);
  // would someone standing here, feet at y, be inside a wall? (the same rule the bots' navigation grid uses, without its padding)
  const buried = (x, y, z) => D.wallBoxes.some((b) => !b.gate && x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && y < b.max.y - STEP && y + H > b.min.y);
  const spawns = D.SPAWNS, s0 = spawns[0], floorLv = D.navLevelFor(F);
  const reach = (x, z, y) => !!D.navPath(s0[0], s0[1], floorLv, x, z, D.navLevelFor(y));
  const at = (x, z) => "(" + r1(x) + ", " + r1(z) + ")";
  for (const p of D.jumpPads) if (buried(p.x, p.y - 0.16, p.z)) probs.push("jump pad at " + at(p.x, p.z) + " is inside a wall");
  for (const s of spawns) {
    if (buried(s[0], F, s[1])) probs.push("spawn at " + at(s[0], s[1]) + " is inside a wall");
    else if (!reach(s[0], s[1], F)) probs.push("spawn at " + at(s[0], s[1]) + " cannot be reached from the first spawn");
  }
  (m.flags || []).forEach((b, t) => {
    const y = b[2] === undefined ? F : b[2];
    if (buried(b[0], y, b[1])) probs.push("flag base " + t + " at " + at(b[0], b[1]) + " is inside a wall");
    else if (!reach(b[0], b[1], y)) probs.push("flag base " + t + " at " + at(b[0], b[1]) + " cannot be reached from the first spawn");
  });
  if (m.hill) {
    const y = m.hill.y === undefined ? F : m.hill.y;
    if (buried(m.hill.x, y, m.hill.z)) probs.push("the hill at " + at(m.hill.x, m.hill.z) + " is inside a wall");
    else if (!reach(m.hill.x, m.hill.z, y)) probs.push("the hill at " + at(m.hill.x, m.hill.z) + " cannot be reached from the first spawn");
  }
  const lads = [];
  for (const arr of D.navLinks.values()) for (const l of arr) if (l.type === 1) lads.push(l.lad);
  for (const L of D.ladders) {
    const foot = [L.x + L.nx * 0.9, L.z + L.nz * 0.9], top = [L.x - L.nx * 1.0, L.z - L.nz * 1.0];
    if (buried(foot[0], L.y0 + 0.05, foot[1])) probs.push("the foot of the ladder at " + at(L.x, L.z) + " is inside a wall");
    else if (buried(top[0], L.y1 + 0.05, top[1])) probs.push("the top of the ladder at " + at(L.x, L.z) + " is inside a wall");
    else if (!lads.includes(L)) probs.push("the ladder at " + at(L.x, L.z) + " joins no two floors, so bots will never use it");
  }
  for (const P of D.portals) if (buried(P.x + P.nx * 1.05, F, P.z + P.nz * 1.05)) probs.push("the portal at " + at(P.x, P.z) + " opens into a wall");
  for (const b of D.boosts) if (buried(b.x, b.y, b.z)) probs.push("the launch strip at " + at(b.x, b.z) + " is inside a wall");
  // floors nobody can walk to from the spawn (informational: people can still jump or grapple up, but bots cannot)
  D.navLv.forEach((lv, i) => {
    if (i === floorLv) return;
    const N = Math.round(Math.sqrt(lv.surf.length)), half = (D.CFG.arenaHalfSize), cell = (2 * half) / N;
    let c = -1;
    for (let k = 0; k < lv.surf.length; k++) if (lv.surf[k] && !lv.blocked[k]) { c = k; break; }
    if (c < 0) return;
    const x = -half + ((c % N) + 0.5) * cell, z = -half + (Math.floor(c / N) + 0.5) * cell;
    if (!D.navPath(s0[0], s0[1], floorLv, x, z, i)) notes.push("the floor at " + r1(lv.h) + " m has no route from the spawn for bots");
  });
  return { probs, notes };
}"""


def test_shots_after_death(browser, base):
    """A bolt shot just before its shooter died still scores the kill; spawn protection ends when you move; the gun game's attachments make sense for each gun."""
    server, dbase, tmp = debug_site()
    try:
        page, errors = open_page(browser, dbase + "/index.html", 800, 450)
        page.click("#mode-tabs .tab[data-mode=mp]")
        start_practice(page, mode="dm", bots=1, level="easy")
        page.click("#mp-play-btn")
        step(page, 30)
        res = page.evaluate("""() => {
          const D = window.__dbg, bot = [...D.net.players.values()].find((p) => p.bot), me = D.net.players.get('you');
          D.net.cd = 0; me.protectUntil = 0; bot.protectUntil = 0;
          bot.x = me.x; bot.z = me.z - 20; bot.y = me.y; bot.hp = 100; bot.alive = true;
          const o = [me.x, me.y + 1.6, me.z], d = [0, 0, -1];
          D.hostHandle('you', { t: 'shot', g: 'crossbow', o, d, l: 100 });
          me.alive = false; me.diedAt = performance.now();   // dies with the bolt in the air
          const kills = me.kills;
          D.hostHandle('you', { t: 'hurt', v: bot.id, pts: 100, tags: [], head: true, knife: false, thr: false, n: 1, h: 1 });
          const credited = !bot.alive && me.kills === kills + 1;
          // too long after dying: no credit
          me.alive = false; me.diedAt = performance.now() - 5000; bot.hp = 100; bot.alive = true;
          D.hostHandle('you', { t: 'shot', g: 'crossbow', o, d, l: 100 });
          me.alive = false; me.diedAt = performance.now() - 5000;
          D.hostHandle('you', { t: 'hurt', v: bot.id, pts: 100, tags: [], head: true, knife: false, thr: false, n: 1, h: 1 });
          const late = bot.alive;
          // spawn protection: gone once you move
          me.alive = true; D.hostRespawn(me, false);
          const st = (x, z) => ({ t: 'st', x, y: 0.25, z, yaw: 0, pitch: 0, w: 0, sl: 0, g: 0, rl: 0, at: '', gr: 0, gh: null });
          const had = me.protectUntil > performance.now();
          D.hostHandle('you', st(me.spawnX + 0.1, me.spawnZ));
          const stillOn = me.protectUntil > performance.now();
          D.hostHandle('you', st(me.spawnX + 1.5, me.spawnZ));
          const gone = me.protectUntil === 0;
          return { credited, late, had, stillOn, gone };
        }""")
        check("a bolt shot before the shooter died still scores the kill", res["credited"], str(res))
        check("but not one claimed long after they died", res["late"], str(res))
        check("a respawn is protected, a small shuffle keeps it, moving ends it", res["had"] and res["stillOn"] and res["gone"], str(res))
        sip = page.evaluate("""() => {
          const D = window.__dbg, bot = [...D.net.players.values()].find((p) => p.bot), me = D.net.players.get('you');
          const kill = (on) => {
            D.net.rules = Object.assign({}, D.net.rules, { siphon: on, oneShot: false });
            me.alive = true; me.protectUntil = 0; bot.alive = true; bot.hp = 100; bot.protectUntil = 0; me.hp = 40; me.lastFireAt = -1e9;   // (the clock is frozen in tests: let the shot through)
            D.hostHandle('you', { t: 'shot', g: 'crossbow', o: [me.x, me.y + 1.6, me.z], d: [0, 0, -1], l: 100 });
            bot.x = me.x; bot.z = me.z - 20; bot.y = me.y;
            D.hostHandle('you', { t: 'hurt', v: bot.id, pts: 100, tags: [], head: true, knife: false, thr: false, n: 1, h: 1 });
            return [bot.alive, me.hp];
          };
          return { on: kill(true), off: kill(false) };
        }""")
        check("with siphon on, a kill refills your health to 100", sip["on"][0] is False and sip["on"][1] == 100, str(sip))
        check("with it off, it does not", sip["off"][0] is False and sip["off"][1] == 40, str(sip))
        gg = page.evaluate("""() => {
          const D = window.__dbg, out = { bad: [], scoped: 0, optics: 0, seen: new Set(), n: 80 };
          for (let i = 0; i < out.n; i++) {
            const str = D.makeGgPreset(), map = D.ggParsePreset(str);
            out.seen.add(str);
            for (const g of D.GUNS) {
              if (!map[g]) { out.bad.push(g + " missing"); continue; }
              const ids = map[g].map((o) => o.id);
              if (g === "rifle" && !(ids.includes("scope-low") || ids.includes("scope-high"))) out.bad.push("sniper without a scope");
              if ((g === "dmr" || g === "crossbow") && !ids.some((x) => ["reddot", "optic-2x", "optic-4x"].includes(x))) out.bad.push(g + " without an optic");
            }
          }
          return { bad: out.bad.slice(0, 3), varied: out.seen.size };
        }""")
        check("every gun game setup has a scope on the sniper and an optic on the marksman rifle and crossbow", not gg["bad"], str(gg))
        check("and the setup is different from game to game", gg["varied"] > 20, str(gg["varied"]))
        check("the checks run without errors", not errors, "; ".join(errors[:2]))
        page.close()
    finally:
        server.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)


def test_bot_aim(browser, base):
    """A bot's chance to hit depends on how the target moves across its aim: easy to hit when still or running straight, hard when strafing fast or jumping."""
    server, dbase, tmp = debug_site()
    try:
        page, errors = open_page(browser, dbase + "/index.html", 800, 450)
        page.click("#mode-tabs .tab[data-mode=mp]")
        start_practice(page, mode="dm", bots=1, level="hard")
        page.click("#mp-play-btn")
        step(page, 30)
        res = page.evaluate("""() => {
          const D = window.__dbg, bot = [...D.net.players.values()].find((p) => p.bot), me = D.net.players.get('you');
          D.net.cd = 0; me.protectUntil = 0; bot.protectUntil = 0;
          bot.x = me.x; bot.z = me.z - 15; bot.y = me.y;
          const rate = (lat, vy, n) => {
            let hit = 0;
            for (let i = 0; i < n; i++) {
              me.hp = 100; me.alive = true; me.lastDamageAt = -1e9;
              const ai = bot.ai; ai.gun = 'ar'; ai.ammo = 30; ai.reloadT = 0; ai.burstLeft = 0; ai.fireT = 0; ai.errK = 1;
              ai.tspd = lat; ai.tlat = lat; ai.tvy = vy;
              D.botFire(bot, me, 15, performance.now());
              if (me.hp < 100) hit++;
            }
            return hit / n;
          };
          return { still: rate(0, 0, 700), walk: rate(5, 0, 700), run: rate(10, 0, 700), max: rate(22, 0, 700), jump: rate(22, 7, 700), air: rate(0, 7, 700) };
        }""")
        check("a still target is hit often", res["still"] > 0.3, str(res))
        check("moving across the aim lowers the chance, more the faster it goes", res["still"] > res["walk"] > res["run"] > res["max"], str(res))
        check("flat-out strafing is hit only rarely, but still can be", 0.01 < res["max"] < 0.14 and res["max"] < res["still"] / 3, str(res))
        check("jumping while strafing is harder still, and a jump alone costs accuracy", res["jump"] <= res["max"] + 0.02 and res["air"] < res["still"], str(res))
        check("the bot aim checks run without errors", not errors, "; ".join(errors[:2]))
        page.close()
    finally:
        server.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)


def test_gungame_bot_knife(browser, base):
    """A bot that reaches the gun game's last level takes the knife, runs up and can win the round with it."""
    server, dbase, tmp = debug_site()
    try:
        page, errors = open_page(browser, dbase + "/index.html", 800, 450)
        page.click("#mode-tabs .tab[data-mode=mp]")
        start_practice(page, mode="gungame", bots=1, level="hard")
        page.click("#mp-play-btn")
        step(page, 30)
        held = page.evaluate("""() => {
          const D = window.__dbg, bot = [...D.net.players.values()].find((p) => p.bot), me = D.net.players.get('you');
          D.net.cd = 0; me.protectUntil = 0; bot.protectUntil = 0;
          bot.gg = D.GG_ORDER.length; D.ggBotGun(bot);
          bot.x = me.x; bot.z = me.z - 12; bot.y = me.y;
          return D.WEAPON_ORDER[bot.g];
        }""")
        check("a bot past the last gun holds the knife", held == "knife", held)
        for _ in range(120):
            step(page, 10)
            if page.evaluate("window.__dbg.net.phase") == "results": break
        res = page.evaluate("[window.__dbg.net.phase, window.__dbg.net.players.get('you').alive]")
        check("and it runs up and stabs to win the round", res[0] == "results" and res[1] is False, str(res))
        check("the winning knife kill counts as the 11th gun (11 / 11)", page.evaluate("[...window.__dbg.net.players.values()].find((p) => p.bot).gg") == 11)
        check("the bot knife runs without errors", not errors, "; ".join(errors[:2]))
        page.close()
    finally:
        server.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)


def test_bot_extras(browser, base):
    """Bots sprint while travelling and walk in a fight; practice allows more bots on big maps and in a battle royale; capture the flag respawns stay on your side."""
    server, dbase, tmp = debug_site()
    try:
        page, errors = open_page(browser, dbase + "/index.html", 800, 450)
        # the bot menu: 7 on most maps, 11 on the big ones, 4 more in a battle royale (15 at most)
        page.click("#mode-tabs .tab[data-mode=mp]")
        page.click("#mp-card-practice")
        page.evaluate("document.getElementById('ps-rules').open = true")
        def cap(mode, map_id):
            page.click(f'#ps-modes .ps-card[data-mode="{mode}"]')
            page.click(f'#ps-maps button[data-map="{map_id}"]')
            return page.evaluate("document.getElementById('ps-bots').options.length")
        got = {"dm courtyard": cap("dm", "courtyard"), "dm canyon": cap("dm", "canyon"), "br courtyard": cap("br", "courtyard"), "br canyon": cap("br", "canyon")}
        check("the bot menu holds 7 on a small map, 11 on a big one", got["dm courtyard"] == 7 and got["dm canyon"] == 11, str(got))
        check("a battle royale allows 4 more (15 at most)", got["br courtyard"] == 11 and got["br canyon"] == 15, str(got))
        page.click("#ps-close")
        page.wait_for_timeout(100)
        # sprint: a hard bot sent across the map runs faster than its walking speed (6.6 u/s)
        start_practice(page, mode="dm", map_id="courtyard", bots=1, level="hard")
        page.click("#mp-play-btn")
        step(page, 30)
        page.evaluate("""() => {
          const D = window.__dbg, bot = [...D.net.players.values()].find((p) => p.bot), me = D.net.players.get('you');
          D.net.cd = 0; me.protectUntil = 0; bot.protectUntil = 0;
        }""")
        trail = [page.evaluate("(() => { const b = [...window.__dbg.net.players.values()].find((p) => p.bot); return [b.x, b.z]; })()")]
        for _ in range(80):
            step(page, 3)
            trail.append(page.evaluate("(() => { const b = [...window.__dbg.net.players.values()].find((p) => p.bot); return [b.x, b.z]; })()"))
        # the fastest half second of straight travel (a chord over 10 samples of 48 ms; a launch pad or a respawn is skipped)
        runs = [((trail[i][0] - trail[i - 10][0]) ** 2 + (trail[i][1] - trail[i - 10][1]) ** 2) ** 0.5 / 0.48 for i in range(10, len(trail))]
        top = max([v for v in runs if v < 11.5] or [0])
        seen = [round(v, 1) for v in sorted(runs)[-5:]]
        check("a hard bot travelling faster than its 6.6 u/s walk (it sprints)", top > 7.5, f"{top:.1f} u/s {sorted(seen)[-6:]}")
        check("but not faster than a sprinting player (about 9 u/s)", top < 9.6, f"{top:.1f} u/s")
        page.evaluate("__unlock()")
        step(page, 5)
        page.click("#mp-leave-btn")
        # capture the flag: a respawn lands on your own side of the map or in the middle band, never nearer their base than the band allows
        start_practice(page, mode="ctf", bots=5, level="easy")
        page.click("#mp-play-btn")
        step(page, 30)
        res = page.evaluate("""() => {
          const D = window.__dbg, out = [];
          D.net.pendingCtf = true; D.net.pendingTeams = true;
          for (const id of Object.keys(D.MAPS)) {
            if (!D.MAPS[id].flags) continue;
            D.net.pendingMap = id; D.hostStartRound();
            const ps = [...D.net.players.values()];
            let bad = 0, n = 0;
            for (let k = 0; k < 30; k++) {
              const p = ps[k % ps.length]; p.alive = false;
              D.hostRespawn(p, false);
              const mine = D.ctfBase(p.team), theirs = D.ctfBase(1 - p.team), band = Math.hypot(mine.x - theirs.x, mine.z - theirs.z) * 0.2;
              const over = Math.hypot(p.x - mine.x, p.z - mine.z) - Math.hypot(p.x - theirs.x, p.z - theirs.z);
              n++; if (over > band + 0.01) bad++;
            }
            out.push({ id, bad, n });
          }
          return out;
        }""")
        for r in res:
            check(f"{r['id']}: capture the flag respawns stay on your side or in the middle", r["bad"] == 0, str(r))
        check("the bot extras run without errors", not errors, "; ".join(errors[:2]))
        page.close()
    finally:
        server.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)


def test_round_rocks(browser, base):
    """A round rock is round: you can stand at the corner of its bounding square, and a shot that skims the corner passes by."""
    server, dbase, tmp = debug_site()
    try:
        page, errors = open_page(browser, dbase + "/index.html", 800, 450)
        res = page.evaluate("""() => {
          const D = window.__dbg;
          D.loadMap("canyon");
          const box = D.wallBoxes.find((b) => b.round && b.round.r > 1.5);
          if (!box) return { none: true };
          const c = box.round, h = c.r, y = (box.min.y + box.max.y) / 2;
          const pos = { x: c.x + h * 0.95, z: c.z + h * 0.95 };
          const before = { x: pos.x, z: pos.z };
          D.resolveWalls(pos, box.min.y, null);
          const moved = Math.hypot(pos.x - before.x, pos.z - before.z);
          // walking straight at the centre is still stopped at the rim
          const p2 = { x: c.x + 0.1, z: c.z };
          D.resolveWalls(p2, box.min.y, { x: c.x + 5, z: c.z });
          const rim = Math.hypot(p2.x - c.x, p2.z - c.z);
          // a shot skimming near the corner of the square (0.9 of the radius off-centre) meets the circle well inside the square
          const ray = new THREE.Ray(new THREE.Vector3(c.x + 4 * h, y, c.z + 0.9 * h), new THREE.Vector3(-1, 0, 0));
          const hit = D.rayHitBox(ray, box, new THREE.Vector3());
          return { moved, rim, h, r: c.r, hitDx: hit ? hit.x - c.x : null, offset: 0.9 * h };
        }""")
        check("a round rock has a round collider", res.get("none") is not True, str(res))
        if not res.get("none"):
            check("standing at the corner of its bounding square is not blocked", res["moved"] < 0.01, f"moved {res['moved']:.2f}")
            check("a shot skimming the corner meets the circle, not the square", res["hitDx"] is not None and res["hitDx"] < res["h"] * 0.6, f"hit {res['hitDx']}")
            check("walking into the middle of it is stopped at the rim (the rock's radius plus yours)", res["rim"] >= res["r"] + 0.3, f"rim {res['rim']:.2f}")
        check("the round rock checks run without errors", not errors, "; ".join(errors[:2]))
        page.close()
    finally:
        server.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)


def test_countdown(browser, base):
    """Every room round starts with a 3-2-1: nobody can shoot until it ends."""
    page, errors = open_page(browser, base + "/index.html", 800, 450)
    page.click("#mode-tabs .tab[data-mode=mp]")
    start_practice(page, mode="dm", bots=1, level="easy")
    page.click("#mp-play-btn")
    step(page, 10)
    check("the round opens with a 3 on the screen", page.inner_text("#run-count").strip() == "3", page.inner_text("#run-count"))
    before = page.inner_text("#ammo-count")
    page.dispatch_event("body > canvas", "mousedown", {"button": 0})
    step(page, 3)
    page.dispatch_event("body > canvas", "mouseup", {"button": 0})
    step(page, 3)
    check("you cannot shoot during the countdown", page.inner_text("#ammo-count") == before, f"{before} -> {page.inner_text('#ammo-count')}")
    step(page, 260)
    check("after it, GO and you can shoot", page.inner_text("#run-count").strip() in ("GO!", ""), page.inner_text("#run-count"))
    page.dispatch_event("body > canvas", "mousedown", {"button": 0})
    step(page, 3)
    page.dispatch_event("body > canvas", "mouseup", {"button": 0})
    step(page, 3)
    check("and the shot goes off", page.inner_text("#ammo-count") != before, f"{before} -> {page.inner_text('#ammo-count')}")
    check("the countdown runs without errors", not errors, "; ".join(errors[:2]))
    page.close()


def test_spawns(browser, base):
    """Team rounds start with each team grouped at its own end of the map (not stacked, not beside an enemy); respawns keep away from enemies and from each other."""
    server, dbase, tmp = debug_site()
    try:
        page, errors = open_page(browser, dbase + "/index.html", 800, 450)
        page.click("#mode-tabs .tab[data-mode=mp]")
        start_practice(page, mode="tdm", bots=5, level="easy")
        page.click("#mp-play-btn")
        step(page, 30)
        res = page.evaluate("""() => {
          const D = window.__dbg, out = [];
          for (const id of Object.keys(D.MAPS)) {
            if (id === "range") continue;
            D.net.pendingMap = id; D.hostStartRound();
            const ps = [...D.net.players.values()];
            let stacked = 0, nearEnemy = 99, mateFar = 0;
            for (const a of ps) for (const b of ps) {
              if (a === b) continue;
              const d = Math.hypot(a.x - b.x, a.z - b.z);
              if (d < 3.5) stacked++;
              if (a.team !== b.team) nearEnemy = Math.min(nearEnemy, d);
            }
            const cen = [0, 1].map((t) => { const m = ps.filter((p) => p.team === t); return [m.reduce((s, p) => s + p.x, 0) / m.length, m.reduce((s, p) => s + p.z, 0) / m.length]; });
            const apart = Math.hypot(cen[0][0] - cen[1][0], cen[0][1] - cen[1][1]);
            // respawns: kill each player in turn and put them back; nobody may land within 10 m of an enemy
            let worst = 99;
            for (let k = 0; k < 12; k++) {
              const p = ps[k % ps.length]; p.alive = false;
              D.hostRespawn(p, false);
              for (const q of ps) if (q !== p && q.team !== p.team && q.alive) worst = Math.min(worst, Math.hypot(p.x - q.x, p.z - q.z));
            }
            out.push({ id, stacked, nearEnemy: Math.round(nearEnemy), apart: Math.round(apart), worst: Math.round(worst), half: D.MAPS[id].half });
          }
          return out;
        }""")
        for r in res:
            check(f"{r['id']}: a team round opens with nobody stacked, the teams apart ({r['apart']} m) and no enemy within 10 m",
                  r["stacked"] == 0 and r["nearEnemy"] >= 10 and r["apart"] >= r["half"] * 0.5, str(r))
            check(f"{r['id']}: respawns land at least 10 m from every enemy", r["worst"] >= 10, str(r["worst"]))
        # capture the flag: each team opens beside its own base, and a flag dropped in mid-air lands on the floor
        ctf = page.evaluate("""() => {
          const D = window.__dbg, out = [];
          D.net.pendingCtf = true; D.net.pendingTeams = true;
          for (const id of Object.keys(D.MAPS)) {
            if (!D.MAPS[id].flags) continue;
            D.net.pendingMap = id; D.hostStartRound();
            const ps = [...D.net.players.values()];
            let nearEnemy = 99, wrong = 0;
            for (const a of ps) {
              const own = D.ctfBase(a.team), other = D.ctfBase(1 - a.team);
              if (Math.hypot(a.x - own.x, a.z - own.z) > Math.hypot(a.x - other.x, a.z - other.z)) wrong++;
              for (const b of ps) if (a.team !== b.team) nearEnemy = Math.min(nearEnemy, Math.hypot(a.x - b.x, a.z - b.z));
            }
            const carrier = ps.find((p) => p.team === 0), f = D.net.flags[1];
            f.s = 1; f.c = carrier.id; carrier.y = 12; carrier.alive = false;
            D.hostCtfTick(0.05);
            out.push({ id, wrong, nearEnemy: Math.round(nearEnemy), dropped: f.s === 2, y: f.y, below: D.surfaceBelow(f.x, 12.4, f.z) });
          }
          D.net.pendingCtf = false; D.net.pendingTeams = false;
          return out;
        }""")
        check("capture the flag is on Courtyard, Foundry, Moonbase, Rooftops and Canyon only", sorted(r["id"] for r in ctf) == ["canyon", "courtyard", "foundry", "moonbase", "rooftops"], ", ".join(r["id"] for r in ctf))
        for r in ctf:
            check(f"{r['id']}: both teams open nearer their own flag, with no enemy within 10 m", r["wrong"] == 0 and r["nearEnemy"] >= 10, str(r))
            check(f"{r['id']}: a flag dropped in mid-air lands on the floor ({r['y']})", r["dropped"] and r["y"] == r["below"] and r["y"] < 11, str(r))
        check("the spawn checks run without errors", not errors, "; ".join(errors[:2]))
        page.close()
    finally:
        server.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)


def test_map_speed(browser, base):
    """Ice Lake's speed cap is 25 u/s and its speed bonus goes with it; other maps stay at 22 u/s (x1.875)."""
    server, dbase, tmp = debug_site()
    try:
        page, errors = open_page(browser, dbase + "/index.html")
        got = {}
        for mid in ("arena", "icelake", "arena"):
            got[mid] = page.evaluate("(id) => { window.__dbg.loadMap(id); return [window.__dbg.CFG.maxSpeed, window.__dbg.CFG.speedMultMax]; }", mid)
            step(page, 2)
        check("Ice Lake caps speed at 25 u/s with a bonus up to x2.085", got["icelake"] == [25, 2.085], str(got["icelake"]))
        check("going back to Arena puts the cap back to 22 u/s (x1.875)", got["arena"] == [22, 1.875], str(got["arena"]))
        check("the speed cap runs without errors", not errors, "; ".join(errors[:2]))
        page.close()
    finally:
        server.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)


def test_map_sanity(browser, base):
    """Every map: pads, spawns, flag bases, the hill, ladders, portals and strips stand in the open, and spawns, flags and the hill can be walked to."""
    server, dbase, tmp = debug_site()
    try:
        page, errors = open_page(browser, dbase + "/index.html")
        ids = page.evaluate("Object.keys(window.__dbg.MAPS)")
        check("the debug copy of the game exposes the maps", len(ids) >= 8, f"{len(ids)} maps")
        unmatched = {k: list(v) for k, v in KNOWN_MAP_ISSUES.items()}
        for mid in ids:
            res = page.evaluate(MAP_CHECK_JS, mid)
            step(page, 2)
            known, bad = [], []
            for prob in res["probs"]:
                hit = next((pat for pat in KNOWN_MAP_ISSUES.get(mid, []) if pat in prob), None)
                if hit:
                    known.append(prob)
                    if hit in unmatched.get(mid, []):
                        unmatched[mid].remove(hit)
                else:
                    bad.append(prob)
            detail = "; ".join(bad[:4])
            if known:
                detail += ("; " if detail else "") + "known, waiting on a map fix: " + "; ".join(known)
            if res["notes"]:
                detail += ("; " if detail else "") + "note: " + "; ".join(res["notes"][:3])
            check(f"{mid}: nothing is buried or out of reach", not bad, detail)
        stale = [f"{k}: {p}" for k, v in unmatched.items() for p in v]
        check("every known map problem is still real (remove fixed ones from KNOWN_MAP_ISSUES)", not stale, "; ".join(stale))
        check("the map checks run without errors", not errors, "; ".join(errors[:2]))
        page.close()
    finally:
        server.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)


# the tests, in the order they run; a name is the function name without "test_"
TESTS = [test_game, test_score_attack, test_controls, test_grapple, test_first_visit, test_erase, test_bots, test_crosshair, test_scoring_extras,
         test_access_and_backup, test_map_records, test_play_setup, test_attachments, test_gamepad, test_maps, test_map_sanity, test_map_speed, test_spawns, test_shots_after_death, test_bot_aim, test_bot_extras, test_gungame_bot_knife, test_round_rocks, test_countdown, test_guns, test_crossbow, test_problem_report, test_tutorial, test_sound_lab]
NAMES = {t.__name__[len("test_"):]: t for t in TESTS}
QUICK = ["grapple", "first_visit", "erase", "scoring_extras", "access_and_backup", "map_records", "play_setup", "attachments", "gamepad",
         "map_sanity", "map_speed", "spawns", "shots_after_death", "bot_aim", "bot_extras", "gungame_bot_knife", "round_rocks", "countdown", "guns", "crossbow", "problem_report", "tutorial", "sound_lab"]   # --quick (about 5 minutes): leaves out the long ones (game, bots, Score Attack, controls, crosshair, every map played), which --only can still run
FLAKY = {"bots"}   # a test that sometimes fails once because a hard bot kills the player at the wrong moment: it gets one retry


def run_one(name, browser, base):
    """Run one test and return how many of its checks failed."""
    before = len(results)
    t0 = time.time()
    try:
        NAMES[name](browser, base)
    except Exception:
        check(NAMES[name].__name__ + " ran to the end", False, traceback.format_exc().splitlines()[-1])
    print(f"   [{name}: {time.time() - t0:.0f} s]")
    return before, sum(1 for _, ok, _ in results[before:] if not ok)


def main():
    parser = argparse.ArgumentParser(description="Smoke tests for Trickshot Sandbox.")
    parser.add_argument("--only", help="run just these tests, comma separated (see --list), e.g. --only bots,maps")
    parser.add_argument("--quick", action="store_true", help="run the fast set (for before a push); implies --small")
    parser.add_argument("--browser", choices=["chromium", "firefox", "webkit"], help="the browser engine to test in (default chromium: Edge, Chrome or Playwright's own)")
    parser.add_argument("--small", action="store_true", help="draw the test pages at 800x450 (much faster; same as TSB_VIEW=800x450)")
    parser.add_argument("--list", action="store_true", help="list the tests and exit")
    args = parser.parse_args()
    if args.list:
        for name, t in NAMES.items():
            print(f"{name:20}" + (" [quick] " if name in QUICK else "         ") + ((t.__doc__ or "").strip().splitlines() or [""])[0])
        return
    if args.browser:
        os.environ["TSB_ENGINE"] = args.browser
    if (args.small or args.quick) and not os.environ.get("TSB_VIEW"):
        os.environ["TSB_VIEW"] = "800x450"
    chosen = list(NAMES)
    if args.quick:
        chosen = [n for n in NAMES if n in QUICK]
    if args.only:
        wanted = [w.strip().removeprefix("test_") for w in args.only.split(",") if w.strip()]
        unknown = [w for w in wanted if w not in NAMES]
        if unknown:
            sys.exit("unknown test(s): " + ", ".join(unknown) + " (available: " + ", ".join(NAMES) + ")")
        chosen = [n for n in NAMES if n in wanted]
    os.makedirs(OUT, exist_ok=True)
    server, base = serve()
    t_all = time.time()
    flaked = []
    with sync_playwright() as p:
        browser = launch(p)
        for name in chosen:
            before, bad = run_one(name, browser, base)
            if bad and name in FLAKY:
                first = results[before:]
                del results[before:]
                print(f"   ({name} failed {bad} check(s): running it once more)")
                _, bad2 = run_one(name, browser, base)
                if not bad2:
                    flaked.extend(n for n, ok, _ in first if not ok)
        browser.close()
    server.shutdown()
    failed = [n for n, ok, _ in results if not ok]
    print()
    print(f"{len(results) - len(failed)} passed, {len(failed)} failed in {(time.time() - t_all) / 60:.1f} min")
    if flaked:
        print("failed once, then passed on a retry: " + "; ".join(flaked))
    if failed:
        print("FAILED: " + "; ".join(failed))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
