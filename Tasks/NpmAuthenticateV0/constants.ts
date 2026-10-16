export class NpmAuthenticateTaskInput  {
    public static WorkingFile: string = 'workingFile';
    public static CustomEndpoint: string = 'customEndpoint';
}

export enum NpmConfigState {
    Unset = 'unset',
    Empty = 'empty',
    SetAsDefault = 'setAsDefault',
    Set = 'set',
    Unknown = 'unknown'
}

export enum NpmConfigFileState {
    NotApplicable = 'notApplicable',
    ExistingFile = 'existingFile',
    MissingFile = 'missingFile',
    InvalidPath = 'invalidPath',
    Unknown = 'unknown'
}

export enum NpmConfigTelemetryPhase {
    Main = 'main',
    PostJob = 'postJob'
}
