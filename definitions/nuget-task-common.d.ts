declare module 'nuget-task-common/Authentication' {
	export class NuGetAuthInfo {
	    uriPrefixes: string[];
	    accessToken: string;
	    constructor(uriPrefixes: string[], accessToken: string);
	}
	export function getSystemAccessToken(): string;

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

}
declare module 'nuget-task-common/NuGetToolRunner' {
	/// <reference path="../../../definitions/node.d.ts" />
	/// <reference path="../../../definitions/vsts-task-lib.d.ts" />
	import { ToolRunner, IExecOptions, IExecResult } from 'vsts-task-lib/toolrunner';
	import * as auth from 'nuget-task-common/Authentication';
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
	export interface LocateOptions {
	    optional?: boolean;
	    userPath?: string;
	    fallbackToSystemPath?: boolean;
	}
	export function locateTool(tool: string | string[], opts?: LocateOptions): string;

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
	    private tempNugetConfigDir;
	    private tempNugetConfigFileName;
	    tempNugetConfigPath: string;
	    constructor(nugetPath: string, nugetConfigPath: string, authInfo: auth.NuGetAuthInfo, environmentSettings: ngToolRunner.NuGetEnvironmentSettings);
	    ensureTempConfigCreated(): void;
	    setSources(packageSources: IPackageSource[]): void;
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

}
