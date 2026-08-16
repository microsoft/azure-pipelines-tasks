import tl = require('azure-pipelines-task-lib/task');
import AzureSqlResourceManager, { FirewallRule } from './AzureSqlResourceManager';

export default class FirewallManager {
    private _resourceManager: AzureSqlResourceManager;
    private _firewallRule?: FirewallRule;

    constructor(azureSqlResourceManager: AzureSqlResourceManager) {
        this._resourceManager = azureSqlResourceManager;
    }

    /**
     * Adds a firewall rule for the specified IP address
     * @param ipAddress Client IP address to allow
     */
    public async addFirewallRule(ipAddress: string): Promise<void> {
        if (!ipAddress) {
            tl.debug(tl.loc('ClientHasAccessToServer'));
            return;
        }

        tl.debug(tl.loc('AddingFirewallRule', ipAddress));
        
        try {
            this._firewallRule = await this._resourceManager.addFirewallRule(ipAddress, ipAddress);
            tl.debug(`Firewall rule details: ${JSON.stringify(this._firewallRule)}`);
            tl.debug(tl.loc('FirewallRuleAdded', this._firewallRule.name));
        } catch (error) {
            throw new Error(tl.loc('FailedToAddFirewallRule', error.message || error));
        }
    }

    /**
     * Removes the firewall rule that was created by this manager
     */
    public async removeFirewallRule(): Promise<void> {
        if (this._firewallRule) {
            tl.debug(tl.loc('RemovingFirewallRule', this._firewallRule.name));
            
            try {
                await this._resourceManager.removeFirewallRule(this._firewallRule);
                tl.debug(tl.loc('FirewallRuleRemoved'));
            } catch (error) {
                // Log warning but don't fail the task if cleanup fails
                tl.warning(tl.loc('FailedToRemoveFirewallRule', this._firewallRule.name, error.message || error));
            }
        }
    }
}
