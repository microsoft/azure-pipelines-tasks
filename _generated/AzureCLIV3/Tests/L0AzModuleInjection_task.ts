import { Utility } from '../src/Utility';

async function main() {
    try {
        const result = await Utility.getPowerShellScriptPathWithAzModule('inlinescript', ['ps1'], '');
        console.log('SCRIPT_PATH:' + result.scriptPath);
        if (result.azShimDirectory) {
            console.log('SHIM_DIRECTORY:' + result.azShimDirectory);
        }
    } catch (err) {
        console.log('TASK_ERROR:' + err.message);
    }
}
main();
