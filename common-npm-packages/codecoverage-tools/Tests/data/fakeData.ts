export const excludeFilter = [
    '**/R.class',
    '**/R$.class'
];
export const excludeFilterStringified = `'${excludeFilter.join('\',\'')}'`;
export const includeFilter = [
    '**/*$ViewInjector.class',
    '**/*$ViewBinder.class'
];
export const includeFilterStringified = `'${includeFilter.join('\',\'')}'`;
export const classDir = 'some/folder/with/classes';
export const classDirs = 'some/folder1/with/classes,some/folder2/with/classes';
export const sourceDir = 'source/dir';
export const sourceDirs = 'source/dir1,source/dir2';
export const reportDir = 'report/dir';
export const getFormattedFileCollectionAssignGradleOutput = 'fileCollectionAssign';
export const aggregate = 'aggregateFake';
export const baseDir = 'base/dir'
export const invalidClassFilter1 = '-:**/R,-';
export const invalidClassFilter2 = '-:**/R,?:**/R$,-:**/*$ViewInjector';
export const classFilter = '+:**/R,+:**/R$,-:**/*$ViewInjector,-:**/*$ViewBinder,+:**/BuildConfig,-:**/Manifest';
export const sharedSubString1 = "abcd";
export const sharedSubString2 = "efhg";
export const sharedSubString3 = "abhg";
export const stringArray = ['g', 'b', 'p', 'f', 'c', 's', 'e', 'a', 't', 'o', 'u', 'q', 'r', 'y', 'd', 'z', 'v', 'x', 'n', 'h', 'w', 'i', 'l', 'j', 'm', 'k'];
export const string = "fake string";
export const propertyName = "someProperty";
export const propertyValue = 108;