#!/usr/bin/env python3
"""BlackboxAI native-mode runtime listener.

Writes RuntimeEvent JSON lines (see packages/contracts) from two OS sources:
- AT-SPI: focus changes, text inserts, window activation, dialogs.
- XInput2 (`xinput test-xi2 --root`): real pointer button presses.

Each pointer press is resolved to the widget under the pointer with an AT-SPI
hit test, so a press is attributed to what was actually clicked, never to
whatever took focus afterwards.
Typed values are never recorded: text inserts carry value "[redacted]".
Not captured: key presses, native <select> option picks, and the agent's
completion claim (in native runs the verdict reads the claim from the video).
Times are relative to /tmp/atspi-clock-start, touched when recording starts.
Usage: atspi_listener.py <out.jsonl>
"""
import json
import os
import subprocess
import sys
import threading
import time

import pyatspi

OUT = open(sys.argv[1], "w", buffering=1)
CLOCK = "/tmp/atspi-clock-start"
CLICK_WINDOW_S = 0.4
last_press = 0.0
in_dialog = False
lock = threading.Lock()


def now_ms():
    try:
        return int((time.time() - os.path.getmtime(CLOCK)) * 1000)
    except FileNotFoundError:
        return None  # recording has not started; drop the event


def emit(event, window="", role=None, name=None, **extra):
    t = now_ms()
    if t is None or t < 0:
        return
    rec = {"tMs": t, "pid": 0, "window": window, "event": event}
    if role:
        rec["role"] = role
    if name:
        rec["name"] = name
    rec.update(extra)
    with lock:
        OUT.write(json.dumps(rec) + "\n")


def window_of(acc):
    try:
        while acc is not None:
            if acc.getRoleName() == "frame":
                return acc.name
            acc = acc.parent
    except Exception:
        pass
    return ""


def in_document(acc):
    try:
        while acc is not None:
            if acc.getRoleName() == "document web":
                return True
            acc = acc.parent
    except Exception:
        pass
    return False


CLICKABLE = ("push button", "toggle button", "check box", "radio button", "combo box", "link", "menu item", "page tab")


def hit_test(x, y):
    """The deepest accessible at screen point (x, y) in the active window, or None."""
    desktop = pyatspi.Registry.getDesktop(0)
    for app in desktop:
        try:
            for frame in app:
                if not frame.getState().contains(pyatspi.STATE_ACTIVE):
                    continue
                acc = frame
                for _ in range(40):
                    child = acc.queryComponent().getAccessibleAtPoint(x, y, pyatspi.DESKTOP_COORDS)
                    if child is None or child == acc:
                        break
                    acc = child
                # Walk up to the nearest clickable control: a click on a button's label is a click on the button.
                node = acc
                while node is not None and node.getRoleName() not in CLICKABLE:
                    node = node.parent
                return node or acc
        except Exception:
            continue
    return None


def on_press():
    loc = subprocess.run(["xdotool", "getmouselocation", "--shell"], capture_output=True, text=True).stdout
    pos = dict(line.split("=", 1) for line in loc.split() if "=" in line)
    try:
        acc = hit_test(int(pos["X"]), int(pos["Y"]))
    except (KeyError, ValueError):
        return
    if acc is None:
        return
    try:
        role, name, win = acc.getRoleName(), _name(acc), window_of(acc)
    except Exception:
        return
    if win.startswith("Agent console") or not in_document(acc):
        return
    if role == "link":
        emit("link.activate", win, role=role, name=name)
    elif role in CLICKABLE:
        emit("button.press", win, role=role, name=name)


def dialog_ancestor(acc):
    try:
        while acc is not None:
            if acc.getRoleName() in ("dialog", "alert dialog"):
                return acc
            acc = acc.parent
    except Exception:
        pass
    return None


def on_focus(e):
    global in_dialog
    if not e.detail1:
        return
    acc = e.source
    try:
        role, name = acc.getRoleName(), acc.name
    except Exception:
        return
    win = window_of(acc)
    if win.startswith("Agent console"):
        return
    dlg = dialog_ancestor(acc)
    if dlg is not None and not in_dialog:
        emit("dialog.open", win, role="dialog", name=_name(dlg))
    in_dialog = dlg is not None


def _name(acc):
    try:
        if acc.name:
            return acc.name
        for rel in acc.getRelationSet():
            if rel.getRelationType() == pyatspi.RELATION_LABELLED_BY:
                return rel.getTarget(0).name
    except Exception:
        pass
    return ""


typed = {}


def on_text(e):
    acc = e.source
    if window_of(acc).startswith("Agent console"):
        return
    try:
        role = acc.getRoleName()
    except Exception:
        return
    if role not in ("entry", "text", "password text", "spin button"):
        return
    # Only typing into a focused field in the page counts; page loads fill fields
    # without focus, and the address bar is browser chrome, not the application.
    try:
        if not acc.getState().contains(pyatspi.STATE_FOCUSED) or not in_document(acc):
            return
    except Exception:
        return
    win = window_of(acc)
    if win.startswith("Agent console"):
        return
    key = win, _name(acc)
    t = now_ms()
    # Coalesce a burst of keystrokes into one text.insert per field.
    if t is not None and t - typed.get(key, -10_000) < 1500:
        typed[key] = t
        return
    typed[key] = t if t is not None else -10_000
    emit("text.insert", win, role=role, name=_name(acc), value="[redacted]")


def on_window(e):
    try:
        name = e.source.name
    except Exception:
        return
    if name and not name.startswith("Agent console"):
        emit("window.focus", name)


def on_load(e):
    # A finished page load is the window's new title: navigation, as the user sees it.
    try:
        acc = e.source
        if acc.getRoleName() != "document web" or not acc.name:
            return
    except Exception:
        return
    if not acc.name.startswith("Agent console"):
        emit("window.focus", acc.name)


def watch_pointer():
    global last_press
    proc = subprocess.Popen(["xinput", "test-xi2", "--root"], stdout=subprocess.PIPE, text=True)
    for line in proc.stdout:
        if "(RawButtonPress)" in line:
            last_press = time.time()
            on_press()


threading.Thread(target=watch_pointer, daemon=True).start()
pyatspi.Registry.registerEventListener(on_focus, "object:state-changed:focused")
pyatspi.Registry.registerEventListener(on_text, "object:text-changed:insert")
pyatspi.Registry.registerEventListener(on_window, "window:activate")
pyatspi.Registry.registerEventListener(on_load, "document:load-complete")
pyatspi.Registry.start()
