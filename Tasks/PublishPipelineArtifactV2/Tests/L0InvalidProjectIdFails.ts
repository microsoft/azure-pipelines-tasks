import { createRunner } from './L0Common';

createRunner({ variables: { 'System.TeamProjectId': 'not-a-guid' } }).run();
