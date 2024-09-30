import tl = require('azure-pipelines-task-lib/task');

/**
 * Finds the tool path for msbuild/xbuild based on specified msbuild version on Mac or Linux agent
 * @param version 
 */
export async function getMSBuildPath(version) {
    let toolPath: string;

    if (version === '15.0' || version === 'latest') {
        let msbuildPath: string = tl.which('msbuild', false);
        if (msbuildPath) {
            // msbuild found on the agent, check version
            let msbuildVersion: number;

            let msbuildVersionCheckTool = tl.tool(msbuildPath);
            msbuildVersionCheckTool.arg(['/version', '/nologo']);
            msbuildVersionCheckTool.on('stdout', function (data) {
                if (data) {
                    let intData = parseInt(data.toString().trim());
                    if (intData && !isNaN(intData)) {
                        msbuildVersion = intData;
                    }
                }
            })
            await msbuildVersionCheckTool.exec();

            if (msbuildVersion) {
                // found msbuild version on the agent, check if it matches requirements
                if (msbuildVersion >= 15) {
                    toolPath = msbuildPath;
                }
            }
        }
    }

    if (!toolPath) {
        // either user selected old version of msbuild or we didn't find matching msbuild version on the agent
        // fallback to xbuild
        toolPath = tl.which('xbuild', false);

        if (!toolPath) {
            // failed to find a version of msbuild / xbuild on the agent
            throw tl.loc('MSB_BuildToolNotFound');
        }
    }

    return toolPath;
}