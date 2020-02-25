import fs = require('fs');

import { findCommonParent } from '../../../utils';
import { assertByExitCode } from '../TestHelpers';

fs.lstatSync = (s: string) => {
    const stat = {} as fs.Stats;
    stat.isFile = () => s.endsWith('.so');
    return stat;
}
const singleSoFilePath = "/a/b/c/symbol.so";
const expectedParentPath = "/a/b/c";
const actualParentPath = findCommonParent([singleSoFilePath]);
assertByExitCode.equal(actualParentPath, expectedParentPath);
