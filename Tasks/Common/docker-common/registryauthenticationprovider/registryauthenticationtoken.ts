"use strict";

import * as tl from "vsts-task-lib/task";

export default class RegistryServerAuthenticationToken {

    // loginserver url like jitekuma-microsoft.azurecr.io
    private registry: string;

    // registry login server creds
    private username: string;
    private password: string;
    private email: string;
    
    constructor(username: string, authenticationPassword: string, registry: string, email: string) {
        
        // Replace it with setvariable once vsts-task-lib is updated
        console.log("##vso[task.setvariable variable=CONTAINER_USERNAME;issecret=true;]" + username);
        console.log("##vso[task.setvariable variable=CONTAINER_PASSWORD;issecret=true;]" + authenticationPassword);
        
        this.registry = registry;
        this.password = authenticationPassword;
        this.username = username;
        this.email = email;
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
    
}