import tl = require("azure-pipelines-task-lib/task");

export function isValidDatabaseName(databaseName: string): boolean {
	return databaseName.length > 0 && !/[^a-zA-Z0-9_\-$\u0080-\uD7FF\uE000-\uFFFF]/.test(databaseName);
}

export class MysqlTaskParameter {
	
	private taskNameSelector: string;
	private sqlFile: string;
	private sqlInline: string;
	private serverName: string;
	private databaseName: string;
	private sqlUserName: string;
	private sqlPassword: string;
	private sqlAdditionalArguments: string;
	
	constructor() {
		try {
			this.taskNameSelector = tl.getInput('TaskNameSelector', true);
			this.sqlFile = tl.getInput('SqlFile', false);
			this.sqlInline = tl.getInput('SqlInline', false);
			this.serverName = tl.getInput('ServerName', true);
			this.databaseName = tl.getInput('DatabaseName', false);
			if (this.databaseName && tl.getPipelineFeature('EnableMysqlDeploymentDatabaseNameValidation') && !isValidDatabaseName(this.databaseName)) {
				throw new Error(tl.loc("InvalidDatabaseName", this.databaseName));
			}
			this.sqlUserName = tl.getInput('SqlUsername', true);
			this.sqlPassword = tl.getInput('SqlPassword', true);
			this.sqlAdditionalArguments = tl.getInput('SqlAdditionalArguments', false);
		}
		catch (error) {
			throw new Error(tl.loc("ARGD_ConstructorFailed", error.message));
		}
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
}
