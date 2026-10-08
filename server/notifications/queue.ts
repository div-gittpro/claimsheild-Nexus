/**
 * Minimal in-process job queue mirroring BullMQ semantics (Section 17-19).
 *
 * Jobs are processed asynchronously off the request path so the claim/anomaly
 * pipeline never blocks on WhatsApp. Transient failures are retried with
 * exponential backoff; permanent failures are routed to a dead-letter list.
 */

export interface QueueJob<T> {
  id: string;
  payload: T;
  attempts: number;
  enqueuedAt: number;
}

export type JobProcessor<T> = (job: QueueJob<T>) => Promise<void>;

/** Backoff schedule in ms: attempt 1 -> 5s, attempt 2 -> 30s, attempt 3 -> 5m. */
export const BACKOFF_SCHEDULE_MS = [5_000, 30_000, 300_000];
export const MAX_ATTEMPTS = BACKOFF_SCHEDULE_MS.length;

export class InProcessQueue<T> {
  private processor: JobProcessor<T> | null = null;
  private deadLetter: QueueJob<T>[] = [];
  private processed = 0;
  /** In tests/demo we can shrink backoff so retries are observable quickly. */
  private backoffScale: number;

  constructor(private readonly name: string, backoffScale = 1) {
    this.backoffScale = backoffScale;
  }

  setProcessor(fn: JobProcessor<T>): void {
    this.processor = fn;
  }

  enqueue(payload: T, idPrefix = 'job'): QueueJob<T> {
    const job: QueueJob<T> = {
      id: `${idPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      payload,
      attempts: 0,
      enqueuedAt: Date.now(),
    };
    // Fire-and-forget: schedule processing on the next tick.
    setImmediate(() => this.run(job));
    return job;
  }

  private async run(job: QueueJob<T>): Promise<void> {
    if (!this.processor) {
      // eslint-disable-next-line no-console
      console.warn(`[queue:${this.name}] no processor registered; dropping job ${job.id}`);
      return;
    }
    job.attempts += 1;
    try {
      await this.processor(job);
      this.processed += 1;
    } catch (err: any) {
      if (job.attempts >= MAX_ATTEMPTS) {
        this.deadLetter.push(job);
        // eslint-disable-next-line no-console
        console.error(`[queue:${this.name}] job ${job.id} dead-lettered after ${job.attempts} attempts: ${err?.message}`);
        return;
      }
      const delay = Math.round((BACKOFF_SCHEDULE_MS[job.attempts - 1] || 300_000) * this.backoffScale);
      // eslint-disable-next-line no-console
      console.warn(`[queue:${this.name}] job ${job.id} attempt ${job.attempts} failed (${err?.message}); retrying in ${delay}ms`);
      setTimeout(() => this.run(job), delay);
    }
  }

  stats() {
    return { name: this.name, processed: this.processed, deadLettered: this.deadLetter.length };
  }

  listDeadLetter(): QueueJob<T>[] {
    return [...this.deadLetter];
  }
}
