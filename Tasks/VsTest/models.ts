import * as version from './vstestversion';

export interface TestConfigurations {
    testSelection: string;

    // ranjanar : TODO : Plan for better modelling of these
    // Test Assembly Related Properties
    sourceFilter: string[];
    testcaseFilter: string;

    // Test Plan related Properties
    testplan: number;
    testSuites: number[];
    testPlanConfigId: number;

    // Test Run Related Properties
    onDemandTestRunId: string;

    // Common Properties
    settingsFile: string;
    testDropLocation: string; // search folder
    overrideTestrunParameters: string;
    codeCoverageEnabled: boolean;
    videoCoverageEnabled: boolean;
    buildConfig: string;
    buildPlatform: string;
    testRunTitle: string;
    vsTestLocationMethod: string;
    vsTestVersion: string;
    vsTestLocation: string;
    vsTestVersionDetais: version.VSTestVersion;
    pathtoCustomTestAdapters: string;
    tiaConfig: TiaConfiguration;
    runInParallel: boolean;
    runTestsInIsolation: boolean;
    otherConsoleOptions: string;
}

export interface DtaTestConfigurations extends TestConfigurations {
    testConfigurationMapping: string; // TODO : What is this?
    customSlicingenabled: boolean;
    dtaEnvironment: DtaEnvironment;
    numberOfAgentsInPhase: number;
    useVsTestConsole: string;
}

export interface DtaEnvironment {
    tfsCollectionUrl: string;
    patToken: string;
    environmentUri: string;
    dtaHostLogFilePath: string;
    agentName: string;
}

export interface VsTestConfigurations extends TestConfigurations {
    publishRunAttachments: string;
    vstestDiagFile: string;
    ignoreVstestFailure: string;
}

export interface TiaConfiguration {
    tiaEnabled: boolean;
    tiaRebaseLimit: string;
    tiaFilterPaths: string;
    fileLevel: string;
    sourcesDir: string;
    runIdFile: string;
    baseLineBuildIdFile: string;
    useNewCollector: boolean;
    isPrFlow: string;
    context: string;
    useTestCaseFilterInResponseFile: string;
    userMapFile: string;
    disableEnablingDataCollector: boolean;
}
