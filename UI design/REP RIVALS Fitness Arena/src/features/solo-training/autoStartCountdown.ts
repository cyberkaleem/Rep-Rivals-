import { COUNTER_CONFIG } from "../computer-vision/pushUpCounter"

const COUNTDOWN_MS = 5000

/** Only a fresh, ready pose frame can advance the countdown to zero. */
export class AutoStartCountdown {
  private deadline = 0
  private previousReadyFrame: number | null = null

  reset() {
    this.previousReadyFrame = null
  }

  update(timestampMs: number, ready: boolean): number | null {
    if (!ready) {
      this.reset()
      return null
    }
    if (
      this.previousReadyFrame === null ||
      timestampMs - this.previousReadyFrame > COUNTER_CONFIG.maxFrameGapMs
    ) {
      this.deadline = timestampMs + COUNTDOWN_MS
    }
    this.previousReadyFrame = timestampMs
    return Math.max(0, Math.ceil((this.deadline - timestampMs) / 1000))
  }
}
