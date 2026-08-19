/**
 * What the interpreter knows about the media currently on screen.
 *
 * Providers need different facts about the same lesson - the caption provider
 * needs the YouTube id, the outline provider needs the title and topic - and
 * neither should reach into a React component to get them. The surface registers
 * the lesson once when it becomes active; providers read from here.
 */

export type MediaDescriptor = {
  /** Stable interpreter-side id. Matches the key used by companion tracks. */
  mediaId: string;
  /** YouTube video id, when the media is a YouTube embed. */
  videoId?: string;
  title: string;
  topic: string;
  exam: string;
  source: string;
  /** Duration in seconds when known. */
  duration?: number;
};

const registry = new Map<string, MediaDescriptor>();

export function describeMedia(descriptor: MediaDescriptor): void {
  registry.set(descriptor.mediaId, descriptor);
}

export function getMedia(mediaId: string): MediaDescriptor | undefined {
  return registry.get(mediaId);
}

export function forgetMedia(mediaId: string): void {
  registry.delete(mediaId);
}
