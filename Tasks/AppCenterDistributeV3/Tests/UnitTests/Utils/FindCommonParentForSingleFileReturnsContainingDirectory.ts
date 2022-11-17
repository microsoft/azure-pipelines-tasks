import fs = require('fs');

import { findCommonParent } from '../../../utils';
import { assertByExitCode } from '../TestHelpers';
const mockery = require('mockery');

const lstatSync  = (s: string) => {
    const stat = {} as fs.Stats;
    stat.isFile = () => s.endsWith('.so');
    return stat;
}

const mockedFs = {...fs, lstatSync};
mockery.registerMock('fs', mockedFs);

const singleSoFilePath = "/a/b/c/symbol.so";
const expectedParentPath = "/a/b/c";
const actualParentPath = findCommonParent([singleSoFilePath]);
assertByExitCode.equal(actualParentPath, expectedParentPath);

mockery.deregisterMock('fs');
