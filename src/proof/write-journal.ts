import type { ProofRecord } from "../types";

export type ProofPersist = (records: ProofRecord[]) => Promise<void>;

function cloneRecords(records: ProofRecord[]): ProofRecord[] {
  return records.map((record) => ({
    ...record,
    before: { ...record.before },
    after: record.after ? { ...record.after } : undefined,
    provenance: [...record.provenance],
  }));
}

export class ProofWriteJournal {
  private queue: Promise<void> = Promise.resolve();
  private generation = 0;
  private persistedGeneration = 0;
  private paused = false;

  isFullyPersisted(): boolean {
    return this.persistedGeneration === this.generation;
  }

  resetPersisted(): void {
    this.generation = 0;
    this.persistedGeneration = 0;
    this.paused = false;
    this.queue = Promise.resolve();
  }

  invalidate(): void {
    this.generation += 1;
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  schedule(
    records: ProofRecord[],
    persist: ProofPersist,
    onLatestPersisted: () => void,
    onLatestFailure: (error: unknown) => void,
  ): void {
    if (this.paused) return;
    const generation = ++this.generation;
    const snapshot = cloneRecords(records);

    this.queue = this.queue
      .then(async () => {
        if (this.paused) return;
        await persist(snapshot);
        this.persistedGeneration = Math.max(this.persistedGeneration, generation);
        if (generation === this.generation) onLatestPersisted();
      })
      .catch((error) => {
        if (generation === this.generation && !this.paused) onLatestFailure(error);
      });
  }

  async drain(): Promise<void> {
    await this.queue;
  }
}
