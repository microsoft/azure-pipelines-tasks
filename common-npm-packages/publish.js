var fs = require('fs');
var util = require('./build-scripts/util');

console.log('Publishing shared npm packages');

fs.readdirSync('./', { encoding: 'utf-8' }).forEach(child => {
    if (fs.statSync(child).isDirectory() &&  ['build-scripts', '.git', '_download', 'node_modules'].indexOf(child) < 0) {
        console.log('\n----------------------------------');
        console.log(child);
        console.log('----------------------------------');
        util.cd(child);
        util.cd('_build');
        try {
            const npmrc = `//registry.npmjs.org/:_authToken=${process.env['NPM_TOKEN']}`;
            console.log(`Writing .npmrc: ${npmrc}`);
            fs.writeFileSync('.npmrc', npmrc);
            util.run('npm publish');
        }
        catch(ex) {
            console.log('Publish failed - this usually indicates that the package has already been published');
        }
        util.cd('..');
        util.cd('..');
    }
});
