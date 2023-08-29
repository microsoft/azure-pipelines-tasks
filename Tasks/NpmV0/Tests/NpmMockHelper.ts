import ma = require('azure-pipelines-task-lib/mock-answer');
import path = require('path');
import tmrm = require('azure-pipelines-task-lib/mock-run');

export class NpmMockHelper {
    static NpmCmdPath = "C:\\Program Files (x86)\\nodejs\\npm";
    static NpmAuthPath = "C:\\tool\\vsts-npm-auth\\vsts-npm-auth.exe";
    static FakeWorkingDirectory = "fake\\wd";
    static AgentBuildDirectory = 'c:\\agent\\work\\build';
    static BuildBuildId = '12345';

    // public answers: ma.TaskLibAnswers = {
    //     which: {},
    //     exec: {},
    //     checkPath: {},
    //     exist: {},
    //     filter: {},
    //     find: {},
    //     match: {}
    // };

    public answers: ma.TaskLibAnswers;

    constructor(
        private tmr: tmrm.TaskMockRunner,
        public command: string,
        public args: string) { 
        NpmMockHelper.setVariable('Agent.HomeDirectory', 'c:\\agent\\home\\directory');
        NpmMockHelper.setVariable('Build.SourcesDirectory', 'c:\\agent\\home\\directory\\sources');
        process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = "{\"parameters\":{\"AccessToken\":\"token\"},\"scheme\":\"OAuth\"}";
        process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = "https://example.visualstudio.com/defaultcollection";
        NpmMockHelper.setVariable('System.DefaultWorkingDirectory', 'c:\\agent\\home\\directory');
        NpmMockHelper.setVariable('System.TeamFoundationCollectionUri', 'https://example.visualstudio.com/defaultcollection');
        NpmMockHelper.setVariable('Agent.BuildDirectory', NpmMockHelper.AgentBuildDirectory);
        NpmMockHelper.setVariable('Build.BuildId', NpmMockHelper.BuildBuildId);
        process.env['System_ServerType'] = "Hosted";

        tmr.setInput('cwd', NpmMockHelper.FakeWorkingDirectory);
        tmr.setInput('command', command);
        tmr.setInput('arguments', args);

        this.setDefaultAnswers();

        this.registerNugetLocationHelpersMock();
    }

    public run(result?: ma.TaskLibAnswerExecResult) {
        if (result) {
            let command = `${NpmMockHelper.NpmCmdPath} ${this.command}`;
            if (this.args) {
                command += " " + this.args;
            }
            this.setExecResponse(command, result);
        }
        this.tmr.setAnswers(this.answers);
        this.tmr.run();
    }

    public useDeprecatedTask() {
        process.env['USE_DEPRECATED_TASK_VERSION'] = 'true';
    }

    public mockAuthHelper() {
        let npmTaskDirName = path.dirname(__dirname);
        let authHelperExternalPath = path.join(npmTaskDirName, 'Npm', 'vsts-npm-auth');
        let authHelperExePath = path.join(authHelperExternalPath, 'bin', 'vsts-npm-auth.exe');
        this.answers.find[authHelperExternalPath] = [npmTaskDirName, authHelperExePath, authHelperExePath + ".config"];
        //this.answers.filter['vsts-npm-auth.exe'] = [authHelperExePath];

        let targetNpmrcFile = `${NpmMockHelper.AgentBuildDirectory}\\npm\\auth.${NpmMockHelper.BuildBuildId}.npmrc`;
        let sourceNpmrcFile = `${NpmMockHelper.FakeWorkingDirectory}\\.npmrc`;
        let command = `${authHelperExePath} -NonInteractive -Verbosity Detailed -Config ${sourceNpmrcFile} -TargetConfig ${targetNpmrcFile}`;
        this.setExecResponse(command, { code: 0, stdout: "", stderr: "" });
    }

    public mockNpmConfigList() {
        let command = `${NpmMockHelper.NpmCmdPath} config list`;
        if (this.isDebugging()) {
            // add option to dump all default values
            command += " -l";
        }
        this.setExecResponse(command, { code: 0, stdout: "; cli configs", stderr: "" });
    }

    public setDebugState(isDebugging: boolean) {
        NpmMockHelper.setVariable('system.debug', isDebugging ? 'true' : 'false');
    }

    public setOsType(osTypeVal : string) {
        if(!this.answers['osType']) {
            this.answers['osType'] = {};
        }

        this.answers['osType']['osType'] = osTypeVal;
    }

    private static setVariable(name: string, value: string) {
        let key = NpmMockHelper.getVariableKey(name);
        process.env[key] = value;
    }

    private static getVariableKey(name: string) {
        let key = name.replace(/\./g, '_').toUpperCase();
        return key;
    }

    private setExecResponse(command: string, result:ma.TaskLibAnswerExecResult) {
        this.answers.exec[command] = result;
    }

    private isDebugging() {
        let value = process.env[NpmMockHelper.getVariableKey('system.debug')];
        return value === 'true';
    }

    private setDefaultAnswers() {
        this.setToolPath(this.answers, "npm", NpmMockHelper.NpmCmdPath);
        this.setOsType('WiNdOWs_nT');
        this.setProjectNpmrcExists();
    }

    private setToolPath(answers: ma.TaskLibAnswers, tool: string, path: string) {
        answers.which[tool] = path;
        answers.checkPath[path] = true;
    }

    private setProjectNpmrcExists() {
        this.answers.exist[path.join(NpmMockHelper.FakeWorkingDirectory, '.npmrc')] = true;
    }

    public registerNugetLocationHelpersMock() {
        this.tmr.registerMock('packaging-common/locationUtilities', {
            getPackagingUris: function(input) {
                const collectionUrl: string = "https://vsts/packagesource";
                return {
                    PackagingUris: [collectionUrl],
                    DefaultPackagingUri: collectionUrl
                };
            },
            ProtocolType: {NuGet: 1, Npm: 2, Maven: 3}
        });
    }
}