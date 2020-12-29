import * as Q from "q";
export interface ICodeCoverageEnabler {
    enableCodeCoverage(ccProps: {
        [name: string]: string;
    }): Q.Promise<boolean>;
}
export declare abstract class CodeCoverageEnabler implements ICodeCoverageEnabler {
    protected buildFile: string;
    abstract enableCodeCoverage(ccProps: {
        [name: string]: string;
    }): Q.Promise<boolean>;
    protected extractFilters(classFilter: string): {
        includeFilter: string;
        excludeFilter: string;
    };
}
export declare abstract class CoberturaCodeCoverageEnabler extends CodeCoverageEnabler {
    protected abstract applyFilterPattern(filter: string): string[];
}
export declare abstract class JacocoCodeCoverageEnabler extends CodeCoverageEnabler {
    protected abstract applyFilterPattern(filter: string): string[];
}
