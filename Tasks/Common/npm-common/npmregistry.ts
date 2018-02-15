import * as os from 'os';
import * as tl from 'vsts-task-lib/task';
import * as URL from 'url';
import * as ipaddress from 'ip-address';

import { NormalizeRegistry } from './npmrcparser';
import * as util from './util';

export interface INpmRegistry {
    url: string;
    auth: string;
    authOnly: boolean;
}

export class NpmRegistry implements INpmRegistry {
    public url: string;
    public auth: string;
    public authOnly: boolean;

    constructor(url: string, auth: string, authOnly?: boolean) {
        this.url = url;
        this.auth = auth;
        this.authOnly = authOnly || false;
    }

    public static FromServiceEndpoint(endpointId: string, authOnly?: boolean): NpmRegistry {
        let lineEnd = os.EOL;
        let endpointAuth: tl.EndpointAuthorization;
        let url: string;
        let nerfed: string;
        let auth: string;
        let username: string;
        let password: string;
        let email: string;
        let password64: string;
        let isVstsTokenAuth: boolean = false;
        try {
            endpointAuth = tl.getEndpointAuthorization(endpointId, false);
        } catch (exception) {
            throw new Error(tl.loc('ServiceEndpointNotDefined'));
        }

        try {
            let collectionUrl = tl.getVariable("System.TeamFoundationCollectionUri");
            let collectionUrlDomain = NpmRegistry.ParseHostnameForDomain(URL.parse(collectionUrl).hostname);
            url = NormalizeRegistry(tl.getEndpointUrl(endpointId, false));
            let epUrlDomain = NpmRegistry.ParseHostnameForDomain(URL.parse(url).hostname);

            // To the reader, this could be optimized here but it is broken out for readability
            if (endpointAuth.scheme === 'Token'){
                if (collectionUrlDomain === epUrlDomain){
                    // Same domain _OR_ matching IP addrs.  Use PAT+Basic
                    isVstsTokenAuth = true;
                } else if (epUrlDomain.toUpperCase() === 'VISUALSTUDIO.COM'){
                    // If the endpoint is VSTS, full stop.  Use PAT+Basic
                    isVstsTokenAuth = true;
                }
            }
            nerfed = util.toNerfDart(url);
        } catch (exception) {
            throw new Error(tl.loc('ServiceEndpointUrlNotDefined'));
        }

        switch (endpointAuth.scheme) {
            case 'UsernamePassword':
                username = endpointAuth.parameters['username'];
                password = endpointAuth.parameters['password'];
                email = username; // npm needs an email to be set in order to publish, this is ignored on npmjs
                password64 = (new Buffer(password).toString('base64'));

                auth = nerfed + ":username=" + username + lineEnd;
                auth += nerfed + ":_password=" + password64 + lineEnd;
                auth += nerfed + ":email=" + email + lineEnd;
                break;
            case 'Token':
                let apitoken = endpointAuth.parameters['apitoken'];
                if (!isVstsTokenAuth){
                    // Use Bearer auth as it was intended.
                    auth = nerfed + ":_authToken=" + apitoken + lineEnd;
                }else{
                    // VSTS does not support PATs+Bearer only JWTs+Bearer
                    email = 'VssEmail';
                    username = 'VssToken';
                    password64 = (new Buffer(apitoken).toString('base64'));
                    console.log("##vso[task.setvariable variable=" + endpointId + "BASE64_PASSWORD;issecret=true;]" + password64);

                    auth = nerfed + ":username=" + username + lineEnd;
                    auth += nerfed + ":_password=" + password64 + lineEnd;
                    auth += nerfed + ":email=" + email + lineEnd;
                }
                break;
        }

        auth += nerfed + ":always-auth=true";
        return new NpmRegistry(url, auth, authOnly);
    }

    public static async FromFeedId(feedId: string, authOnly?: boolean): Promise<NpmRegistry> {
        let url = NormalizeRegistry(await util.getFeedRegistryUrl(feedId));
        let nerfed = util.toNerfDart(url);
        let auth = `${nerfed}:_authToken=${util.getSystemAccessToken()}`;

        return new NpmRegistry(url, auth, authOnly);
    }

    /**
     * Helper function to return the domain name given a hostname.
     * @param hostname This should be the output from: url.parse('http://myserver.example.com').hostname
     * @returns Given a FQDN the domain name will be returned.  Given a hostname the
     * hostname will be return.  Given an IP address, the IP will be returned.
     */
    private static ParseHostnameForDomain(hostname: string): string {
        if (hostname &&
            (!new ipaddress.Address6(hostname).isValid() &&
             !new ipaddress.Address4(hostname).isValid())) {
                // We know we have a non-null string that is not an IP addr
                let hnAry = hostname.split('.');
                return hnAry.slice(-2).join('.')
        }
        return hostname;
    }
}
