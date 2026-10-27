import assert = require('assert');
import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import internal = require('azure-pipelines-task-lib/internal');

// Verifies how HelmDeployV1 builds its Helm command-line argv.
//
// The task stores every argument it is given - structured single-token
// values (release name, chart path, values-file path, namespace, version)
// and the task's own free-form "arguments" input alike - and hands each one
// to ToolRunner. Structured values must always reach Helm as exactly one
// argv element, even when they contain whitespace or characters that look
// like additional Helm options; only the documented free-form "arguments"
// input is meant to expand into multiple flags.
//
// The existing L0 suite's mock-exec table is keyed by a JOINED command-line
// string built via the same plain string concatenation the task itself used
// to do - it cannot distinguish an argv array of N elements from one of N-1
// elements whose joined string form happens to look identical. These tests
// assert on the REAL argv array ToolRunner hands to child_process.spawn()
// instead, by driving the actual production addArguments() functions and
// intercepting ToolRunner.execSync() before it would spawn anything.
describe('HelmDeployV1 Helm command-line argument construction', function () {
    this.timeout(10000);

    const helmcliPath = path.join(__dirname, '../src/helmcli.js');
    const commonCommandOptionsPath = path.join(__dirname, '../src/commoncommandoption.js');
    const helmupgradePath = path.join(__dirname, '../src/helmcommands/helmupgrade.js');

    const HelmCli = require(helmcliPath).default;
    const commonCommandOptions = require(commonCommandOptionsPath);
    const helmupgrade = require(helmupgradePath);

    // basecommand's constructor resolves the Helm binary via
    // tl.which('helm', true), which is task.js's `exports.which = im._which`
    // - a value copy of internal.js's _which captured at module-load time.
    // ToolRunner's OWN constructor then independently re-resolves the tool
    // path by calling internal.js's _which directly (not through tl.which),
    // so both the public tl.which and the internal _which must be stubbed;
    // patching only tl.which leaves ToolRunner's own re-verification
    // unaffected. These tests only inspect the constructed argv and never
    // actually spawn Helm, so stub both lookups rather than require a real
    // Helm binary on the test machine.
    const originalWhich = tl.which;
    const originalInternalWhich = internal._which;

    // task-lib's tl.getInput()/getBoolInput() read from a one-time internal
    // "vault" that is snapshotted from INPUT_* environment variables the
    // first time azure-pipelines-task-lib/task is loaded in this process,
    // then deletes those env vars (internal.js _loadData()). Since mocha
    // runs every suite in one process, setting process.env.INPUT_X per test
    // has no effect after that first snapshot. Stub getInput/getBoolInput
    // directly instead, matching their documented required/boolean
    // semantics exactly; tl.getVariable() is unaffected (it reads
    // process.env live for non-secret variables) and is used as-is for
    // BUILD_BUILDNUMBER/SYSTEM_HOSTTYPE/System.DefaultWorkingDirectory.
    const originalGetInput = tl.getInput;
    const originalGetBoolInput = tl.getBoolInput;
    let inputValues: { [key: string]: string } = {};

    before(function () {
        (tl as any).which = function (tool: string, check?: boolean): string {
            return tool === 'helm' ? 'helm' : originalWhich(tool, check);
        };
        (internal as any)._which = function (tool: string, check?: boolean): string {
            return tool === 'helm' ? 'helm' : originalInternalWhich(tool, check);
        };
        (tl as any).getInput = function (name: string, required?: boolean): string {
            const value = inputValues[name.toLowerCase()];
            if (required && !value) {
                throw new Error('Input required: ' + name);
            }
            return value;
        };
        (tl as any).getBoolInput = function (name: string, required?: boolean): boolean {
            return ((tl as any).getInput(name, required) || '').toUpperCase() === 'TRUE';
        };
    });
    after(function () {
        (tl as any).which = originalWhich;
        (internal as any)._which = originalInternalWhich;
        (tl as any).getInput = originalGetInput;
        (tl as any).getBoolInput = originalGetBoolInput;
    });

    function setInput(name: string, value: string) {
        inputValues[name.toLowerCase()] = value;
    }

    beforeEach(function () {
        inputValues = {};
        delete process.env.BUILD_BUILDNUMBER;
        delete process.env.RELEASE_RELEASENAME;
        process.env.SYSTEM_HOSTTYPE = 'build';
        process.env.SYSTEM_DEFAULTWORKINGDIRECTORY = __dirname;
        setInput('chartType', 'Name');
        setInput('chartName', 'testChart');
    });

    /**
     * Drives the REAL production commonCommandOptions.addArguments() +
     * helmupgrade.addArguments() against a fresh helmcli instance (the exact
     * call sequence Tasks/HelmDeployV1/src/helm.ts's runHelm() uses), then
     * returns the exact argv array ToolRunner would hand to
     * child_process.spawn() - without ever spawning anything.
     */
    async function buildUpgradeArgv(): Promise<string[]> {
        let captured: string[] = null;
        const originalExecSync = tr.ToolRunner.prototype.execSync;
        (tr.ToolRunner.prototype as any).execSync = function (options?: tr.IExecOptions) {
            captured = [this.toolPath].concat((this as any).args.slice());
            return { code: 0, stdout: '', stderr: '', error: null };
        };
        try {
            const helmCli = new HelmCli();
            helmCli.setCommand('upgrade');
            commonCommandOptions.addArguments(helmCli);
            await helmupgrade.addArguments(helmCli);
            helmCli.execHelmCommand(true);
        } finally {
            tr.ToolRunner.prototype.execSync = originalExecSync;
        }
        return captured;
    }

    it('keeps a Build.BuildNumber that looks like it contains a --post-renderer option as ONE release-name token', async function () {
        const buildNumber = 'release-2b0627 --post-renderer bash --post-renderer-args=-c --post-renderer-args=pwn';
        process.env.BUILD_BUILDNUMBER = buildNumber;

        const argv = await buildUpgradeArgv();

        assert.strictEqual(argv.filter((a) => a === buildNumber).length, 1,
            'the build number must survive as a single argv element');
        assert.ok(argv.indexOf('--post-renderer') === -1,
            'no new --post-renderer option may be introduced from the build number');
        assert.ok(argv.indexOf('bash') === -1,
            'no new program name may be introduced from the build number');
    });

    it('keeps a Build.BuildNumber that looks like it contains a --values option as ONE release-name token', async function () {
        const buildNumber = 'release-2b0627 --values override-values.yaml';
        process.env.BUILD_BUILDNUMBER = buildNumber;

        const argv = await buildUpgradeArgv();

        assert.strictEqual(argv.filter((a) => a === buildNumber).length, 1,
            'the build number must survive as a single argv element');
        assert.strictEqual(argv.filter((a) => a === '--values').length, 0,
            'no valueFile input was configured in this test, so --values must not appear at all');
    });

    it('produces the identical single release-name token for a typical build number (no regression)', async function () {
        process.env.BUILD_BUILDNUMBER = '20261027.3';

        const argv = await buildUpgradeArgv();

        assert.strictEqual(argv.filter((a) => a === '20261027.3').length, 1);
    });

    it('keeps an explicit releaseName input in effect regardless of Build.BuildNumber content', async function () {
        setInput('releaseName', 'locked-release');
        process.env.BUILD_BUILDNUMBER = 'release-2b0627 --post-renderer bash';

        const argv = await buildUpgradeArgv();

        assert.ok(argv.indexOf('locked-release') !== -1);
        assert.ok(argv.indexOf('release-2b0627') === -1);
        assert.ok(argv.indexOf('--post-renderer') === -1);
    });

    it('still splits the documented free-form "arguments" input into multiple tokens (not a regression)', async function () {
        process.env.BUILD_BUILDNUMBER = '20261027.3';
        setInput('arguments', '--atomic --timeout 5m0s');

        const argv = await buildUpgradeArgv();

        assert.ok(argv.indexOf('--atomic') !== -1);
        assert.ok(argv.indexOf('--timeout') !== -1);
        assert.ok(argv.indexOf('5m0s') !== -1);
    });

    it('keeps a namespace value and its flag as two discrete tokens, without re-splitting an internal space', async function () {
        process.env.BUILD_BUILDNUMBER = '20261027.3';
        setInput('namespace', 'my namespace');

        const argv = await buildUpgradeArgv();

        const flagIndex = argv.indexOf('--namespace');
        assert.ok(flagIndex !== -1, '--namespace flag must be present');
        assert.strictEqual(argv[flagIndex + 1], 'my namespace',
            'the namespace value must be the single next argv element, not re-split on its internal space');
    });
});
