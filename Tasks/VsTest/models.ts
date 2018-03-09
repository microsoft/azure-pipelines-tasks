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

export interface InputDataContract {
    AgentName : string;
    AccessToken : string;
    CollectionUri : string;
    EnvironmentUri : string;
    TeamProject : string;
    TestSelectionSettings : TestSelectionSettings;
    TestReportingSettings : TestReportingSettings;
    TfsSpecificSettings : TfsSpecificSettings;
    TargetBinariesSettings : TargetBinariesSettings;
    TestSpecificSettings : TestSpecificSettings;
    ProxySettings : ProxySettings;
    DistributionSettings : DistributionSettings;
    ExecutionSettings : ExecutionSettings;
    Logging : Logging;
    UseVsTestConsole : boolean;
    TestPlatformVersion : string;
    COR_PROFILER_PATH_32 : string;
    COR_PROFILER_PATH_64 : string;
    ForcePlatformV2 : boolean;
    VisualStudioPath : string;
    TestWindowPath : string;
    TiaRunIdFile : string;
    ResponseFile : string;
    ResponseSupplementryFilePath : string;
    TiaBaseLineBuildIdFile : string;
    VsVersion : string;
    VsVersionIsTestSettingsPropertiesSupported : boolean;
    RerunIterationCount : number;
    AgentVersion : string;
    VstestTaskInstanceIdentifier : string;
    MiniMatchTestSourcesFile : string;
    UseNewCollector : boolean;
    IsPrFlow : boolean;
    UseTestCaseFilterInResponseFile : boolean;
    DisableEnablingDataCollector : boolean;
}

export interface TestReportingSettings {
    TestRunTitle  : string;
    TestResultDirectory : string;
}

export interface TestSelectionSettings {
    TestSelectionType : string;
    AssemblyBasedTestSelection : AssemblyBasedTestSelection;
    TestPlanTestSuiteSettings : TestPlanTestSuiteSettings;
    SearchFolder : string;
    TestCaseFilter : string;
}

export interface AssemblyBasedTestSelection {
    SourceFilter : string;
}

export interface TestPlanTestSuiteSettings {
    OnDemandTestRunId : number;
    Testplan : number;
    TestPlanConfigId : number;
    TestSuites : number[];
}

export interface TfsSpecificSettings {
    BuildId : number;
    BuildUri : string;
    ReleaseId : number;
    ReleaseUri : string;
    ReleaseEnvironmentUri : string;
}

export interface TestSpecificSettings {
    TestCaseAccessToken : string;
}

export interface TargetBinariesSettings {
    BuildConfig : string;
    BuildPlatform : string;
}

export interface ProxySettings {
    ProxyUrl : string;
    ProxyUsername : string;
    ProxyPassword : string;
    ProxyBypassHosts : string;
}

export interface RerunSettings {
    RerunFailedTests : boolean;
    RerunFailedTestCasesMaxLimit : number;
    RerunFailedThreshold : number;
    RerunMaxAttempts : number;
}

export interface DistributionSettings {
    TestCaseLevelSlicingEnabled : boolean;
    NumberOfTestAgents : number;
    IsTimeBasedSlicing : boolean;
    RunTimePerSlice : number;
    NumberOfTestCasesPerSlice : number;
}

export interface ExecutionSettings {
    AssemblyLevelParallelism : boolean;
    CodeCoverageEnabled : boolean;
    CustomTestAdapters : string;
    ExecutionMode : string;
    IgnoreTestFailures : boolean;
    ProceedAfterAbortedTestCase : boolean;
    SettingsFile : string;
    OverridenParameters : string;
    RerunSettings : RerunSettings;
    IsToolsInstallerFlow : boolean;
    VstestConsolePath : string;
    TiaSettings : TiaSettings;
    VideoDataCollectorEnabled : boolean;
}

export interface TiaSettings {
    Enabled : boolean;
    RebaseLimit : number;
    SourcesDirectory : string;
    FileLevel : boolean;
    FilterPaths : string;
    UserMapFile : string;
}

export interface Logging {
    DebugLogging : boolean;
    EnableConsoleLogs : boolean;
}