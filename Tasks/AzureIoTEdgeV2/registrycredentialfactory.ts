import * as tl from 'azure-pipelines-task-lib/task';

export class RegistryCredential {
  public serverUrl: string;
  public username: string;
  public password: string;

  constructor(username: string, password: string, serverUrl: string) {
    this.serverUrl = serverUrl;
    this.username = username;
    this.password = password;
  }
}

export interface ACRRegistry {
  id: string,
  loginServer: string,
}

export class RegistryCredentialFactory {
  public static fetchACRCredential(endpointName: string, registryObject: ACRRegistry): RegistryCredential {
    if (!endpointName || !registryObject) {
      throw Error(`endpointName or registryName is empty when fetching ACR credential`);
    }
    return new RegistryCredential(tl.getEndpointAuthorizationParameter(endpointName, 'serviceprincipalid', true),
      tl.getEndpointAuthorizationParameter(endpointName, 'serviceprincipalkey', true),
      registryObject.loginServer);
  }

  public static fetchGenericCredential(endpointName: string): RegistryCredential {
    if (!endpointName) {
      throw Error(`endpointName or registryName is empty when fetching Generic credential`);
    }
    let registryAuth: any = tl.getEndpointAuthorization(endpointName, true).parameters;
    return new RegistryCredential(registryAuth.username, registryAuth.password, registryAuth.registry);
  }
}