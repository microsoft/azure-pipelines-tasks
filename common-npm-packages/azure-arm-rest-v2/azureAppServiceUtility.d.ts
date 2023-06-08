import { Kudu } from './azure-arm-app-service-kudu';
import { AzureAppService } from './azure-arm-app-service';

export declare class AzureAppServiceUtility {
    constructor(appService: AzureAppService, telemetryFeature?: string);
    getWebDeployPublishingProfile(): Promise<any>;
    getApplicationURL(virtualApplication?: string): Promise<string>;
    pingApplication(): Promise<void>;
    getPhysicalPath(virtualApplication: string): Promise<string>;
    getKuduService(): Promise<Kudu>;
    updateAndMonitorAppSettings(addProperties?: any, deleteProperties?: any, formatJSON?: boolean): Promise<boolean>;
    enableRenameLockedFiles(): Promise<void>;
    updateStartupCommandAndRuntimeStack(runtimeStack: string, startupCommand?: string): Promise<void>;
    isFunctionAppOnCentauri(): Promise<boolean>;
}