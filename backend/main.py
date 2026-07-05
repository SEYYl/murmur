"""Murmur backend — thin app factory.

Creates the FastAPI app, configures CORS/middleware, mounts static files,
registers all API routers, and provides the SPA fallback route.
"""
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.models import MEDIA_DIR, UPLOAD_DIR, init_db
from backend.routers import (
    admin,
    auth,
    categories,
    comments,
    favorites,
    media,
    misc,
    playback,
    playlists,
    posts,
    settings,
    subtitles,
    tags,
)

app = FastAPI(title="ASMR")

# CORS: use explicit origin whitelist instead of "*" + credentials (security: prevent CSRF)
_cors_env = os.getenv("ASMR_CORS_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000")
_cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_cors_origins, allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
                   allow_headers=["Authorization", "Content-Type"],
                   expose_headers=["Content-Length", "Content-Range"])

# ─── No-cache middleware for static assets & HTML ───
@app.middleware("http")
async def no_cache_static(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    # Force no-cache for HTML pages, CSS, JS, and SW
    if (path == "/" or path.endswith(".html") or path.endswith(".css")
            or path.endswith(".js") or path.endswith("/sw.js") or path == "/sw.js"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
for d in ["audio", "video", "covers", "subtitles"]:
    os.makedirs(os.path.join(MEDIA_DIR, d), exist_ok=True)

frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# Register all routers
for r in [media, auth, categories, posts, favorites, playback, comments,
          subtitles, tags, playlists, settings, admin, misc]:
    app.include_router(r.router)


@app.on_event("startup")
def startup():
    init_db()


# ─── Frontend SPA — MUST be registered last (after all routers) ───
@app.get("/{full_path:path}")
def serve(full_path: str):
    ip = os.path.join(frontend_path, "index.html")
    if os.path.exists(ip):
        r = FileResponse(ip)
        r.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return r
    return JSONResponse({"error": "not found"}, 404)
