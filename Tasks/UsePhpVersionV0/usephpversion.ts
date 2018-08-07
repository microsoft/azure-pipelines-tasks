import { Platform } from './taskutil';

interface TaskParameters {
    versionSpec: string,
    architecture: string
}

export async function usePhpVersion(parameters: Readonly<TaskParameters>, platform: Platform): Promise<void> {
}