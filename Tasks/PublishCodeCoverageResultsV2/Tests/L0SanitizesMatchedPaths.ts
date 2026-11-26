import path = require('path');
import { TaskLibAnswers } from 'azure-pipelines-task-lib/mock-answer';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'publishcodecoverageresults.js');
const tr = new TaskMockRunner(taskPath);

const embeddedCommandPath = '/coverage/coverage-##vso[task.setvariable variable=NODE_OPTIONS]--require=payload.xml';
const lineSeparatedCommandPath = '/coverage/coverage-line-break\n##vso[task.setvariable variable=BASH_ENV]payload.xml';
const loggingCommandFiltering = process.env['COVERAGE_TEST_LOG_FILTERING'];
process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = '/coverage';
process.env['BUILD_SOURCESDIRECTORY'] = '/coverage';
if (loggingCommandFiltering === undefined) {
    delete process.env['DISTRIBUTEDTASK_TASKS_PUBLISHCODECOVERAGERESULTSV2LOGGINGCOMMANDINJECTIONFIXENABLED'];
} else {
    process.env['DISTRIBUTEDTASK_TASKS_PUBLISHCODECOVERAGERESULTSV2LOGGINGCOMMANDINJECTIONFIXENABLED'] =
        loggingCommandFiltering;
}
process.env['DISTRIBUTEDTASK_TASKS_ENABLEPUBLISHCODECOVERAGERESULTSV2SOURCEPATHCONTAINMENT'] =
    process.env['COVERAGE_TEST_CONTAINMENT'] || 'false';

tr.setInput('summaryFileLocation', '/coverage/coverage*.xml');
tr.setAnswers(<TaskLibAnswers>{
    findMatch: {
        '/coverage/coverage*.xml': [
            embeddedCommandPath,
            lineSeparatedCommandPath
        ]
    },
    stats: {
        [embeddedCommandPath]: {
            isFile: true
        },
        [lineSeparatedCommandPath]: {
            isFile: true
        }
    }
});

tr.registerMock('coveragepublisher/coveragepublisher', {
    PublishCodeCoverage: async (
        inputFiles: string[],
        sourceDirectory: string,
        publishHtmlReport: boolean,
        trustedSourceDirectories: string[],
        enableTrustedSourcePathFiltering: boolean,
        enableLoggingCommandFiltering: boolean) => {
        console.log(`enableLoggingCommandFiltering=${enableLoggingCommandFiltering}`);
        console.log(`enableTrustedSourcePathFiltering=${enableTrustedSourcePathFiltering}`);
        console.log(`summaryPathsPreserved=${inputFiles[0] === embeddedCommandPath && inputFiles[1] === lineSeparatedCommandPath}`);
    }
});

tr.run();
