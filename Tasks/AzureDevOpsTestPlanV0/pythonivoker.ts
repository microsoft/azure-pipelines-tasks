import { spawn } from './testexecutor'
import tl = require('azure-pipelines-task-lib/task');

export async function executepythontests(testsToBeExecuted: string[]) {

    const executable = 'pytest'
    const args = []

    args.push('-v')

        // https://docs.pytest.org/en/7.1.x/example/markers.html
    const testsList = testsToBeExecuted.join(' ')
    args.push(testsToBeExecuted)

     //args.push('--junitxml=junit.xml')

    // spawnSync will automatically quote any args with spaces in them, so we don't need to
    // manually include the quotes when running the command. Here we do it for display purposes.
    const quotedArgs = args.map((arg) => (arg.includes(' ') ? `'${arg}'` : arg))
    console.log(`Running tests with pytest using command: ${[executable, ...quotedArgs].join(' ')}`)

    const { status, error } = await spawn(executable, args)

    if (error) {
        console.error(error)
    }

    return { exitCode: status ?? 1 }
}