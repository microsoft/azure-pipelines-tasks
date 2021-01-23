import * as assert from 'assert';
import * as path from 'path';
import * as mockery from 'mockery';

describe('Code coverage tools', function() {
  afterEach(() => {
      mockery.deregisterAll();
  });

  it('Correctly checks if code coverage file is empty', function(done: Mocha.Done) {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    const inputs = {
      codeCoverageFile: 'ccReport.xml',
      codeCoverageTool: 'cobertura'
    };

    mockery.registerMock('azure-pipelines-task-lib/task', {
      exist(path: string) {
        return path === inputs.codeCoverageFile;
      }
    });

    mockery.registerMock('fs', {
      readFile(filePath: string) {
        if (filePath !== inputs.codeCoverageFile) {
          throw new Error(`Trying to read unexpected file: ${filePath}`);
        }

        return coberturaCCReport;
      }
    });

    done();
  });
});
