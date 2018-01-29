import { FirewallConfigurationCheckResult } from '../models/FirewallConfigurationCheckResult';

export interface ISqlClient {

    /**
     * Get firewall configuration either Ip address is already added or not
     *
     * @returns FirewallConfigurationCheckResult  contains isIpAddress already whitelisted and If it is not Ip address of agent
     */
    getFirewallConfiguration(): FirewallConfigurationCheckResult;

    /**
     * Execute sql command in asynchronously
     * 
     * @returns response code promise  
     */
    executeSqlCommand(): Promise<number>;

}
