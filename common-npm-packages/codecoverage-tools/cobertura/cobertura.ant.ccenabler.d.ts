import * as Q from "q";
import * as cc from "../codecoverageenabler";
export declare class CoberturaAntCodeCoverageEnabler extends cc.CoberturaCodeCoverageEnabler {
    reportDir: string;
    reportbuildfile: string;
    classDirs: string;
    includeFilter: string;
    excludeFilter: string;
    sourceDirs: string;
    enableCodeCoverage(ccProps: {
        [name: string]: string;
    }): Q.Promise<boolean>;
    protected applyFilterPattern(filter: string): string[];
    protected getClassData(): string;
    protected createReportFile(reportContent: string): Q.Promise<void>;
    protected addCodeCoverageData(pomJson: CheerioStatic): Q.Promise<any[]>;
    protected addCodeCoverageNodes(buildJsonContent: CheerioStatic): Q.Promise<any>;
    protected enableForking(buildJsonContent: CheerioStatic, targetNode: CheerioElement): void;
    protected enableForkOnTestNodes(testNode: CheerioElement): void;
}
