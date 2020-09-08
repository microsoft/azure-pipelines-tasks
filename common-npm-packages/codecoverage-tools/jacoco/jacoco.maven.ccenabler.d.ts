import * as cc from "../codecoverageenabler";
import * as Q from "q";
export declare class JacocoMavenCodeCoverageEnabler extends cc.JacocoCodeCoverageEnabler {
    excludeFilter: string[];
    includeFilter: string[];
    reportDir: string;
    sourceDirs: string;
    classDirs: string;
    reportBuildFile: string;
    enableCodeCoverage(ccProps: {
        [name: string]: string;
    }): Q.Promise<boolean>;
    protected applyFilterPattern(filter: string): string[];
    protected addCodeCoverageData(pomJson: any): Q.Promise<any[]>;
    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any>;
    private getBuildDataNode(buildJsonContent);
    private getPluginDataNode(buildNode);
    protected createMultiModuleReport(reportDir: string): Q.Promise<any>;
    protected addCodeCoveragePluginData(pomJson: any): Q.Promise<any>;
}
