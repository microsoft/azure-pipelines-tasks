export class NpmCommand {
    public static Install: string = 'install';
    public static Publish: string = 'publish';
    public static Custom: string = 'custom';
}

export class RegistryLocation {
    public static Npmrc: string = 'useNpmrc';
    public static Feed: string = 'useFeed';
    public static External: string = 'useExternalRegistry';
}

export class NpmTaskInput {
    public static Command: string = 'command';
    public static WorkingDir: string = 'workingDir';
    public static CustomCommand: string = 'customCommand';
    public static Verbose: string = 'verbose';
    public static CustomRegistry: string = 'customRegistry';
    public static CustomFeed: string = 'customFeed';
    public static CustomEndpoint: string = 'customEndpoint';
    public static PublishRegistry: string = 'publishRegistry';
    public static PublishFeed: string = 'publishFeed';
    public static PublishEndpoint: string = 'publishEndpoint';
}
