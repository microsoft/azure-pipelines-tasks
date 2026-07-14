import * as fs from 'fs';
import * as path from 'path';
import { WebApi, getPersonalAccessTokenHandler } from 'azure-devops-node-api';

const MSENG_URL = 'https://dev.azure.com/mseng';
const BUG_PROJECT = 'AzureDevOps';

const OWNER_HANDLES = ['@tarunramsinghani'];

const CANARYTEST_AREA_PATH = 'AzureDevOps\\Pipelines\\Pipeline Agent and Tasks - IDC';
const BUG_PRIORITY = '2';
const BUG_TAG = 'azure-pipelines-canary';

const CODEOWNERS_PATH = path.join(__dirname, '..', '..', '..', '..', '.github', 'CODEOWNERS');

let ownedTasksCache: Set<string> | null = null;

function getOwnedTasks(): Set<string> {
    if (ownedTasksCache) {
        return ownedTasksCache;
    }

    const owned = new Set<string>();
    try {
        const content = fs.readFileSync(CODEOWNERS_PATH, 'utf8');
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) {
                continue;
            }

            const tokens = line.split(/\s+/);
            const pattern = tokens[0];
            const owners = tokens.slice(1);

            const match = /^Tasks\/([^/\s]+)\/?$/.exec(pattern);
            if (!match) {
                continue;
            }

            const isOwned = owners.some(owner => OWNER_HANDLES.includes(owner));
            if (isOwned) {
                owned.add(match[1].toLowerCase());
            }
        }
    } catch (err) {
        console.log(`Could not read CODEOWNERS at ${CODEOWNERS_PATH}: ${err}`);
    }

    ownedTasksCache = owned;
    return owned;
}

export async function fileBugIfNeeded(taskName: string, result: string, buildUrl?: string): Promise<void> {
    const pat = process.env['AZP_BUG_PAT'];
    if (!pat) {
        return;
    }

    if (!getOwnedTasks().has(taskName.toLowerCase())) {
        console.log(`Skipping bug for "${taskName}" - not owned by ${OWNER_HANDLES.join(', ')} in CODEOWNERS`);
        return;
    }

    const connection = new WebApi(MSENG_URL, getPersonalAccessTokenHandler(pat));
    const wit = await connection.getWorkItemTrackingApi();

    const title = `Canary test pipeline ${taskName} failed`;
    const wiql = `SELECT [System.Id] FROM workitems WHERE [System.Title] = '${title}' AND [System.State] = 'Active'`;
    const existing = await wit.queryByWiql({ query: wiql });
    if (existing.workItems && existing.workItems.length > 0) {
        console.log(`Bug already exists for "${taskName}": ${existing.workItems[0].url}`);
        return;
    }

    const add = (field: string, value: string) => ({ op: 'add', path: `/fields/${field}`, value });
    const document: any = [
        add('System.Title', title),
        add('System.AreaPath', CANARYTEST_AREA_PATH),
        add('Microsoft.VSTS.Common.Priority', BUG_PRIORITY),
        add('System.Tags', BUG_TAG)
    ];

    const workItem = await wit.createWorkItem(null, document, BUG_PROJECT, 'Bug');

    const linkPart = buildUrl ? `<div>Failing build: <a href="${buildUrl}">${buildUrl}</a></div>` : '';
    const message = `<div>Canary test pipeline "${taskName}" completed with result "${result}".</div>${linkPart}<div><br></div><div><b>This ticket was created automatically.</b></div>`;
    await wit.addComment({ text: message }, BUG_PROJECT, workItem.id!);

    console.log(`Created bug for "${taskName}": ${workItem.url}`);
}
