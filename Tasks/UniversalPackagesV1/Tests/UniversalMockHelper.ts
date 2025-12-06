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
        organization: string;
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

    private registerProvenanceHelperMock() {
        const sessionId = this.provenanceSessionId;
        
        const provenanceMock = {
            ProvenanceHelper: {
                GetSessionId: async () => sessionId
            }
        };
        
        this.tmr.registerMock('azure-pipelines-tasks-packaging-common/provenance', provenanceMock);
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
        
        // Mock getSystemAccessToken
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
                    options: {}
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
