export const TaskRequestStepType = 
{
	FileTask: "FileTask",
	EncodedTask: "EncodedTask"
}

export interface ITaskStepProperties {
	type: string;
}

export interface EncodedTaskStep extends ITaskStepProperties {
	values: Value[];
	contextPath: string;
	contextAccessToken: string;
	encodedTaskContent: string;
	encodedValuesContent: string;
}

export interface IFileTaskStep extends ITaskStepProperties {
	contextPath: string;
	contextAccessToken: string;
	taskFilePath: string;
	valuesFilePath: string;
}

export class Value {
	name: string;
	value: string;
	isSecret: boolean;
}

export class TaskStep {
	build? : string;
	push?: string[];
}

export class TaskJson {
	version: string;
	steps: TaskStep[];
}

export interface IOverrideTaskStepProperties {
	arguments: string[];
	values: Value[];
	contextPath: string;
}

export interface ITaskRunRequest
{
	type: "TaskRunRequest";
	taskId: string;
	taskName: string;
	overrideTaskStepProperties: IOverrideTaskStepProperties
}

export interface IPlatformProperties {
	architecture: string;
	os: string;
	variant: string;
}

export interface IBaseImageTrigger {
	status: string;
	baseImageTriggerType: string;
	name: string;
	updateTriggerEndpoint: string;
	updateTriggerPayloadType: string;
}

export interface ITrigger {
	baseImageTrigger: IBaseImageTrigger;
}

export interface IAgentConfiguration {
	cpu: string;
}

export interface IAcrTaskRequestBodyProperties {
	platform: IPlatformProperties;
	step: ITaskStepProperties;
	agentConfiguration?: IAgentConfiguration;
	trigger?: ITrigger;
}

export interface IAcrTaskRequestBody {
	location: string;
	identity: {};
	tags: { [key: string] : string };
	properties: IAcrTaskRequestBodyProperties;

}

export class OutputImage {
	registry: string;
	repository: string;
	tag: string;
	digest: string;
}