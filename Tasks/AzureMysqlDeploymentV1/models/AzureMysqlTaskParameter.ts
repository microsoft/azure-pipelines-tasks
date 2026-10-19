import tl = require("azure-pipelines-task-lib/task");

// Allow-list of characters permitted in a MySQL database identifier.
// Mirrors MySQL's own identifier rules (see dev.mysql.com/doc/refman/8.0/en/identifiers.html):
// ASCII alnum/_/-/$ plus the full Basic Multilingual Plane (U+0080-U+FFFF), EXCLUDING the
// UTF-16 surrogate range (U+D800-U+DFFF) so that supplementary-plane characters (U+10000+,
// e.g. emoji) are rejected -- MySQL never permits those in identifiers, quoted or not.
const DATABASE_NAME_REGEX = /^[a-zA-Z0-9_\-$\u0080-\uD7FF\uE000-\uFFFF]+$/;

export function isValidDatabaseName(databaseName: string): boolean {
	return DATABASE_NAME_REGEX.test(databaseName);
}

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
            if (this.databaseName && tl.getPipelineFeature('EnableAzureMysqlDeploymentDatabaseNameValidation') && !isValidDatabaseName(this.databaseName)) {
                throw new Error(tl.loc("InvalidDatabaseName", this.databaseName));
            }
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
