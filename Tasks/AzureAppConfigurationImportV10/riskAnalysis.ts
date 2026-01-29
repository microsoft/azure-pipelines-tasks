import * as tl from 'azure-pipelines-task-lib/task';
import * as tr from 'azure-pipelines-task-lib/toolrunner';
import { RISK_ANALYSIS_PROMPT } from './prompt';

export class RiskAnalysis {

    /**
     * Sets up the risk analysis environment by installing GitHub Copilot CLI
     */
    private static setUp(): void {
        try {
            console.log(tl.loc("InstallingGithubCopilotCLI"));

            // do we always have npm? 
            const npmPath: string = tl.which('npm', true);
            const installTool: tr.ToolRunner = tl.tool(npmPath);
            installTool.line('install -g @github/copilot@0.0.395');
            const result: tr.IExecSyncResult = installTool.execSync({
                silent: true,
            });
            
            if (result.code !== 0) {
                console.error(result.stderr);
                throw new Error('GitHub Copilot CLI installation failed'); // will localize later
            }
            
            console.log(tl.loc("CopilotCLIInstalled"));
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to set up GitHub Copilot CLI: ${errorMessage}`);
        }
    }

    public static runRiskAnalysis(diff: any): string {
        try {
            // Ensure Copilot CLI is set up
            this.setUp();

            console.log(tl.loc("AnalyzingConfigurationChanges"));
            
            const fullPrompt = `${RISK_ANALYSIS_PROMPT} Configuration Diff:${JSON.stringify(diff, null, 2)}`;
        
            const copilotPath: string = tl.which('copilot', true);
            
            // Run Copilot CLI with the prompt
            const copilotTool = tl.tool(copilotPath);
            copilotTool.arg('-p').arg(fullPrompt);

            const result: tr.IExecSyncResult = copilotTool.execSync({
                silent: true,
                env: {
                    ...process.env,
                    GITHUB_TOKEN: tl.getVariable('GITHUB_ACCESS_TOKEN')
                }
            });
            
            if (result.code !== 0) {
                console.error(result.stderr);
                throw new Error('GitHub Copilot CLI execution failed');
            }
            
            return result.stdout;
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to run risk analysis: ${errorMessage}`);
        }
    }
}
