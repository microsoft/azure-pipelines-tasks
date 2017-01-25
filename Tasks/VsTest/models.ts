export interface ExecutabaleInfo {
    version: number;
    location: string;
}

export interface TestConfigurations {
    sourceFilter: string[];
    testcaseFilter: string;
    runSettingsFile: string;
    testDropLocation: string; // search folder
    overrideTestrunParameters: string;
    codeCoverageEnabled: boolean;
    buildConfig: string;
    buildPlatform: string;
    testRunTitle: string;
    vsTestVersion: string;
    pathtoCustomTestAdapters: string;
    tiaConfig: TiaConfiguration;
}

export interface DtaTestConfigurations extends TestConfigurations {
    testConfigurationMapping: string; // TODO : What is this?
    testSelection: string; // "testPlan" as selection string
    testplan: number;
    testSuites: number[];
    testPlanConfigId: number;
    customSlicingenabled: boolean;
}

export interface VsTestConfigurations extends TestConfigurations {
    vstestLocationMethod: string;
    vstestLocation: string;
    otherConsoleOptions: string;
    publishRunAttachments: string;
    runInParallel: boolean;
    vstestDiagFile: string;
    ignoreVstestFailure: string;
    vs15HelperPath: string;
}

export interface TiaConfiguration
{
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
