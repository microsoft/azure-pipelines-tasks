import * as path from 'path';
import * as tl from 'vsts-task-lib/task';
import * as npmCustom from './npmcustom';
import { NpmTaskInput} from './constants';

export async function run(): Promise<void> {
    let Command = 'install';
    return npmCustom.run(Command);
}
