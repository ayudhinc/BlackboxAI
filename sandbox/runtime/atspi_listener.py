#!/usr/bin/env python3
"""BlackboxAI native-mode runtime listener.

Writes RuntimeEvent JSON lines (see packages/contracts) from two OS sources:
- AT-SPI: focus changes, text inserts, window activation, dialogs.
- XInput2 (`xinput test-xi2 --root`): real pointer button presses.

A focus change becomes `button.press` only when a pointer press happened in
the 400 ms before it, so focus moved by a dialog opening is not a press.
Typed values are never recorded: text inserts carry value "[redacted]".
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
    pressed = time.time() - last_press <= CLICK_WINDOW_S
    if not pressed:
        return
    if role in ("push button", "toggle button", "check box", "radio button", "combo box"):
        emit("button.press", win, role=role, name=name)
    elif role == "link":
        emit("link.activate", win, role=role, name=name)


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
    try:
        role = acc.getRoleName()
    except Exception:
        return
    if role not in ("entry", "text", "password text", "spin button"):
        return
    win = window_of(acc)
    if win.startswith("Agent console"):
        return
    key = id(acc), _name(acc)
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


def watch_pointer():
    global last_press
    proc = subprocess.Popen(["xinput", "test-xi2", "--root"], stdout=subprocess.PIPE, text=True)
    for line in proc.stdout:
        if "(ButtonPress)" in line or "(RawButtonPress)" in line:
            last_press = time.time()


threading.Thread(target=watch_pointer, daemon=True).start()
pyatspi.Registry.registerEventListener(on_focus, "object:state-changed:focused")
pyatspi.Registry.registerEventListener(on_text, "object:text-changed:insert")
pyatspi.Registry.registerEventListener(on_window, "window:activate")
pyatspi.Registry.start()
