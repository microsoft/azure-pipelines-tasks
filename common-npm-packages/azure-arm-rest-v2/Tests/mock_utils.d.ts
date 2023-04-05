import { AzureEndpoint } from '../azureModels';
export declare var nock: any;
export declare function getMockEndpoint(scheme?: string, msiClientId?: string): AzureEndpoint;
export declare function mockAzureARMAppInsightsWebTests(): void;
export declare function mockAzureApplicationInsightsTests(): void;
export declare function mockAzureAppServiceTests(): void;
export declare function mockKuduServiceTests(): void;
export declare function mockAzureARMResourcesTests(): void;
