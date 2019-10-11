import * as tl from 'azure-pipelines-task-lib/task';
import { KubernetesConnection } from 'kubernetes-common-v2/kubernetesconnection';
import * as FileHelper from './fileHelper';

export function getKubernetesConnection(): KubernetesConnection {
    const kubernetesServiceConnection = tl.getInput('kubernetesServiceConnection', true);
    const connection = new KubernetesConnection(kubernetesServiceConnection, FileHelper.getTaskTempDir());
    return connection;
}