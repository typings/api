import events = require('events')

declare class Batch <T> extends events.EventEmitter {
  
  concurrency (count: number): void;
  push (fn: (done: (err: Error, result: T) => any) => any): void;
  end (cb: (err: Error, results: T[]) => any): void;
  
}

export = Batch;