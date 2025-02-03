import tl = require('azure-pipelines-task-lib/task');
import utils = require('../../Common/utils');
import constants = require('../../Common/constants');
import { execMavenBuild } from '../../OldAutomatedFlow/testLibExecutor';

export async function executeMavenTests(testsToBeExecuted: string[], pomFilePath?: string):Promise<number> {

    //public doc link: https://maven.apache.org/surefire/maven-surefire-plugin/examples/single-test.html
    //maven command like "mvn test -Dtest=<package.className#testName>,<package.className#testName1>"

    const executable = constants.MVN_EXECUTABLE;
    const args = []
    const testsToRun =[]

    for (let tests of testsToBeExecuted) {
        const modifiedTest = utils.replaceLastDotWithHash(tests);
        testsToRun.push(modifiedTest);
    }

    if (testsToRun.length > 0)
    {
        const testsList = testsToRun.join(',')
        const dtest = constants.MAVEN_DTEST;
        const combinedTestArgs = dtest + testsList;

        args.push('test');
        args.push(combinedTestArgs);
    }

    if (pomFilePath) {
        args.push('-f');
        args.push(pomFilePath);
    }

    //for returning success exit code incase of test failure and later we detect test failure from PTR command, documentation: https://maven.apache.org/surefire/maven-failsafe-plugin/verify-mojo.html, https://maven.apache.org/archives/maven-1.x/plugins/test/announcements/announcement-1.8.txt
    args.push('-Dmaven.test.failure.ignore=true');

    tl.debug("Executing java maven tests with executable : " + executable);
    tl.debug("Executing java maven tests with args :" + args);

   let status = await execMavenBuild(args);

   return status ?? 1;
}
