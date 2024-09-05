const fs = require('fs');
const path = require('path');
const util = require('./common-npm-packages/build-scripts/util');
const minimist = require('minimist');

const ignoredFolders = ['build-scripts', '.git', '_download', 'node_modules'];
const defaultTestSuite = 'L0';
const predefinedFlags = {
    boolean: [
        'build',
        'test'
    ],
    string: [
        'suite'
    ]
};

const options = minimist(process.argv, predefinedFlags)
const testResultsPath = path.join(__dirname, 'test-results');
const mochaReporterPath = path.join(__dirname, 'common-npm-packages', 'build-scripts', 'junit-spec-reporter.js');
const coverageBaseNameJson = 'coverage-final.json';
const summaryBaseName = 'coverage-summary.json';

const printLabel = (name) => {
    console.log('\n----------------------------------');
    console.log(name);
    console.log('----------------------------------');
}

const buildPsTestHelpers = () => {
    console.log('Building Tests');
    util.cd('Tests');
    util.run('npm install');
    util.run(path.join('node_modules', '.bin', 'tsc'));
    util.cd('..');
}

if (options.build) {
    buildPsTestHelpers();

    console.log('\nBuilding shared npm packages');
    util.cd('common-npm-packages');
    fs.readdirSync('./', { encoding: 'utf-8' }).forEach(child => {
        if (fs.statSync(child).isDirectory() && !ignoredFolders.includes(child)) {
            printLabel(child);

            util.cd(child);
            util.run('npm install');
            util.run('npm run build');
            util.cd('..');
        }
    });
}

if (options.test) {
    const gitkeepName = '.gitkeep';
    const junitPath = path.join(testResultsPath, 'junit');
    const coveragePath = path.join(testResultsPath, 'coverage');

    console.log('Testing shared npm packages');
    util.cd('common-npm-packages');
    const suite = options.suite || defaultTestSuite;
    let testsFailed = false;
    util.cleanFolder(testResultsPath, [gitkeepName]);

    const startPath = process.cwd();
    fs.readdirSync(startPath, { encoding: 'utf-8' }).forEach(child => {
        if (fs.statSync(child).isDirectory() && !ignoredFolders.includes(child)) {
            printLabel(child);
            const buildPath = path.join(startPath, child, '_build');

            if (fs.existsSync(buildPath)) {
                const testPath = path.join(buildPath, 'Tests', `${suite}.js`);

                if (fs.existsSync(path.join(testPath))) {
                    try {
                        const suitName = `${child}-suite`;
                        const mochaOptions = util.createMochaOptions(mochaReporterPath, junitPath, suitName);

                        util.run(`nyc --all --src ${buildPath} --report-dir ${coveragePath} mocha ${mochaOptions} ${testPath}`, true);
                        util.renameFile(coveragePath, coverageBaseNameJson, `${child}-coverage.json`);
                    } catch (err) {
                        testsFailed = true;
                    }
                } else {
                    console.log('No tests found for the package');
                }
            } else {
                throw new Error('Package has not been built');
            }
        }
    });

    try {
        util.rm(path.join(coveragePath, summaryBaseName));
        util.run(`nyc merge ${coveragePath} ${path.join(testResultsPath, 'merged-coverage.json')}`, true);
        util.run(`nyc report -t ${testResultsPath} --report-dir ${testResultsPath} --reporter=cobertura`, true);
    } catch (e) {
        console.log('Error while generating coverage report')
    }

    if (testsFailed) {
        throw new Error('Tests failed!');
    }
}