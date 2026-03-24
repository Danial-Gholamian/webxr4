// SlidingTimelineManager.js

export class SlidingTimelineManager {
  constructor(globalStart, globalDuration, initialWindowSize) {
    this.globalStart = globalStart;
    this.maxTime = globalStart + globalDuration;
    

    this.currentStart = globalStart;
    this.windowSize = initialWindowSize;
    this.stepResolution = 1; // Always 1 for now
  }

  shift(direction, amount = this.stepResolution) {
    this.currentStart += (direction * amount);
    

    this.currentStart = Math.max(
      this.globalStart, 
      Math.min(this.currentStart, this.maxTime - this.windowSize)
    );
  }


  setWindowSize(newSize) {
    this.windowSize = Math.max(1, newSize); // Prevent window size of 0
    

    this.currentStart = Math.max(
      this.globalStart, 
      Math.min(this.currentStart, this.maxTime - this.windowSize)
    );
  }


  getCurrentBucket() {
    return {
      id: `window_${this.currentStart.toFixed(2)}_${this.windowSize}`,
      start: this.currentStart,
      end: this.currentStart + this.windowSize
    };
  }
}