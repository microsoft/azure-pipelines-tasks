import { Utility } from '../src/Utility';

async function main() {
    try {
        const result = await Utility.getPowerShellScriptPathWithAzModule('inlinescript', ['ps1'], '');
        console.log('UNEXPECTED_SUCCESS:' + result.scriptPath);
    } catch (err) {
        console.log('EXPECTED_ERROR:' + err.message);
    }
}
main();
