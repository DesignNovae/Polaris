"use client";

import { useEffect, useState } from "react";
import { MediaElementClockSource } from "@/lib/interpreter/synchronization/clocks/MediaElementClockSource";
import type { PlaybackClockSource } from "@/lib/interpreter/synchronization/clocks/types";

export function ImportedLessonPlayer({ url, title, onSource }: {
  url: string; title: string; onSource: (source: PlaybackClockSource | null) => void;
}) {
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!element) return;
    const source = new MediaElementClockSource(element);
    onSource(source);
    return () => { source.destroy(); onSource(null); };
  }, [element, onSource]);
  return <div className="bg-[#18201e]">
    <video ref={setElement} src={url} controls playsInline preload="metadata" aria-label={title}
      className="aspect-video w-full object-contain" onError={() => setError(true)} />
    {error && <p role="alert" className="p-4 text-sm text-white">This browser cannot play the file. Import an MP4 video or an MP3/WAV audio file.</p>}
  </div>;
}
