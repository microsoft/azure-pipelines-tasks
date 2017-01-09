export interface ExecutabaleInfo {
    version: number;
    location: string;
}

export interface testConfigurations{
    sourceFilter: string[];
    testcaseFilter: string;
    runSettingsFile: string;
    testDropLocation: string; // search folder
    overrideTestrunParameters: string;    
    codeCoverageEnabled: boolean;
    buildConfig: string;
    buildPlatform: string;    
    testRunTitle: string;
}

export interface dtaTestConfigurations extends testConfigurations {
    testConfigurationMapping: string; // TODO : What is this?
    testSelection: string; // "testPlan" as selection string
    testplan: number;
    testSuites: number[];
    testPlanConfigId: number;
    customSlicingenabled: boolean;
}

export interface vsTestConfigurations extends testConfigurations {
    vsTestVersion: string;
    vstestLocationMethod: string;
    vstestLocation: string;
    pathtoCustomTestAdapters: string;   
    otherConsoleOptions: string;
    publishRunAttachments: string;
    runInParallel: boolean;
    vstestDiagFile: string;
    ignoreVstestFailure: string;
    tiaConfig: tiaConfiguration;
    vs15HelperPath: string;
}

export interface tiaConfiguration
{
    tiaEnabled: boolean;    
    tiaRebaseLimit: string;
    fileLevel: string;
    sourcesDir: string;
    runIdFile: string;
    baseLineBuildIdFile: string;
    useNewCollector: boolean;
    isPrFlow: string;
    context: string;
}
