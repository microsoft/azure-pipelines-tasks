import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');
import webClient = require("./webClient");
import { AzureEndpoint } from "./azureModels";
import { ApplicationTokenCredentials } from './azure-arm-common';
import constants = require('./constants');
import fs = require('fs');
import path = require('path');
const certFilePath: string = path.join(tl.getVariable('Agent.TempDirectory'), 'spnCert.pem');

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

export class AzureRMEndpoint {
    public endpoint: AzureEndpoint;
    private _connectedServiceName: string;
    private applicationTokenCredentials: ApplicationTokenCredentials;

    // Add an entry here and separate function for each new environment
    private _environments = {
        'AzureStack': 'azurestack'
    }

    constructor(connectedServiceName: string) {
        this._connectedServiceName = connectedServiceName;
        this.endpoint = null;
    }

    public async getEndpoint(useGraphActiveDirectoryResource: boolean = false, useMSAL: boolean = true): Promise<AzureEndpoint> {
        if (!!this.endpoint) {
            return this.endpoint;
        }
        else {
            
            const rawUseMSAL = tl.getVariable("USE_MSAL");
            if(rawUseMSAL) {
                try {
                    tl.debug(`MSAL - USE_MSAL override is found: ${rawUseMSAL}`);
                    if(typeof JSON.parse(rawUseMSAL) !== "boolean") {
                        throw new Error("Value is not a boolean");
                    }
                    useMSAL = JSON.parse(rawUseMSAL);
                } catch (error) {
                    // this is not a blocker error, so we're informing
                    tl.debug(`MSAL - USE_MSAL couldn't be parsed due to error ${error}. useMSAL=${useMSAL} is used instead`);
                }
            }

            let endpointAuthScheme = tl.getEndpointAuthorizationScheme(this._connectedServiceName, true);
            if (endpointAuthScheme && endpointAuthScheme.toLowerCase() == constants.AzureRmEndpointAuthenticationScheme.PublishProfile) {

                let resourceId = tl.getEndpointDataParameter(this._connectedServiceName, 'resourceId', true);
                resourceId = resourceId.startsWith("/") ? resourceId : "/" + resourceId;
                let resourceIdSplit = resourceId.split("/");
                if (resourceIdSplit.length < 9) {
                    throw new Error(tl.loc('SpecifiedAzureRmEndpointIsInvalid', ''));
                }

                this.endpoint = {
                    subscriptionName: tl.getEndpointDataParameter(this._connectedServiceName, 'subscriptionname', true),
                    tenantID: tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'tenantid', false),
                    scheme: endpointAuthScheme,
                    PublishProfile: tl.getEndpointAuthorizationParameter(this._connectedServiceName, "publishProfile", true),
                    resourceId: resourceId
                } as AzureEndpoint;
            } else {
                this.endpoint = {
                    subscriptionID: tl.getEndpointDataParameter(this._connectedServiceName, 'subscriptionid', true),
                    subscriptionName: tl.getEndpointDataParameter(this._connectedServiceName, 'subscriptionname', true),
                    servicePrincipalClientID: tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'serviceprincipalid', true),
                    environmentAuthorityUrl: tl.getEndpointDataParameter(this._connectedServiceName, useMSAL ? 'activeDirectoryAuthority' : 'environmentAuthorityUrl', true),
                    tenantID: tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'tenantid', false),
                    url: tl.getEndpointUrl(this._connectedServiceName, true),
                    environment: tl.getEndpointDataParameter(this._connectedServiceName, 'environment', true),
                    scheme: tl.getEndpointAuthorizationScheme(this._connectedServiceName, true),
                    msiClientId: tl.getEndpointDataParameter(this._connectedServiceName, 'msiclientId', true),
                    activeDirectoryResourceID: tl.getEndpointDataParameter(this._connectedServiceName, 'activeDirectoryServiceEndpointResourceId', true),
                    azureKeyVaultServiceEndpointResourceId: tl.getEndpointDataParameter(this._connectedServiceName, 'AzureKeyVaultServiceEndpointResourceId', true),
                    azureKeyVaultDnsSuffix: tl.getEndpointDataParameter(this._connectedServiceName, 'AzureKeyVaultDnsSuffix', true),
                    scopeLevel: tl.getEndpointDataParameter(this._connectedServiceName, 'ScopeLevel', true),
                } as AzureEndpoint;

                tl.debug('MSAL - getEndpoint - useGraphActiveDirectoryResource=' + useGraphActiveDirectoryResource);
                tl.debug('MSAL - getEndpoint - useMSAL=' + useMSAL);
                tl.debug('MSAL - getEndpoint - endpoint=' + JSON.stringify(this.endpoint));
                tl.debug('MSAL - getEndpoint - connectedServiceName=' + this._connectedServiceName);

                if (useGraphActiveDirectoryResource) {
                    const fallbackURL = useMSAL ? "https://graph.microsoft.com/v1.0/" : "https://graph.microsoft.com/";
                    var activeDirectoryResourceId: string = tl.getEndpointDataParameter(this._connectedServiceName, useMSAL ? 'microsoftGraphUrl' : 'graphUrl', true);
                    activeDirectoryResourceId = activeDirectoryResourceId != null ? activeDirectoryResourceId : fallbackURL;
                    this.endpoint.activeDirectoryResourceID = activeDirectoryResourceId;
                    tl.debug('MSAL - getEndpoint - activeDirectoryResourceID=' + this.endpoint.activeDirectoryResourceID);
                }

                this.endpoint.authenticationType = tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'authenticationType', true);

                // if scheme is null, we assume the scheme to be ServicePrincipal
                let isServicePrincipalAuthenticationScheme = !this.endpoint.scheme || this.endpoint.scheme.toLowerCase() == constants.AzureRmEndpointAuthenticationScheme.ServicePrincipal;
                if (isServicePrincipalAuthenticationScheme) {
                    if (this.endpoint.authenticationType && this.endpoint.authenticationType == constants.AzureServicePrinicipalAuthentications.servicePrincipalCertificate) {
                        tl.debug('certificate spn endpoint');
                        this.endpoint.servicePrincipalCertificate = tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'servicePrincipalCertificate', false);
                        this.endpoint.servicePrincipalCertificatePath = certFilePath;
                        fs.writeFileSync(this.endpoint.servicePrincipalCertificatePath, this.endpoint.servicePrincipalCertificate);
                    }
                    else {
                        tl.debug('credentials spn endpoint');
                        this.endpoint.servicePrincipalKey = tl.getEndpointAuthorizationParameter(this._connectedServiceName, 'serviceprincipalkey', false);
                    }
                }

                var isADFSEnabled = tl.getEndpointDataParameter(this._connectedServiceName, 'EnableAdfsAuthentication', true);
                this.endpoint.isADFSEnabled = isADFSEnabled && (isADFSEnabled.toLowerCase() == "true");

                if (!!this.endpoint.environment && this.endpoint.environment.toLowerCase() == this._environments.AzureStack) {
                    if (!this.endpoint.environmentAuthorityUrl || !this.endpoint.activeDirectoryResourceID) {
                        this.endpoint = await this._updateAzureStackData(this.endpoint);
                    }
                }
                else {
                    const fallbackURL = useMSAL ? "https://login.microsoftonline.com/" : "https://login.windows.net/";
                    this.endpoint.environmentAuthorityUrl = (!!this.endpoint.environmentAuthorityUrl) ? this.endpoint.environmentAuthorityUrl : fallbackURL;
                    if (!useGraphActiveDirectoryResource) {
                        this.endpoint.activeDirectoryResourceID = this.endpoint.url;
                    }
                }

                let access_token: string = tl.getEndpointAuthorizationParameter(this._connectedServiceName, "apitoken", true);
                this.endpoint.applicationTokenCredentials = new ApplicationTokenCredentials(
                    this.endpoint.servicePrincipalClientID, 
                    this.endpoint.tenantID, 
                    this.endpoint.servicePrincipalKey,
                    this.endpoint.url, 
                    this.endpoint.environmentAuthorityUrl, 
                    this.endpoint.activeDirectoryResourceID, 
                    !!this.endpoint.environment && this.endpoint.environment.toLowerCase() == constants.AzureEnvironments.AzureStack, 
                    this.endpoint.scheme, 
                    this.endpoint.msiClientId, 
                    this.endpoint.authenticationType, 
                    this.endpoint.servicePrincipalCertificatePath, 
                    this.endpoint.isADFSEnabled, 
                    access_token, 
                    useMSAL
                );
            }
        }
        tl.debug(JSON.stringify(this.endpoint));
        return this.endpoint;
    }

    private async _updateAzureStackData(endpoint: AzureEndpoint): Promise<AzureEndpoint> {
        let dataDeferred = Q.defer<AzureEndpoint>();
        let webRequest = new webClient.WebRequest();
        webRequest.uri = `${endpoint.url}metadata/endpoints?api-version=2015-01-01`;
        webRequest.method = 'GET';
        webRequest.headers = {
            'Content-Type': 'application/json'
        }

        let azureStackResult;
        try {
            let response: webClient.WebResponse = await webClient.sendRequest(webRequest);
            if (response.statusCode != 200) {
                tl.debug("Action: _updateAzureStackData, Response: " + JSON.stringify(response));
                throw new Error(response.statusCode + ' ' + response.statusMessage)
            }

            azureStackResult = response.body;
        }
        catch (error) {
            throw new Error(tl.loc("FailedToFetchAzureStackDependencyData", error.toString()));
        }

        endpoint.graphEndpoint = azureStackResult.graphEndpoint;
        endpoint.galleryUrl = azureStackResult.galleryUrl;
        endpoint.portalEndpoint = azureStackResult.portalEndpoint;
        var authenticationData = azureStackResult.authentication;
        if (!!authenticationData) {
            var loginEndpoint: string = authenticationData.loginEndpoint;
            if (!!loginEndpoint) {
                loginEndpoint += (loginEndpoint[loginEndpoint.length - 1] == "/") ? "" : "/";
                endpoint.activeDirectoryAuthority = loginEndpoint;
                endpoint.environmentAuthorityUrl = loginEndpoint;
                endpoint.isADFSEnabled = loginEndpoint.endsWith('/adfs/');
            }
            else {
                // change to login endpoint
                throw new Error(tl.loc('UnableToFetchAuthorityURL'));
            }

            var audiences = authenticationData.audiences;
            if (audiences && audiences.length > 0) {
                endpoint.activeDirectoryResourceID = audiences[0];
            }

            try {
                var endpointUrl = endpoint.url;
                endpointUrl += (endpointUrl[endpointUrl.length - 1] == "/") ? "" : "/";
                var index = endpointUrl.indexOf('.');
                var domain = endpointUrl.substring(index + 1);
                domain = (domain.lastIndexOf("/") == domain.length - 1) ? domain.substring(0, domain.length - 1) : domain;
                endpoint.azureKeyVaultDnsSuffix = ("vault." + domain).toLowerCase();
                endpoint.azureKeyVaultServiceEndpointResourceId = ("https://vault." + domain).toLowerCase();
            }
            catch (error) {
                throw new Error(tl.loc("SpecifiedAzureRmEndpointIsInvalid", endpointUrl));
            }
        }

        return endpoint;
    }
}

export function dispose() {
    if (tl.exist(certFilePath)) {
        tl.rmRF(certFilePath);
        tl.debug('Removed cert endpoint file');
    }
}