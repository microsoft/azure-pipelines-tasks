import * as tl from "vsts-task-lib/task";
import * as vsts from "vso-node-api/WebApi";

import { Package } from "./package";
import { SingleFilePackage } from "./singlefilepackage";
import { MultiFilePackage } from "./multifilepackage";

export class PackageUrlsBuilder {
    private type: string;
    private pattern: string;
    private maxRetries: number;
    private packagingMetadataAreaId: string;
    private packageProtocolDownloadAreadId: string;
    private extension: string;
    private feedConnection: vsts.WebApi;
    private pkgsConnection: vsts.WebApi;
    private packageProtocolAreaName: string;
    private blobStoreRedirectEnabled: boolean = false;

    private getRouteParams: (feedId: string, packageMetadata: any, fileMetadata: any) => any;

    get Type() {
        return this.type;
    }

    ofType(type: string): PackageUrlsBuilder {
        this.type = type;
        switch (this.type) {
            case "NuGet":
                this.packagingMetadataAreaId = "7A20D846-C929-4ACC-9EA2-0D5A7DF1B197";
                this.packageProtocolDownloadAreadId = "6EA81B8C-7386-490B-A71F-6CF23C80B388";
                this.packageProtocolAreaName = "NuGet";
                this.extension = ".zip";
                break;
            case "Npm":
                this.packagingMetadataAreaId = "7A20D846-C929-4ACC-9EA2-0D5A7DF1B197";
                this.packageProtocolDownloadAreadId = "75CAA482-CB1E-47CD-9F2C-C048A4B7A43E"; // TODO fix to scoped
                this.packageProtocolAreaName = "npm";
                this.extension = ".tgz";
                break;
            case "Python":
                this.packagingMetadataAreaId = "3B331909-6A86-44CC-B9EC-C1834C35498F";
                this.packageProtocolDownloadAreadId = "97218BAE-A64D-4381-9257-B5B7951F0B98";
                this.packageProtocolAreaName = "pypi";
                this.blobStoreRedirectEnabled = true;
                this.getRouteParams = this.getPythonRouteParams;
                break;
            case "Maven":
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

    get BlobStoreRedirectEnabled() {
        return this.blobStoreRedirectEnabled;
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

    matchingPattern(pattern: string): PackageUrlsBuilder {
        this.pattern = pattern;
        return this;
    }

    get PkgsConnection(): vsts.WebApi {
        return this.pkgsConnection;
    }

    withPkgsConnection(connection: vsts.WebApi): PackageUrlsBuilder {
        this.pkgsConnection = connection;
        return this;
    }

    get FeedsConnection(): vsts.WebApi {
        return this.feedConnection;
    }

    withFeedsConnection(connection: vsts.WebApi): PackageUrlsBuilder {
        this.feedConnection = connection;
        return this;
    }

    get MaxRetries() {
        return this.maxRetries;
    }

    withMaxRetries(maxRetries: number): PackageUrlsBuilder {
        this.maxRetries = maxRetries;
        return this;
    }

    async build(): Promise<Package> {
        switch (this.type) {
            case "NuGet":
            case "Npm":
                return new SingleFilePackage(this);
            case "Python":
            case "Maven":
                return new MultiFilePackage(this);
            default:
                throw new Error(tl.loc("PackageTypeNotSupported"));
        }
    }

    private getPythonRouteParams(feedId: string, packageMetadata: any, fileMetadata: any): any {
        return {
            feedId: feedId,
            packageName: packageMetadata.protocolMetadata.data.name,
            packageVersion: packageMetadata.protocolMetadata.data.version,
            fileName: fileMetadata.name
        };
    }

    private getMavenRouteParams(feedId: string, packageMetadata: any, fileMetadata: any): any {
        var fileName = fileMetadata.name;
        var groupId = packageMetadata.protocolMetadata.data.groupId.replace(new RegExp("\\."), "/");
        var artifactId = packageMetadata.protocolMetadata.data.artifactId;
        var version = packageMetadata.protocolMetadata.data.version;

        var artifactPath = `${groupId}/${artifactId}/${version}/${fileName}`;
        return {
            feed: feedId,
            path: artifactPath
        };
    }
}
