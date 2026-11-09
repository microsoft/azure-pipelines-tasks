import * as path from 'path';
import { createRunner } from './L0Common';

void path;
createRunner({ inputs: { path: 'Tests' }, variables: { 'system.defaultworkingdirectory': path.join(__dirname, '..') } }).run();
