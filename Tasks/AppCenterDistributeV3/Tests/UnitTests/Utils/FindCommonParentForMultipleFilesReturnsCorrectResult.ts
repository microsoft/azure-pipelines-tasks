import fs = require('fs');

import { findCommonParent } from '../../../utils';
import { assertByExitCode } from '../TestHelpers';

fs.lstatSync = (s: string) => {
    const stat = {} as fs.Stats;
    stat.isFile = () => s.endsWith('.so');
    stat.isSymbolicLink = () => false;
    return stat;
}
const expectedParentPath = "/a/b";
const actualParentPath = findCommonParent(["/a/b/c/x", "/a/b/c/y", "/a/b/d/z"]);
assertByExitCode.equal(actualParentPath, expectedParentPath);
