interface Task<T> {
  key: string;
  controller: AbortController;
  users: number;
  started: boolean;
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  run: (signal: AbortSignal) => Promise<T>;
}
const aborted = () => new DOMException('Aborted', 'AbortError');

/** Shared work has its own cancellation signal; an individual consumer cannot cancel others. */
export class VoiceRequestQueue<T> {
  private tasks = new Map<string, Task<T>>();
  private pending: Task<T>[] = [];
  private running = 0;
  constructor(private concurrency = 2) {}

  request(key: string, run: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(aborted());
    let task = this.tasks.get(key);
    if (!task) {
      let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
      const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
      task = { key, controller: new AbortController(), users: 0, started: false, promise, resolve, reject, run };
      this.tasks.set(key, task);
      this.pending.push(task);
    }
    const shared = task;
    shared.users++;
    const result = new Promise<T>((resolve, reject) => {
      let finished = false;
      const release = () => {
        if (finished) return false;
        finished = true;
        signal?.removeEventListener('abort', cancel);
        shared.users--;
        if (shared.users === 0 && this.tasks.get(key) === shared) {
          this.tasks.delete(key);
          shared.controller.abort();
          if (!shared.started) shared.reject(aborted());
        }
        return true;
      };
      const cancel = () => { if (release()) reject(aborted()); };
      signal?.addEventListener('abort', cancel, { once: true });
      shared.promise.then(value => { if (release()) resolve(value); }, error => { if (release()) reject(error); });
    });
    this.pump();
    return result;
  }

  private pump() {
    while (this.running < this.concurrency && this.pending.length) {
      const task = this.pending.shift()!;
      if (task.controller.signal.aborted) continue;
      task.started = true;
      this.running++;
      void task.run(task.controller.signal).then(task.resolve, task.reject).finally(() => {
        this.running--;
        if (this.tasks.get(task.key) === task) this.tasks.delete(task.key);
        this.pump();
      });
    }
  }
}
