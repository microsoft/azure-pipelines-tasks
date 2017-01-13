export class AzureBaseObject {
    public name?: string;
    public id: string;
    public tags?: string
}

export class LoadBalancerProperties {
    public inboundNatRules: InboundNatRule[];
    public backendAddressPools: BackendAddressPool[];
    public frontendIPConfigurations: IPConfiguration[]
}

export class InboundNatRuleProperties {
    public frontendPort: number;
    public backendPort: number;
    public backendIPConfiguration?: IPConfiguration;
    public frontendIPConfiguration: IPConfiguration;
    public protocol: string;
    public idleTimeoutInMinutes: number;
    public enableFloatingIP: boolean;
}

export class BackendAddressPoolProperties {
    public backendIPConfigurations: IPConfiguration[];
}

export class NetworkInterfaceProperties {
    public ipConfigurations: IPConfiguration[]
}

export class IPConfigurationProperties {
    public publicIPAddress: PublicIPAddress;
    public loadBalancerInboundNatRules: InboundNatRule[];
}

export class PublicIPAddressProperties {
    public ipAddress: string;
    public dnsSettings: DnsSettings;
}

export class VMProperties {
    public networkProfile: NetworkProfile
}

export class DnsSettings {
    public fqdn: string;
}

export class NetworkProfile {
    public networkInterfaces: NetworkInterface[]
}

export class LoadBalancer extends AzureBaseObject {
    public location: string;
    public properties: LoadBalancerProperties
}

export class VM extends AzureBaseObject {
    public properties: VMProperties
}

export class NetworkInterface extends AzureBaseObject {
    public properties: NetworkInterfaceProperties
}

export class InboundNatRule extends AzureBaseObject {
    public properties: InboundNatRuleProperties
}

export class IPConfiguration extends AzureBaseObject {
    public properties?: IPConfigurationProperties
}

export class BackendAddressPool extends AzureBaseObject {
    public properties: BackendAddressPoolProperties
}

export class PublicIPAddress extends AzureBaseObject {
    public properties: PublicIPAddressProperties;
}
