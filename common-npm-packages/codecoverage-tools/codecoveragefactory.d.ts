import { ICodeCoverageEnabler } from "./codecoverageenabler";
export interface ICodeCoverageEnablerFactory {
    getTool(buildTool: string, ccTool: string): ICodeCoverageEnabler;
}
export declare class CodeCoverageEnablerFactory implements ICodeCoverageEnablerFactory {
    getTool(buildTool: string, ccTool: string): ICodeCoverageEnabler;
}
