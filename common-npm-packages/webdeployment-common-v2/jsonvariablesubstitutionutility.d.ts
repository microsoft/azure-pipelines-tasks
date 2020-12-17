export declare function createEnvTree(envVariables: any): {
    value: any;
    isEnd: boolean;
    child: {
        __proto__: any;
    };
};
export declare function substituteJsonVariable(jsonObject: any, envObject: any): any;
export declare function substituteJsonVariableV2(jsonObject: any, envObject: any): any;
export declare function stripJsonComments(content: any): any;
export declare function jsonVariableSubstitution(absolutePath: any, jsonSubFiles: any, substituteAllTypes?: boolean): boolean;
