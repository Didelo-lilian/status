#!/usr/bin/env python3
"""Probe every target and append the results to the history file.

usage: probe.py HISTORY_JSON TARGETS_JSON
Writes `down=true|false` to $GITHUB_OUTPUT when it is set.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

KEEP_SECONDS = 30 * 86400
TIMEOUT = 20
RETRY_DELAY = 10


def probe(url):
    """Return (ok, milliseconds). TLS is verified: an expired certificate counts as down."""
    start = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as response:
            ok = 200 <= response.status < 300
    except (urllib.error.URLError, OSError):
        ok = False
    return ok, round((time.monotonic() - start) * 1000)


def probe_with_retry(url):
    """A failure is confirmed once after a short wait, to ignore a blip."""
    ok, ms = probe(url)
    if ok:
        return ok, ms
    time.sleep(RETRY_DELAY)
    return probe(url)


def record(history, target, ok, ms, now):
    entry = history["targets"].setdefault(target["key"], {"checks": []})
    entry["name"] = target["name"]
    entry["url"] = target["url"]
    entry["checks"].append([now, int(ok), ms])
    entry["checks"] = [c for c in entry["checks"] if c[0] >= now - KEEP_SECONDS]
    history["updated"] = now


def main(history_path, targets_path):
    with open(targets_path) as f:
        targets = json.load(f)
    try:
        with open(history_path) as f:
            history = json.load(f)
    except FileNotFoundError:
        history = {"targets": {}}
    now = int(time.time())
    down = False
    for target in targets:
        ok, ms = probe_with_retry(target["url"])
        record(history, target, ok, ms, now)
        down = down or not ok
        print(f"{'UP  ' if ok else 'DOWN'} {ms:>5} ms  {target['url']}")
    with open(history_path, "w") as f:
        json.dump(history, f, separators=(",", ":"))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f:
            f.write(f"down={'true' if down else 'false'}\n")


if __name__ == "__main__":
    main(*sys.argv[1:3])
