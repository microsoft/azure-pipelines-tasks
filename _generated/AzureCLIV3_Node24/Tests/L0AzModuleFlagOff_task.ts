import { Utility } from '../src/Utility';

async function main() {
    try {
        const scriptPath = await Utility.getPowerShellScriptPath('inlinescript', ['ps1'], '');
        console.log('SCRIPT_PATH:' + scriptPath);
    } catch (err) {
        console.log('TASK_ERROR:' + err.message);
    }
}
main();
