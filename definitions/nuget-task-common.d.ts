declare module 'nuget-task-common/Authentication' {
	export class NuGetAuthInfo {
	    uriPrefixes: string[];
	    accessToken: string;
	    constructor(uriPrefixes: string[], accessToken: string);
	}
	export function getSystemAccessToken(): string;

}
declare module 'nuget-task-common/Utility' {
	/// <reference path="../../../definitions/Q.d.ts" />
	export function resolveFilterSpec(filterSpec: string, basePath?: string, allowEmptyMatch?: boolean): string[];
	export function resolveWildcardPath(pattern: string, allowEmptyWildcardMatch?: boolean): string[];
	export function stripLeadingAndTrailingQuotes(path: string): string;

}
declare module 'nuget-task-common/pe-parser/VersionInfoVersion' {
	export class VersionInfoVersion {
	    a: number;
	    b: number;
	    c: number;
	    d: number;
	    constructor(a: number, b: number, c: number, d: number);
	    static fromDWords(highDWord: number, lowDWord: number): VersionInfoVersion;
	    static compare(left: VersionInfoVersion, right: VersionInfoVersion): number;
	    toString(): string;
	    equals(other: VersionInfoVersion): boolean;
	    static MAX_VERSION: VersionInfoVersion;
	    static MIN_VERSION: VersionInfoVersion;
	}
	export default VersionInfoVersion;

}
declare module 'nuget-task-common/NuGetQuirks' {
	import VersionInfoVersion from 'nuget-task-common/pe-parser/VersionInfoVersion';
	export enum NuGetQuirkName {
	    /** Race condition in credential provider which causes NuGet to not supply credentials */
	    CredentialProviderRace = 0,
	    /** No credential provider support */
	    NoCredentialProvider = 1,
	    /** repositoryPath value in nuget.config is relative to the wrong nuget.config in some cases */
	    RelativeRepositoryPathBug = 2,
	    /** does not send NTLM credentials on follow-up requests */
	    NtlmReAuthBug = 3,
	    /** Does not support authentication to TFS on-premises via credential provider */
	    NoTfsOnPremAuthCredentialProvider = 4,
	    /** Does not support authentication to TFS on-premises via nuget.config */
	    NoTfsOnPremAuthConfig = 5,
	    /** Does not support the NuGet v3 protocol */
	    NoV3 = 6,
	}
	export class NuGetQuirks {
	    nuGetVersion: VersionInfoVersion;
	    quirks: NuGetQuirkName[];
	    constructor(nuGetVersion: VersionInfoVersion, quirks: NuGetQuirkName[]);
	    static fromVersion(nuGetVersion: VersionInfoVersion): NuGetQuirks;
	    hasQuirk(quirk: NuGetQuirkName): boolean;
	    getQuirkNames(): string[];
	}
	export default NuGetQuirks;

}
declare module 'nuget-task-common/pe-parser/IReadableFile' {
	export interface IReadableFile {
	    readAsync(buffer: Buffer, offset: number, length: number, position: number): Promise<number>;
	    closeAsync(): Promise<void>;
	}
	export default IReadableFile;

}
declare module 'nuget-task-common/pe-parser/SectionTable' {
	import IReadableFile from 'nuget-task-common/pe-parser/IReadableFile';
	export interface SectionTableEntry {
	    name: string;
	    virtualSize: number;
	    virtualAddress: number;
	    sizeOfRawData: number;
	    pointerToRawData: number;
	    pointerToRelocations: number;
	    pointerToLinenumbers: number;
	    numberOfRelocations: number;
	    numberOfLinenumbers: number;
	    characteristics: number;
	}
	export class SectionTable {
	    sections: SectionTableEntry[];
	    constructor(sections: SectionTableEntry[]);
	    static readAsync(file: IReadableFile, buffer: Buffer, filePositionOfSectionTable: number, numberOfSections: number): Promise<SectionTable>;
	    getSection(name: string): SectionTableEntry;
	}
	export default SectionTable;

}
declare module 'nuget-task-common/pe-parser/PEImageFile' {
	import IReadableFile from 'nuget-task-common/pe-parser/IReadableFile';
	import { SectionTable, SectionTableEntry } from 'nuget-task-common/pe-parser/SectionTable';
	export interface CoffHeader {
	    machine: number;
	    numberOfSections: number;
	    timeDateStamp: number;
	    pointerToSymbolTable: number;
	    numberOfSymbols: number;
	    sizeOfOptionalHeader: number;
	    characteristics: number;
	}
	export class PEImageFile {
	    coffHeader: CoffHeader;
	    sectionTable: SectionTable;
	    constructor(coffHeader: CoffHeader, sectionTable: SectionTable);
	    static readAsync(file: IReadableFile): Promise<PEImageFile>;
	    getSection(name: string): SectionTableEntry;
	}
	export default PEImageFile;

}
declare module 'nuget-task-common/pe-parser/ReadableFile' {
	import IReadableFile from 'nuget-task-common/pe-parser/IReadableFile';
	export class ReadableFile implements IReadableFile {
	    path: string;
	    fd: number;
	    constructor(path: string, fd: number);
	    static openAsync(path: string): Promise<ReadableFile>;
	    readAsync(buffer: Buffer, offset: number, length: number, position: number): Promise<number>;
	    closeAsync(): Promise<void>;
	}
	export default ReadableFile;

}
declare module 'nuget-task-common/pe-parser/ResourceSection' {
	import IReadableFile from 'nuget-task-common/pe-parser/IReadableFile';
	import { SectionTableEntry } from 'nuget-task-common/pe-parser/SectionTable';
	export interface ResourceData {
	    dataRva: number;
	    size: number;
	    codepage: number;
	}
	export interface ResourceDirectoryEntry {
	    id: number | string;
	    data: ResourceData | ResourceDirectory;
	}
	export class ResourceDirectory {
	    entries: ResourceDirectoryEntry[];
	    getDataEntry(id: string | number): ResourceData;
	    getSubdirectory(id: string | number): ResourceDirectory;
	}
	export class ResourceSection {
	    root: ResourceDirectory;
	    private file;
	    private sectionTableEntry;
	    constructor(root: ResourceDirectory, file: IReadableFile, sectionTableEntry: SectionTableEntry);
	    static load(file: IReadableFile, resourceSectionTableEntry: SectionTableEntry): Promise<ResourceSection>;
	    getResource(...path: (number | string)[]): ResourceData;
	    getResourceBufferAsync(...path: (number | string)[]): Promise<Buffer>;
	}
	export default ResourceSection;

}
declare module 'nuget-task-common/pe-parser/VersionResource' {
	import VersionInfoVersion from 'nuget-task-common/pe-parser/VersionInfoVersion';
	export interface RawVsFixedFileInfo {
	    signature: number;
	    structVersion: number;
	    fileVersionMS: number;
	    fileVersionLS: number;
	    productVersionMS: number;
	    productVersionLS: number;
	    fileFlagsMask: number;
	    fileFlags: number;
	    fileOS: number;
	    fileType: number;
	    fileSubtype: number;
	    fileDateMS: number;
	    fileDateLS: number;
	}
	export interface RawVsVersionInfoElement {
	    header: RawVsVersionInfoElementHeader;
	    rawChildren: RawVsVersionInfoElement[];
	}
	export interface RawVsVersionInfoElementHeader {
	    length: number;
	    valueLength: number;
	    type: number;
	    key: string;
	    /** Offset from the beginning of the version resource to the beginning of this header */
	    offset: number;
	    /** Offset from the beginning of the version resource to the Value field of this element */
	    valueOffset: number;
	    /** Offset from the beginning of the version resource to the Children field of this element */
	    childrenOffset: number;
	}
	export interface VersionStrings {
	    [key: string]: string;
	    Comments?: string;
	    CompanyName?: string;
	    FileDescription?: string;
	    FileVersion?: string;
	    InternalName?: string;
	    LegalCopyright?: string;
	    LegalTrademarks?: string;
	    OriginalFilename?: string;
	    PrivateBuild?: string;
	    ProductName?: string;
	    ProductVersion?: string;
	    SpecialBuild?: string;
	}
	export interface VersionInfo {
	    fileVersion?: VersionInfoVersion;
	    productVersion?: VersionInfoVersion;
	    strings: VersionStrings;
	}
	export class VersionResource {
	    versionInfo: VersionInfo;
	    rawVersionInfoTree: RawVsVersionInfoElement;
	    constructor(buffer: Buffer);
	}
	export default VersionResource;

}
declare module 'nuget-task-common/pe-parser/index' {
	import IReadableFile from 'nuget-task-common/pe-parser/IReadableFile';
	import { VersionInfo } from 'nuget-task-common/pe-parser/VersionResource';
	export function getFileVersionInfoAsync(file: string | IReadableFile): Promise<VersionInfo>;

}
declare module 'nuget-task-common/NuGetToolRunner' {
	/// <reference path="../../../definitions/node.d.ts" />
	/// <reference path="../../../definitions/vsts-task-lib.d.ts" />
	import { ToolRunner, IExecOptions, IExecResult } from 'vsts-task-lib/toolrunner';
	import * as auth from 'nuget-task-common/Authentication';
	import { NuGetQuirks } from 'nuget-task-common/NuGetQuirks';
	export interface NuGetEnvironmentSettings {
	    authInfo: auth.NuGetAuthInfo;
	    credProviderFolder: string;
	    extensionsDisabled: boolean;
	}
	export class NuGetToolRunner extends ToolRunner {
	    private _settings;
	    constructor(nuGetExePath: string, settings: NuGetEnvironmentSettings);
	    execSync(options?: IExecOptions): IExecResult;
	    exec(options?: IExecOptions): Q.Promise<number>;
	}
	export function createNuGetToolRunner(nuGetExePath: string, settings: NuGetEnvironmentSettings): NuGetToolRunner;
	export function locateNuGetExe(userNuGetExePath: string): string;
	export function getNuGetQuirksAsync(nuGetExePath: string): Promise<NuGetQuirks>;
	export function isCredentialProviderEnabled(quirks: NuGetQuirks): boolean;
	export function isCredentialConfigEnabled(quirks: NuGetQuirks): boolean;
	export function locateCredentialProvider(): string;

}
declare module 'nuget-task-common/INuGetCommandOptions' {
	import { NuGetEnvironmentSettings } from 'nuget-task-common/NuGetToolRunner';
	export interface INuGetCommandOptions {
	    /** settings used to initialize the environment NuGet.exe is invoked in */
	    environment: NuGetEnvironmentSettings;
	    /** full path to NuGet.exe */
	    nuGetPath: string;
	    /** path to the NuGet config file. Passed as the -ConfigFile argument. */
	    configFile: string;
	}
	export default INuGetCommandOptions;

}
declare module 'nuget-task-common/LocationApi' {
	import Q = require('q');
	import vstsClientBases = require('vso-node-api/ClientApiBases');
	import VsoBaseInterfaces = require('vso-node-api/interfaces/common/VsoBaseInterfaces');
	export interface Property {
	    $type: string;
	    $value: string;
	}
	export interface Identity {
	    id: string;
	    descriptor: string;
	    providerDisplayName?: string;
	    customDisplayName?: string;
	    properties: {
	        [key: string]: Property;
	    };
	}
	export interface LocationMapping {
	    accessMappingMoniker: string;
	    location: string;
	}
	export interface ServiceDefinition {
	    serviceOwner: string;
	    serviceType: string;
	    locationMappings?: LocationMapping[];
	    identifier: string;
	    displayName: string;
	    relativeToSetting?: string;
	    toolId: string;
	    properties: {
	        [key: string]: Property;
	    };
	}
	export interface AccessMapping {
	    displayName: string;
	    moniker: string;
	    accessPoint: string;
	    serviceOwner: string;
	    virtualDirectory: string;
	}
	export interface LocationServiceData {
	    serviceOwner: string;
	    accessMappings: AccessMapping[];
	    defaultAccessMappingMoniker: string;
	    serviceDefinitions: ServiceDefinition[];
	}
	export interface ConnectionData {
	    authenticatedUser: Identity;
	    authorizedUser: Identity;
	    instanceId: string;
	    locationServiceData: LocationServiceData;
	}
	export class LocationApi extends vstsClientBases.ClientApiBase {
	    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[]);
	    getConnectionData(onResult: (err: any, statusCode: number, connectionData: ConnectionData) => void): void;
	}
	export class QLocationApi extends vstsClientBases.QClientApiBase {
	    api: LocationApi;
	    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[]);
	    getConnectionData(): Q.Promise<ConnectionData>;
	}

}
declare module 'nuget-task-common/LocationHelpers' {
	import Q = require('q');
	import * as locationApi from 'nuget-task-common/LocationApi';
	export function getIdentityDisplayName(identity: locationApi.Identity): string;
	export function getIdentityAccount(identity: locationApi.Identity): string;
	export function getAllAccessMappingUris(connectionData: locationApi.ConnectionData): string[];
	export class GetConnectionDataForAreaError extends Error {
	    code: string;
	    constructor(message: string, code: string);
	}
	export function getConnectionDataForArea(serviceUri: string, areaName: string, areaId: string, accessToken: string): Q.Promise<locationApi.ConnectionData>;
	export function getNuGetConnectionData(serviceUri: string, accessToken: string): Q.Promise<locationApi.ConnectionData>;
	/**
	 * Make assumptions about VSTS domain names to generate URI prefixes for feeds in the current collection.
	 * Returns a promise so as to provide a drop-in replacement for location-service-based lookup.
	 */
	export function assumeNuGetUriPrefixes(collectionUri: string): Q.Promise<string[]>;

}
declare module 'nuget-task-common/NuGetConfigHelper' {
	import Q = require('q');
	import * as auth from 'nuget-task-common/Authentication';
	import * as ngToolRunner from 'nuget-task-common/NuGetToolRunner';
	export interface IPackageSource {
	    feedName: string;
	    feedUri: string;
	}
	export class NuGetConfigHelper {
	    private _nugetPath;
	    private _nugetConfigPath;
	    private _authInfo;
	    private _environmentSettings;
	    private tempNugetConfigBaseDir;
	    private tempNugetConfigDir;
	    private tempNugetConfigFileName;
	    tempNugetConfigPath: string;
	    constructor(nugetPath: string, nugetConfigPath: string, authInfo: auth.NuGetAuthInfo, environmentSettings: ngToolRunner.NuGetEnvironmentSettings);
	    ensureTempConfigCreated(): void;
	    setSources(packageSources: IPackageSource[], includeAuth: boolean): void;
	    getSourcesFromConfig(): Q.Promise<IPackageSource[]>;
	    private removeSourcesInNugetConfig(packageSources);
	    private addSourcesInNugetConfig(packageSources);
	    private shouldGetCredentialsForFeed(source);
	}

}

declare module 'nuget-task-common/Utility' {
	/// <reference path="../../../definitions/Q.d.ts" />
	export function resolveFilterSpec(filterSpec: string, basePath?: string, allowEmptyMatch?: boolean): string[];
	export function resolveWildcardPath(pattern: string, allowEmptyWildcardMatch?: boolean): string[];
	export function stripLeadingAndTrailingQuotes(path: string): string;
	export function getBundledNuGetLocation(version: string): string;
}

declare module 'nuget-task-common/NuGetToolGetter' {
	export const NUGET_EXE_TOOL_PATH_ENV_VAR: string;
	export function getNuGet(versionSpec: string, checkLatest?: boolean, addNuGetToPath?: boolean);
}