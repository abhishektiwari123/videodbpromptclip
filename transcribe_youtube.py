"""
Script to fetch and save the full transcript of a YouTube video.

Usage:
    python transcribe_youtube.py <youtube_url_or_video_id>

Example:
    python transcribe_youtube.py https://www.youtube.com/live/WTo6F9C7Bxo
    python transcribe_youtube.py WTo6F9C7Bxo

Requirements:
    pip install youtube-transcript-api
"""

import re
import sys
import json

from youtube_transcript_api import YouTubeTranscriptApi


def extract_video_id(url_or_id):
    """Extract video ID from a YouTube URL or return as-is if already an ID."""
    patterns = [
        r'(?:v=|/v/|youtu\.be/|/embed/|/live/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$',
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    return url_or_id


def fetch_transcript(video_id):
    """Fetch transcript for a YouTube video and return full text + timestamped entries."""
    ytt_api = YouTubeTranscriptApi()
    transcript = ytt_api.fetch(video_id)

    entries = []
    full_text_parts = []

    for entry in transcript:
        entries.append({
            "start": entry.start,
            "duration": entry.duration,
            "text": entry.text,
        })
        full_text_parts.append(entry.text)

    full_text = " ".join(full_text_parts)
    return full_text, entries


def main():
    if len(sys.argv) < 2:
        url_or_id = "WTo6F9C7Bxo"
        print(f"No argument provided, using default video ID: {url_or_id}")
    else:
        url_or_id = sys.argv[1]

    video_id = extract_video_id(url_or_id)
    print(f"Fetching transcript for video: {video_id}")

    full_text, entries = fetch_transcript(video_id)

    # Save full text
    text_file = f"transcript_{video_id}.txt"
    with open(text_file, "w") as f:
        f.write(full_text)
    print(f"\nFull transcript saved to: {text_file}")

    # Save timestamped JSON
    json_file = f"transcript_{video_id}.json"
    with open(json_file, "w") as f:
        json.dump(entries, f, indent=2)
    print(f"Timestamped transcript saved to: {json_file}")

    # Print the full transcript
    print("\n" + "=" * 80)
    print("FULL TRANSCRIPT")
    print("=" * 80)
    print(full_text)
    print("=" * 80)
    print(f"\nTotal segments: {len(entries)}")
    if entries:
        total_duration = entries[-1]["start"] + entries[-1]["duration"]
        minutes = int(total_duration // 60)
        seconds = int(total_duration % 60)
        print(f"Video duration: ~{minutes}m {seconds}s")


if __name__ == "__main__":
    main()
