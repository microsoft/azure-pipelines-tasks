import * as assert from 'assert';
import * as os from 'os';
import { availableProcessors, cpuQuota } from '../../DownloadEngine/util/processors';

function filesOf(contents: Record<string, string>): (file: string) => string | undefined {
    return file => contents[file];
}

describe('processors', () => {
    describe('cpuQuota', () => {
        it('finds no quota when the cgroup of the process cannot be read', () => {
            assert.strictEqual(cpuQuota(filesOf({})), undefined);
        });

        it('reads the quota of a cgroup v2 container, which sees its own cgroup as the root', () => {
            const read = filesOf({ '/proc/self/cgroup': '0::/\n', '/sys/fs/cgroup/cpu.max': '200000 100000\n' });
            assert.strictEqual(cpuQuota(read), 2);
        });

        it('keeps a fraction of a processor, divides by the period of the file and assumes 100000 when it has none', () => {
            assert.strictEqual(cpuQuota(filesOf({ '/proc/self/cgroup': '0::/\n', '/sys/fs/cgroup/cpu.max': '150000 100000\n' })), 1.5);
            assert.strictEqual(cpuQuota(filesOf({ '/proc/self/cgroup': '0::/\n', '/sys/fs/cgroup/cpu.max': '50000 25000\n' })), 2);
            assert.strictEqual(cpuQuota(filesOf({ '/proc/self/cgroup': '0::/\n', '/sys/fs/cgroup/cpu.max': '300000\n' })), 3);
        });

        it('takes "max" for no limit and ignores a file that cannot be understood', () => {
            assert.strictEqual(cpuQuota(filesOf({ '/proc/self/cgroup': '0::/\n', '/sys/fs/cgroup/cpu.max': 'max 100000\n' })), undefined);
            assert.strictEqual(cpuQuota(filesOf({ '/proc/self/cgroup': '0::/\n', '/sys/fs/cgroup/cpu.max': 'unlimited\n' })), undefined);
            assert.strictEqual(cpuQuota(filesOf({ '/proc/self/cgroup': '0::/\n', '/sys/fs/cgroup/cpu.max': '100000 0\n' })), undefined);
        });

        it('applies the lowest quota on the way up from the cgroup of the process to the root', () => {
            const read = filesOf({
                '/proc/self/cgroup': '0::/kubepods/pod1/container1\n',
                '/sys/fs/cgroup/kubepods/pod1/container1/cpu.max': '400000 100000\n',
                '/sys/fs/cgroup/kubepods/pod1/cpu.max': '200000 100000\n',
                '/sys/fs/cgroup/kubepods/cpu.max': 'max 100000\n'
            });
            assert.strictEqual(cpuQuota(read), 2);
        });

        it('skips a level that has no cpu.max, as one does where the cpu controller is off', () => {
            const read = filesOf({
                '/proc/self/cgroup': '0::/user.slice/session.scope\n',
                '/sys/fs/cgroup/user.slice/cpu.max': '100000 100000\n'
            });
            assert.strictEqual(cpuQuota(read), 1);
        });

        it('does not read outside the cgroup tree for a path that leaves it', () => {
            const read = filesOf({ '/proc/self/cgroup': '0::/../x\n', '/sys/fs/cgroup/cpu.max': '100000 100000\n', '/sys/fs/cgroup/x/cpu.max': '100000 100000\n' });
            assert.strictEqual(cpuQuota(read), undefined);
        });

        it('reads the quota of a cgroup v1 where the cpu controller is mounted together with cpuacct', () => {
            const read = filesOf({
                '/proc/self/cgroup': '12:memory:/docker/abc\n4:cpu,cpuacct:/docker/abc\n1:name=systemd:/docker/abc\n',
                '/sys/fs/cgroup/cpu,cpuacct/docker/abc/cpu.cfs_quota_us': '200000\n',
                '/sys/fs/cgroup/cpu,cpuacct/docker/abc/cpu.cfs_period_us': '100000\n'
            });
            assert.strictEqual(cpuQuota(read), 2);
        });

        it('reads the quota of a cgroup v1 where the cpu controller is mounted alone', () => {
            const read = filesOf({
                '/proc/self/cgroup': '3:cpu:/a/b\n',
                '/sys/fs/cgroup/cpu/a/b/cpu.cfs_quota_us': '50000\n',
                '/sys/fs/cgroup/cpu/a/b/cpu.cfs_period_us': '100000\n'
            });
            assert.strictEqual(cpuQuota(read), 0.5);
        });

        it('finds the quota of a cgroup v1 container that sees only its own cgroup, at the root of the controller', () => {
            const read = filesOf({
                '/proc/self/cgroup': '4:cpu,cpuacct:/docker/abc\n',
                '/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_quota_us': '300000\n',
                '/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_period_us': '100000\n'
            });
            assert.strictEqual(cpuQuota(read), 3);
        });

        it('takes a quota of -1 and a missing period of cgroup v1 for no limit', () => {
            assert.strictEqual(cpuQuota(filesOf({ '/proc/self/cgroup': '4:cpu,cpuacct:/a\n', '/sys/fs/cgroup/cpu,cpuacct/a/cpu.cfs_quota_us': '-1\n', '/sys/fs/cgroup/cpu,cpuacct/a/cpu.cfs_period_us': '100000\n' })), undefined);
            assert.strictEqual(cpuQuota(filesOf({ '/proc/self/cgroup': '4:cpu,cpuacct:/a\n', '/sys/fs/cgroup/cpu,cpuacct/a/cpu.cfs_quota_us': '200000\n' })), undefined);
        });

        it('finds the quota on a host with both hierarchies, where the cpu controller is on cgroup v1', () => {
            const read = filesOf({
                '/proc/self/cgroup': '4:cpu,cpuacct:/system.slice/agent.service\n0::/system.slice/agent.service\n',
                '/sys/fs/cgroup/cpu,cpuacct/system.slice/agent.service/cpu.cfs_quota_us': '100000\n',
                '/sys/fs/cgroup/cpu,cpuacct/system.slice/agent.service/cpu.cfs_period_us': '100000\n'
            });
            assert.strictEqual(cpuQuota(read), 1);
        });
    });

    describe('availableProcessors', () => {
        it('reports at least one processor and never more than the machine has or the quota of the cgroup allows', () => {
            const processors = availableProcessors();
            assert.ok(processors >= 1 && processors <= os.cpus().length, `${processors} processors`);
            const quota = process.platform === 'linux' ? cpuQuota() : undefined;
            if (quota !== undefined) {
                assert.ok(processors <= Math.max(1, Math.floor(quota)), `${processors} processors with a quota of ${quota}`);
            }
        });
    });
});
