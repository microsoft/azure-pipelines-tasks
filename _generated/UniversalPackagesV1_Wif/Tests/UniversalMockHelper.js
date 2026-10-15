"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversalMockHelper = void 0;
const pkgMock = require("azure-pipelines-tasks-packaging-common/Tests/MockHelper");
const artMock = require("azure-pipelines-tasks-packaging-common/Tests/ArtifactToolMockHelper");
const clientMock = require("azure-pipelines-tasks-packaging-common/Tests/ClientToolMockHelper");
const testConstants_1 = require("./testConstants");
class UniversalMockHelper {
    constructor(tmr, config) {
        this.tmr = tmr;
        this.config = config;
        this.provenanceSessionId = null;
        this.answers = {
            exec: {},
            which: {
                'c:\\mock\\location\\ArtifactTool.exe': UniversalMockHelper.ArtifactToolCmd
            }
        };
        // Configure provenance based on provided configuration
        if (config.providesSessionId === 'true') {
            this.provenanceSessionId = testConstants_1.TEST_CONSTANTS.PROVENANCE_SESSION_ID;
        }
        else if (config.providesSessionId === 'false') {
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
    setupEndpointAuth() {
        // Set SYSTEMVSSCONNECTION auth if system token is available
        if (this.config.systemTokenAvailable) {
            process.env['ENDPOINT_AUTH_SYSTEMVSSCONNECTION'] = JSON.stringify({
                parameters: {
                    AccessToken: testConstants_1.TEST_CONSTANTS.SYSTEM_TOKEN
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
    registerRetryUtilitiesMock() {
        const retryUtilitiesMock = {
            retryOnException: (operation, maxRetries, delayMs) => __awaiter(this, void 0, void 0, function* () {
                // For tests, just execute once without retries
                return yield operation();
            })
        };
        this.tmr.registerMock('azure-pipelines-tasks-artifacts-common/retryUtils', retryUtilitiesMock);
    }
    registerTelemetryMock() {
        const telemetryMock = {
            emitTelemetry: (area, feature, taskSpecificTelemetry) => {
                // Mock telemetry emission - do nothing in tests
            },
            logResult: (area, feature, resultCode) => {
                // Mock telemetry result logging - do nothing in tests
            }
        };
        this.tmr.registerMock('azure-pipelines-tasks-utility-common/telemetry', telemetryMock);
    }
    registerArtifactToolUtilitiesMock() {
        const highestVersion = this.config.highestPackageVersion;
        const incrementedVersion = this.config.expectedIncrementedVersion;
        const artifactToolUtilitiesMock = {
            getArtifactToolFromService: function (serviceUri, accessToken, toolName) {
                return UniversalMockHelper.ArtifactToolCmd;
            },
            getPackageNameFromId: function (serviceUri, accessToken, projectId, feedId, packageId) {
                return packageId;
            },
            getHighestPackageVersionFromFeed: function (serviceUri, accessToken, projectId, feedId, packageName) {
                return __awaiter(this, void 0, void 0, function* () {
                    // Return null if no highest version configured (simulates new package)
                    return highestVersion || null;
                });
            },
            getVersionUtility: function (versionRadio, highestVer) {
                // Return the test-configured expected version
                return incrementedVersion || null;
            }
        };
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities', artifactToolUtilitiesMock);
    }
    registerProvenanceHelperMock() {
        const sessionId = this.provenanceSessionId;
        const provenanceMock = {
            ProvenanceHelper: {
                CreateSessionRequest: (feedId) => ({
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
                constructor(userAgent, baseUrl, handlers, options) { }
                create(resource, body, options) {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (sessionId) {
                            return { result: { sessionId: sessionId }, statusCode: 200 };
                        }
                        // Return null result if session creation failed
                        return { result: null, statusCode: 404 };
                    });
                }
            }
        };
        this.tmr.registerMock('typed-rest-client/RestClient', restClientMock);
        // Mock ClientApiBase infrastructure for ProvenanceApi
        const clientApiBasesMock = {
            ClientApiBase: class MockClientApiBase {
                constructor(baseUrl, handlers, userAgent, options) {
                    this.baseUrl = baseUrl;
                    this.rest = new restClientMock.RestClient(userAgent, baseUrl, handlers, options);
                    this.vsoClient = {
                        getVersioningData: (apiVersion, area, locationId, routeValues) => __awaiter(this, void 0, void 0, function* () {
                            // Mock successful versioning data response
                            const protocol = (routeValues === null || routeValues === void 0 ? void 0 : routeValues.protocol) || 'upack';
                            const project = routeValues === null || routeValues === void 0 ? void 0 : routeValues.project;
                            const projectSegment = project ? `/${project}` : '';
                            return {
                                apiVersion: apiVersion,
                                requestUrl: `${baseUrl}${projectSegment}/_apis/Provenance/${protocol}/CreateSession?api-version=${apiVersion}`
                            };
                        })
                    };
                }
                createRequestOptions(contentType, apiVersion) {
                    return {
                        acceptHeader: contentType,
                        additionalHeaders: {
                            'Content-Type': contentType,
                            'X-TFS-FedAuthRedirect': 'Suppress'
                        }
                    };
                }
                formatResponse(data, responseTypeMetadata, isCollection) {
                    return data;
                }
            }
        };
        this.tmr.registerMock('azure-devops-node-api/ClientApiBases', clientApiBasesMock);
    }
    registerAuthenticationMocks() {
        const wifMock = {
            getFederatedWorkloadIdentityCredentialsForFeed: (serviceConnectionName, feedUrl) => __awaiter(this, void 0, void 0, function* () {
                if (this.config.wifAuthBehavior === 'success') {
                    return {
                        accessToken: testConstants_1.TEST_CONSTANTS.WIF_TOKEN,
                        feedUrl: new URL(feedUrl)
                    };
                }
                else if (this.config.wifAuthBehavior === 'returns-null') {
                    return null;
                }
                else if (this.config.wifAuthBehavior === 'throws') {
                    throw new Error('WIF authentication failed: simulated error');
                }
                // If undefined, don't mock (module not loaded)
                return undefined;
            })
        };
        // Mock getSystemAccessToken and getWebApiWithProxy for provenance
        const provenanceSessionId = this.provenanceSessionId;
        const webapiMock = {
            requireHttpsUrl: (value) => {
                const url = new URL(value);
                if (url.protocol !== 'https:') {
                    throw new Error('Error_UrlHttpsRequired');
                }
                return url;
            },
            getSystemAccessToken: () => {
                if (this.config.systemTokenAvailable) {
                    return testConstants_1.TEST_CONSTANTS.SYSTEM_TOKEN;
                }
                return undefined;
            },
            getWebApiWithProxy: (serviceUri, accessToken) => {
                return {
                    serverUrl: serviceUri,
                    authHandler: {},
                    options: {},
                    rest: {
                        create: (resource, body, options) => __awaiter(this, void 0, void 0, function* () {
                            if (provenanceSessionId) {
                                return { result: { sessionId: provenanceSessionId }, statusCode: 200 };
                            }
                            return { result: null, statusCode: 404 };
                        }),
                        get: (url, options) => __awaiter(this, void 0, void 0, function* () {
                            // Default response for GET calls
                            return { result: {}, statusCode: 200 };
                        })
                    },
                    vsoClient: {
                        getVersioningData: (apiVersion, area, locationId, routeValues) => __awaiter(this, void 0, void 0, function* () {
                            // For provenance API calls
                            if (area === 'Provenance') {
                                const protocol = (routeValues === null || routeValues === void 0 ? void 0 : routeValues.protocol) || 'upack';
                                const project = routeValues === null || routeValues === void 0 ? void 0 : routeValues.project;
                                const projectSegment = project ? `/${project}` : '';
                                return {
                                    apiVersion: apiVersion,
                                    requestUrl: `${serviceUri}${projectSegment}/_apis/Provenance/${protocol}/CreateSession?api-version=${apiVersion}`
                                };
                            }
                            // Default for feed validation
                            return { requestUrl: `${serviceUri}/_apis/packaging/feeds` };
                        })
                    },
                    getLocationsApi: () => __awaiter(this, void 0, void 0, function* () {
                        return ({
                            getResourceArea: (areaId) => __awaiter(this, void 0, void 0, function* () {
                                const locationUrl = process.env['MOCK_FEED_SERVICE_URL'] ||
                                    (serviceUri.includes('other-org')
                                        ? testConstants_1.TEST_CONSTANTS.CROSS_ORG_FEED_SERVICE_URL
                                        : testConstants_1.TEST_CONSTANTS.FEED_SERVICE_URL);
                                return { locationUrl };
                            }),
                            getConnectionData: () => __awaiter(this, void 0, void 0, function* () {
                                return ({
                                    authenticatedUser: {
                                        id: testConstants_1.TEST_CONSTANTS.SYSTEM_TOKEN ? 'mock-build-service-id' : undefined,
                                        providerDisplayName: 'TestProject Build Service (TestOrg)',
                                        customDisplayName: null
                                    }
                                });
                            })
                        });
                    })
                };
            }
        };
        this.tmr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', wifMock);
        this.tmr.registerMock('azure-pipelines-tasks-artifacts-common/webapi', webapiMock);
    }
    mockUniversalCommand() {
        if (!this.config.commandString) {
            throw new Error('config.commandString is required');
        }
        this.answers.exec[this.config.commandString] = this.config.execResult;
    }
    static getArtifactToolPath() {
        return UniversalMockHelper.ArtifactToolCmd;
    }
}
exports.UniversalMockHelper = UniversalMockHelper;
UniversalMockHelper.ArtifactToolCmd = 'c:\\mock\\location\\ArtifactTool.exe';
