import tl = require("azure-pipelines-task-lib/task");

export class FirewallRule {
    private properties: FirewallAddressRange;
    private name: string;

    constructor(name: string, firewallAddressRange: FirewallAddressRange){
        if ( !name || typeof name.valueOf() !== 'string') {
            throw new Error(tl.loc("FirewallRuleNameCannotBeEmpty"));
        }
        if (!firewallAddressRange) {
            throw new Error(tl.loc("FirewallAddressRangeCannotBeEmpty"));
        }

        this.name = name;
        this.properties = firewallAddressRange;
    }

    public getProperties(): FirewallAddressRange{
        return this.properties;
    }

    public getName(): string{
        return  this.name;
    }
}

export class FirewallAddressRange {
    private startIpAddress: string;
    private endIpAddress: string;

    constructor(startIpAddress: string, endIpAddress: string){
        if ( !startIpAddress ||typeof startIpAddress.valueOf() !== 'string') {
            throw new Error(tl.loc("StartIpAddressCannotBeEmpty"));
        }

        if (!endIpAddress || typeof endIpAddress.valueOf() !== 'string') {
            throw new Error(tl.loc("EndIpAddressCannotBeEmpty"));
        }

        this.startIpAddress = startIpAddress;
        this.endIpAddress = endIpAddress;
    }

    public getEndIpAddress(): string{
        return this.endIpAddress;
    }

    public getStartIpAddress(): string{
        return this.startIpAddress;
    }
}
