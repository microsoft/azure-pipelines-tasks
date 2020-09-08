import ContainerConnection from "./containerconnection";
export declare function build(connection: ContainerConnection, dockerFile: string, context: string, commandArguments: string, labelArguments: string[], tagArguments: string[], onCommandOut: (output) => any): any;
export declare function command(connection: ContainerConnection, dockerCommand: string, commandArguments: string, onCommandOut: (output) => any): any;
export declare function push(connection: ContainerConnection, image: string, commandArguments: string, onCommandOut: (image, output) => any): any;
export declare function getCommandArguments(args: string): string;
export declare function getLayers(connection: ContainerConnection, imageId: string): Promise<any>;
export declare function getImageSize(layers: {
    [key: string]: string;
}[]): string;
export declare function extractSizeInBytes(size: string): number;
