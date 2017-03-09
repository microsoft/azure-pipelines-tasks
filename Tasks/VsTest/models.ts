export interface ExecutabaleInfo {
    version: number;
    location: string;
}

export interface TestConfigurations {
    sourceFilter: string[];
    testcaseFilter: string;
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
    pathtoCustomTestAdapters: string;
    tiaConfig: TiaConfiguration;
    runInParallel: boolean;
    runTestsInIsolation: boolean;
    vs15HelperPath: string;
    testSelection: string; // "testPlan" as selection string
    testplan: number;
    testSuites: number[];
    testPlanConfigId: number;
}

export interface DtaTestConfigurations extends TestConfigurations {
    onDemandTestRunId: string;
    testConfigurationMapping: string; // TODO : What is this?
    customSlicingenabled: boolean;
    dtaEnvironment: DtaEnvironment;
    numberOfAgentsInPhase: number;
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
}
