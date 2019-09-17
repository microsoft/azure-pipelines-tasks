import * as assert from "assert";
import { buildExternalFeedEndpointsJson } from "../credentialProviderUtils";
import { ServiceConnectionAuthType, TokenServiceConnection, ApiKeyServiceConnection, UsernamePasswordServiceConnection } from "../serviceConnectionUtils";

export function credentialProviderUtilsTests() {

    beforeEach(() => {
    });

    afterEach(() => {
    });

    it("buildExternalFeedEndpointsJson null returns null", (done: MochaDone) => {
        assert.equal(buildExternalFeedEndpointsJson(null), null);
        done();
    });

    it("buildExternalFeedEndpointsJson empty returns null", (done: MochaDone) => {
        assert.equal(buildExternalFeedEndpointsJson([]), null);
        done();
    });

    it("buildExternalFeedEndpointsJson token", (done: MochaDone) => {
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

    it("buildExternalFeedEndpointsJson usernamepassword", (done: MochaDone) => {
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

    it("buildExternalFeedEndpointsJson token + usernamepassword", (done: MochaDone) => {
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

    it("buildExternalFeedEndpointsJson apikey throws", (done: MochaDone) => {
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

    it("buildExternalFeedEndpointsJson otherauthtype throws", (done: MochaDone) => {
        assert.throws(() => {
            buildExternalFeedEndpointsJson([
                {
                    packageSource: {
                        uri: "https://contoso.com/nuget/v3/index.json" 
                    },
                    authType: <any>"unsupportedauthtype",
                }
            ])
        });

        done();
    });
}
