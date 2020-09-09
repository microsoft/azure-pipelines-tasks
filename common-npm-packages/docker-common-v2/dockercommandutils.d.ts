import ContainerConnection from "./containerconnection";
export declare function build(connection: ContainerConnection, dockerFile: string, commandArguments: string, labelArguments: string[], tagArguments: string[], onCommandOut: (output) => any): any;
export declare function command(connection: ContainerConnection, dockerCommand: string, commandArguments: string, onCommandOut: (output) => any): any;
export declare function push(connection: ContainerConnection, image: string, commandArguments: string, onCommandOut: (image, output) => any): any;
export declare function start(connection: ContainerConnection, container: string, commandArguments: string, onCommandOut: (container, output) => any): any;
export declare function stop(connection: ContainerConnection, container: string, commandArguments: string, onCommandOut: (container, output) => any): any;
export declare function getCommandArguments(args: string): string;
export declare function getCreatorEmail(): string;
export declare function getPipelineLogsUrl(): string;
export declare function getBuildAndPushArguments(dockerFile: string, labelArguments: string[], tagArguments: string[]): {
    [key: string]: string;
};
export declare function getBuildContext(dockerFile: string): string;
export declare function useDefaultBuildContext(buildContext: string): boolean;
export declare function getPipelineUrl(): string;
export declare function getLayers(history: string): {
    [key: string]: string;
}[];
export declare function getImageFingerPrintV1Name(history: string): string;
export declare function getImageSize(layers: {
    [key: string]: string;
}[]): string;
export declare function extractSizeInBytes(size: string): number;
export declare function getHistory(connection: ContainerConnection, image: string): Promise<string>;
export declare function getImageRootfsLayers(connection: ContainerConnection, imageDigest: string): Promise<string[]>;
export declare function getImageFingerPrint(rootLayers: string[], v1Name: string): {
    [key: string]: string | string[];
};
