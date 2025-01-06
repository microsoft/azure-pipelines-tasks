import * as utilsTests from './L0UtilsTests';

describe('CopyFilesOverSSHV0 Suite', function () {
    utilsTests.run();

    if (process.platform === 'win32') {
        require('./L0WindowsUtilsTests').run();
    } else {
        require('./L0LinuxUtilsTests').run();
    }
});
