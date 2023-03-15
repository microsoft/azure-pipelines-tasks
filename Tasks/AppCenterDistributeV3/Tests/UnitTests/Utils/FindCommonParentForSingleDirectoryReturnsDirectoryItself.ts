import fs = require('fs');

import { findCommonParent } from '../../../utils';
import { assertByExitCode } from '../TestHelpers';
const mockery = require('mockery');

const lstatSync = (s: string) => {
    const stat = {} as fs.Stats;
    stat.isFile = () => s.endsWith('.so');
    stat.isSymbolicLink = () => false;
    return stat;
}

const mockedFs = {...fs, lstatSync};
mockery.registerMock('fs', mockedFs);

const expectedParentPath = "/a/b/c";
const actualParentPath = findCommonParent(["/a/b/c"]);
assertByExitCode.equal(actualParentPath, expectedParentPath);
mockery.deregisterMock('fs');
