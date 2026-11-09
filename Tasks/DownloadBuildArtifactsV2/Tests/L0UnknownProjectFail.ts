import { createRunner } from './L0Common';

createRunner({ inputs: { buildType: 'specific', project: 'missing-project', definition: '12', buildVersionToDownload: 'latest' } }).run();
