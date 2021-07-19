import * as api from 'azure-devops-node-api';
import { IRequestOptions } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';
export declare function getWebApiWithProxy(serviceUri: string, accessToken: string, options?: IRequestOptions): api.WebApi;
export declare function getSystemAccessToken(): string;
