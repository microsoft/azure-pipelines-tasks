// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import VsoBaseInterfaces = require('../interfaces/common/VsoBaseInterfaces');

export class BasicCredentialHandler implements VsoBaseInterfaces.IRequestHandler {
    username: string;
    password: string;

    constructor(username: string, password: string) {
        this.username = username;
        this.password = password;
    }

    // currently implements pre-authorization
    // TODO: support preAuth = false where it hooks on 401
    prepareRequest(options:any): void {
        options.headers['Authorization'] = 'Basic ' + new Buffer(this.username + ':' + this.password).toString('base64');
        options.headers['X-TFS-FedAuthRedirect'] = 'Suppress';
    }

    // This handler cannot handle 401
    canHandleAuthentication(res: VsoBaseInterfaces.IHttpResponse): boolean {
        return false;
    }

    handleAuthentication(httpClient, protocol, options, objs, finalCallback): void {
    }
}
