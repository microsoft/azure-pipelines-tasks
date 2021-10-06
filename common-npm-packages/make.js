const fs = require('fs');
const path = require('path');
const util = require('./build-scripts/util');
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

const printLabel = (name) => {
    console.log('\n----------------------------------');
    console.log(name);
    console.log('----------------------------------');
}

if (options.build) {
    console.log('Building shared npm packages');

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
    console.log('Testing shared npm packages');

    const suite = options.suite || defaultTestSuite;
    let testsFailed = false;

    fs.readdirSync('./', { encoding: 'utf-8' }).forEach(child => {
        if (fs.statSync(child).isDirectory() && !ignoredFolders.includes(child)) {
            printLabel(child);

            if (fs.existsSync(path.join('./', child, '_build'))) {
                util.cd(path.join(child, '_build'));

                if (fs.existsSync(path.join('./', 'Tests', `${suite}.js`))) {
                    try {
                        util.run(`mocha Tests/${suite}.js`, true);
                    } catch (err) {
                        testsFailed = true;
                    } finally {
                        util.cd('../..');
                    }
                } else {
                    console.log('No tests found for the package');
                    util.cd('../..');
                }
            } else {
                throw new Error('Package has not been built');
            }
        }
    });
    if (testsFailed) {
        throw new Error('Tests failed!');
    }
}
