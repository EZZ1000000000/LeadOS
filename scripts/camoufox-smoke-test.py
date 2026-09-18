#!/usr/bin/env python3
"""اختبار إطلاق Camoufox + جلب صفحة للتأكد من عمل المتصفح."""
from camoufox.sync_api import Camoufox

with Camoufox(headless=True, humanize=True) as browser:
    page = browser.new_page()
    page.goto("https://example.com", timeout=60000)
    print("TITLE:", page.title())
    ua = page.evaluate("navigator.userAgent")
    print("UA:", ua[:80])
    print("STEALTH OK")
