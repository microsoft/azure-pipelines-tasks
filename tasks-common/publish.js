const fs = require('fs');
const util = require('./common-npm-packages/build-scripts/util');
const releaseNotes = require('./common-npm-packages/build-scripts/create-release');

console.log('Publishing shared npm packages');

async function publishPackages(packages) {
    for (let i = 0; i < packages.length; i++) {
        const package = packages[i];
        if (fs.statSync(package).isDirectory() &&  ['build-scripts', '.git', '_download', 'node_modules'].indexOf(package) < 0) {
            console.log('\n----------------------------------');
            console.log(package);
            console.log('----------------------------------');
            util.cd(package);
            util.cd('_build');
            try {
                const npmrc = `//registry.npmjs.org/:_authToken=\${NPM_TOKEN}`;
                console.log(`Writing .npmrc: ${npmrc}`);
                fs.writeFileSync('.npmrc', npmrc);
                util.run('npm publish --registry https://registry.npmjs.org/');
                await releaseNotes.createReleaseNotes(package, 'main');
            }
            catch(ex) {
                if (ex instanceof util.CreateReleaseError) {
                    console.log(`Error creating release notes: ${ex.message}`);                    
                } else {
                    console.log('Publish failed - this usually indicates that the package has already been published');
                }
            }
            util.cd('../..');
        }
    }
}

util.cd('common-npm-packages');
var packages = fs.readdirSync('./', { encoding: 'utf-8' });
publishPackages(packages);