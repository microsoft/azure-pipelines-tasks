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

export enum RegistryEndpointType {
  ACR,
  Generic
}

export class RegistryCredentialFactory {
  public static fetchRegistryCredential(endpointName: string, endpointType: RegistryEndpointType): RegistryCredential {
    if (!endpointName) {
      throw Error("endpointName is empty when fetching docker credential");
    }

    switch (endpointType) {
      case RegistryEndpointType.ACR: {
        let acrObject: ACRRegistry = JSON.parse(tl.getInput("azureContainerRegistry"));
        if (!acrObject) {
          throw Error("No Azure Container Registry configured in task.")
        }
        return this.fetchACRCredential(endpointName, acrObject.loginServer);
      }
      case RegistryEndpointType.Generic: {
        return this.fetchGenericCredential(endpointName);
      }
      default: {
        throw Error(`Endpoint type ${endpointType} is not supported yet.`)
      }
    }
  }

  private static fetchACRCredential(endpointName: string, registryLoginServer: string): RegistryCredential {
    return new RegistryCredential(
      tl.getEndpointAuthorizationParameter(endpointName, "serviceprincipalid", true),
      tl.getEndpointAuthorizationParameter(endpointName, "serviceprincipalkey", true),
      registryLoginServer);
  }

  private static fetchGenericCredential(endpointName: string): RegistryCredential {
    var registryType = tl.getEndpointDataParameter(endpointName, "registrytype", true);

    if (registryType === "ACR") {
      let registryLoginServer = tl.getEndpointAuthorizationParameter(endpointName, "loginServer", false).toLowerCase()
      return this.fetchACRCredential(endpointName, registryLoginServer);
    } else {
      let registryAuth: any = tl.getEndpointAuthorization(endpointName, true).parameters;
      return new RegistryCredential(registryAuth.username, registryAuth.password, registryAuth.registry);
    }
  }
}