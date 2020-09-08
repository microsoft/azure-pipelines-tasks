export declare function hasRegistryComponent(imageName: string): boolean;
export declare function imageNameWithoutTag(imageName: string): string;
export declare function generateValidImageName(imageName: string): string;
export declare function getBaseImageNameFromDockerFile(dockerFilePath: string): string;
export declare function getBaseImageName(contents: string): string;
export declare function getResourceName(image: string, digest: string): string;
