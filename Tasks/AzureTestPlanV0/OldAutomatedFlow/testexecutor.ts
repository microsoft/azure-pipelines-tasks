import { spawnSync } from 'child_process'

export async function spawn(executable: string, args: string[]): Promise<SpawnResult> {

    console.log("-------------------------------------------")
    console.log("test execution begins")
    console.log("-------------------------------------------")
    console.log('Test command executable: ' + executable);
    console.log('Test command args: ' + args);

    const { status, error, stdout } = spawnSync(executable, args, { stdio: 'pipe' });
    return { status, error, stdout: stdout?.toString() };
}

export interface SpawnResult {
    status: number | null
    error?: Error
    stdout?: string
}