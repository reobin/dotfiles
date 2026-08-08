#!/usr/bin/env python3
"""Report meaningful CAD/COP rate changes using a public mid-market proxy."""

import json
import os
import re
import sys
import urllib.request
from datetime import datetime
from pathlib import Path
from statistics import mean

HERMES_HOME = Path(os.environ.get("HERMES_HOME", "~/.hermes")).expanduser()
STATE_FILE = HERMES_HOME / "scripts" / ".cad-cop-timing-state.json"
HISTORY_DAYS = 30
MIN_HISTORY = 7
WISE_URL = "https://wise.com/ca/currency-converter/cad-to-cop-rate"
FALLBACK_URL = "https://open.er-api.com/v6/latest/CAD"


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "hermes-cad-cop-monitor/1.0"})
    with urllib.request.urlopen(request, timeout=15) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_rate():
    try:
        html = fetch(WISE_URL)
        match = re.search(r"1\s*CAD\s*=\s*([\d,]+(?:\.\d+)?)\s*COP", html, re.IGNORECASE)
        if match:
            return float(match.group(1).replace(",", "")), "Wise"
    except (OSError, ValueError):
        pass

    try:
        payload = json.loads(fetch(FALLBACK_URL))
        rate = float(payload["rates"]["COP"])
        return rate, "ExchangeRate.host"
    except (KeyError, OSError, TypeError, ValueError, json.JSONDecodeError):
        return None, None


def load_history():
    try:
        with STATE_FILE.open() as state_file:
            payload = json.load(state_file)
        return payload.get("history", [])
    except (FileNotFoundError, OSError, json.JSONDecodeError, AttributeError):
        return []


def save_history(history):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = STATE_FILE.with_suffix(".tmp")
    with temporary.open("w") as state_file:
        json.dump({"history": history}, state_file)
    temporary.replace(STATE_FILE)


def percentile(values, fraction):
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def main():
    rate, source = fetch_rate()
    if rate is None:
        print("[WARN] cad-cop-timing: rate source unavailable")
        return 1

    today = datetime.now().astimezone().date().isoformat()
    history = [entry for entry in load_history() if entry.get("date") != today]
    past_rates = [float(entry["rate"]) for entry in history if "rate" in entry]
    history.append({"date": today, "rate": rate})
    history = sorted(history, key=lambda entry: entry["date"])[-(HISTORY_DAYS + 1):]
    save_history(history)

    if len(past_rates) < MIN_HISTORY:
        print("[SILENT]")
        return 0

    average = mean(past_rates)
    change = ((rate - average) / average) * 100
    top_quartile = rate >= percentile(past_rates, 0.75)
    bottom_quartile = rate <= percentile(past_rates, 0.25)
    if not (top_quartile or bottom_quartile or abs(change) > 1):
        print("[SILENT]")
        return 0

    if top_quartile:
        verdict = "good time to send"
    elif bottom_quartile:
        verdict = "skip - bad time to send"
    elif change > 0:
        verdict = "rate moved up"
    else:
        verdict = "rate moved down"

    print(f"[CAD-COP] {today} - {verdict}")
    print(f"- 1 CAD = {rate:,.0f} COP ({source})")
    print(f"- 30-day average: {average:,.0f} ({change:+.1f}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
