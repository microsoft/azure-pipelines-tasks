import * as path from 'path';
import { createRunner } from './L0Common';

void path;
createRunner({ inputs: { path: path.join(__dirname, 'does-not-exist') } }).run();
