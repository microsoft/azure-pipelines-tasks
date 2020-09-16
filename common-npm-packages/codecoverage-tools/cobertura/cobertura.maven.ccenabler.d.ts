import * as cc from "../codecoverageenabler";
import * as Q from "q";
export declare class CoberturaMavenCodeCoverageEnabler extends cc.CoberturaCodeCoverageEnabler {
    protected includeFilter: string;
    protected excludeFilter: string;
    enableCodeCoverage(ccProps: {
        [name: string]: string;
    }): Q.Promise<boolean>;
    protected applyFilterPattern(filter: string): string[];
    protected addCodeCoverageNodes(buildJsonContent: any): Q.Promise<any>;
    private getBuildDataNode(buildJsonContent);
    private getPluginDataNode(buildNode);
    private getReportingPluginNode(reportNode);
    protected addCodeCoveragePluginData(pomJson: any): Q.Promise<void>;
}
