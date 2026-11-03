import * as tl from 'azure-pipelines-task-lib/task';

// Exit codes below 8 of robocopy mean that the copy succeeded (possibly with extra or skipped files).
const ROBOCOPY_FAILURE_EXIT_CODE = 8;

export async function copyToFileShare(source: string, destination: string, parallelCount: number): Promise<void> {
    console.log(tl.loc('PublishingArtifactUsingRobocopy'));

    const trim = /[\\/]+$/;
    const robocopy = tl.tool(tl.which('robocopy', true));
    robocopy.arg(source.replace(trim, ''));
    robocopy.arg(destination.replace(trim, ''));
    robocopy.arg('*');
    robocopy.arg(['/E', '/COPY:DA', '/NP', '/R:3', `/MT:${parallelCount}`]);

    const exitCode = await robocopy.exec(<any>{ ignoreReturnCode: true });
    console.log(tl.loc('RobocopyBasedPublishArtifactTaskExitCode', exitCode));
    if (exitCode >= ROBOCOPY_FAILURE_EXIT_CODE) {
        throw new Error(tl.loc('RobocopyBasedPublishArtifactTaskFailed', exitCode));
    }
}
