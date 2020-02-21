import fs = require('fs');

import { findCommonParent } from '../../../utils';
import { unitTest } from '../TestHelpers';

fs.lstatSync = (s: string) => {
    const stat = {} as fs.Stats;
    stat.isFile = () => s.endsWith('.so');
    stat.isSymbolicLink = () => false;
    return stat;
}
const singleSoFilePath = "/a/b/c/symbol.so";
const expectedParentPath = "/a/b/c";
const actualParentPath = findCommonParent([singleSoFilePath]);
unitTest.equal(actualParentPath, expectedParentPath);
