import path = require('path');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as answers from './answers';

const taskPath = path.join(__dirname, '..', 'publishcodecoverageresults.js');
const tr: TaskMockRunner = new TaskMockRunner(taskPath);

process.env['SYSTEM_DEFAULTWORKINGDIRECTORY'] = '/agent/_work/1/s';
process.env['BUILD_SOURCESDIRECTORY'] = '/agent/_work/1/s/repository';
delete process.env['DISTRIBUTEDTASK_TASKS_ENABLEPUBLISHCODECOVERAGERESULTSV2SOURCEPATHCONTAINMENT'];

tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
tr.setInput('pathToSources', '/external/sources');
tr.setInput('publishHtmlReport', 'true');
tr.setAnswers({
    ...answers.defaultAnswers,
    stats: {
        ...answers.defaultAnswers.stats,
        '/user/admin/summary.xml': {
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
        enableTrustedSourcePathFiltering: boolean) => {
        console.log(`publishHtmlReport=${publishHtmlReport}`);
        console.log(`trustedSourceDirectories=${trustedSourceDirectories}`);
        console.log(`enableTrustedSourcePathFiltering=${enableTrustedSourcePathFiltering}`);
    }
});

tr.run();
