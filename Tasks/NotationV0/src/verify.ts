import * as taskLib from 'azure-pipelines-task-lib/task';
import { IExecOptions, ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import * as path from 'path';
import { NOTATION, NOTATION_BINARY, TRUST_STORE, X509 } from './lib/constants';
import { getConfigHome } from './lib/fs';
import { notationRunner } from './lib/runner';
import { getArtifactReferences } from './lib/variables';

export async function verify(): Promise<void> {
    const artifactRefs = getArtifactReferences();
    const trustPolicy = taskLib.getInput('trustPolicy', true) || '';
    const trustStore = taskLib.getInput('trustStore', true) || '';
    const allowReferrerAPI = taskLib.getBoolInput('allowReferrersAPI', false);
    const debug = taskLib.getVariable('system.debug')

    // config trust policy
    await configTrustPolicy(trustPolicy);
    // config trust store
    taskLib.rmRF(path.join(getConfigHome(), NOTATION, TRUST_STORE));
    await configTrustStore(trustStore);

    let env = { ...process.env }
    if (allowReferrerAPI) {
        env["NOTATION_EXPERIMENTAL"] = "1";
    }

    // run notation verify for each artifact
    await notationRunner(artifactRefs, async (notation: ToolRunner, artifactRef: string, execOptions: IExecOptions) => {
        execOptions.env = env;
        return notation
            .arg(['verify', artifactRef, '--verbose'])
            .argIf(allowReferrerAPI, '--allow-referrers-api')
            .argIf(debug && debug.toLowerCase() === 'true', '--debug')
            .exec(execOptions);
    })
}

async function configTrustPolicy(trustPolicy: string): Promise<void> {
    // run notation command to install trust policy
    let code = await taskLib.tool(NOTATION_BINARY)
        .arg(['policy', 'import', '--force', trustPolicy])
        .exec();
    if (code !== 0) {
        throw new Error(taskLib.loc('FailedToImportTrustPolicy', trustPolicy));
    }

    code = await taskLib.tool(NOTATION_BINARY)
        .arg(['policy', 'show'])
        .exec();
    if (code !== 0) {
        throw new Error(taskLib.loc('FailedToShowTrustPolicy'));
    }
}

// configTrustStore configures Notation trust store based on specs.
// Reference: https://github.com/notaryproject/specifications/blob/v1.0.0-rc.2/specs/trust-store-trust-policy.md#trust-store
async function configTrustStore(dir: string): Promise<void> {
    const trustStoreX509 = path.join(dir, X509); // .github/truststore/x509
    if (!taskLib.exist(trustStoreX509)) {
        throw new Error(taskLib.loc('CannotFindTrustStore', trustStoreX509));
    }

    // traverse all trust store types
    for (var trustStoreTypePath of getSubdir(trustStoreX509)) {  // [.github/truststore/x509/ca, .github/truststore/x509/signingAuthority, ...]
        const trustStoreType = path.basename(trustStoreTypePath);

        // traverse all trust stores
        for (var trustStorePath of getSubdir(trustStoreTypePath)) {  // [.github/truststore/x509/ca/<my_store1>, .github/truststore/x509/ca/<my_store2>, ...]
            const trustStore = path.basename(trustStorePath);

            // get all certs
            const certs = getFilesFromDir(trustStorePath); // [.github/truststore/x509/ca/<my_store1>/<my_cert1>, .github/truststore/x509/ca/<my_store1>/<my_cert2>, ...]

            // run notation command to add cert to trust store
            const code = await taskLib.tool(NOTATION_BINARY)
                .arg(['cert', 'add', '--type', trustStoreType, '--store', trustStore, ...certs])
                .exec();
            if (code !== 0) {
                throw new Error(taskLib.loc('FailedToAddCertToTrustStore', trustStore));
            }
        }
    }

    // list trust store
    const code = await taskLib.tool(NOTATION_BINARY)
        .arg(['cert', 'list'])
        .exec();
    if (code !== 0) {
        throw new Error(taskLib.loc('FailedToListTrustStore'));
    }
}

// getSubdir gets all sub dirs under dir without recursive
function getSubdir(dir: string): string[] {
    return taskLib.ls('', [dir])
        .map(filename => path.join(dir, filename))
        .filter(filepath => taskLib.stats(filepath).isDirectory())
}

// getFilesFromDir gets all files under dir without recursive
function getFilesFromDir(dir: string): string[] {
    return taskLib.ls('', [dir])
        .map(filename => path.join(dir, filename))
        .filter(filepath => taskLib.stats(filepath).isFile())
}
