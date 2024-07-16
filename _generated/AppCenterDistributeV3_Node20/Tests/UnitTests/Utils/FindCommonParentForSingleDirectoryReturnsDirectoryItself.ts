import fs = require('fs');

import { findCommonParent } from '../../../utils';
import { assertByExitCode } from '../TestHelpers';
const libMocker = require('azure-pipelines-task-lib/lib-mocker');

const lstatSync = (s: string) => {
    const stat = {} as fs.Stats;
    stat.isFile = () => s.endsWith('.so');
    stat.isSymbolicLink = () => false;
    return stat;
}

const mockedFs = {...fs, lstatSync};
libMocker.registerMock('fs', mockedFs);

const expectedParentPath = "/a/b/c";
const actualParentPath = findCommonParent(["/a/b/c"]);
assertByExitCode.equal(actualParentPath, expectedParentPath);
libMocker.deregisterMock('fs');
