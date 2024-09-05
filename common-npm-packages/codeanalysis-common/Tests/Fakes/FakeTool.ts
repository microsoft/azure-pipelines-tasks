import { BaseTool } from '../../Common/BaseTool';
import { ModuleOutput } from '../../Common/ModuleOutput';
import { ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

export class FakeTool extends BaseTool {
    protected getBuildReportDir(output: ModuleOutput): string {
        throw new Error('Method not implemented.');
    }
    protected parseXmlReport(xmlReport: string, moduleName: string): [number, number] {
        throw new Error('Method not implemented.');
    }
    public configureBuild(toolRunner: ToolRunner): ToolRunner {
        throw new Error('Method not implemented.');
    }
}