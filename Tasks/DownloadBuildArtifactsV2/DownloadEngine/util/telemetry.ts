/**
 * What a download reports about itself: counts and sizes, never names, paths, URLs or messages. The task sends them as one
 * event when it ends. A process runs one task, so everything in the process shares these counters.
 */
export class Telemetry {
    private readonly counters = new Map<string, number>();

    add(name: string, amount: number = 1): void {
        this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
    }

    set(name: string, value: number): void {
        this.counters.set(name, value);
    }

    snapshot(): Record<string, number> {
        return Object.fromEntries(this.counters);
    }

    reset(): void {
        this.counters.clear();
    }
}

export const telemetry = new Telemetry();
