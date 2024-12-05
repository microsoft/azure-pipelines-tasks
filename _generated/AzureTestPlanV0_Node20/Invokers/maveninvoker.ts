import { spawn } from '../testexecutor'
import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import { execMavenBuild } from '../testLibExecutor';

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

    args.push('-Dmaven.test.failure.ignore=true');

    tl.debug("Executing java maven tests with executable : " + executable);
    tl.debug("Executing java maven tests with args :" + args);

   let status = await execMavenBuild(args);

   return status ?? 1;
}
