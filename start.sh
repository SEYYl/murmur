#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "🚀 ASMR — 启动中..."
mkdir -p media/audio media/video media/covers
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌙 ASMR"
echo "  📍 http://localhost:8000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
