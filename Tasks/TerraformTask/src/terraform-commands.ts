import {TerraformCommand} from './terraform';

export enum BackendTypes {
    azurerm = "azurerm",
    aws = "aws",
    gcp = "gcp"
}

export class TerraformInit extends TerraformCommand {
    readonly backendType: BackendTypes | undefined;

    constructor(
        name: string,
        workingDirectory: string,
        backendType: string,
        additionalArgs?: string | undefined
    ) {
        super(name, workingDirectory, additionalArgs);
        if (backendType) {
            this.backendType = BackendTypes[<keyof typeof BackendTypes> backendType];
        }
    }
}

export class TerraformPlan extends TerraformCommand {
    readonly serviceProvidername: string;

    constructor(
        name: string,
        workingDirectory: string,
        serviceProvidername: string,
        additionalArgs?: string
    ) {
        super(name, workingDirectory, additionalArgs);
        this.serviceProvidername = serviceProvidername;
    }
}

export class TerraformApply extends TerraformCommand {
    readonly serviceProvidername: string;

    constructor(
        name: string,
        workingDirectory: string,
        serviceProvidername: string,
        additionalArgs?: string
    ) {
        super(name, workingDirectory, additionalArgs);
        this.serviceProvidername = serviceProvidername;
    }
}

export class TerraformDestroy extends TerraformCommand {
    readonly serviceProvidername: string;

    constructor(
        name: string,
        workingDirectory: string,
        serviceProvidername: string,
        additionalArgs?: string
    ) {
        super(name, workingDirectory, additionalArgs);
        this.serviceProvidername = serviceProvidername;
    }
}
