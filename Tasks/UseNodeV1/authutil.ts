import * as taskLib from 'vsts-task-lib/task';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

function setNpmrc(registryUrl: string, registryToken: string, authFile?: string) {
    let projectNpmrc: string = path.resolve(process.cwd(), '.npmrc');
    if (authFile) {
        projectNpmrc = path.resolve(process.cwd(), authFile);
    }

    let newContents = '';
    if (fs.existsSync(projectNpmrc)) {
        const curContents = fs.readFileSync(projectNpmrc, 'utf8');
        curContents.split(os.EOL).forEach((line) => {
            // Add current contents unless they are setting the registry
            if (!line.startsWith('registry')) {
                newContents += line + os.EOL;
            }
        });
    }
    newContents += 'registry=' + registryUrl + os.EOL + 'always-auth=true' + os.EOL + registryUrl + ':_authToken=${NPM_TOKEN}';
    fs.writeFileSync(projectNpmrc, newContents);

    taskLib.setVariable('NPM_TOKEN', registryToken, true);
}

export function setAuth(auth: string, authFile?: string) {
    // TODO - make this better. Should actually get feed info.
    if (auth.toLowerCase() === 'npm') {
        // setNpmrc(null, null, authFile);
    }
}