export class FirewallConfiguration {

    private ipAdressAlreadyAdded: boolean;
    private ipAddress: string;
    
    constructor(ipAdressAlreadyAdded: boolean, iPAddress?: string) {
        this.ipAdressAlreadyAdded = ipAdressAlreadyAdded;
        this.ipAddress = iPAddress;
    }

    public isIpAdressAlreadyAdded(): boolean{
        return this.ipAdressAlreadyAdded;
    }

    public getIpAddress(): string{
        return this.ipAddress;
    }    
}
