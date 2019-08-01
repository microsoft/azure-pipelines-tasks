import * as assert from "assert";
import * as mockery from "mockery";
import { EndpointAuthorization } from "azure-pipelines-task-lib";
import { ServiceConnectionAuthType, TokenServiceConnection, UsernamePasswordServiceConnection } from "../serviceConnectionUtils";

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
    });

    afterEach(() => {
        mockery.deregisterAll();
    });

    it("getPackagingServiceConnections null returns empty", (done: MochaDone) => {
        let mockTask = {
            getDelimitedInput: (key) => {
                return null;
            }
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
            }
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.deepEqual(serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey), []);
        done();
    });

    it("getPackagingServiceConnections token good", (done: MochaDone) => {
        let mockTask = {
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { "apitoken": "sometoken" },
                scheme: "token"
            },
            getEndpointAuthorizationScheme: (key, optional): string => "token"
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.deepEqual(serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey), [<TokenServiceConnection>{
            packageSource: {
                uri: "https://contoso.com/nuget/v3/index.json" 
            },
            authType: ServiceConnectionAuthType.Token,
            token: "sometoken"
        }]);
        done();
    });
    
    it("getPackagingServiceConnections token missing apitoken throws", (done: MochaDone) => {
        let mockTask = {
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { /* missing apitoken */ },
                scheme: "token"
            },
            getEndpointAuthorizationScheme: (key, optional): string => "token"
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.throws(() => serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey));
        done();
    });

    it("getPackagingServiceConnections username/password good", (done: MochaDone) => {
        let mockTask = {
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { "username": "someusername", "password": "somepassword" },
                scheme: "usernamepassword"
            },
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
            password: "somepassword"
        }]);
        done();
    });
      
    it("getPackagingServiceConnections username/password missing username throws", (done: MochaDone) => {
        let mockTask = {
            debug: () => {},
            getDelimitedInput: (key) => ["tokenendpoint1"],
            getEndpointUrl: (key, optional) => "https://contoso.com/nuget/v3/index.json",
            getEndpointAuthorization: (key, optional) => <EndpointAuthorization>{
                parameters: { /* missing username */ "password": "somepassword" },
                scheme: "usernamepassword"
            },
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
            getEndpointAuthorizationScheme: (key, optional): string => "usernamepassword"
        };
        mockery.registerMock('azure-pipelines-task-lib/task', mockTask);

        let serviceConnectionUtilsWithMocks = require("../serviceConnectionUtils");
        assert.throws(() => serviceConnectionUtilsWithMocks.getPackagingServiceConnections(serviceConnectionsKey));
        done();
    });
}
