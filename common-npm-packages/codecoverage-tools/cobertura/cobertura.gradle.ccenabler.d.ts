import * as cc from "../codecoverageenabler";
import * as Q from "q";
export declare class CoberturaGradleCodeCoverageEnabler extends cc.CoberturaCodeCoverageEnabler {
    enableCodeCoverage(ccProps: {
        [name: string]: string;
    }): Q.Promise<boolean>;
    protected applyFilterPattern(filter: string): string[];
}
