import * as assert from "assert";
import * as mocker from "azure-pipelines-task-lib/lib-mocker";

import Lazy_NpmRegistry = require('../../npm/npmregistry');

const BASIC_AUTH_PAT_PASSWD_REGEX = /\/\/.*\/:_password=.*/g;
const BEARER_AUTH_REGEX = /\/\/.*\/:_authToken=AUTHTOKEN.*/g;
const BASIC_AUTH_PAT_EML_REGEX = /\/\/.*\/:email=VssEmail.*/g;
const BASIC_AUTH_PAT_USERNAME_REGEX = /\/\/.*\/:username=VssToken.*/g;
const ALWAYS_AUTH_REGEX = /\/\/.*\/:always-auth=true.*/g;

export function npmcommon() {
    before(() => {
        mocker.disable(); // needed to ensure that we can mock vsts-task-lib/task
        mocker.enable({
            useCleanCache: true,
            warnOnUnregistered: false
        } as mocker.MockOptions);
    });

    after(() => {
        mocker.disable();
    });

    beforeEach(() => {
        mocker.resetCache();
    });

    afterEach(() => {
        mocker.deregisterAll();
    });

    it('gets npm registries', (done: MochaDone) => {
        let mockTask = {
            writeFile: (file: string, data: string | Buffer) => {
                // no-op
            }
        };
        mocker.registerMock('azure-pipelines-task-lib/task', mockTask);
        let npmrc = `registry=http://example.com
                     always-auth=true
                     @scoped:registry=http://scoped.com
                     //scoped.com/:_authToken=thisIsASecretToken
                     @scopedTwo:registry=http://scopedTwo.com
                     ; some comments
                     @scoped:always-auth=true
                     # more comments`;

        let mockFs = {
            readFileSync: (path: string) => npmrc
        };
        mocker.registerMock('fs', mockFs);

        let npmrcParser = require('../../npm/npmrcparser');
        let registries = npmrcParser.GetRegistries('');

        assert.equal(registries.length, 3);
        assert.equal(registries[0], 'http://example.com/');
        assert.equal(registries[1], 'http://scoped.com/');
        assert.equal(registries[2], 'http://scopedTwo.com/');

        done();
    });

    it('gets feed id from VSTS registry', (done: MochaDone) => {
        let mockTask = {
            debug: message => {}
        };
        mocker.registerMock('vsts-task-lib/task', mockTask);
        let npmutil = require('../../npm/npmutil');

        assert.equal(npmutil.getFeedIdFromRegistry(
            'https://account.visualstudio.com/_packaging/feedId/npm/registry'),
            'feedId');
        assert.equal(npmutil.getFeedIdFromRegistry(
            'https://account.visualstudio.com/_packaging/feedId/npm/registry/'),
            'feedId');
        assert.equal(npmutil.getFeedIdFromRegistry(
            'https://account.visualstudio.com/_packaging/feedId@PreRelease/npm/registry/'),
            'feedId@PreRelease');
        assert.equal(npmutil.getFeedIdFromRegistry(
            'http://TFSSERVER/_packaging/feedId/npm/registry'),
            'feedId');
        assert.equal(npmutil.getFeedIdFromRegistry(
            'http://TFSSERVER:1234/_packaging/feedId/npm/registry'),
            'feedId');

        done();
    });

    it('gets correct local registries', () => {
        let mockParser = {
            GetRegistries: (npmrc: string) => [
                'http://registry.com/npmRegistry/',
                'http://example.pkgs.visualstudio.com/npmRegistry/',
                'http://localTFSServer/npmRegistry/'
            ],
            setResourcePath:(path)=>{}
        };
        mocker.registerMock('./npmrcparser', mockParser);
        let mockTask = {
            getVariable: (v: string) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    return 'http://example.visualstudio.com';
                }
            },
            debug: (message: string) => {
                // no-op
            },
            loc: (key: string) => {
                // no-op
            },
            setResourcePath:(path)=>{}
        };
        mocker.registerMock('azure-pipelines-task-lib/task', mockTask);

        let npmutil = require('../../npm/npmutil');

        return npmutil.getLocalRegistries(['http://example.pkgs.visualstudio.com/', 'http://example.com'], '').then((registries: string[]) => {
            assert.equal(registries.length, 1);
            assert.equal(registries[0], 'http://example.pkgs.visualstudio.com/npmRegistry/');

            mockTask.getVariable = () => 'http://localTFSServer/';
            return npmutil.getLocalRegistries(['http://localTFSServer/', 'http://example.com'], '').then((registries: string[]) => {
                assert.equal(registries.length, 1);
                assert.equal(registries[0], 'http://localTFSServer/npmRegistry/');
            });
        });
    });

    it('does Basic auth for hosted when service endpoint auth is Token and endpoint is in the .visualstudio.com domain',
        async () => {
        // Scenario: Cross account on visualstudio.com
        let mockTask = {
            getVariable: (v) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    return 'http://example.visualstudio.com';
                }
            },
            getEndpointAuthorization: (id, optional) => {
                return { scheme: 'Token', parameters: { 'apitoken': 'AUTHTOKEN' } };
            },
            getEndpointUrl: (id, optional) => {
                return 'http://serviceendpoint.visualstudio.com';
            },
            loc: (key: string) => {
                // no-op
            },
            getHttpProxyConfiguration: (endpoint) => {
                return null;
            },
            setSecret: () => {
                return;
            },
            setResourcePath: (path) => {}
        };
        mocker.registerMock('azure-pipelines-task-lib/task', mockTask);

        mocker.registerMock('typed-rest-client/HttpClient', {
            HttpClient: function() {
                return {
                    get: function(url, headers) {
                        return {
                        then: function(handler) {
                            handler({
                                message: {
                                    statusCode: 401,
                                    rawHeaders: ['x-tfs-foo: abc', 'x-content-type-options: nosniff', 'X-Powered-By: ASP.NET']
                                },
                                readBody: function() {
                                    return Promise.resolve('mocked body content');
                                }
                            });
                        }
                        };
                    }
                };
            }
        });

        const npmregistry = require("../../npm/npmregistry");
        let registry = await npmregistry.NpmRegistry.FromServiceEndpoint('endpointId');

        assert(registry.auth.match(BASIC_AUTH_PAT_PASSWD_REGEX), `Auth must contain a password. Auth is: (${registry.auth})`);
        assert(registry.auth.match(BASIC_AUTH_PAT_EML_REGEX), `Auth must contain a email. Auth is: (${registry.auth})`);
        assert(registry.auth.match(BASIC_AUTH_PAT_USERNAME_REGEX), `Auth must contain a email. Auth is: (${registry.auth})`);
        assert(registry.auth.match(ALWAYS_AUTH_REGEX), `Auth must contain always-auth. Auth is: (${registry.auth})`);
    });



    it('does Bearer auth for hosted when service endpoint auth is Token and endpoint is 3rd party', async () => {
        // Scenario: User is connecting to a non-visualstudio.com registry
        let mockTask = {
            getVariable: (v) => {
                if (v === 'System.TeamFoundationCollectionUri') {
                    return 'http://example.visualstudio.com';
                }
            },
            getEndpointAuthorization: (id, optional) => {
                return { scheme: 'Token', parameters: { 'apitoken': 'AUTHTOKEN' } };
            },
            getEndpointUrl: (id, optional) => {
                return 'http://somepublicrepo.contoso.com:8080/some/random/path';
            },
            loc: (key: string) => {
                // no-op
            },
            getHttpProxyConfiguration: (endpoint) => {
                return null;
            },
            setSecret : msg => null,
            setResourcePath: (path) => {}
        };
        mocker.registerMock('azure-pipelines-task-lib/task', mockTask);

        mocker.registerMock('typed-rest-client/HttpClient', {
            HttpClient: function() {
                return {
                    get: function(url, headers) {
                        return {
                        then: function(handler) {
                            handler({
                                message: {
                                    statusCode: 401,
                                    rawHeaders: ['x-content-type-options: nosniff', 'X-Powered-By: ASP.NET']
                                },
                                readBody: function() {
                                    return Promise.resolve('mocked body content');
                                }
                            });
                        }
                        };
                    }
                };
            }
        });

        const npmregistry = require("../../npm/npmregistry");
        let registry = await npmregistry.NpmRegistry.FromServiceEndpoint('endpointId');

        assert(registry.auth.match(BEARER_AUTH_REGEX), `Auth must contain _authToken. Auth is: (${registry.auth})`);
        assert(registry.auth.match(ALWAYS_AUTH_REGEX), `Auth must contain always-auth. Auth is: (${registry.auth})`);
    });

    it('handles views in registry URL', async () => {
        // Scenario: Includes view (e.g. @Release) within the registry entry
        const hostName = 'https://mytfsserver.visualstudio.com';
        const nerfedRegistry = "//mytfsserver.pkgs.visualstudio.com/npmRegistry@Release/npm/registry/";
        const registry = `https:${nerfedRegistry}`;
        const authToken = '**sometoken**';

        const mockTask = {
            loc: key => "LocValue",
            debug: msg => null,
            exist: path => true,
            getVariable: v => {
                return (v === 'System.TeamFoundationCollectionUri') ? hostName : null;
            },
            getEndpointAuthorization: (id, optional) => {
                return { scheme: 'OAuth', parameters: { 'AccessToken': authToken } };
            },
            setSecret : msg => null,
            setResourcePath: (path) => {}
        };
        const mockParser = {
            GetRegistries: (npmrc: string) => [registry]
        };
        mocker.registerMock('azure-pipelines-task-lib/task', mockTask);
        mocker.registerMock('./npmrcparser', mockParser);
        
        const npmutil = require('../../npm/npmutil');
        const registries = await npmutil.getLocalNpmRegistries("foobarPath", ['https://mytfsserver.pkgs.visualstudio.com']);

        assert.equal(registries.length, 1, "Expected one response");
        const npmRegistry: Lazy_NpmRegistry.INpmRegistry = registries[0];
        assert.equal(npmRegistry.url, registry, "Registry needs to match");
        assert.equal(npmRegistry.auth, `${nerfedRegistry}:_authToken=${authToken}`, "Auth needs to match");
        assert.equal(npmRegistry.authOnly, true, "Authonly needs to match");
    });
};
