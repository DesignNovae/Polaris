import type { ClockSnapshot } from "../synchronization/clocks/types";

/** Distinguish our buffering pause from an explicit user pause. */
export class SigningBuffer {
  waiting = false;
  resumeRequested = false;
  private pauseIssued = false;

  pauseByUser() { this.resumeRequested = false; }

  transport(snapshot: ClockSnapshot) {
    if (!snapshot.playing && this.pauseIssued) { this.pauseIssued = false; return; }
    // While held, the native player is already paused. The explicit 'keep paused'
    // control cancels resume intent; seek/rate/metadata events must not cancel it.
  }

  update(snapshot: ClockSnapshot, available: boolean): "pause" | "play" | null {
    if (snapshot.lost) { this.resumeRequested = false; return null; }
    if (!available) {
      this.waiting = true;
      if (snapshot.playing && !this.pauseIssued) {
        this.resumeRequested = true;
        this.pauseIssued = true;
        return "pause";
      }
      return null;
    }
    if (this.waiting) {
      this.waiting = false;
      this.pauseIssued = false;
      if (this.resumeRequested) { this.resumeRequested = false; return "play"; }
    }
    return null;
  }
}
