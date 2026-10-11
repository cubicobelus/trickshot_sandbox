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
window.__noFullscreen = true;   // fullscreen would resize the test browser
window.__noForceTutorial = true;   // a first visit would otherwise start the tutorial on the first click to play
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


def test_game(browser, base):
    page, errors = open_page(browser, base + "/index.html")
    # before any shooting: nothing to watch yet
    check("replay buttons stay hidden until there's something to watch",
          not page.is_visible("#watch-best") and not page.is_visible("#watch-last"))
    check("three.js loads from lib/", page.evaluate("typeof THREE !== 'undefined' && THREE.REVISION === '128'"))
    guns = page.eval_on_selector_all("#loadout button", "els => els.map(e => e.dataset.gun)")
    check("loadout menu lists five guns", len(guns) == 5, ", ".join(guns))

    for gun in guns:
        page.click(f"#loadout button[data-gun={gun}]")
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
    missing = [k for k in ("PORTAL SHOT", "STRIP SHOT", "PLATFORM SHOT", "ZERO-G", "CHAIN", "NEW", "BONUS TARGET", "SHIELD BREAK", "POP-UP") if k not in text]
    check("the trickshot list includes the portal, strip, platform, zero-g, chain and new-trick bonuses", not missing, ", ".join(missing))
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


def test_play_setup(browser, base):
    """The multiplayer menu: three big choices, a setup window for practice and hosting, and the last choices remembered."""
    page, errors = open_page(browser, base + "/index.html")
    page.click('#mode-tabs .tab[data-mode="mp"]')
    check("the multiplayer menu shows Practice, Host and Join", page.is_visible("#mp-card-practice") and page.is_visible("#mp-card-host") and page.is_visible("#mp-join-btn"))
    page.click("#mp-card-practice")
    page.wait_for_timeout(100)
    modes = page.eval_on_selector_all("#ps-modes .ps-card", "els => els.map(e => e.dataset.mode)")
    check("the practice window lists the modes (no score race: it needs real people)", modes == ["dm", "tdm", "koth", "tkoth", "br", "ctf", "gungame", "range"], ", ".join(modes))
    page.click('#ps-modes .ps-card[data-mode="koth"]')
    active_map = page.evaluate("document.querySelector('#ps-maps button.active').dataset.map")
    off = page.eval_on_selector_all("#ps-maps button.off", "els => els.map(e => e.dataset.map)")
    check("King of the Hill picks the hill map and switches the others off", active_map == "summit" and "arena" in off and "summit" not in off, f"{active_map} / {len(off)} off")
    page.evaluate("document.getElementById('ps-rules').open = true")
    page.select_option("#ps-bots", "4")
    page.select_option("#ps-level", "easy")
    summary = page.inner_text("#ps-rules-sum")
    check("the rules line sums up the choices", "4 bots" in summary and "easy" in summary.lower(), summary)
    page.check("#ps-r-lowgrav")
    page.check("#ps-r-oneshot")
    summary = page.inner_text("#ps-rules-sum")
    check("the match rules show in the rules line", "low gravity" in summary and "one-shot" in summary, summary)
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
    check("the last practice choices are remembered", "Team Deathmatch" in sub and "Foundry" in sub and "4 bots" in sub, sub)
    # the shooting range: practice only, on its own map, with what the gun does in the corner
    page.click("#mp-card-practice")
    page.wait_for_timeout(100)
    check("the practice window offers the shooting range", page.query_selector('#ps-modes .ps-card[data-mode="range"]') is not None)
    page.click('#ps-modes .ps-card[data-mode="range"]')
    rmap = page.evaluate("document.querySelector('#ps-maps button.active').dataset.map")
    check("the range mode plays on the range map", rmap == "range", rmap)
    page.click("#ps-go")
    page.wait_for_timeout(300)
    page.click("#mp-play-btn")
    step(page, 90)
    info = page.evaluate("[!document.getElementById('range-info').hidden, document.getElementById('range-info').textContent]")
    check("the range shows what your gun does", info[0] and "body" in info[1], str(info))
    page.evaluate("__unlock()")
    step(page, 3)
    page.click("#mp-leave-btn")
    page.wait_for_timeout(200)
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
    check("gun game shows your level in the timer", "gun game" in gg_label and "level 1 / 6" in gg_label, gg_label)
    page.evaluate("__unlock()")
    step(page, 3)
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
    check("attachments start locked", locked >= 3, str(locked))
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
    check("attachments run without errors", not errors, "; ".join(errors[:2]))
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
    for _ in range(40):   # Enter skips whatever is left
        if "complete" in page.inner_text("#tut-count").lower():
            break
        page.keyboard.press("Enter")
        step(page, 12)
    check("Enter skips steps through to the end", "complete" in page.inner_text("#tut-count").lower(), page.inner_text("#tut-count"))
    page.evaluate("__unlock()")
    step(page, 5)
    done = page.evaluate("localStorage.getItem('tsb-tutorial')") == "done" and page.inner_text("#tutorial-btn") == "Tutorial"
    check("finishing is remembered and the button goes plain", done, page.inner_text("#tutorial-btn"))
    check("no errors in the tutorial", not errors, "; ".join(errors[:3]))
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
        for test in (test_game, test_score_attack, test_controls, test_grapple, test_first_visit, test_erase, test_bots, test_crosshair, test_scoring_extras, test_access_and_backup, test_play_setup, test_attachments, test_maps, test_tutorial, test_sound_lab):
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
