import { FirewallConfiguration } from '../models/FirewallConfiguration';

export interface ISqlClient {

    /**
     * Get firewall configuration either Ip address is already added or not
     *
     * @returns FirewallConfiguration  contains isIpAddress already whitelisted and If it is not Ip address of agent
     */
    getFirewallConfiguration(): FirewallConfiguration;

    /**
     * Execute sql command in asynchronously
     * 
     * @returns response code promise  
     */
    executeSqlCommand(): Promise<number>;

}
