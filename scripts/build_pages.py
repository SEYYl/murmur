#!/usr/bin/env python3
"""
Build script for Cloudflare Pages deployment.
Copies frontend files to dist/ and injects API base URL from env.

Usage:
    API_BASE_URL=https://api.example.com python scripts/build_pages.py
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(ROOT, "frontend")
DIST_DIR = os.path.join(ROOT, "dist")

API_BASE = os.environ.get("API_BASE_URL", "").rstrip("/")


def main():
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)

    shutil.copytree(FRONTEND_DIR, DIST_DIR)

    index_path = os.path.join(DIST_DIR, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()

    content = content.replace('href="/static/', 'href="/')
    content = content.replace('src="/static/', 'src="/')

    with open(index_path, "w", encoding="utf-8") as f:
        f.write(content)

    config_path = os.path.join(DIST_DIR, "config.js")
    if API_BASE:
        config_content = f"window.__API_BASE__ = '{API_BASE}';\n"
        with open(config_path, "w", encoding="utf-8") as f:
            f.write(config_content)
        print(f"[build] API_BASE_URL set to: {API_BASE}")
    else:
        print("[build] No API_BASE_URL set, using empty string (same-origin)")

    with open(os.path.join(DIST_DIR, "_redirects"), "w", encoding="utf-8") as f:
        f.write("/* /index.html 200\n")

    print(f"[build] Output written to: {DIST_DIR}")
    print("[build] Done ✓")


if __name__ == "__main__":
    main()
