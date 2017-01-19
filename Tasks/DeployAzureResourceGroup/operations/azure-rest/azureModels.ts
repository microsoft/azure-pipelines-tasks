export interface AzureBaseObject {
    name?: string;
    id: string;
    tags?: string ;
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

export interface StorageProfile{
    imageReference: Map<string, string>;
    osDisk: OSDisk;
    dataDisks: Map<string, string>[];
}

export interface OSDisk{
    osType: string;
}

export interface DnsSettings {
    fqdn: string;
}

export interface NetworkProfile {
    networkInterfaces: NetworkInterface[]
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
    location: string
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
