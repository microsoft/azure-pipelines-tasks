import * as tl from 'azure-pipelines-task-lib/task';
import * as javaCommon from 'azure-pipelines-tasks-java-common/java-common';
import { IExecOptions, ToolRunner } from 'azure-pipelines-task-lib/toolrunner';

// Setting the access token env var to both VSTS and AZURE_ARTIFACTS for
// backwards compatibility with repos that already use the older env var.
const accessTokenEnvSettingLegacy: string = 'VSTS_ENV_ACCESS_TOKEN';
const accessTokenEnvSetting: string = 'AZURE_ARTIFACTS_ENV_ACCESS_TOKEN';

/**
 * Extract system access token from endpoint
 * @returns {string} access token to access account feeds or empty string
 */
function getSystemAccessToken(): string {
    tl.debug('Getting credentials for account feeds');

    const authorizationData: tl.EndpointAuthorization = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);

    if (authorizationData && authorizationData.scheme === 'OAuth') {
        tl.debug('Got auth token');
        return authorizationData.parameters['AccessToken'];
    }

    tl.warning(tl.loc('FeedTokenUnavailable'));

    return '';
}

/**
 * Update JAVA_HOME if user selected specific JDK version or set path manually
 * @param {string} javaHomeSelection - value of the `Set JAVA_HOME by` task input
 */
export function setJavaHome(javaHomeSelection: string): void {
    let specifiedJavaHome: string;
    let javaTelemetryData: any = {};

    if (javaHomeSelection === 'JDKVersion') {
        tl.debug('Using JDK version to find and set JAVA_HOME');

        const jdkVersion: string = tl.getInput('jdkVersion');
        const jdkArchitecture: string = tl.getInput('jdkArchitecture');

        javaTelemetryData = { 'jdkVersion': jdkVersion };

        if (jdkVersion !== 'default') {
            specifiedJavaHome = javaCommon.findJavaHome(jdkVersion, jdkArchitecture);
        }
    } else {
        tl.debug('Using path from user input to set JAVA_HOME');

        const jdkUserInputPath: string = tl.getPathInput('jdkUserInputPath', true, true);
        specifiedJavaHome = jdkUserInputPath;

        javaTelemetryData = { 'jdkVersion': 'custom' };
    }

    javaCommon.publishJavaTelemetry('Gradle', javaTelemetryData);

    if (specifiedJavaHome) {
        tl.debug(`Set JAVA_HOME to ${specifiedJavaHome}`);
        process.env['JAVA_HOME'] = specifiedJavaHome;
    }
}

/**
 * Get execution options for Gradle.
 *
 * This function does the following things:
 * - Get a snapshot of the process environment variables
 * - Update the snapshot to include system access token
 * @returns {IExecOptions} object with execution options for Gradle
 */
export function getExecOptions(): IExecOptions {
    const env: NodeJS.ProcessEnv = process.env;
    env[accessTokenEnvSetting] = env[accessTokenEnvSettingLegacy] = getSystemAccessToken();
    return <IExecOptions>{
        env: env
    };
}

/**
 * Configure the JVM associated with this run.
 * @param {string} gradleOptions - Gradle options provided by the user
 */
export function setGradleOpts(gradleOptions: string): void {
    if (gradleOptions) {
        process.env['GRADLE_OPTS'] = gradleOptions;
        tl.debug(`GRADLE_OPTS is now set to ${gradleOptions}`);
    }
}

/**
 * Determine Gradle version by running ./gradlew --version
 * @param {string} wrapperScript - Relative path from the repository root to the Gradle Wrapper script.
 * @returns {string} Gradle version
 */
export function getGradleVersion(wrapperScript: string): string {
    const gradleVersionRunner: ToolRunner = tl.tool(wrapperScript);
    gradleVersionRunner.arg('--version');

    const gradleOutput: string = gradleVersionRunner.execSync().stdout;
    const gradleVersion: string = extractGradleVersion(gradleOutput);

    if (gradleVersion === 'unknown'){
        tl.warning(tl.loc('UnableToExtractGradleVersion'));
    }

    tl.debug(`Gradle version: ${gradleVersion}`);

    return gradleVersion;
}

export function extractGradleVersion(str: string): string {
    const regex = /^Gradle (?<version>\d+\.\d+(?:\.\d+)?.*$)/m;
    const match = str.match(regex);
    return match?.groups?.version || 'unknown';
}
