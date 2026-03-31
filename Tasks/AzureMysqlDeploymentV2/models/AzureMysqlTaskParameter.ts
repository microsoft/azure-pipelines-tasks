import tl = require("azure-pipelines-task-lib/task");

export class AzureMysqlTaskParameter {
	
	private connectedServiceName: string; 
	private serverName: string;
	private databaseName: string;
	private sqlUserName: string;
	private sqlPassword: string;
	private taskNameSelector: string;
	private sqlFile: string;
	private sqlInline: string;
	private sqlAdditionalArguments: string;
	private ipDetectionMethod: string;
	private startIpAddress: string;
	private endIpAddress: string;
	private deleteFirewallRule: boolean;

    constructor() {
        try {
            this.connectedServiceName = tl.getInput('ConnectedServiceName', true);
            this.serverName = tl.getInput('ServerName', true);
            this.databaseName = tl.getInput('DatabaseName', false);
            this.sqlUserName = tl.getInput('SqlUsername', true);
            this.sqlPassword = tl.getInput('SqlPassword', true);
            this.taskNameSelector = tl.getInput('TaskNameSelector', true);
            this.sqlFile = tl.getInput('SqlFile', false);
            this.sqlInline = tl.getInput('SqlInline', false);
            this.sqlAdditionalArguments = tl.getInput('SqlAdditionalArguments', false);
            this.ipDetectionMethod  = tl.getInput('IpDetectionMethod', false);
            this.startIpAddress = tl.getInput('StartIpAddress', false);
            this.endIpAddress = tl.getInput('EndIpAddress', false);
            this.deleteFirewallRule = tl.getBoolInput('DeleteFirewallRule', false);
        }
        catch (error) {
            throw new Error(tl.loc("ARGD_ConstructorFailed", error.message));
        }
	}

	public getConnectedServiceName(): string {
		return this.connectedServiceName;
	}

	public getServerName(): string {
		return this.serverName;
	}

	public getDatabaseName(): string {
		return this.databaseName;
	}

	public getSqlPassword(): string {
		return this.sqlPassword;
	}

	public getSqlUserName(): string {
		return this.sqlUserName;
	}

	public getTaskNameSelector(): string {
		return this.taskNameSelector;
	}

	public getSqlFile(): string {
		return this.sqlFile;
	}

	public getSqlInline(): string {
		return this.sqlInline;
	}

	public getSqlAdditionalArguments(): string {
		return this.sqlAdditionalArguments;
	}

	public getIpDetectionMethod(): string {
		return this.ipDetectionMethod;
	}

	public getStartIpAddress(): string {
		return this.startIpAddress;
	}

	public getEndIpAddress(): string {
		return this.endIpAddress;
	}

	public getDeleteFirewallRule(): boolean {
		return this.deleteFirewallRule;
	}  
}
