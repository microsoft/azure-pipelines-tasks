import * as tl from 'azure-pipelines-task-lib/task';
import { KubernetesConnection } from 'azure-pipelines-tasks-kubernetes-common/kubernetesconnection';
import * as FileHelper from './fileHelper';

export function getKubernetesConnection(): KubernetesConnection {
    const kubernetesServiceConnection = tl.getInput('kubernetesServiceConnection', true);
    const connection = new KubernetesConnection(kubernetesServiceConnection, FileHelper.getTaskTempDir());
    return connection;
}