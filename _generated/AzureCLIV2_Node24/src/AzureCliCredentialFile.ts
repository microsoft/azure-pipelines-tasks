import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

// Keep this helper synchronized across AzureCLIV1, AzureCLIV2 and AzureCLIV3.
export interface ServicePrincipalCertificate {
    certificatePath: string;
    directoryPath: string;
}

export function createServicePrincipalCertificate(
    agentTempDirectory: string,
    certificateContent: string
): ServicePrincipalCertificate {
    if (!agentTempDirectory) {
        throw new Error('Agent.TempDirectory is required for Azure CLI certificate credentials.');
    }

    const directoryPath = fs.mkdtempSync(path.join(agentTempDirectory, '.azclitask-credentials-'));
    const certificatePath = path.join(directoryPath, 'spnCert.pem');
    try {
        if (process.platform !== 'win32') {
            fs.chmodSync(directoryPath, 0o700);
        }
        fs.writeFileSync(certificatePath, certificateContent, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        return { certificatePath, directoryPath };
    } catch (error) {
        removeServicePrincipalCertificate(certificatePath, directoryPath);
        throw error;
    }
}

export function removeServicePrincipalCertificate(certificatePath: string, directoryPath?: string): void {
    const cleanupPath = directoryPath || certificatePath;
    if (!cleanupPath) {
        return;
    }

    try {
        tl.rmRF(cleanupPath);
    } catch (error) {
        // Cleanup must not hide a login/script failure or prevent Azure logout.
        tl.warning('Failed to remove the Azure CLI service-principal certificate credentials.');
    }
}
