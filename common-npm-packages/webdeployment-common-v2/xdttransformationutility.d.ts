export declare function expandWildcardPattern(folderPath: string, wildcardPattern: string): {};
/**
* Applys XDT transform on Source file using the Transform file
*
* @param    sourceFile Source Xml File
* @param    tansformFile Transform Xml File
*
*/
export declare function applyXdtTransformation(sourceFile: string, transformFile: string, destinationFile?: string): void;
/**
* Performs XDT transformations on *.config using ctt.exe
*
* @param    sourcePattern  The source wildcard pattern on which the transforms need to be applied
* @param    transformConfigs  The array of transform config names, ex : ["Release.config", "EnvName.config"]
*
*/
export declare function basicXdtTransformation(rootFolder: any, transformConfigs: any): boolean;
/**
* Performs XDT transformations using ctt.exe
*
*/
export declare function specialXdtTransformation(rootFolder: any, transformConfig: any, sourceConfig: any, destinationConfig?: string): boolean;
