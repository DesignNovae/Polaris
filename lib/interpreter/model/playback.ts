/** The source clock owns transport. Never stretch a whole signing track to fit. */
export function signingPlayback(input: {
  mediaTime: number; offset: number; duration: number; videoTime: number;
  rate: number; playing: boolean; lost: boolean;
}) {
  const rawTarget = input.mediaTime + input.offset;
  const target = input.lost ? input.videoTime : Math.max(0, Math.min(input.duration, rawTarget));
  const playing = input.playing && !input.lost && rawTarget >= 0 && rawTarget < input.duration;
  const drift = input.videoTime - target;
  const seek = Math.abs(drift) > (playing ? 0.25 : 0.04);
  const trim = playing && !seek && Math.abs(drift) > 0.08 ? (drift > 0 ? -0.04 : 0.04) : 0;
  return { target, playing, seek, rate: Math.max(0.25, Math.min(4, input.rate + trim)) };
}
