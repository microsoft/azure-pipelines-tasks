export interface InputDataContract {
    AgentName : string;
    AccessToken : string;
    AccessTokenType : string;
    CollectionUri : string;
    RunIdentifier : string;
    TeamProject : string;
    TestSelectionSettings : TestSelectionSettings;
    VsTestConsolePath : string;
    UsingXCopyTestPlatformPackage : boolean;
    EnableSingleAgentAPIFlow : boolean;
    TestReportingSettings : TestReportingSettings;
    TfsSpecificSettings : TfsSpecificSettings;
    TargetBinariesSettings : TargetBinariesSettings;
    TestSpecificSettings : TestSpecificSettings;
    ProxySettings : ProxySettings;
    DistributionSettings : DistributionSettings;
    ExecutionSettings : ExecutionSettings;
    Logging : Logging;
    SourcesDirectory : string;
    ServerType : string;
}

export interface TestReportingSettings {
    TestRunTitle : string;
    TestResultsDirectory : string;
    TestRunSystem : string;
    TestSourceSettings : TestSourceSettings;
    ExecutionStatusSettings : ExecutionStatusSettings;
}

export interface TestSelectionSettings {
    TestSelectionType : string;
    TestPlanTestSuiteSettings : TestPlanTestSuiteSettings;
    SearchFolder : string;
    TestCaseFilter : string;
    TestSourcesFile : string;
}

export interface TestPlanTestSuiteSettings {
    OnDemandTestRunId : number;
    Testplan : number;
    TestPlanConfigId : number;
    TestSuites : number[];
}

export interface TfsSpecificSettings {
    BuildDefinitionId : number;
    ReleaseDefinitionId : number;
    BuildId : number;
    BuildUri : string;
    ReleaseId : number;
    ReleaseUri : string;
    ReleaseEnvironmentUri : string;
    WorkFolder : string;
    PhaseName : string;
    PhaseAttempt : number;
    StageName : string;
    StageAttempt : number;
    JobName : string;
    JobAttempt : number;
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
    RerunType : string;
    RerunFailedTestCasesMaxLimit : number;
    RerunFailedThreshold : number;
    RerunMaxAttempts : number;
}

export interface DistributionSettings {
    DistributeTestsBasedOn : string;
    NumberOfTestAgents : number;
    RunTimePerSlice : number;
    NumberOfTestCasesPerSlice : number;
}

export interface ExecutionSettings {
    TestPlatformExecutionMode : string;
    DefaultTestBatchSize : number;
    AssemblyLevelParallelism : boolean;
    CodeCoverageEnabled : boolean;
    PathToCustomTestAdapters : string;
    ProceedAfterAbortedTestCase : boolean;
    PathToCustomVsTestConsoleWrapperAssembly : string;
    SettingsFile : string;
    AdditionalConsoleParameters : string;
    OverridenParameters : string;
    RerunSettings : RerunSettings;
    RunTestsInIsolation : boolean;
    TiaSettings : TiaSettings;
    TempFolder : string;
    VideoDataCollectorEnabled : boolean;
    DiagnosticsSettings : DiagnosticsSettings;
}

export interface TestSourceSettings {
    PullRequestTargetBranchName : string;
}

export interface ExecutionStatusSettings {
    IgnoreTestFailures : boolean;
    MinimumExecutedTestsExpected : number;
    ActionOnThresholdNotMet : string;
}

export interface DiagnosticsSettings {
    Enabled : boolean;
    DumpCollectionType : string;
}

export interface TiaSettings {
    Enabled : boolean;
    DisableDataCollection : boolean;
    RebaseLimit : number;
    SourcesDirectory : string;
    FileLevel : boolean;
    FilterPaths : string;
    UserMapFile : string;
    IsPrFlow : boolean;
    UseTestCaseFilterInResponseFile : boolean;
}

export interface Logging {
    DebugLogging : boolean;
    EnableConsoleLogs : boolean;
}
