import * as path from 'path';
import { createRunner } from './L0Common';

void path;
createRunner({ inputs: { artifactName: 'my artifact', properties: '{"user-a":"1","user-b":2}' }, variables: { 'SEND_PIPELINE_ARTIFACTS_TO_BLOBSTORE_DOMAIN': 'domain-guid', 'AZURE_PIPELINES_DEDUP_PARALLELISM': '12' } }).run();
