import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const CGROUP_ROOT = '/sys/fs/cgroup';
const DEFAULT_PERIOD = 100000;

/** Reads a small text file; undefined when it cannot be read. */
export type ReadText = (file: string) => string | undefined;

function readText(file: string): string | undefined {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return undefined;
    }
}

/** A cgroup and each directory above it, up to the root: the limit of any of them applies to the processes in the cgroup. */
function withAncestors(cgroup: string): string[] {
    const segments = cgroup.split('/').filter(segment => segment !== '');
    if (segments.includes('.') || segments.includes('..')) {
        return [];
    }
    const directories: string[] = [];
    for (let length = segments.length; length >= 0; length--) {
        directories.push(segments.slice(0, length).join('/'));
    }
    return directories;
}

/** "cpu.max" of cgroup v2: "max 100000" is no limit, "200000 100000" is a quota of two processors. */
function quotaOfCpuMax(text: string): number | undefined {
    const match = /^\s*(max|\d+)(?:\s+(\d+))?\s*$/.exec(text);
    if (!match || match[1] === 'max') {
        return undefined;
    }
    const period = match[2] === undefined ? DEFAULT_PERIOD : Number(match[2]);
    return period > 0 ? Number(match[1]) / period : undefined;
}

/** "cpu.cfs_quota_us" and "cpu.cfs_period_us" of cgroup v1: a quota of -1 is no limit. */
function quotaOfCfs(quotaText: string, periodText: string | undefined): number | undefined {
    const quota = Number(quotaText);
    const period = Number(periodText);
    return quota > 0 && period > 0 ? quota / period : undefined;
}

/**
 * The CPU quota of the cgroup of this process, in processors (it can be a fraction): a container limit such as `docker run --cpus 2`, a
 * Kubernetes CPU limit or a systemd CPUQuota. When several levels of the hierarchy have a quota, the lowest one is the limit. Undefined
 * when there is no quota or it cannot be read. A container usually sees its own cgroup as the root of the hierarchy.
 */
export function cpuQuota(read: ReadText = readText): number | undefined {
    const listing = read('/proc/self/cgroup');
    if (listing === undefined) {
        return undefined;
    }
    const quotas: number[] = [];
    const add = (quota: number | undefined) => {
        if (quota !== undefined) {
            quotas.push(quota);
        }
    };
    for (const line of listing.split('\n')) {
        const [, controllers, ...rest] = line.split(':');
        const cgroup = rest.join(':');
        if (controllers === '') {
            for (const directory of withAncestors(cgroup)) {
                const text = read(path.posix.join(CGROUP_ROOT, directory, 'cpu.max'));
                if (text !== undefined) {
                    add(quotaOfCpuMax(text));
                }
            }
        } else if (controllers !== undefined && controllers.split(',').includes('cpu')) {
            for (const directory of withAncestors(cgroup)) {
                for (const mount of ['cpu,cpuacct', 'cpu']) {
                    const base = path.posix.join(CGROUP_ROOT, mount, directory);
                    const quota = read(path.posix.join(base, 'cpu.cfs_quota_us'));
                    if (quota !== undefined) {
                        add(quotaOfCfs(quota, read(path.posix.join(base, 'cpu.cfs_period_us'))));
                        break;
                    }
                }
            }
        }
    }
    return quotas.length > 0 ? Math.min(...quotas) : undefined;
}

/**
 * The processors this process can use: those of the machine that it may run on, cut down to the CPU quota of its cgroup, rounded down but
 * at least one. Node.js 20 looks at the first only, so in a container that is limited to two of sixteen processors it reports sixteen.
 */
export function availableProcessors(): number {
    const machine = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
    const quota = process.platform === 'linux' ? cpuQuota() : undefined;
    return Math.max(1, quota === undefined ? machine : Math.min(machine, Math.floor(quota)));
}
