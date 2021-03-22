import * as path from 'path';
import { TaskLibAnswers } from 'azure-pipelines-task-lib/mock-answer';

export const badAnswers: TaskLibAnswers = {
  'checkPath': {
    '/bin/release': true,
    'C:\\bin\\release': true
  },
  'exec': {
    [`powershell.exe -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -Command & \'${path.resolve(__dirname, '..', 'Invoke-Robocopy.ps1')}\' -Source \'C:\\bin\\release\' -Target \'\\\\UNCShare\\subdir\\drop\' -ParallelCount 1`]: {
      'stdout': 'test stdout from robocopy middle-man',
      'stderr': '',
      'code': 1
    }
  }
};
