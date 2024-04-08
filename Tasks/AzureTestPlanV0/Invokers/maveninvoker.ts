import { spawn } from '../testexecutor'
import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import { execMavenBuild } from '../testLibExecutor';

export async function executemaventests(testsToBeExecuted: string[]) {

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

    tl.debug("Executing java maven tests with executable : " + executable);
    tl.debug("Executing java maven tests with args :" + args);

   let status = await execMavenBuild(args);

   return { exitCode: status ?? 1 };
}