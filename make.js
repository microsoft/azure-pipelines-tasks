var process = require('process');
var child_process = require('child_process');
if (process.argv[2] == 'testLegacy') {
    console.log('Skipping "testLegacy" target');
}
else {
    var cl = 'gulp ' + process.argv.slice(2).join(' ');
    console.log(cl);
    try {
        child_process.execSync(cl, { cwd: __dirname, stdio: 'inherit' });
    }
    catch (err) {
        console.error(err.output ? err.output.toString() : err.message);
        process.exit(1);
    }
}
