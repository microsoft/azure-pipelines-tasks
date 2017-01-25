import tl = require('vsts-task-lib/task');
import models = require('./models')
import taskInputParser = require('./taskInputParser')
import localTest = require('./vstest')
import path = require('path');

try {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const parallelExecution = tl.getVariable('System.ParallelExecutionType');
    tl.debug('Value of ParallelExecutionType is ' + parallelExecution);

    if (parallelExecution && parallelExecution.toLowerCase() === 'multimachine') {
        tl.debug('Multi Agent is ON.. Run the distributed tests.....');
        tl.debug('**************************************************');
    } else {
        tl.debug('Multi Agent is OFF.. Run the tests locally........');
        tl.debug('**************************************************');
        localTest.startTest();
    }
} catch (error) {
    tl._writeLine('##vso[task.logissue type=error;code=' + error + ';TaskName=VSTest]');
    throw error;
}
