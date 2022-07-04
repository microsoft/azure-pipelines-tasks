// TODO: This file should be moved to the common package as a spotbugs tool
import * as tl from 'azure-pipelines-task-lib/task';
import { BuildOutput } from 'azure-pipelines-tasks-codeanalysis-common/Common/BuildOutput';
import { ModuleOutput } from 'azure-pipelines-tasks-codeanalysis-common/Common/ModuleOutput';
import * as path from 'path';
import { copyFile } from '../utils';
import * as fs from 'fs';

/**
 * Publishes the spotbugs xml report file to the pipeline artifacts
 * @param buildOutput - Build output from a single or multi module project. Identifies modules based on path conventions.
 */
export function PublishSpotbugsReport(buildOutput: BuildOutput): void {
    const moduleOutput: ModuleOutput = buildOutput.findModuleOutputs()[0];
    tl.debug(`[CA] Spotbugs parser found ${moduleOutput.moduleName} module to upload results from.`);

    const stagingDir: string = path.join(tl.getVariable('build.artifactStagingDirectory'), '.codeAnalysis');
    const artifactBaseDir: string = path.join(stagingDir, 'CA');
    const destinationDir: string = path.join(artifactBaseDir, moduleOutput.moduleName);

    if (!fs.existsSync(destinationDir)) {
        tl.debug(`Creating CA directory = ${destinationDir}`);
        fs.mkdirSync(destinationDir, { recursive: true });
    }

    const reportsPath = moduleOutput.moduleRoot;
    const reportFile = path.join(reportsPath, 'spotbugsXml.xml');
    tl.debug(`Spotbugs report file = ${reportFile}`);

    const buildNumber: string = tl.getVariable('build.buildNumber');
    const extension: string = path.extname(reportFile);
    const reportName: string = path.basename(reportFile, extension);
    const artifactName: string = `${buildNumber}_${reportName}_${'Spotbugs'}${extension}`;

    copyFile(reportFile, path.join(destinationDir, artifactName));
    tl.command('artifact.upload',
        { 'artifactname': tl.loc('codeAnalysisArtifactSummaryTitle') },
        artifactBaseDir);
}
