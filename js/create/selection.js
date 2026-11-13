import { generateComposition } from '../composition/planner.js';
import { prepareScore } from './score.js';

export class CreateSelection {
  constructor(generate = generateComposition) {
    this.generateScore = generate;
    this.current = null;
    this.pending = null;
  }

  generate(options, liveDefaults) {
    const composition = this.generateScore(options);
    const prepared = Object.freeze({ ...prepareScore(composition), composition, liveDefaults });
    this.pending = prepared;
    return prepared;
  }

  select({ resume = false, restart = false } = {}) {
    if ((resume || restart) && this.current) return this.current;
    if (this.pending) {
      this.current = this.pending;
      this.pending = null;
    }
    return this.current;
  }
}
