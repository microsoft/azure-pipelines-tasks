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
