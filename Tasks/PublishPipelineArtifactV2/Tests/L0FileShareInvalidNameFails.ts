import * as path from 'path';
import { createRunner } from './L0Common';

void path;
createRunner({ inputs: { artifactType: 'filepath', fileSharePath: path.join(__dirname, 'share'), artifactName: '..' } }).run();
