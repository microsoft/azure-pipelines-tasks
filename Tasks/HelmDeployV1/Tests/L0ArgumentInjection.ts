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
    const helminstallPath = path.join(__dirname, '../src/helmcommands/helminstall.js');
    const helmrollbackPath = path.join(__dirname, '../src/helmcommands/helmrollback.js');
    const helmuninstallPath = path.join(__dirname, '../src/helmcommands/helmuninstall.js');
    const helmpackagePath = path.join(__dirname, '../src/helmcommands/helmpackage.js');

    const HelmCli = require(helmcliPath).default;
    const commonCommandOptions = require(commonCommandOptionsPath);
    const helmupgrade = require(helmupgradePath);
    const helminstall = require(helminstallPath);
    const helmrollback = require(helmrollbackPath);
    const helmuninstall = require(helmuninstallPath);
    const helmpackage = require(helmpackagePath);

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

    /**
     * Generic variant of buildUpgradeArgv() for commands other than "upgrade"
     * (install / rollback / uninstall / package). Transparently answers the
     * "helm version" probe isHelmV3orHigher() issues (used by install's Helm
     * v2-vs-v3 branch) with a parseable v3 version string, so it resolves
     * without needing a real Helm binary, then captures the argv of the
     * actual command invocation that follows.
     */
    async function buildArgv(command: string, addArgs: (helmCli: any) => Promise<void> | void): Promise<string[]> {
        let captured: string[] = null;
        const originalExecSync = tr.ToolRunner.prototype.execSync;
        (tr.ToolRunner.prototype as any).execSync = function (options?: tr.IExecOptions) {
            const args: string[] = (this as any).args || [];
            if (args[0] === 'version') {
                return { code: 0, stdout: 'v3.14.4+gxxxxxxx', stderr: '', error: null };
            }
            captured = [this.toolPath].concat(args.slice());
            return { code: 0, stdout: '', stderr: '', error: null };
        };
        try {
            const helmCli = new HelmCli();
            helmCli.setCommand(command);
            commonCommandOptions.addArguments(helmCli);
            await addArgs(helmCli);
            helmCli.execHelmCommand(true);
        } finally {
            tr.ToolRunner.prototype.execSync = originalExecSync;
        }
        return captured;
    }

    // --- Reviewer follow-up (post-merge): validateReleaseName() only rejects
    // empty-or-dash-leading values; it deliberately does not enforce Helm's
    // own release-name format (charset, length), since that varies by the
    // installed Helm version (see the "legacy-style release name" test
    // below). A Build.BuildNumber that merely CONTAINS text that looks like
    // a Helm option - without the release name itself starting with "-" -
    // is still handed to Helm as a single, inert argv element: confirmed
    // directly against real Helm binaries that Cobra/pflag only treats a
    // token as an option when the token ITSELF starts with "-"; embedded
    // "--post-renderer"/"--values" text inside one positional argv element
    // is never re-split or reinterpreted as separate flags, on either Helm
    // 3.2.4 or 3.17.3. Helm's own (version-specific) release-name validator
    // remains free to accept or reject the resulting odd-looking name on its
    // own terms - that is no longer this task's concern.
    it('keeps a Build.BuildNumber containing embedded --post-renderer-looking text as a single inert token (no reinterpretation, no task-level rejection)', async function () {
        const buildNumber = 'release-2b0627 --post-renderer bash --post-renderer-args=-c --post-renderer-args=pwn';
        process.env.BUILD_BUILDNUMBER = buildNumber;

        const argv = await buildUpgradeArgv();

        assert.strictEqual(argv.filter((a) => a === buildNumber).length, 1,
            'the entire build number must survive as exactly one inert argv element');
        assert.ok(argv.indexOf('--post-renderer') === -1, 'the embedded text must never become a separate argv element');
    });

    it('keeps a Build.BuildNumber containing embedded --values-looking text as a single inert token (no reinterpretation, no task-level rejection)', async function () {
        const buildNumber = 'release-2b0627 --values override-values.yaml';
        process.env.BUILD_BUILDNUMBER = buildNumber;

        const argv = await buildUpgradeArgv();

        assert.strictEqual(argv.filter((a) => a === buildNumber).length, 1,
            'the entire build number must survive as exactly one inert argv element');
        assert.ok(argv.indexOf('--values') === -1, 'the embedded text must never become a separate argv element');
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

    it('does not let the generic single-token dispatch silently mutate a value, independent of any caller-level normalization', function () {
        // This isolates execHelmCommand()'s dispatch mechanism itself: it
        // must hand a single-token value to Helm exactly as it was added,
        // whatever normalization (if any) the caller already chose to apply.
        // A value that resolves a path or holds a credential can legitimately
        // contain meaningful whitespace, so the dispatch layer must never
        // guess and silently trim/alter it (that is a caller decision - see
        // the namespace-trimming test below for the one place this task
        // does choose to normalize, explicitly, before the value ever
        // reaches this dispatch).
        let captured: string[] = null;
        const originalExecSync = tr.ToolRunner.prototype.execSync;
        (tr.ToolRunner.prototype as any).execSync = function () {
            captured = [this.toolPath].concat((this as any).args.slice());
            return { code: 0, stdout: '', stderr: '', error: null };
        };
        try {
            const helmCli = new HelmCli();
            helmCli.setCommand('upgrade');
            helmCli.addSingleArgument('--some-flag');
            helmCli.addSingleArgument('  padded-value  ');
            helmCli.execHelmCommand(true);
        } finally {
            tr.ToolRunner.prototype.execSync = originalExecSync;
        }

        assert.deepStrictEqual(captured.slice(1), ['upgrade', '--some-flag', '  padded-value  '],
            'execHelmCommand() must not alter a single-token value that was already added');
    });

    it('trims accidental leading/trailing whitespace from a namespace input before it reaches Helm', async function () {
        // Unlike the dispatch-level test above, this exercises the real
        // production addArguments() path end to end. namespace is a strict
        // Kubernetes identifier with no legitimate whitespace-containing
        // form, so this task explicitly trims it right after reading the
        // input (see utils.ts's trimIdentifierInput) - restoring the same
        // tolerance for an accidentally padded value (stray copy-pasted
        // space, etc.) that the old ToolRunner.line()-based code provided
        // for free, without reintroducing any implicit trimming into the
        // generic single-token dispatch itself.
        process.env.BUILD_BUILDNUMBER = '20261027.3';
        setInput('namespace', '  padded-namespace  ');

        const argv = await buildUpgradeArgv();

        const flagIndex = argv.indexOf('--namespace');
        assert.ok(flagIndex !== -1, '--namespace flag must be present');
        assert.strictEqual(argv[flagIndex + 1], 'padded-namespace',
            'a namespace value padded with stray whitespace must be trimmed before reaching Helm');
    });

    it('still lets a quoted overrideValues entry have its quotes stripped, matching Helm --set quoting conventions', async function () {
        process.env.BUILD_BUILDNUMBER = '20261027.3';
        setInput('overrideValues', 'image.tag="1.2.3"');

        const argv = await buildUpgradeArgv();

        const setIndex = argv.indexOf('--set');
        assert.ok(setIndex !== -1, '--set flag must be present');
        assert.strictEqual(argv[setIndex + 1], 'image.tag=1.2.3',
            'quotes around an overrideValues value must still be stripped so Helm does not receive literal quote characters');
    });

    it('omits a single-token argument entirely when its value is empty, rather than adding a stray empty element', function () {
        let captured: string[] = null;
        const originalExecSync = tr.ToolRunner.prototype.execSync;
        (tr.ToolRunner.prototype as any).execSync = function () {
            captured = [this.toolPath].concat((this as any).args.slice());
            return { code: 0, stdout: '', stderr: '', error: null };
        };
        try {
            const helmCli = new HelmCli();
            helmCli.setCommand('upgrade');
            helmCli.addSingleArgument('--flag-with-empty-value');
            helmCli.addSingleArgument('');
            helmCli.addSingleArgument('next-real-value');
            helmCli.execHelmCommand(true);
        } finally {
            tr.ToolRunner.prototype.execSync = originalExecSync;
        }

        assert.deepStrictEqual(captured.slice(1), ['upgrade', '--flag-with-empty-value', 'next-real-value']);
    });

    // --- Reviewer follow-up (post-merge): a leading-dash release name is
    // still a single argv element after addSingleArgument(), but Helm's OWN
    // CLI flag parser still treats a token starting with "-"/"--" as an
    // option rather than the positional release name (e.g. a release name of
    // "--kube-apiserver=..." is parsed by Helm as that flag, not as the
    // literal release name). validateReleaseName() rejects any resolved
    // release name that does not match Helm's own release-name rule before
    // this task ever builds a Helm command line, so the task fails with a
    // clear error instead of handing Helm an option-shaped "release name".
    it('rejects a dash-leading explicit releaseName on upgrade instead of letting Helm reinterpret it as an option', async function () {
        setInput('releaseName', '--post-renderer=node');

        await assert.rejects(() => buildUpgradeArgv(), /InvalidReleaseName|starts with '-'/);
    });

    it('rejects a dash-leading Build.BuildNumber release-name fallback on upgrade', async function () {
        process.env.BUILD_BUILDNUMBER = '--kube-apiserver=http://169.254.169.254';

        await assert.rejects(() => buildUpgradeArgv(), /InvalidReleaseName|starts with '-'/);
    });

    it('rejects a dash-leading explicit releaseName on install (Helm v3 bare-positional path)', async function () {
        setInput('releaseName', '--repo=http://169.254.169.254/charts');

        await assert.rejects(
            () => buildArgv('install', (helmCli) => helminstall.addArguments(helmCli)),
            /InvalidReleaseName|starts with '-'/);
    });

    it('rejects a dash-leading releaseName on rollback', async function () {
        setInput('releaseName', '--post-renderer=node');
        setInput('namespace', 'ns');

        await assert.rejects(
            () => buildArgv('rollback', (helmCli) => helmrollback.addArguments(helmCli)),
            /InvalidReleaseName|starts with '-'/);
    });

    it('rejects a dash-leading releaseName on uninstall', async function () {
        setInput('releaseName', '--post-renderer=node');

        await assert.rejects(
            () => buildArgv('uninstall', (helmCli) => helmuninstall.addArguments(helmCli)),
            /InvalidReleaseName|starts with '-'/);
    });

    it('still accepts a well-formed releaseName on install, rollback, and uninstall (no regression)', async function () {
        setInput('releaseName', 'my-release');
        setInput('namespace', 'ns');

        const installArgv = await buildArgv('install', (helmCli) => helminstall.addArguments(helmCli));
        assert.ok(installArgv.indexOf('my-release') !== -1, 'install must still accept a well-formed release name');

        const rollbackArgv = await buildArgv('rollback', (helmCli) => helmrollback.addArguments(helmCli));
        assert.ok(rollbackArgv.indexOf('my-release') !== -1, 'rollback must still accept a well-formed release name');

        const uninstallArgv = await buildArgv('uninstall', (helmCli) => helmuninstall.addArguments(helmCli));
        assert.ok(uninstallArgv.indexOf('my-release') !== -1, 'uninstall must still accept a well-formed release name');
    });

    // --- Reviewer follow-up (post-merge): validateReleaseName() must not
    // enforce Helm's current (3.17+) release-name format, only reject empty
    // or dash-leading values. Confirmed directly: Helm 3.2.4 accepts an
    // uppercase/underscore name such as "Legacy_Release" end-to-end for both
    // "install" and "upgrade" (Helm 3.17.3 rejects the same name). A
    // pre-existing release named this way on an older, still-supported Helm
    // must keep upgrading through this task; only the installed Helm binary
    // enforces the rest of its own version's naming rule.
    it('still accepts a legacy-style release name with uppercase letters and underscores (older Helm versions allow this)', async function () {
        setInput('releaseName', 'Legacy_Release');
        setInput('namespace', 'ns');

        const installArgv = await buildArgv('install', (helmCli) => helminstall.addArguments(helmCli));
        assert.ok(installArgv.indexOf('Legacy_Release') !== -1,
            'install must not reject a release name only because it has uppercase letters or underscores');

        const upgradeArgv = await buildUpgradeArgv();
        assert.ok(upgradeArgv.indexOf('Legacy_Release') !== -1,
            'upgrade must not reject a release name only because it has uppercase letters or underscores');

        const rollbackArgv = await buildArgv('rollback', (helmCli) => helmrollback.addArguments(helmCli));
        assert.ok(rollbackArgv.indexOf('Legacy_Release') !== -1,
            'rollback must not reject a release name only because it has uppercase letters or underscores');

        const uninstallArgv = await buildArgv('uninstall', (helmCli) => helmuninstall.addArguments(helmCli));
        assert.ok(uninstallArgv.indexOf('Legacy_Release') !== -1,
            'uninstall must not reject a release name only because it has uppercase letters or underscores');
    });

    // --- Reviewer follow-up (post-merge, nonblocking): helmpackage.ts had no
    // whitespace normalization for "version" (unlike install/upgrade, which
    // already gate version behind semver.valid()). Before this task's switch
    // to opaque single-token dispatch, the old line()-based tokenizer
    // incidentally stripped a stray trailing/leading space from the
    // concatenated "--version <value>" string; addSingleArgument() preserves
    // the value verbatim instead, and a padded value is then rejected by
    // Helm's own (whitespace-intolerant) semver parser. Trimming "version"
    // the same way other plain identifier-style inputs already are restores
    // the old tolerance for an accidentally padded value.
    it('trims accidental leading/trailing whitespace from a package command version before it reaches Helm', async function () {
        setInput('chartPath', __dirname);
        setInput('version', '1.2.3 ');

        const argv = await buildArgv('package', (helmCli) => helmpackage.addArguments(helmCli));

        const versionIndex = argv.indexOf('--version');
        assert.ok(versionIndex !== -1, '--version flag must be present');
        assert.strictEqual(argv[versionIndex + 1], '1.2.3',
            "a version value padded with stray whitespace must be trimmed before reaching Helm, matching Helm's own strict semver parsing");
    });
});
