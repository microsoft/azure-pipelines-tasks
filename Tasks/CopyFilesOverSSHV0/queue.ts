const EventEmitter = require('events');

type QueueOptions = {
  concurrent: number;
  delay: number;
}

export enum QueueEvents {
  END = 'end',
  PROCESSED = 'processed',
  ERROR = 'error',
  EMPTY = 'empty'
}

interface IJob {
  filepath: string;
  job: () => Promise<any>;
}

export default class Queue extends EventEmitter {
  jobs: IJob[] = [];
  concurrent = 10;
  inProcess = 0;
  delay = 50;

  constructor(options: QueueOptions) {
    super();

    this.concurrent = options.concurrent || 10;
    this.delay = options.delay || 50;
  }

  enqueue(jobs) {
    this.jobs.push(...jobs);
    this.start();
  }

  dequeue() {
    return this.jobs.shift();
  }

  get isConcurrentCapacityReached() {
    return this.inProcess >= this.concurrent;
  }

  consume() {
    this.inProcess--;

    if (this.inProcess === 0) {
      this.emit(QueueEvents.EMPTY);
    }
  }

  waitForComplete() {
    if (this.inProcess === 0) {
      this.emit(QueueEvents.END);
    } else {
      setTimeout(() => {
        this.waitForComplete();
      }, this.delay);
    }
  }

  start() {
    if (this.jobs.length === 0) {
      this.waitForComplete();
      return;
    }

    if (this.isConcurrentCapacityReached) {
      setTimeout(() => {
        this.start();
      }, this.delay);
      return;
    }

    const { filepath, job } = this.dequeue();

    if (!job) {
      return;
    }

    this.inProcess++;

    setTimeout(async () => {
      try {
        const result = await job();
        this.emit(QueueEvents.PROCESSED, result);
      } catch (error) {
        this.emit(QueueEvents.ERROR, error, filepath);
      }

      this.consume();
    });

    this.start();
  }
}