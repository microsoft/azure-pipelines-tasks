import * as version from './vstestversion';

export class TestConfigurations {
    public testSelection: string;

    // ranjanar : TODO : Plan for better modelling of these
    // Test Assembly Related Properties
    public sourceFilter: string[];
    public testcaseFilter: string;

    // Test Plan related Properties
    public testplan: number;
    public testSuites: number[];
    public testPlanConfigId: number;

    // Test Run Related Properties
    public onDemandTestRunId: string;

    // Common Properties
    public settingsFile: string;
    public testDropLocation: string; // search folder
    public overrideTestrunParameters: string;
    public codeCoverageEnabled: boolean;
    public videoCoverageEnabled: boolean;
    public buildConfig: string;
    public buildPlatform: string;
    public testRunTitle: string;
    public vsTestLocationMethod: string;
    public vsTestVersion: string;
    public vsTestLocation: string;
    public vsTestVersionDetais: version.VSTestVersion;
    public pathtoCustomTestAdapters: string;
    public tiaConfig: TiaConfiguration;
    public runInParallel: boolean;
    public runTestsInIsolation: boolean;
    public otherConsoleOptions: string;
}

export class DtaTestConfigurations extends TestConfigurations {
    public testConfigurationMapping: string; // TODO : What is this?
    public customSlicingenabled: boolean;
    public dtaEnvironment: DtaEnvironment;
    public numberOfAgentsInPhase: number;
    public numberOfTestCasesPerSlice: number = 0;
}

export class DtaEnvironment {
    public tfsCollectionUrl: string;
    public patToken: string;
    public environmentUri: string;
    public dtaHostLogFilePath: string;
    public agentName: string;
}

export class VsTestConfigurations extends TestConfigurations {
    public publishRunAttachments: string;
    public vstestDiagFile: string;
    public ignoreVstestFailure: string;
}

export class TiaConfiguration {
    public tiaEnabled: boolean;
    public tiaRebaseLimit: string;
    public tiaFilterPaths: string;
    public fileLevel: string;
    public sourcesDir: string;
    public runIdFile: string;
    public baseLineBuildIdFile: string;
    public useNewCollector: boolean;
    public isPrFlow: string;
    public context: string;
    public useTestCaseFilterInResponseFile: string;
    public userMapFile: string;
    public disableEnablingDataCollector: boolean;
}
