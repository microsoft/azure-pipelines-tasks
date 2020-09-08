import * as cc from "../codecoverageenabler";
import * as Q from "q";
export declare class JacocoAntCodeCoverageEnabler extends cc.JacocoCodeCoverageEnabler {
    reportDir: string;
    excludeFilter: string;
    includeFilter: string;
    sourceDirs: string;
    classDirs: string;
    reportBuildFile: string;
    excludeFilterExec: string;
    includeFilterExec: string;
    enableCodeCoverage(ccProps: {
        [name: string]: string;
    }): Q.Promise<boolean>;
    protected applyFilterPattern(filter: string): string[];
    protected getSourceFilter(): string;
    protected getClassData(): string;
    protected createReportFile(reportContent: string): Q.Promise<void>;
    protected addCodeCoverageData(pomJson: any): Q.Promise<any[]>;
    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any>;
    protected enableForking(targetNode: any): void;
    protected enableForkOnTestNodes(testNode: any, enableForkMode: boolean): void;
    protected addCodeCoveragePluginData(pomJson: any): Q.Promise<any>;
}
