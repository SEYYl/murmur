"""Media serving endpoints — stream audio/video/covers/subtitles with Range support."""
from fastapi import APIRouter, Depends, Request

from backend.auth import get_current_user
from backend.models import User
from backend.utils import _serve_media

router = APIRouter()


@router.get("/media/audio/{filename}")
async def serve_audio(filename: str, request: Request):
    return _serve_media(f"audio/{filename}", request, "audio/mpeg")


@router.get("/media/video/{filename}")
async def serve_video(filename: str, request: Request, user: User = Depends(get_current_user)):
    return _serve_media(f"video/{filename}", request, "video/mp4")


@router.get("/media/covers/{filename}")
async def serve_cover(filename: str, request: Request):
    return _serve_media(f"covers/{filename}", request, "image/jpeg")


@router.get("/media/subtitles/{filename}")
async def serve_subtitle(filename: str, request: Request):
    return _serve_media(f"subtitles/{filename}", request, "text/vtt")
