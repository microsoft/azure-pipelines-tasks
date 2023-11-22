import * as path from "path";
import * as fs from "fs";

import { Readable } from "stream";
import { IncomingMessage } from "http";

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
        "6EA81B8C-7386-490B-A71F-6CF23C80B388": "nugetPackageDownloadUrl",
        "75CAA482-CB1E-47CD-9F2C-C048A4B7A43E": "npmPackageDownloadUrl",
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
        if(locationId == "7A20D846-C929-4ACC-9EA2-0D5A7DF1B197" 
            && routeValues['packageId'] == "6f598cbe-a5e2-4f75-aa78-e0fd08301a17") {
                return Promise.resolve({ requestUrl: "badNupKg" });
        }

        if(locationId == "6EA81B8C-7386-490B-A71F-6CF23C80B388"
            && routeValues["packageName"] == "badNupkgPackageName") {
                return Promise.resolve({ requestUrl: "badNupKgDownloadUrl" });
        }

        if(queryParams && "packageNameQuery" in queryParams) {
            return Promise.resolve({ requestUrl: "packageNameResolverUrl" })
        }
        return Promise.resolve({ requestUrl: this.packageUrlMap[locationId] });
    }
}

class RestMock {
    private metadataMap = {
        packageNameResolverUrl: {
            "count":2,
            "value": [
                {
                    "name": "unknown"
                },
                {
                    "name": "packageName",
                    "id": "6f598cbe-a5e2-4f75-aa78-e0fd08301a15"
                }
            ]
        },
        badNupKg: {
            name: "badNupkgPackageName"
        },
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
                            storageId: "storageId",
                            content: null
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
                            storageId: null,
                            content: null
                        }
                    }
                }
            ]
        }
    };
    async get(resource: string, options?: any): Promise<any> {
        return Promise.resolve({ statusCode: 200, result: this.metadataMap[resource] });
    }
}

class HttpMock {
    private responseMap = {
        nugetPackageDownloadUrl: fs.createReadStream(path.join(__dirname, "inputs", "nugetFile.nupkg")),
        npmPackageDownloadUrl: fs.createReadStream(path.join(__dirname, "inputs", "npmFile.tgz")),
        multiPackageDownloadUrl: new Readable({
            read(size) {
                this.push("test");
                this.push(null);
            }
        }),
        badNupKgDownloadUrl: fs.createReadStream(path.join(__dirname, "inputs", "badNupkgPackageName.nupkg"))
    };

    async get(resource: string, additionalHeaders?: any): Promise<any> {
        var response = this.responseMap[resource] as IncomingMessage;
        response.statusCode = 200;
        return {
            message: response
        };
    }
}
