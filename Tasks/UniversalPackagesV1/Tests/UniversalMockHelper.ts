import { TaskLibAnswers, TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as pkgMock from 'azure-pipelines-tasks-packaging-common/Tests/MockHelper';
import * as artMock from 'azure-pipelines-tasks-packaging-common/Tests/ArtifactToolMockHelper';
import * as clientMock from 'azure-pipelines-tasks-packaging-common/Tests/ClientToolMockHelper';
import { TEST_CONSTANTS } from './TestConstants';

export interface MockConfig {
    inputs: {
        command: string;
        directory: string;
        organization?: string;
        feed: string;
        packageName: string;
        packageVersion?: string;
        versionIncrement?: string;
        packageDescription?: string;
        adoServiceConnection?: string;
    };
    execResult: TaskLibAnswerExecResult;
    feedName?: string;
    projectId?: string;
    commandString?: string;
    wifAuthBehavior?: string;
    systemTokenAvailable: boolean;
    providesSessionId?: string;
    serviceUrl: string;
    highestPackageVersion?: string;
    expectedIncrementedVersion?: string;
}

export class UniversalMockHelper {
    private static ArtifactToolCmd: string = 'c:\\mock\\location\\ArtifactTool.exe';
    private provenanceSessionId: string | null = null;

    public answers: TaskLibAnswers = {
        exec: {},
        which: {
            'c:\\mock\\location\\ArtifactTool.exe': UniversalMockHelper.ArtifactToolCmd
        }
    };

    constructor(private tmr: TaskMockRunner, private config: MockConfig) {
        // Configure provenance based on provided configuration
        if (config.providesSessionId === 'true') {
            this.provenanceSessionId = TEST_CONSTANTS.PROVENANCE_SESSION_ID;
        } else if (config.providesSessionId === 'false') {
            // Mock returns null (session creation failed)
            this.provenanceSessionId = null;
        }
        // If providesSessionId is undefined, don't mock provenance (provenanceSessionId stays null)
        
        // Register mocks for task-lib functions
        // Set endpoint authorization environment variables
        this.setupEndpointAuth();
        
        this.registerArtifactToolUtilitiesMock();
        artMock.registerArtifactToolRunnerMock(tmr);
        clientMock.registerClientToolUtilitiesMock(tmr, UniversalMockHelper.ArtifactToolCmd);
        clientMock.registerClientToolRunnerMock(tmr);
        pkgMock.registerLocationHelpersMock(tmr);
        this.registerConnectionDataUtilsMock();
        this.registerLocationUtilitiesMock();
        this.registerRetryUtilitiesMock();
        this.registerAuthenticationMocks();
        this.registerTelemetryMock();
        
        // Only register provenance mock if test explicitly sets providesSessionId
        if (config.providesSessionId !== undefined) {
            this.registerProvenanceHelperMock();
        }
        
        // Register the command mock
        this.mockUniversalCommand();
        
        this.tmr.setAnswers(this.answers);
    }

    private setupEndpointAuth() {
        // Set SYSTEMVSSCONNECTION auth if system token is available
        if (this.config.systemTokenAvailable) {
            process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = JSON.stringify({
                parameters: {
                    AccessToken: TEST_CONSTANTS.SYSTEM_TOKEN
                },
                scheme: 'OAuth'
            });
        }
        
        // Set service connection auth if provided
        if (this.config.inputs.adoServiceConnection) {
            process.env[`ENDPOINT_AUTH_${this.config.inputs.adoServiceConnection}`] = JSON.stringify({
                parameters: {},
                scheme: 'WorkloadIdentityFederation'
            });
        }
    }

    private registerConnectionDataUtilsMock() {
        const connectionDataMock = {
            getConnectionDataForProtocol: async () => {
                return {
                    locationServiceData: {
                        serviceOwner: "00000000-0000-0000-0000-000000000000",
                        defaultAccessMappingMoniker: "PublicAccessMapping",
                        accessMappings: [{
                            moniker: "PublicAccessMapping",
                            accessPoint: TEST_CONSTANTS.SERVICE_URL
                        }]
                    }
                };
            }
        };
        
        this.tmr.registerMock('azure-pipelines-tasks-artifacts-common/connectionDataUtils', connectionDataMock);
    }

    private registerLocationUtilitiesMock() {
        const locationUtilitiesMock = {
            getFeedUriFromBaseServiceUri: async (serviceUri: string, accessToken: string) => {
                // Return the packaging API URL based on the service URI
                return `${serviceUri}/_apis/packaging`;
            }
        };
        
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common/locationUtilities', locationUtilitiesMock);
    }

    private registerRetryUtilitiesMock() {
        const retryUtilitiesMock = {
            retryOnException: async <T>(operation: () => Promise<T>, maxRetries: number, delayMs: number): Promise<T> => {
                // For tests, just execute once without retries
                return await operation();
            }
        };
        
        this.tmr.registerMock('azure-pipelines-tasks-artifacts-common/retryUtils', retryUtilitiesMock);
    }

    private registerTelemetryMock() {
        const telemetryMock = {
            emitTelemetry: (area: string, feature: string, taskSpecificTelemetry: any) => {
                // Mock telemetry emission - do nothing in tests
            },
            logResult: (area: string, feature: string, resultCode: number) => {
                // Mock telemetry result logging - do nothing in tests
            }
        };
        
        this.tmr.registerMock('azure-pipelines-tasks-utility-common/telemetry', telemetryMock);
    }

    private registerArtifactToolUtilitiesMock() {
        const highestVersion = this.config.highestPackageVersion;
        const incrementedVersion = this.config.expectedIncrementedVersion;
        
        const artifactToolUtilitiesMock = {
            getArtifactToolFromService: function(serviceUri: string, accessToken: string, toolName: string) {
                return UniversalMockHelper.ArtifactToolCmd;
            },
            getPackageNameFromId: function(serviceUri: string, accessToken: string, projectId: string, feedId: string, packageId: string) {
                return packageId;
            },
            getHighestPackageVersionFromFeed: async function(serviceUri: string, accessToken: string, projectId: string, feedId: string, packageName: string): Promise<string> {
                // Return null if no highest version configured (simulates new package)
                return highestVersion || null;
            },
            getVersionUtility: function(versionRadio: string, highestVer: string): string {
                // Return the test-configured expected version
                return incrementedVersion || null;
            }
        };
        
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities', artifactToolUtilitiesMock);
    }

    private registerProvenanceHelperMock() {
        const sessionId = this.provenanceSessionId;
        
        const provenanceMock = {
            ProvenanceHelper: {
                CreateSessionRequest: (feedId: string) => ({
                    feed: feedId,
                    source: "InternalBuild",
                    data: {
                        "Build.BuildId": "12345"
                    }
                })
            }
        };
        
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common/provenance', provenanceMock);
        
        // Mock the REST client for provenance API calls
        const restClientMock = {
            RestClient: class MockRestClient {
                constructor(userAgent: string, baseUrl?: string, handlers?: any[], options?: any) {}
                
                async create<T>(resource: string, body: any, options?: any): Promise<{result: T, statusCode: number}> {
                    if (sessionId) {
                        return { result: { sessionId: sessionId } as T, statusCode: 200 };
                    }
                    // Return null result if session creation failed
                    return { result: null as T, statusCode: 404 };
                }
            }
        };
        
        this.tmr.registerMock('typed-rest-client/RestClient', restClientMock);
        
        // Mock ClientApiBase infrastructure for ProvenanceApi
        const clientApiBasesMock = {
            ClientApiBase: class MockClientApiBase {
                public baseUrl: string;
                public rest: any;
                public vsoClient: any;
                
                constructor(baseUrl: string, handlers: any[], userAgent: string, options?: any) {
                    this.baseUrl = baseUrl;
                    this.rest = new restClientMock.RestClient(userAgent, baseUrl, handlers, options);
                    this.vsoClient = {
                        getVersioningData: async (apiVersion: string, area: string, locationId: string, routeValues?: any) => {
                            // Mock successful versioning data response
                            const protocol = routeValues?.protocol || 'upack';
                            const project = routeValues?.project;
                            const projectSegment = project ? `/${project}` : '';
                            return {
                                apiVersion: apiVersion,
                                requestUrl: `${baseUrl}${projectSegment}/_apis/Provenance/${protocol}/CreateSession?api-version=${apiVersion}`
                            };
                        }
                    };
                }
                
                createRequestOptions(contentType: string, apiVersion: string): any {
                    return {
                        acceptHeader: contentType,
                        additionalHeaders: {
                            'Content-Type': contentType,
                            'X-TFS-FedAuthRedirect': 'Suppress'
                        }
                    };
                }
                
                formatResponse(data: any, responseTypeMetadata: any, isCollection: boolean): any {
                    return data;
                }
            }
        };
        
        this.tmr.registerMock('azure-devops-node-api/ClientApiBases', clientApiBasesMock);
    }

    private registerAuthenticationMocks() {
        // Mock getFederatedWorkloadIdentityCredentials
        const wifMock = {
            getFederatedWorkloadIdentityCredentials: async (serviceConnectionName: string) => {
                if (this.config.wifAuthBehavior === 'success') {
                    return TEST_CONSTANTS.WIF_TOKEN;
                } else if (this.config.wifAuthBehavior === 'returns-null') {
                    return null;
                } else if (this.config.wifAuthBehavior === 'throws') {
                    throw new Error('WIF authentication failed: simulated error');
                }
                // If undefined, don't mock (module not loaded)
                return undefined;
            }
        };
        
        // Mock getSystemAccessToken and getWebApiWithProxy for provenance
        const provenanceSessionId = this.provenanceSessionId;
        const webapiMock = {
            getSystemAccessToken: () => {
                if (this.config.systemTokenAvailable) {
                    return TEST_CONSTANTS.SYSTEM_TOKEN;
                }
                return undefined;
            },
            getWebApiWithProxy: (serviceUri: string, accessToken: string) => {
                return {
                    serverUrl: serviceUri,
                    authHandler: {},
                    options: {},
                    rest: {
                        create: async <T>(resource: string, body: any, options?: any): Promise<{result: T, statusCode: number}> => {
                            if (provenanceSessionId) {
                                return { result: { sessionId: provenanceSessionId } as T, statusCode: 200 };
                            }
                            return { result: null as T, statusCode: 404 };
                        },
                        get: async <T>(url: string, options?: any): Promise<{result: T, statusCode: number}> => {
                            // Default response for GET calls
                            return { result: {} as T, statusCode: 200 };
                        }
                    },
                    vsoClient: {
                        getVersioningData: async (apiVersion?: string, area?: string, locationId?: string, routeValues?: any) => {
                            // For provenance API calls
                            if (area === 'Provenance') {
                                const protocol = routeValues?.protocol || 'upack';
                                const project = routeValues?.project;
                                const projectSegment = project ? `/${project}` : '';
                                return {
                                    apiVersion: apiVersion,
                                    requestUrl: `${serviceUri}${projectSegment}/_apis/Provenance/${protocol}/CreateSession?api-version=${apiVersion}`
                                };
                            }
                            // Default for feed validation
                            return { requestUrl: `${serviceUri}/_apis/packaging/feeds` };
                        }
                    },
                    getLocationsApi: async () => ({
                        getResourceArea: async (areaId: string) => {
                            // Mock the UPack area ID returning a packaging service URL
                            return { locationUrl: `${serviceUri}/_apis/packaging` };
                        }
                    })
                };
            }
        };
        
        this.tmr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', wifMock);
        this.tmr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', webapiMock);
    }

    private mockUniversalCommand() {
        if (!this.config.commandString) {
            throw new Error('config.commandString is required');
        }
        
        this.answers.exec[this.config.commandString] = this.config.execResult;
    }

    public static getArtifactToolPath(): string {
        return UniversalMockHelper.ArtifactToolCmd;
    }
}
