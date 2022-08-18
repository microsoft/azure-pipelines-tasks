"use strict";

import * as tl from "azure-pipelines-task-lib/task";
const util = require('util');
import ACRAuthenticationTokenProvider from "./acrauthenticationtokenprovider"
import GenericAuthenticationTokenProvider from "./genericauthenticationtokenprovider";

export default class RegistryServerAuthenticationToken {

    // loginserver url like jitekuma-microsoft.azurecr.io
    private registry: string;

    // registry login server creds
    private username: string;
    private password: string;
    private email: string;
    private xMetaSourceClient: string;

    constructor(username: string, authenticationPassword: string, registry: string, email: string, xMetaSourceClient: string) {

        // Replace it with setvariable once azure-pipelines-task-lib is updated
        console.log("##vso[task.setvariable variable=CONTAINER_USERNAME;issecret=true;]" + username);
        console.log("##vso[task.setvariable variable=CONTAINER_PASSWORD;issecret=true;]" + authenticationPassword);

        this.registry = registry;
        this.password = authenticationPassword;
        this.username = username;
        this.email = email;
        this.xMetaSourceClient = xMetaSourceClient;
    }

    public getUsername(): string {
        return this.username;
    }

    public getPassword(): string {
        return this.password;
    }

    public getLoginServerUrl(): string {
        return this.registry;
    }

    public getEmail(): string {
        return this.email;
    }

    public getDockerConfig(): string {
        var authenticationToken = new Buffer(this.username + ":" + this.password).toString('base64')
        console.log("##vso[task.setvariable variable=CONTAINER_AUTHENTICATIONTOKEN;issecret=true;]" + authenticationToken);
        var auths = util.format('{"auths": { "%s": {"auth": "%s", "email": "%s" } }, "HttpHeaders":{"X-Meta-Source-Client":"%s"} }', this.registry, authenticationToken, this.email, this.xMetaSourceClient);
        return auths;
    }

    public getDockerAuth(): string {
        var authenticationToken = new Buffer(this.username + ":" + this.password).toString('base64')
        console.log("##vso[task.setvariable variable=CONTAINER_AUTHENTICATIONTOKEN;issecret=true;]" + authenticationToken);
        let auth = util.format('{ "%s": {"auth": "%s", "email": "%s" } }', this.registry, authenticationToken, this.email);
        return auth;
    }
}

export function getDockerRegistryEndpointAuthenticationToken(endpointId: string): RegistryServerAuthenticationToken {
    var registryType = tl.getEndpointDataParameter(endpointId, "registrytype", true);
    let authToken: RegistryServerAuthenticationToken;

    if (registryType === "ACR") {
        const loginServer = tl.getEndpointAuthorizationParameter(endpointId, "loginServer", false).toLowerCase();;
        authToken = new ACRAuthenticationTokenProvider(endpointId, loginServer).getAuthenticationToken();
    }
    else {
        authToken = new GenericAuthenticationTokenProvider(endpointId).getAuthenticationToken();
    }

    return authToken;
}