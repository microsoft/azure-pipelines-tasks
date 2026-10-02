import { Utility } from '../src/Utility';
import fs = require('fs');

async function main() {
    try {
        const result = await Utility.getPowerShellScriptPathWithAzModule('inlinescript', ['ps1'], '');
        console.log('UNEXPECTED_SUCCESS:' + result.scriptPath);
    } catch (err) {
        console.log('EXPECTED_ERROR:' + err.message);
    }
    const shimDir = process.env['TEST_SHIM_DIR'];
    if (shimDir) {
        const exists = fs.existsSync(shimDir);
        console.log('SHIM_DIR_EXISTS_AFTER_CLEANUP:' + exists);
    }
}
main();
