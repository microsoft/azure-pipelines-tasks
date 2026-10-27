import * as path from 'path';
import { createRunner } from './L0Common';

void path;
createRunner({ inputs: { artifactType: 'filepath', fileSharePath: '\\\\server\\share' } }).run();
