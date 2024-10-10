import * as assert from "assert";
import { buildExternalFeedEndpointsJson, configureCredProviderForServiceConnectionFeeds } from "../credentialProviderUtils";
import { ServiceConnectionAuthType, TokenServiceConnection, ApiKeyServiceConnection, UsernamePasswordServiceConnection, ServiceConnection, EntraServiceConnection } from "../serviceConnectionUtils";
const CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR = "VSS_NUGET_EXTERNAL_FEED_ENDPOINTS";
export function credentialProviderUtilsTests() {

    beforeEach(() => {
    });

    afterEach(() => {
    });

    it("buildExternalFeedEndpointsJson null returns null", (done: Mocha.Done) => {
        assert.equal(buildExternalFeedEndpointsJson(null), null);
        done();
    });

    it("buildExternalFeedEndpointsJson empty returns null", (done: Mocha.Done) => {
        assert.equal(buildExternalFeedEndpointsJson([]), null);
        done();
    });

    it("buildExternalFeedEndpointsJson token", (done: Mocha.Done) => {
        const json = buildExternalFeedEndpointsJson([
            <TokenServiceConnection>{
                packageSource: {
                    uri: "https://contoso.com/nuget/v3/index.json"
                },
                authType: ServiceConnectionAuthType.Token,
                token: "sometoken"
            }
        ])

        assert.equal(json, "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget/v3/index.json\",\"password\":\"sometoken\"}]}");

        done();
    });

    it("buildExternalFeedEndpointsJson usernamepassword", (done: Mocha.Done) => {
        const json = buildExternalFeedEndpointsJson([
            <UsernamePasswordServiceConnection>{
                packageSource: {
                    uri: "https://fabrikam.com/nuget/v3/index.json"
                },
                authType: ServiceConnectionAuthType.UsernamePassword,
                username: "someusername",
                password: "somepassword"
            }
        ])

        assert.equal(json, "{\"endpointCredentials\":[{\"endpoint\":\"https://fabrikam.com/nuget/v3/index.json\",\"username\":\"someusername\",\"password\":\"somepassword\"}]}");

        done();
    });

    it("buildExternalFeedEndpointsJson token + usernamepassword", (done: Mocha.Done) => {
        const json = buildExternalFeedEndpointsJson([
            <TokenServiceConnection>{
                packageSource: {
                    uri: "https://contoso.com/nuget/v3/index.json"
                },
                authType: ServiceConnectionAuthType.Token,
                token: "sometoken"
            },
            <UsernamePasswordServiceConnection>{
                packageSource: {
                    uri: "https://fabrikam.com/nuget/v3/index.json"
                },
                authType: ServiceConnectionAuthType.UsernamePassword,
                username: "someusername",
                password: "somepassword"
            }
        ])

        assert.equal(json, "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget/v3/index.json\",\"password\":\"sometoken\"},{\"endpoint\":\"https://fabrikam.com/nuget/v3/index.json\",\"username\":\"someusername\",\"password\":\"somepassword\"}]}");

        done();
    });

    it("buildExternalFeedEndpointsJson apikey throws", (done: Mocha.Done) => {
        assert.throws(() => {
            buildExternalFeedEndpointsJson([
                <ApiKeyServiceConnection>{
                    packageSource: {
                        uri: "https://contoso.com/nuget/v3/index.json"
                    },
                    authType: ServiceConnectionAuthType.ApiKey,
                    apiKey: "someapikey"
                }
            ])
        });

        done();
    });

    it("buildExternalFeedEndpointsJson otherauthtype throws", (done: Mocha.Done) => {
        assert.throws(() => {
            buildExternalFeedEndpointsJson([
                {
                    packageSource: {
                        uri: "https://contoso.com/nuget/v3/index.json"
                    },
                    authType: <any>"unsupportedauthtype",
                    maskSecret: () => void {}
                }
            ])
        });

        done();
    });


    it("configureCredProviderForServiceConnectionFeeds single new service connection", (done: Mocha.Done) => {
        process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR] = "";
        var serviceConnections = [
            new EntraServiceConnection({uri:"https://contoso.com/nuget/v3/index.json"}, "password", "sometoken")
        ]

        configureCredProviderForServiceConnectionFeeds(serviceConnections);
        var json = process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR]
        
        assert.equal(json, "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget/v3/index.json\",\"password\":\"sometoken\"}]}");
        done();
    });

    it("configureCredProviderForServiceConnectionFeeds multiple unique service connection endpoints", (done: Mocha.Done) => {
        process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR] = "";
        var serviceConnections = [
            new EntraServiceConnection({uri:"https://contoso.com/nuget/v3/index.json"}, "password", "sometoken"),
            new EntraServiceConnection({uri:"https://contoso.com/nuget123/v3/index.json"}, "password", "sometoken"),
        ]

        configureCredProviderForServiceConnectionFeeds(serviceConnections);
        var json = process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR]
        
        assert.equal(json, "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget/v3/index.json\",\"password\":\"sometoken\"},{\"endpoint\":\"https://contoso.com/nuget123/v3/index.json\",\"password\":\"sometoken\"}]}");
        done();
    });

    it("configureCredProviderForServiceConnectionFeeds multiple unique service connection types", (done: Mocha.Done) => {
        process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR] = "";
        var serviceConnections = [
            new EntraServiceConnection({uri:"https://contoso.com/nuget/v3/index.json"}, "password", "sometoken"),
            new UsernamePasswordServiceConnection({uri:"https://contoso.com/nuget123/v3/index.json"}, "password", "sometoken"),
        ]

        configureCredProviderForServiceConnectionFeeds(serviceConnections);
        var json = process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR]
        
        assert.equal(json, "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget/v3/index.json\",\"password\":\"sometoken\"},{\"endpoint\":\"https://contoso.com/nuget123/v3/index.json\",\"username\":\"password\",\"password\":\"sometoken\"}]}");
        done();
    });

    it("configureCredProviderForServiceConnectionFeeds multiple unique service connection types", (done: Mocha.Done) => {
        process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR] = "";
        var serviceConnections = [
            new EntraServiceConnection({uri:"https://contoso.com/nuget/v3/index.json"}, "password", "sometoken"),
            new UsernamePasswordServiceConnection({uri:"https://contoso.com/nuget123/v3/index.json"}, "password", "sometoken"),
        ]

        configureCredProviderForServiceConnectionFeeds(serviceConnections);
        var json = process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR]
        
        assert.equal(json, "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget/v3/index.json\",\"password\":\"sometoken\"},{\"endpoint\":\"https://contoso.com/nuget123/v3/index.json\",\"username\":\"password\",\"password\":\"sometoken\"}]}");
        done();
    });

    it("configureCredProviderForServiceConnectionFeeds with existing credentials, different endpoint", (done: Mocha.Done) => {
        process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR] = "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget123/v3/index.json\",\"username\":\"password\",\"password\":\"sometoken\"}]}"

        var serviceConnections = [
            new EntraServiceConnection({uri:"https://contoso.com/nuget/v3/index.json"}, "password", "sometoken")
        ]

        configureCredProviderForServiceConnectionFeeds(serviceConnections);
        var json = process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR]
        
        assert.equal(json, "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget/v3/index.json\",\"password\":\"sometoken\"},{\"endpoint\":\"https://contoso.com/nuget123/v3/index.json\",\"username\":\"password\",\"password\":\"sometoken\"}]}");
        done();
    });

    it("configureCredProviderForServiceConnectionFeeds with existing credentials for the same endpoint", (done: Mocha.Done) => {
        process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR] = "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget/v3/index.json\",\"password\":\"SomeOtherToken\"}]}"

        var serviceConnections = [
            new EntraServiceConnection({uri:"https://contoso.com/nuget/v3/index.json"}, "password", "sometoken"),
        ]

        configureCredProviderForServiceConnectionFeeds(serviceConnections);
        var json = process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR]
        
        assert.equal(json, "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget/v3/index.json\",\"password\":\"sometoken\"}]}");
        done();
    });

    it("configureCredProviderForServiceConnectionFeeds with existing credentials for the same endpoint different types", (done: Mocha.Done) => {
        process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR] = "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget/v3/index.json\",\"username\":\"password\",\"password\":\"SomeOtherToken\"}]}"

        var serviceConnections = [
            new EntraServiceConnection({uri:"https://contoso.com/nuget/v3/index.json"}, "password", "sometoken"),
        ]

        configureCredProviderForServiceConnectionFeeds(serviceConnections);
        var json = process.env[CRED_PROVIDER_EXTERNAL_ENDPOINTS_ENVVAR]
        
        assert.equal(json, "{\"endpointCredentials\":[{\"endpoint\":\"https://contoso.com/nuget/v3/index.json\",\"password\":\"sometoken\"}]}");
        done();
    });
}
