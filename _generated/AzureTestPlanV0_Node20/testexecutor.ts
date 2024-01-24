import * as path from 'path';
import * as fs from 'fs';
import * as semver from "semver"
import { spawnSync } from 'child_process'
import tl = require('azure-pipelines-task-lib/task');

export function spawn(executable: string, args: string[]): Promise<SpawnResult> {

    console.log("-------------------------------------------")
    console.log("test execution begins")
    console.log("-------------------------------------------")
    console.log('Test command executable: ' + executable);
    console.log('Test command args: ' + args);

    const { status, error } = spawnSync(executable, args, { stdio: 'inherit' })

    return Promise.resolve({ status, error })
}

interface SpawnResult {
    status: number | null
    error?: Error
}