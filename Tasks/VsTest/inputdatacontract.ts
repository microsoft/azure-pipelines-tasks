export interface InputDataContract {
    AgentName : string;
    AccessToken : string;
    CollectionUri : string;
    RunIdentifier : string;
    TeamProject : string;
    TestSelectionSettings : TestSelectionSettings;
    VsTestConsolePath : string;
    UsingXCopyTestPlatformPackage : boolean;
    TestReportingSettings : TestReportingSettings;
    TfsSpecificSettings : TfsSpecificSettings;
    TargetBinariesSettings : TargetBinariesSettings;
    TestSpecificSettings : TestSpecificSettings;
    ProxySettings : ProxySettings;
    DistributionSettings : DistributionSettings;
    ExecutionSettings : ExecutionSettings;
    Logging : Logging;
    TiaBaseLineBuildIdFile : string;
    UseNewCollector : boolean;
    IsPrFlow : boolean;
}

export interface TestReportingSettings {
    TestRunTitle : string;
    TestResultDirectory : string;
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
    AssemblyLevelParallelism : boolean;
    CodeCoverageEnabled : boolean;
    CustomTestAdapters : string;
    ExecutionMode : string;
    IgnoreTestFailures : boolean;
    ProceedAfterAbortedTestCase : boolean;
    SettingsFile : string;
    OverridenParameters : string;
    RerunSettings : RerunSettings;
    TiaSettings : TiaSettings;
    VideoDataCollectorEnabled : boolean;
}

export interface TiaSettings {
    Enabled : boolean;
    DisableDataCollection : boolean;
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