import * as path from 'path';
import { createRunner } from './L0Common';

void path;
createRunner({ inputs: { properties: '{"other":"x"}' } }).run();
