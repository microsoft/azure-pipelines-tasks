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
    vsTestVersionDetails: version.VSTestVersion;
    pathtoCustomTestAdapters: string;
    tiaConfig: TiaConfiguration;
    runInParallel: boolean;
    runTestsInIsolation: boolean;
    otherConsoleOptions: string;
    taskInstanceIdentifier: string;
    runUITests: boolean;
    ignoreTestFailures: string;
    rerunFailedTests: boolean;
    rerunType: string;
    rerunFailedThreshold: number;
    rerunFailedTestCasesMaxLimit: number;
    rerunMaxAttempts: number;
    toolsInstallerConfig: ToolsInstallerConfiguration;
    proxyConfiguration: ProxyConfiguration;
    diagnosticsConfiguration: DiagnosticsConfiguration
}

export interface DtaTestConfigurations extends TestConfigurations {
    testConfigurationMapping: string; // TODO : What is this?
    customSlicingenabled: boolean;
    dtaEnvironment: DtaEnvironment;
    numberOfAgentsInPhase: number;
    useVsTestConsole: string;
    numberOfTestCasesPerSlice: number;
    batchingType: BatchingType;
    runningTimePerBatchInMs: number;
    proceedAfterAbortedTestCase: boolean;
}

export interface ProxyConfiguration {
    proxyUrl: string;
    proxyUserName: string;
    proxyPassword: string;
    proxyBypassHosts: string;
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
    responseFile: string;
    isResponseFileRun: boolean;
    responseSupplementryFile: string;
    vstestArgsFile: string;
    responseFileSupported: boolean;
    publishTestResultsInTiaMode: boolean;
}

export interface DiagnosticsConfiguration {
    enabled: boolean;
    dumpCollectionType: string;
}

export interface TiaConfiguration {
    tiaEnabled: boolean;
    tiaRebaseLimit: string;
    tiaFilterPaths: string;
    fileLevel: string;
    sourcesDir: string;
    runIdFile: string;
    baseLineBuildIdFile: string;
    responseFile: string;
    useNewCollector: boolean;
    isPrFlow: string;
    context: string;
    useTestCaseFilterInResponseFile: string;
    userMapFile: string;
    disableEnablingDataCollector: boolean;
}

export interface ToolsInstallerConfiguration {
    vsTestPackageLocation: string; // root of the package downloaded by Tools installer
    vsTestConsolePathFromPackageLocation: string; // path to vstest.console.exe
    x86ProfilerProxyDLLLocation: string;
    x64ProfilerProxyDLLLocation: string;
    isToolsInstallerInUse: boolean;
}

export enum BatchingType {
    TestCaseBased,
    TestExecutionTimeBased,
    AssemblyBased
}