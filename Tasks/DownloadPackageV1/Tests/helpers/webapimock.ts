import path = require("path");
import fs = require("fs");
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
        "3B331909-6A86-44CC-B9EC-C1834C35498F": "multiPackageMetadataUrl"
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
