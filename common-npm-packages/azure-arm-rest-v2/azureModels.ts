import { ApplicationTokenCredentials } from "./azure-arm-common";

export interface AzureBaseObject {
    name?: string;
    id: string;
}

export interface LoadBalancerProperties {
    inboundNatRules: InboundNatRule[];
    backendAddressPools: BackendAddressPool[];
    frontendIPConfigurations: IPConfiguration[]
}

export interface InboundNatRuleProperties {
    frontendPort: number;
    backendPort: number;
    backendIPConfiguration?: IPConfiguration;
    frontendIPConfiguration: IPConfiguration;
    protocol: string;
    idleTimeoutInMinutes: number;
    enableFloatingIP: boolean;
}

export interface BackendAddressPoolProperties {
    backendIPConfigurations: IPConfiguration[];
}

export interface NetworkInterfaceProperties {
    ipConfigurations: IPConfiguration[]
}

export interface IPConfigurationProperties {
    publicIPAddress: PublicIPAddress;
    loadBalancerInboundNatRules: InboundNatRule[];
}

export interface PublicIPAddressProperties {
    ipAddress: string;
    dnsSettings: DnsSettings;
}

export interface VMProperties {
    networkProfile: NetworkProfile;
    instanceView: InstanceView;
    storageProfile: StorageProfile
}

export interface VirtualMachineProfile {
    networkProfile?: NetworkProfile;
    instanceView?: InstanceView;
    storageProfile?: StorageProfile;
    extensionProfile?:ExtensionProfile;
}

export interface VMSSProperties {
    virtualMachineProfile: VirtualMachineProfile;
    provisioningState?: string;
}

export interface VMExtensionProperties {
    provisioningState?: string;
    type: string;
    publisher: string;
    typeHandlerVersion: string;
    autoUpgradeMinorVersion?: boolean;
    settings?: Object;
    protectedSettings?: Object;
}

export interface StorageProfile{
    imageReference?: Map<string, string>;
    osDisk: OSDisk;
    dataDisks?: Map<string, string>[];
}

export interface OSDisk{
    osType: string;
    name: string;
    createOption: string;
    caching: string;
    image: ImageUrl;
}

export interface ImageUrl{
    uri: string;
}

export interface DnsSettings {
    fqdn: string;
}

export interface NetworkProfile {
    networkInterfaces: NetworkInterface[]
}

export interface ExtensionProfile {
    extensions: VMExtension[];
}

export interface InstanceView {
    statuses: Status[];
}

export interface Status{
    code: string;
}

export interface LoadBalancer extends AzureBaseObject {
    location: string;
    properties: LoadBalancerProperties
}

export interface VM extends AzureBaseObject {
    properties: VMProperties,
    location: string,
    tags?: string ;
}

export interface VMSS extends AzureBaseObject {
    properties?: VMSSProperties,
    location?: string,
    tags?: string ;
}

export interface VMExtension {
    name?: string;
    id?: string;
    properties: VMExtensionProperties,
    sku?: VMSku;
}

export interface VMSku {
    name?: string,
    tier?: string;
    capacity?: string;
}

export interface NetworkInterface extends AzureBaseObject {
    properties: NetworkInterfaceProperties
}

export interface InboundNatRule extends AzureBaseObject {
    properties: InboundNatRuleProperties
}

export interface IPConfiguration extends AzureBaseObject {
    properties?: IPConfigurationProperties;
}

export interface BackendAddressPool extends AzureBaseObject {
    properties: BackendAddressPoolProperties
}

export interface PublicIPAddress extends AzureBaseObject {
    properties: PublicIPAddressProperties;
}

export interface VMExtensionMetadata {
    type: string;
    publisher: string;
    typeHandlerVersion: string;
}

export enum ComputeResourceType {
    VirtualMachine,
    VirtualMachineScaleSet
}

export enum Scheme {
    ManagedServiceIdentity,
    SPN,
    OidcFederation
}

export interface StorageAccountSku {
    name: string;
    tier?: string;
}

export interface StorageAccountEndpoints {
    blob?: string;
    table?: string;
    file?: string;
    queue?: string;
}

export interface StorageAccountProperties {
    creationTime?: string;
    primaryLocation?: string;
    primaryEndpoints?: StorageAccountEndpoints;
    provisioningState?: string;
    secondaryLocation?: string;
    secondaryndpoints?: StorageAccountEndpoints;
    statusOfPrimary?: string;
    statusOfSecondary?: string;
    supportsHttpsTrafficOnly?: boolean;
}

export interface StorageAccount extends AzureBaseObject {
    type: string;
    location?: string;
    sku?: StorageAccountSku;
    kind?: string;
    tags?: Map<string, string>;
    properties?: StorageAccountProperties;
}

export interface AzureEndpoint {
    subscriptionID?: string;
    subscriptionName: string;
    servicePrincipalClientID?: string;
    authenticationType?: string;
    servicePrincipalKey?: string;
    servicePrincipalCertificate?: string;
    servicePrincipalCertificatePath?: string
    tenantID: string;
    environmentAuthorityUrl: string;
    url: string;
    environment: string;
    activeDirectoryResourceID: string;
    activeDirectoryAuthority?: string;
    graphEndpoint?: string;
    galleryUrl?: string;
    portalEndpoint?: string;
    azureKeyVaultDnsSuffix?: string;
    azureKeyVaultServiceEndpointResourceId?: string;
    msiClientId?: string;
    scheme?: string;
    applicationTokenCredentials: ApplicationTokenCredentials;
    isADFSEnabled?: boolean;
    scopeLevel?: string;
    PublishProfile?: string;
    resourceId?: string;
}

export interface AzureAppServiceConfigurationDetails {
    id: string;
    name: string;
    type: string;
    kind?: string;
    location: string;
    tags: string;
    properties?: {[key: string]: any};
}

export interface WebJob {
    name: string;
    status: string;
    runCommand: string;
    log_url: string;
    url: string;
    type: string;
}

export interface SiteExtension {
    id: string;
    title: string;
    description: string;
    extension_url: string;
    local_path: string;
    version: string;
    project_url: string;
    authors: Array<string>;
    provisioningState: string;
    local_is_latest_version: boolean;
}

export interface WebTest {
    id?: string;
    name: string;
    type: string;
    location: string;
    tags: {[key: string]: string},
    kind?: string,
    etag?: string;
    properties?: {[key: string]: any};
}


export interface ApplicationInsights {
    id?: string;
    name: string;
    type: string;
    location: string;
    tags: {[key: string]: string},
    kind?: string,
    etag?: string;
    properties?: {[key: string]: any};
}

export interface AKSClusterProperties {
    provisioningState: string;
    kubernetesVersion: string;
}

export interface AKSCluster extends AzureBaseObject {
    properties: AKSClusterProperties
}

export interface AKSClusterAccessProfileProperties {
    kubeConfig: string;
}

export interface AKSClusterAccessProfile extends AzureBaseObject {
    properties: AKSClusterAccessProfileProperties
}

export interface IThresholdRuleConditionDataSource {
	"odata.type": string;
	resourceUri: string;
	metricName: string;
}

export interface IThresholdRuleCondition {
	"odata.type": string; // "Microsoft.Azure.Management.Insights.Models.ThresholdRuleCondition"
	dataSource: IThresholdRuleConditionDataSource;
	threshold: string;
	operator: string;
	windowSize: string;
}

export interface IAzureMetricAlertRequestBodyProperties {
	name: string;
	description?: string;
	isEnabled: boolean;
	condition: IThresholdRuleCondition;
	actions: IRuleEmailAction[];
}

export interface IRuleEmailAction {
	"odata.type": string; //"Microsoft.Azure.Management.Insights.Models.RuleEmailAction",
	sendToServiceOwners: boolean;
	customEmails: string[]
}

export interface IAzureMetricAlertRequestBody {
	location: string;
	tags: { [key: string] : string };
	properties: IAzureMetricAlertRequestBodyProperties;
}

export interface IMetric {
	value: string;
	displayValue: string;
	unit: string;
}

export interface IAzureMetricAlertRule {
	alertName: string;
	metric: IMetric;
	thresholdCondition: string;
	thresholdValue: string;
	timePeriod: string;
}

export interface IAzureMetricAlertRulesList {
	resourceId: string;
	rules: IAzureMetricAlertRule[];
}