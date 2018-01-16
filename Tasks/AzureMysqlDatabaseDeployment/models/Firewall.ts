import tl = require("vsts-task-lib/task");
import { read } from "fs";

export class FirewallRule {
    private _firewallAddressRange: FirewallAddressRange;
    private _name: string;

    constructor(name: string, firewallAddressRange: FirewallAddressRange){
        if ( !name ||typeof name.valueOf() !== 'string') {
            throw new Error(tl.loc("FirewallnameCannotBeEmpty"));
        }
        if (!firewallAddressRange) {
            throw new Error(tl.loc("FirewallAddressRangeCannotBeEmpty"));
        }

        this._name = name;
        this._firewallAddressRange = firewallAddressRange;
    }

    public getFirewallAddressRange(): FirewallAddressRange{
        return this._firewallAddressRange;
    }

    public getName(): string{
        return  this._name;
    }
}

export class FirewallAddressRange {
    private _startIpAddress: string;
    private _endIpAddress: string;

    constructor(startIpAddress: string, endIpAddress: string){
        if ( !startIpAddress ||typeof startIpAddress.valueOf() !== 'string') {
            throw new Error(tl.loc("StartIpAddressCannotBeEmpty"));
        }

        if (!endIpAddress || typeof endIpAddress.valueOf() !== 'string') {
            throw new Error(tl.loc("EndIpAddressCannotBeEmpty"));
        }

        this._startIpAddress = startIpAddress;
        this._endIpAddress = endIpAddress;
    }

    public getEndIpAddress(): string{
        return this._endIpAddress;
    }

    public getStartIpAddress(): string{
        return this._startIpAddress;
    }
}
