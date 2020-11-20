var fs = require('fs');
var util = require('./build-scripts/util');

console.log('Building shared npm packages');

fs.readdirSync('./', { encoding: 'utf-8' }).forEach(child => {
    if (fs.statSync(child).isDirectory() &&  ['build-scripts', '.git', '_download'].indexOf(child) < 0) {
        console.log('\n----------------------------------');
        console.log(child);
        console.log('----------------------------------');
        util.cd(child);
        util.run('npm install');
        util.run('npm run build');
        util.cd('..');
    }
});
