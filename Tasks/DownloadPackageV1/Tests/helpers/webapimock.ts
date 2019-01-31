import { Readable } from "stream";

export class WebApiMock {
    vsoClient: VsoClientMock;
    rest: RestMock;
    http: HttpMock;

    constructor() {
        this.vsoClient = new VsoClientMock();
        this.rest = new RestMock();
        this.http = new HttpMock();
    }

    public getCoreApi() {
        return { http: this.http };
    }
}

class VsoClientMock {
    private packageUrlMap = {
        "7A20D846-C929-4ACC-9EA2-0D5A7DF1B197": "singlePackageMetadataUrl",
        "6EA81B8C-7386-490B-A71F-6CF23C80B388": "singlePackageDownloadUrl",
        "3B331909-6A86-44CC-B9EC-C1834C35498F": "multiPackageMetadataUrl",
        "F285A171-0DF5-4C49-AAF2-17D0D37D9F0E": "multiPackageDownloadUrl"
    };
    async getVersioningData(
        apiVersion: string,
        area: string,
        locationId: string,
        routeValues: any,
        queryParams?: any
    ): Promise<any> {
        return Promise.resolve({ requestUrl: this.packageUrlMap[locationId] });
    }
}

class RestMock {
    private metadataMap = {
        singlePackageMetadataUrl: {
            name: "singlePackageName"
        },
        multiPackageMetadataUrl: {
            protocolMetadata: {
                data: {
                    groupId: "groupid",
                    artifactId: "artifactId",
                    version: "version"
                }
            },
            files: [
                {
                    name: "packageName.jar",
                    protocolMetadata: {
                        data: {
                            storageId: "storageId"
                        }
                    }
                },
                {
                    name: "packageName.pom",
                    protocolMetadata: {
                        data: {
                            storageId: null,
                            content: "pom content"
                        }
                    }
                },
                {
                    name: "packageName.xml",
                    protocolMetadata: {
                        data: {
                            storageId: null
                        }
                    }
                }
            ]
        }
    };
    async get(resource: string, options?: any): Promise<any> {
        return Promise.resolve({ result: this.metadataMap[resource] });
    }
}

class HttpMock {
    async get(resource: string, additionalHeaders?: any): Promise<any> {
        return {
            message: new Readable({
                read(size) {
                    this.push("test");
                    this.push(null);
                }
            })
        };
    }
}
