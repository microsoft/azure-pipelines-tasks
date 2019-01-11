import * as K8sTypes from "@kubernetes/client-node";
import * as k8s from "@kubernetes/client-node";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.Core_v1Api);
const k8sAppApiClient = kc.makeApiClient(k8s.Apps_v1Api);

export class KubeService {

    public static getPod(namespace: string, name:string): Promise<K8sTypes.V1Pod> {
        return k8sApi.readNamespacedPod(name, namespace, null, false, true).then((res) => {
            return !!res && !!res.response && res.response.statusCode == 200 ? res.body : <K8sTypes.V1Pod>{};
         });
    }

    public static getDeployment(namespace: string, name:string): Promise<K8sTypes.V1Deployment> {
        return k8sAppApiClient.readNamespacedDeployment(name, namespace, null, false, true).then((res) => {
           return !!res && !!res.response && res.response.statusCode == 200 ? res.body : <K8sTypes.V1Deployment>{};
        });
    }

    public static getReplicaSet(namespace: string, name:string): Promise<K8sTypes.V1ReplicaSet> {
        return k8sAppApiClient.readNamespacedReplicaSet(name, namespace, null, false, true).then((res) => {
            return !!res && !!res.response && res.response.statusCode == 200 ? res.body : <K8sTypes.V1ReplicaSet>{};
         });
    }

    public static getDaemonSet(namespace: string, name:string) : Promise<K8sTypes.V1DaemonSet> {
        return k8sAppApiClient.readNamespacedDaemonSet(name, namespace, null, false, true).then((res) => {
            return !!res && !!res.response && res.response.statusCode == 200 ? res.body : <K8sTypes.V1DaemonSet>{};
         });
    }

    public static getStatefulSet(namespace: string, name:string) : Promise<K8sTypes.V1StatefulSet> {
        return k8sAppApiClient.readNamespacedStatefulSet(name, namespace, null, false, true).then((res) => {
            return !!res && !!res.response && res.response.statusCode == 200 ? res.body : <K8sTypes.V1StatefulSet>{};
         });
    }

    public static createPod(namespace: string, body:K8sTypes.V1Pod): Promise<K8sTypes.V1Pod> {
        return k8sApi.createNamespacedPod(namespace, body, null).then((res) => {
            return !!res && !!res.response && res.response.statusCode == 200 ? res.body : <K8sTypes.V1Pod>{};
         });
    }

    public static createDeployment(namespace: string, body:K8sTypes.V1Deployment): Promise<K8sTypes.V1Deployment> {
        return k8sAppApiClient.createNamespacedDeployment(namespace, body, null).then((res) => {
           return !!res && !!res.response && res.response.statusCode == 200 ? res.body : <K8sTypes.V1Deployment>{};
        });
    }

    public static createReplicaSet(namespace: string, body:K8sTypes.V1ReplicaSet): Promise<K8sTypes.V1ReplicaSet> {
        return k8sAppApiClient.createNamespacedReplicaSet(namespace, body, null).then((res) => {
            return !!res && !!res.response && res.response.statusCode == 200 ? res.body : <K8sTypes.V1ReplicaSet>{};
         });
    }

    public static createDaemonSet(namespace: string, body:K8sTypes.V1DaemonSet) : Promise<K8sTypes.V1DaemonSet> {
        return k8sAppApiClient.createNamespacedDaemonSet(namespace, body, null).then((res) => {
            return !!res && !!res.response && res.response.statusCode == 200 ? res.body : <K8sTypes.V1DaemonSet>{};
         });
    }

    public static createStatefulSet(namespace: string, body:K8sTypes.V1StatefulSet) : Promise<K8sTypes.V1StatefulSet> {
        return k8sAppApiClient.createNamespacedStatefulSet(namespace, body, null).then((res) => {
            return !!res && !!res.response && res.response.statusCode == 200 ? res.body : <K8sTypes.V1StatefulSet>{};
         });
    }
}