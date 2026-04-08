// SlidingTimelineManager.js

export class SlidingTimelineManager {
  constructor(globalStart, globalDuration) {
    this.globalDuration = globalDuration
    this.globalStart = globalStart;
    this.maxTime = globalStart + globalDuration;

    // We start at the beginning
    this.currentStart = globalStart;
    this.initialWindowSize = 500;
    this.windowSize = this.initialWindowSize;
    this.stepResolution = 1; // Always 1 for now
  }

  shift(direction, amount = this.stepResolution) {
    this.currentStart = Math.round(this.currentStart + (direction * amount));

    // Clamp to boundaries so we don't scroll past the end or before the beginning
    this.currentStart = Math.max(
      this.globalStart,
      Math.min(this.currentStart, this.maxTime - this.windowSize)
    );
    console.log(`start:${this.currentStart}, end: ${this.currentStart + this.windowSize}`)
  }


  setWindowSize(newSize) {
    // Clamp window size to global duration
    this.windowSize = Math.max(
      1,
      Math.min(newSize, this.globalDuration)
    );    // Re-clamp in case expanding the window pushes it past maxTime
    this.currentStart = Math.max(
      this.globalStart,
      Math.round(
        Math.min(this.currentStart, this.maxTime - this.windowSize)
      )
    );
  }


  getCurrentBucket() {
    const start = Math.round(this.currentStart);
    const end = Math.min(
      this.maxTime,
      Math.round(start + this.windowSize)
    );

    return {
      id: `window_${start}_${end}`,
      start,
      end
    };
  }

  reset() {
    this.currentStart = this.globalStart
    this.windowSize = this.initialWindowSize
  }

}