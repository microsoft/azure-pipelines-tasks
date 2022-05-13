import * as tl from "azure-pipelines-task-lib/task";

import { Package } from "./package";
import { SingleFilePackage } from "./singlefilepackage";
import { MultiFilePackage } from "./multifilepackage";
import { WebApi } from "azure-devops-node-api";

export class PackageUrlsBuilder {
    private type: string;
    private pattern: string[];
    private packagingMetadataAreaId: string;
    private packageProtocolDownloadAreadId: string;
    private extension: string;
    private feedConnection: WebApi;
    private pkgsConnection: WebApi;
    private packageProtocolAreaName: string;
    private executeWithRetries: <T>(operation: () => Promise<T>) => Promise<T>;

    private getRouteParams: (feedId: string, project: string, packageMetadata: any, fileMetadata: any) => any;

    get Type() {
        return this.type;
    }

    ofType(type: string): PackageUrlsBuilder {
        this.type = type;
        switch (this.type) {
            case "nuget":
                this.packagingMetadataAreaId = "7A20D846-C929-4ACC-9EA2-0D5A7DF1B197";
                this.packageProtocolDownloadAreadId = "6EA81B8C-7386-490B-A71F-6CF23C80B388";
                this.packageProtocolAreaName = "NuGet";
                this.extension = ".nupkg";
                break;
            case "npm":
                this.packagingMetadataAreaId = "7A20D846-C929-4ACC-9EA2-0D5A7DF1B197";
                this.packageProtocolDownloadAreadId = "75CAA482-CB1E-47CD-9F2C-C048A4B7A43E"; 
                this.packageProtocolAreaName = "npm";
                this.extension = ".tgz";
                break;
            case "pypi":
                this.packagingMetadataAreaId = "3B331909-6A86-44CC-B9EC-C1834C35498F";
                this.packageProtocolDownloadAreadId = "97218BAE-A64D-4381-9257-B5B7951F0B98";
                this.packageProtocolAreaName = "pypi";
                this.getRouteParams = this.getPythonRouteParams;
                break;
            case "maven":
                this.packagingMetadataAreaId = "3B331909-6A86-44CC-B9EC-C1834C35498F";
                this.packageProtocolDownloadAreadId = "F285A171-0DF5-4C49-AAF2-17D0D37D9F0E";
                this.packageProtocolAreaName = "maven";
                this.getRouteParams = this.getMavenRouteParams;
                break;
            default:
                throw new Error(tl.loc("PackageTypeNotSupported"));
        }
        return this;
    }

    get PackageProtocolAreaName() {
        return this.packageProtocolAreaName;
    }

    get GetRouteParams() {
        return this.getRouteParams;
    }

    get Extension() {
        return this.extension;
    }

    get PackagingMetadataAreaId() {
        return this.packagingMetadataAreaId;
    }

    get PackageProtocolDownloadAreadId() {
        return this.packageProtocolDownloadAreadId;
    }

    get Pattern() {
        return this.pattern;
    }

    matchingPattern(pattern: string[]): PackageUrlsBuilder {
        this.pattern = pattern;
        return this;
    }

    get PkgsConnection(): WebApi {
        return this.pkgsConnection;
    }

    withPkgsConnection(connection: WebApi): PackageUrlsBuilder {
        this.pkgsConnection = connection;
        return this;
    }

    withRetries(executeWithRetries:<T>(operation: () => Promise<T>) => Promise<T>): PackageUrlsBuilder {
        this.executeWithRetries = executeWithRetries;
        return this;
    }

    get ExecuteWithRetries() {
        return this.executeWithRetries;
    }

    get FeedsConnection(): WebApi {
        return this.feedConnection;
    }

    withFeedsConnection(connection: WebApi): PackageUrlsBuilder {
        this.feedConnection = connection;
        return this;
    }

    async build(): Promise<Package> {
        switch (this.type) {
            case "nuget":
            case "npm":
                return new SingleFilePackage(this);
            case "pypi":
            case "maven":
                return new MultiFilePackage(this);
            default:
                throw new Error(tl.loc("PackageTypeNotSupported"));
        }
    }

    private getPythonRouteParams(feedId: string, project: string, packageMetadata: any, fileMetadata: any): any {
        return {
            feedId: feedId,
            packageName: packageMetadata.protocolMetadata.data.name,
            packageVersion: packageMetadata.protocolMetadata.data.version,
            fileName: fileMetadata.name,
            project: project
        };
    }

    private getMavenRouteParams(feedId: string, project: string, packageMetadata: any, fileMetadata: any): any {
        var fileName = fileMetadata.name;
        var groupId = packageMetadata.protocolMetadata.data.groupId || packageMetadata.protocolMetadata.data.parent.groupId;
        var artifactId = packageMetadata.protocolMetadata.data.artifactId;
        var version = packageMetadata.protocolMetadata.data.version;

        var artifactPath = `${groupId}/${artifactId}/${version}/${fileName}`;
        return {
            feed: feedId,
            path: artifactPath,
            project: project
        };
    }
}
