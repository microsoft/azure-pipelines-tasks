import { TaskLibAnswers, TaskLibAnswerExecResult } from 'azure-pipelines-task-lib/mock-answer';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as mtt from 'azure-pipelines-task-lib/mock-toolrunner';
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
        packageVersion: string;
        verbosity: string;
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
    feedValidationBehavior?: string;
}

export class UniversalMockHelper {
    private static ArtifactToolCmd: string = 'c:\\mock\\location\\ArtifactTool.exe';
    private provenanceSessionId: string | null = null;
    public usedToken: string | undefined;

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
        
        artMock.registerArtifactToolUtilitiesMock(tmr, UniversalMockHelper.ArtifactToolCmd);
        this.registerArtifactToolRunnerMockWithTokenCapture();
        clientMock.registerClientToolUtilitiesMock(tmr, UniversalMockHelper.ArtifactToolCmd);
        clientMock.registerClientToolRunnerMock(tmr);
        pkgMock.registerLocationHelpersMock(tmr);
        this.registerConnectionDataUtilsMock();
        this.registerLocationUtilitiesMock();
        this.registerRetryUtilitiesMock();
        this.registerAuthenticationMocks();
        
        // Only register provenance mock if test explicitly sets providesSessionId
        if (config.providesSessionId !== undefined) {
            this.registerProvenanceHelperMock();
        }
        
        // Register the command mock
        this.mockUniversalCommand();
        
        this.tmr.setAnswers(this.answers);
    }

    private registerArtifactToolRunnerMockWithTokenCapture() {
        // Register our extended mock directly
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolRunner', {
            getOptions: function() {
                return {
                    cwd: process.cwd(),
                    env: Object.assign({}, process.env),
                    silent: false,
                    failOnStdErr: false,
                    ignoreReturnCode: false,
                    windowsVerbatimArguments: false
                }
            },
            runArtifactTool: (artifactToolPath: string, command: string[], execOptions: any) => {
                // Extension: Capture the token for test verification
                if (execOptions?.env?.UNIVERSAL_AUTH_TOKEN) {
                    this.usedToken = execOptions.env.UNIVERSAL_AUTH_TOKEN;
                }
                
                // Run the tool (same implementation as base mock)
                const tr = new mtt.ToolRunner(artifactToolPath);
                tr.arg(command);
                return tr.execSync(execOptions);
            }
        });
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
        
        // Mock getSystemAccessToken and getWebApiWithProxy for feed validation and provenance
        const provenanceSessionId = this.provenanceSessionId;
        const webapiMock = {
            getSystemAccessToken: () => {
                if (this.config.systemTokenAvailable) {
                    return TEST_CONSTANTS.SYSTEM_TOKEN;
                }
                return undefined;
            },
            getWebApiWithProxy: (serviceUri: string, accessToken: string) => {
                if (this.config.feedValidationBehavior === 'fail') {
                    return {
                        serverUrl: serviceUri,
                        authHandler: {},
                        options: {},
                        vsoClient: {
                            getVersioningData: async () => {
                                throw new Error('Feed validation failed: 401 Unauthorized');
                            }
                        },
                        getLocationsApi: async () => ({
                            getResourceArea: async (areaId: string) => {
                                throw new Error('Feed validation failed: 401 Unauthorized');
                            }
                        })
                    };
                }
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
