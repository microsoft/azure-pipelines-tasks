import * as cheerio from 'cheerio';

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
export const stringArray = ['g', 'b', 'a', 'p', 'f', 'c', 's', 'e', 'a', 't', 'o', 'u', 'q', 'r', 'y', 'd', 'z', 'v', 'x', 'n', 'h', 'w', 'i', 'l', 'j', 'm', 'k'];
export const string = "fake string";
export const propertyName = "someProperty";
export const propertyValue = 108;
export const filtersWithNotAppliedFilterPattern = ":**/R:**/R$:**/BuildConfig*";
export const buildFile = '/build/file/path/build.gradle';
export const summaryFile = 'coverageSummary.xml'
export const filters = {
    includeFilter: ":**/R:**/R$:**/BuildConfig",
    excludeFilter: ":**/*$ViewInjector:**/*$ViewBinder:**/Manifest"
}
export const AntBuildConfigurationJSONWithoutProject = {
    someProperty: 108
}
export const AntBuildConfigurationJSONWithProject = {
    project: {},
    someProperty: 108
}
export const cherioObjWithProjectNode = cheerio.load('<project></project><node></node>', <CheerioOptionsInterface>{ xmlMode: true, withDomLvl1: false });
export const cherioObjWithoutProjectNode = cheerio.load('<node></node>', <CheerioOptionsInterface>{ xmlMode: true, withDomLvl1: false });
export const coberturaAntBuildConfigurationWithTarget = cheerio.load(`<project>
    <target></target>
    <target></target>
    <target></target>
</project>`, <CheerioOptionsInterface>{ xmlMode: true, withDomLvl1: false });
export const nodeToEnableFork = cheerio.load('<node/>', <CheerioOptionsInterface>{ xmlMode: true, withDomLvl1: false })('node').get()[0] as unknown as CheerioElement;
export const enableForkingBuildConfigWithTargetConfig = cheerio.load('<project><target><junit/></target></project>', <CheerioOptionsInterface>{ xmlMode: true, withDomLvl1: false });
export const enableForkingBuildConfigWithTargetNode = enableForkingBuildConfigWithTargetConfig('target').get()[0] as unknown as CheerioElement;
export const enableForkingBuildConfigWithTargetAndCoberturaConfig = cheerio.load('<project><target><cobertura-instrument>exist cobertura node</cobertura-instrument><junit/></target></project>', <CheerioOptionsInterface>{ xmlMode: true, withDomLvl1: false });
export const enableForkingBuildConfigWithTargetAndCoberturaNode = enableForkingBuildConfigWithTargetAndCoberturaConfig('target').get()[0] as unknown as CheerioElement;
export const enableForkingBuildConfigWithoutTargetConfig = cheerio.load('<project><target/></project>', <CheerioOptionsInterface>{ xmlMode: true, withDomLvl1: false });
export const enableForkingBuildConfigWithoutTargetNode = enableForkingBuildConfigWithoutTargetConfig('target').get()[0] as unknown as CheerioElement;
export const enableForkingBuildConfigWithJavacConfig = cheerio.load('<project><target><javac/></target></project>', <CheerioOptionsInterface>{ xmlMode: true, withDomLvl1: false });
export const enableForkingBuildConfigWithJavacNode = enableForkingBuildConfigWithJavacConfig('target').get()[0] as unknown as CheerioElement;
