import * as tl from 'azure-pipelines-task-lib/task';
import { BuildOutput } from 'azure-pipelines-tasks-codeanalysis-common/Common/BuildOutput';
import { ModuleOutput } from 'azure-pipelines-tasks-codeanalysis-common/Common/ModuleOutput';
import * as path from 'path';
import { copyFile } from '../utils';

/**
 * Publishes the spotbugs xml report file to the pipeline artifacts
 * @param mavenPOMFile - Path to the pom.xml configuration file
 * @param buildOutput - Build output from a single or multi module project. Identifies modules based on path conventions.
 */
export function PublishSpotbugsReport(mavenPOMFile: string, buildOutput: BuildOutput): void {
    let outputs: ModuleOutput[] = buildOutput.findModuleOutputs();
    tl.debug(`[CA] ${'Spotbugs'} parser found ${outputs.length} possible modules to upload results from.`);

    const buildRootPath = path.dirname(mavenPOMFile);
    const reportsPath = path.join(buildRootPath, 'target')

    const reportFile = path.join(reportsPath, 'spotbugsXml.xml')

    const stagingDir: string = path.join(tl.getVariable('build.artifactStagingDirectory'), '.codeAnalysis');
    const buildNumber: string = tl.getVariable('build.buildNumber');

    const artifactBaseDir: string = path.join(stagingDir, 'CA');

    const destinationDir: string = path.join(artifactBaseDir, outputs[0].moduleName);

    const extension: string = path.extname(reportFile);
    const reportName: string = path.basename(reportFile, extension);

    const artifactName: string = `${buildNumber}_${reportName}_${'Spotbugs'}${extension}`;
    copyFile(reportFile, path.join(destinationDir, artifactName));

    tl.command('artifact.upload',
        { 'artifactname': tl.loc('codeAnalysisArtifactSummaryTitle') },
        artifactBaseDir);
}
