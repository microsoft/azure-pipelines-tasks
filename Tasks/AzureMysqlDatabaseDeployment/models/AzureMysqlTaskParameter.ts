import tl = require("vsts-task-lib/task");

export class AzureMysqlTaskParameter {

    private _connectedServiceName: string; 
    private _resourceGroupName: string;
    private _serverName: string;
    private _databaseName: string;
    private _sqlUserName: string;
    private _sqlPassword: string;
    private _taskNameSelector: string;
    private _sqlFile: string;
    private _sqlInline: string;
    private _sqlAdditionalArguments: string;
    private _inlineAdditionalArguments;
    private _ipDetectionMethod: string;
    private _startIpAddress: string;
    private _endIpAddress: string;
	private _deleteFirewallRule: boolean;

    constructor() {
        try {
            this._connectedServiceName = tl.getInput('ConnectedServiceName', true);
            this._resourceGroupName = tl.getInput('ResourceGroupName', true);
            this._serverName = tl.getInput('ServerName', true);
            this._databaseName = tl.getInput('DatabaseName', false);
            this._sqlUserName = tl.getInput('SqlUsername', true);
            this._sqlPassword = tl.getInput('SqlPassword', true);
            this._taskNameSelector = tl.getInput('TaskNameSelector', true);
            this._sqlFile = tl.getInput('SqlFile', false);
            this._sqlInline = tl.getInput('SqlInline', false);
            this._sqlAdditionalArguments = tl.getInput('SqlAdditionalArguments', false);
            this._inlineAdditionalArguments = tl.getInput('InlineAdditionalArguments', false);
            this._ipDetectionMethod  = tl.getInput('IpDetectionMethod', false);
            this._startIpAddress = tl.getInput('StartIpAddress', false);
            this._endIpAddress = tl.getInput('EndIpAddress', false);
            this._deleteFirewallRule = tl.getBoolInput('DeleteFirewallRule', false);
        }
        catch (error) {
            throw new Error(tl.loc("ARGD_ConstructorFailed", error.message));
        }
	}

	public getConnectedServiceName(): string {
		return this._connectedServiceName;
	}
    
	public getResourceGroupName(): string {
		return this._resourceGroupName;
	}  

	public getServerName(): string {
		return this._serverName;
	}

	public getDatabaseName(): string {
		return this._databaseName;
	}

	public getSqlPassword(): string {
		return this._sqlPassword;
	}

	public getSqlUserName(): string {
		return this._sqlUserName;
	}

	public getTaskNameSelector(): string {
		return this._taskNameSelector;
	}

	public getSqlFile(): string {
		return this._sqlFile;
	}

	public getSqlInline(): string {
		return this._sqlInline;
	}

	public getSqlAdditionalArguments(): string {
		return this._sqlAdditionalArguments;
	}

	public getIpDetectionMethod(): string {
		return this._ipDetectionMethod;
	}

	public getStartIpAddress(): string {
		return this._startIpAddress;
	}

	public getEndIpAddress(): string {
		return this._endIpAddress;
	}

	public getDeleteFirewallRule(): boolean {
		return this._deleteFirewallRule;
	}
    
}