/*
 * ---------------------------------------------------------
 * Copyright(C) Microsoft Corporation. All rights reserved.
 * ---------------------------------------------------------
 * 
 * ---------------------------------------------------------
 * Generated file, DO NOT EDIT
 * ---------------------------------------------------------
 */

"use strict";

import IdentitiesInterfaces = require("../interfaces/IdentitiesInterfaces");


export interface AccessMapping {
    accessPoint: string;
    displayName: string;
    moniker: string;
    /**
     * The service which owns this access mapping e.g. TFS, ELS, etc.
     */
    serviceOwner: string;
    /**
     * Part of the access mapping which applies context after the access point of the server.
     */
    virtualDirectory: string;
}

/**
 * Data transfer class that holds information needed to set up a connection with a VSS server.
 */
export interface ConnectionData {
    /**
     * The Id of the authenticated user who made this request. More information about the user can be obtained by passing this Id to the Identity service
     */
    authenticatedUser: IdentitiesInterfaces.Identity;
    /**
     * The Id of the authorized user who made this request. More information about the user can be obtained by passing this Id to the Identity service
     */
    authorizedUser: IdentitiesInterfaces.Identity;
    /**
     * The id for the server.
     */
    deploymentId: string;
    /**
     * The instance id for this host.
     */
    instanceId: string;
    /**
     * The last user access for this instance.  Null if not requested specifically.
     */
    lastUserAccess: Date;
    /**
     * Data that the location service holds.
     */
    locationServiceData: LocationServiceData;
    /**
     * The virtual directory of the host we are talking to.
     */
    webApplicationRelativeDirectory: string;
}

export enum InheritLevel {
    None = 0,
    Deployment = 1,
    Account = 2,
    Collection = 4,
    All = 7,
}

export interface LocationMapping {
    accessMappingMoniker: string;
    location: string;
}

/**
 * Data transfer class used to transfer data about the location service data over the web service.
 */
export interface LocationServiceData {
    /**
     * Data about the access mappings contained by this location service.
     */
    accessMappings: AccessMapping[];
    /**
     * Data that the location service holds.
     */
    clientCacheFresh: boolean;
    /**
     * The time to live on the location service cache.
     */
    clientCacheTimeToLive: number;
    /**
     * The default access mapping moniker for the server.
     */
    defaultAccessMappingMoniker: string;
    /**
     * The obsolete id for the last change that took place on the server (use LastChangeId64).
     */
    lastChangeId: number;
    /**
     * The non-truncated 64-bit id for the last change that took place on the server.
     */
    lastChangeId64: number;
    /**
     * Data about the service definitions contained by this location service.
     */
    serviceDefinitions: ServiceDefinition[];
    /**
     * The identifier of the deployment which is hosting this location data (e.g. SPS, TFS, ELS, Napa, etc.)
     */
    serviceOwner: string;
}

export enum RelativeToSetting {
    Context = 0,
    WebApplication = 2,
    FullyQualified = 3,
}

export interface ResourceAreaInfo {
    id: string;
    locationUrl: string;
    name: string;
}

export interface ServiceDefinition {
    description: string;
    displayName: string;
    identifier: string;
    inheritLevel: InheritLevel;
    locationMappings: LocationMapping[];
    /**
     * Maximum api version that this resource supports (current server version for this resource). Copied from ApiResourceLocation.
     */
    maxVersion: string;
    /**
     * Minimum api version that this resource supports. Copied from ApiResourceLocation.
     */
    minVersion: string;
    parentIdentifier: string;
    parentServiceType: string;
    properties: any;
    relativePath: string;
    relativeToSetting: RelativeToSetting;
    /**
     * The latest version of this resource location that is in "Release" (non-preview) mode. Copied from ApiResourceLocation.
     */
    releasedVersion: string;
    /**
     * The current resource version supported by this resource location. Copied from ApiResourceLocation.
     */
    resourceVersion: number;
    /**
     * The service which owns this definition e.g. TFS, ELS, etc.
     */
    serviceOwner: string;
    serviceType: string;
    status: ServiceStatus;
    toolId: string;
}

export enum ServiceStatus {
    Assigned = 0,
    Active = 1,
    Moving = 2,
}

export var TypeInfo = {
    ConnectionData: <any>{
    },
    InheritLevel: {
        enumValues: {
            "none": 0,
            "deployment": 1,
            "account": 2,
            "collection": 4,
            "all": 7
        }
    },
    LocationServiceData: <any>{
    },
    RelativeToSetting: {
        enumValues: {
            "context": 0,
            "webApplication": 2,
            "fullyQualified": 3
        }
    },
    ServiceDefinition: <any>{
    },
    ServiceStatus: {
        enumValues: {
            "assigned": 0,
            "active": 1,
            "moving": 2
        }
    },
};

TypeInfo.ConnectionData.fields = {
    lastUserAccess: {
        isDate: true,
    },
    locationServiceData: {
        typeInfo: TypeInfo.LocationServiceData
    },
};

TypeInfo.LocationServiceData.fields = {
    serviceDefinitions: {
        isArray: true,
        typeInfo: TypeInfo.ServiceDefinition
    },
};

TypeInfo.ServiceDefinition.fields = {
    inheritLevel: {
        enumType: TypeInfo.InheritLevel
    },
    relativeToSetting: {
        enumType: TypeInfo.RelativeToSetting
    },
    status: {
        enumType: TypeInfo.ServiceStatus
    },
};
