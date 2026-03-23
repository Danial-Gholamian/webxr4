// SlidingTimelineManager.js

export class SlidingTimelineManager {
  constructor(globalStart, globalDuration, initialWindowSize) {
    this.globalStart = globalStart;
    this.maxTime = globalStart + globalDuration;
    
    // We start at the beginning
    this.currentStart = globalStart;
    this.windowSize = initialWindowSize;
    this.stepResolution = 1; // Always 1 for now
  }

  // Move forward or backward
  shift(direction, amount = this.stepResolution) {
    this.currentStart += (direction * amount);
    
    // Clamp to boundaries so we don't scroll past the end or before the beginning
    this.currentStart = Math.max(
      this.globalStart, 
      Math.min(this.currentStart, this.maxTime - this.windowSize)
    );
  }

  // Change window size via the Panel
  setWindowSize(newSize) {
    this.windowSize = Math.max(1, newSize); // Prevent window size of 0
    
    // Re-clamp in case expanding the window pushes it past maxTime
    this.currentStart = Math.max(
      this.globalStart, 
      Math.min(this.currentStart, this.maxTime - this.windowSize)
    );
  }

  // Generates the bucket format your GraphVisualController expects
  getCurrentBucket() {
    return {
      id: `window_${this.currentStart.toFixed(2)}_${this.windowSize}`,
      start: this.currentStart,
      end: this.currentStart + this.windowSize
    };
  }
}