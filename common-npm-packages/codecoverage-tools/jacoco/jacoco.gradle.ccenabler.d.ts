import * as cc from "../codecoverageenabler";
import * as Q from "q";
export declare class JacocoGradleCodeCoverageEnabler extends cc.JacocoCodeCoverageEnabler {
    enableCodeCoverage(ccProps: {
        [name: string]: string;
    }): Q.Promise<boolean>;
    protected applyFilterPattern(filter: string): string[];
}
