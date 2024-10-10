const os = require('os');

const stdout = process.stdout;
const stderr = process.stderr;

stdout.write('stdline 1' + os.EOL,
    () => stdout.write('stdline 2',
        () => stdout.write(os.EOL + 'stdline 3')));

stderr.write('errline 1' + os.EOL,
    () => stderr.write('errline 2',
        () => stderr.write(os.EOL + 'errline 3')));
