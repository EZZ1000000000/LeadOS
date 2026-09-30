#!/usr/bin/env python3
"""Ads Library anonymous-access probe with real Chromium (same stack as Actions worker)."""
import time, sys
from playwright.sync_api import sync_playwright

URL = ("https://www.facebook.com/ads/library/?active_status=active&ad_type=all"
       "&country=EG&q=apartments&media_type=all")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, args=[
        "--no-sandbox", "--disable-blink-features=AutomationControlled"])
    ctx = b.new_context(user_agent=UA, locale="en-US",
                        viewport={"width": 1366, "height": 900})
    page = ctx.new_page()
    t0 = time.time()
    try:
        page.goto(URL, wait_until="domcontentloaded", timeout=45_000)
        time.sleep(8)  # let the React app fetch ads
        html = page.content()
        title = page.title()
        print(f"loaded in {time.time()-t0:.0f}s | title: {title[:70]}")
        print(f"html size: {len(html)}")
        for marker in ["ad_archive_id", "Ads Library", "results", "checkpoint",
                       "login", "Log in", "captcha", "undefined"]:
            print(f"  contains {marker!r}: {marker in html}")
        # count ad cards heuristically
        n = html.count("ad_archive_id")
        print(f"ad_archive_id occurrences: {n}")
        if n:
            print("VERDICT: ADS_LIBRARY_SCRAPEABLE_ANONYMOUS ✅")
        elif "checkpoint" in html.lower() or "captcha" in html.lower():
            print("VERDICT: BLOCKED_CHECKPOINT ❌")
        else:
            print("VERDICT: UNCLEAR (needs JS/wait or different IP)")
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        b.close()
