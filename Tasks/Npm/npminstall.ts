import * as path from 'path';

import * as tl from 'vsts-task-lib/task';

import * as npmCustom from './npmcustom';

export async function run(): Promise<void> {
    return npmCustom.run('install');
}
