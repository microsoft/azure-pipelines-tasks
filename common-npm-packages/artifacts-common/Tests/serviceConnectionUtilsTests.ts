import * as assert from "assert";
import * as mockery from "mockery";
import { EndpointAuthorization } from "azure-pipelines-task-lib";
import { ServiceConnectionAuthType, TokenServiceConnection, UsernamePasswordServiceConnection, ApiKeyServiceConnection, IAdditionalData } from "../serviceConnectionUtils";

export function serviceConnectionUtilsTests() {

    const serviceConnectionsKey = "someProtocolServiceConnections";

    before(() => {
        mockery.disable(); // needed to ensure that we can mock vsts-task-lib/task
        mockery.enable({
            useCleanCache: true,
            warnOnUnregistered: true
        } as mockery.MockeryEnableArgs);
    });

    after(() => {
        mockery.disable();
    });

    beforeEach(() => {
        mockery.resetCache();
        mockery.registerAllowable("../serviceConnectionUtils");
    });

    afterEach(() => {
        mockery.deregisterAll();
    });

    it("getPackagingServiceConnections null returns empty", (done: MochaDone) => {
        let mockTask = {
            getDelimitedInput: (key) => {
                return null;
            },
            setResourcePath: (path) => {}
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);
        
        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.deepEqual(serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey), []);
        done();
    });

    it("getPackagingServiceConnections empty returns empty", (done: MochaDone) => {
        let mockTask = {
            getDelimitedInput: (key) => {
                return [];
            },
            setResourcePath: (path) => {}
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.deepEqual(serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey), []);
        done();
    });

    it("getPackagingServiceConnections token good", (done: MochaDone) => {
        let mockTask = {
            loc: msg => msg,
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { "apitoken": "sometoken" },
                scheme: "token"
            },
            setResourcePath: (path) => {},
            getEndpointAuthorizationScheme: (key, optional): string => "token"
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.deepEqual(serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey), [<TokenServiceConnection>{
            packageSource: {
                uri: "https://contoso.com/nuget/v3/index.json" 
            },
            authType: ServiceConnectionAuthType.Token,
            token: "sometoken",
            additionalData: {}
        }]);
        done();
    });
    
    it("getPackagingServiceConnections token missing apitoken throws", (done: MochaDone) => {
        let mockTask = {
            loc: msg => msg,
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { /* missing apitoken */ },
                scheme: "token"
            },
            setResourcePath: (path) => {},
            getEndpointAuthorizationScheme: (key, optional): string => "token"
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.throws(() => serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey));
        done();
    });

    it("getPackagingServiceConnections username/password good", (done: MochaDone) => {
        let mockTask = {
            loc: msg => msg,
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { "username": "someusername", "password": "somepassword" },
                scheme: "usernamepassword"
            },
            setResourcePath: (path) => {},
            getEndpointAuthorizationScheme: (key, optional): string => "usernamepassword"
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.deepEqual(serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey), [<UsernamePasswordServiceConnection>{
            packageSource: {
                uri: "https://contoso.com/nuget/v3/index.json" 
            },
            authType: ServiceConnectionAuthType.UsernamePassword,
            username: "someusername",
            password: "somepassword",
            additionalData: {}
        }]);
        done();
    });
      
    it("getPackagingServiceConnections username/password missing username throws", (done: MochaDone) => {
        let mockTask = {
            loc: msg => msg,
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { /* missing username */ "password": "somepassword" },
                scheme: "usernamepassword"
            },
            setResourcePath: (path) => {},
            getEndpointAuthorizationScheme: (key, optional): string => "usernamepassword"
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.throws(() => serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey));
        done();
    });

    it("getPackagingServiceConnections username/password missing password throws", (done: MochaDone) => {
        let mockTask = {
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { "username": "someusername" /* missing password */ },
                scheme: "usernamepassword"
            },
            setResourcePath: (path) => {},
            getEndpointAuthorizationScheme: (key, optional): string => "usernamepassword"
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.throws(() => serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey));
        done();
    });

    it("getPackagingServiceConnections apikey good", (done: MochaDone) => {
        let mockTask = {
            loc: msg => msg,
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { "nugetkey": "someapikey" },
                scheme: "none"
            },
            setResourcePath: (path) => {},
            getEndpointAuthorizationScheme: (key, optional): string => "none"
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.deepEqual(serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey), [<ApiKeyServiceConnection>{
            packageSource: {
                uri: "https://contoso.com/nuget/v3/index.json" 
            },
            authType: ServiceConnectionAuthType.ApiKey,
            apiKey: "someapikey",
	    additionalData: {}
        }]);
        done();
    });

    it("getPackagingServiceConnections apikey missing nugetkey throws", (done: MochaDone) => {
        let mockTask = {
            loc: msg => msg,
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { /* missing nugetkey */ },
                scheme: "none"
            },
            setResourcePath: (path) => {},
            getEndpointAuthorizationScheme: (key, optional): string => "none"
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.throws(() => serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey));
        done();
    });


    it("getPackagingServiceConnections token good additional data good", (done: MochaDone) => {
        let mockTask = {
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { "apitoken": "sometoken" },
                scheme: "token"
            },
            getEndpointAuthorizationScheme: (key, optional): string => "token",
            getEndpointDataParameter: (id, key, optional) => {
                var values = {
                    "key1" : "value1",
                    "key2" : "value2"
                }
                return values[key];
            },
            setResourcePath: (path) => {}
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.deepEqual(serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey, ["key1", "key2"]), [<TokenServiceConnection>{
            packageSource: {
                uri: "https://contoso.com/nuget/v3/index.json" 
            },
            authType: ServiceConnectionAuthType.Token,
            token: "sometoken",
            additionalData: {
                "key1" : "value1",
                "key2" : "value2"
            } as IAdditionalData
        }]);
        done();
    });

    it("getPackagingServiceConnections token good missing additional data doesn't throw", (done: MochaDone) => {
        let mockTask = {
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { "apitoken": "sometoken" },
                scheme: "token"
            },
            setResourcePath: (path) => {},
            getEndpointAuthorizationScheme: (key, optional): string => "token",
            getEndpointDataParameter: (id, key, optional) => {
                var values = {
                    "key2" : "value2"
                }
                return values[key];
            }
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.deepEqual(serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey, ["key1", "key2"]), [<TokenServiceConnection>{
            packageSource: {
                uri: "https://contoso.com/nuget/v3/index.json" 
            },
            authType: ServiceConnectionAuthType.Token,
            token: "sometoken",
            additionalData: {
                "key2" : "value2"
            } as IAdditionalData
        }]);
        done();
    });
}
