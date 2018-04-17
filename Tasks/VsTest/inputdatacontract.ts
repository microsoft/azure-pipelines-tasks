export interface InputDataContract {
    AgentName : string;
    AccessToken : string;
    CollectionUri : string;
    EnvironmentUri : string;
    TeamProject : string;
    TestSelectionSettings : TestSelectionSettings;
    VsTestConsolePath: string;
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
    TestRunTitle : string;
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