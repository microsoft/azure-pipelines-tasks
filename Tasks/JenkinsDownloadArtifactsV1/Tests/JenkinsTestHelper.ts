import tmrm = require('vsts-task-lib/mock-run');

export interface ExpectedResult {
    returnCode: number;
    apiResult: string;
 };

export function RegisterHttpClientMock(tr: tmrm.TaskMockRunner, getResultCallback: any)
{
    // setting retry value to zero as we don't want the test to hang up
    process.env['VSTS_HTTP_RETRY'] = "0"

    tr.registerMock("artifact-engine/Providers/typed-rest-client/HttpClient", {
        HttpClient: function(name, handlers, options) {
            return {
                get: function(url) {
                    console.log(`Mock invoked for ${url}`)
            
                    return {
                        then: function(response) {
                            let expectedResult: ExpectedResult = getResultCallback(url);

                            if (!expectedResult) {
                                expectedResult = GetErrorExpectedResult();
                            }

                            response({
                                message: {
                                    statusCode: expectedResult.returnCode
                                },
                                readBody: function() {
                                    return {
                                        then: function(body) {
                                            body(expectedResult.apiResult);          
                                        }
                                    }
                                }
                            });
                        }
                    };
                }    
            }
        }
    });
}

export function GetSuccessExpectedResult(result: string): ExpectedResult{
    return {
        returnCode: 200,
        apiResult: result
    };
}

export function GetErrorExpectedResult(returnCode?: number, result?: string): ExpectedResult {
    return {
        returnCode: returnCode || 500,
        apiResult: result
    };
}

export function RegisterArtifactEngineMock(tr: tmrm.TaskMockRunner)
{
    tr.registerMock("artifact-engine/Engine", { 
        ArtifactEngine: function() {
            return { 
                processItems: function(A,B,C) {},
            }
        },
        ArtifactEngineOptions: function() {
        }
    });
}