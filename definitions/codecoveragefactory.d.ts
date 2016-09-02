/// <reference path="./Q.d.ts" />

declare module 'codecoverage-tools/codecoveragefactory' {
    import * as Q from "q";

    export interface ICodeCoverageEnabler {
        enableCodeCoverage(ccProps: {
            [name: string]: string;
        }): Q.Promise<boolean>;
    }

    export interface ICodeCoverageEnablerFactory {
        getTool(buildTool: string, ccTool: string): ICodeCoverageEnabler;
    }

    export class CodeCoverageEnablerFactory implements ICodeCoverageEnablerFactory {
        getTool(buildTool: string, ccTool: string): ICodeCoverageEnabler;
    }
}
