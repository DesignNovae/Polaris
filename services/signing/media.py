"""Bounded media decoding and timestamped local speech recognition."""
import math
from pathlib import Path
import re
import subprocess

from config import CACHE

CHUNK_SECONDS = 8.0
MAX_SECONDS = 7200
MAX_UPLOAD = 100 * 1024 * 1024
YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def chunk_index(seconds, duration):
    if not math.isfinite(seconds) or seconds < 0:
        raise ValueError("Invalid playback position")
    return min(int(seconds // CHUNK_SECONDS), max(0, math.ceil(duration / CHUNK_SECONDS) - 1))


def audio_duration(path):
    import av
    try:
        with av.open(str(path)) as container:
            streams = container.streams.audio
            if not streams:
                raise ValueError("This file has no audio track")
            duration = float(container.duration / av.time_base) if container.duration else 0
            if not duration and streams[0].duration:
                duration = float(streams[0].duration * streams[0].time_base)
    except Exception as error:
        raise ValueError("This media file could not be decoded or has no audio") from error
    if not 0 < duration <= MAX_SECONDS:
        raise ValueError("Choose media between 1 second and 2 hours long")
    return duration


def download_youtube(video_id, directory):
    if not YOUTUBE_ID.fullmatch(video_id):
        raise ValueError("Invalid YouTube video ID")
    import yt_dlp
    import imageio_ffmpeg
    # Only public YouTube content. No cookies, private URLs, or arbitrary fetches.
    options = {
        "format": "bestaudio/best", "noplaylist": True, "quiet": True,
        "no_warnings": True, "noprogress": True, "socket_timeout": 25, "retries": 1,
        "max_filesize": MAX_UPLOAD, "outtmpl": str(directory / "source.%(ext)s"),
        "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(),
        "match_filter": lambda info, **_: "Video exceeds 2 hours" if (info.get("duration") or 0) > MAX_SECONDS else None,
    }
    try:
        with yt_dlp.YoutubeDL(options) as downloader:
            info = downloader.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
            path = Path(downloader.prepare_filename(info))
        if not path.is_file() or path.stat().st_size > MAX_UPLOAD:
            raise ValueError("Media exceeds the 100 MB limit")
        return path
    except Exception as error:
        raise ValueError("YouTube did not provide accessible audio. Import the original video or audio file instead.") from error


def words_in_window(words, start, end):
    """Use midpoints so overlap context never duplicates a word across chunks."""
    return " ".join(word[2].strip() for word in words if start <= (word[0] + word[1]) / 2 < end).strip()


class Transcriber:
    def __init__(self):
        self.model = None

    def transcribe(self, path, index, duration):
        import imageio_ffmpeg
        import numpy as np
        from faster_whisper import WhisperModel
        start = index * CHUNK_SECONDS
        end = min(duration, start + CHUNK_SECONDS)
        context_start = max(0, start - 1)
        command = [imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-v", "error", "-ss", str(context_start),
                   "-i", str(path), "-t", str(min(duration, end + 1) - context_start),
                   "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"]
        result = subprocess.run(command, capture_output=True, timeout=45, check=True,
                                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        audio = np.frombuffer(result.stdout, dtype="<f4")
        if not audio.size:
            raise ValueError("The requested section contains no decodable audio")
        if self.model is None:
            self.model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4,
                                      download_root=str(CACHE / "whisper"))
        segments, info = self.model.transcribe(audio, beam_size=3, word_timestamps=True, vad_filter=True,
                                              condition_on_previous_text=False)
        words = [(word.start + context_start, word.end + context_start, word.word)
                 for segment in segments for word in (segment.words or [])]
        # The deployed SignSparK checkpoint has not been validated for arbitrary spoken languages.
        if words and info.language != "en" and info.language_probability > .7:
            raise ValueError("Live ASL currently supports English audio. This recording was detected as another language.")
        return words_in_window(words, start, end), start, end
