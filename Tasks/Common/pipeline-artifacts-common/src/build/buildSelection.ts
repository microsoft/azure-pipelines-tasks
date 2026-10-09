import { isNullOrWhiteSpace, parseDotNetBoolean, parseDotNetGuid, parseDotNetInt32 } from '../util/dotnet';
import { BuildClient, BuildResult as BuildResultFlags } from './buildClient';

const BuildResult = BuildResultFlags;

export const SourceRun = {
    Current: 'current',
    Specific: 'specific'
} as const;

export const RunVersion = {
    Latest: 'latest',
    LatestFromBranch: 'latestFromBranch',
    Specific: 'specific'
} as const;

export type BuildLocalizer = (key: string, ...args: unknown[]) => string;
export type VariableGetter = (name: string) => string | undefined;
export type LogFunction = (message: string) => void;

export interface BuildSelectionContext {
    buildClient: BuildClient;
    loc: BuildLocalizer;
    debug?: LogFunction;
    signal?: AbortSignal;
}

export interface LatestBuildSelectionOptions {
    pipelineDefinition: string;
    project: string;
    runVersion: string;
    tagFilters: string[];
    resultFilter?: number;
    branchName?: string;
}

export interface SpecificRunSelectionOptions {
    projectInput: string;
    pipelineDefinition: string;
    preferTriggeringPipeline?: string | boolean;
    runVersion: string;
    runIdInput?: string;
    branchName?: string;
    tagFilters: string[];
    resultFilter: number;
    getVariable: VariableGetter;
}

export interface ResolvedSpecificRun {
    projectId: string;
    pipelineId: number;
}

function parseBoolean(value: string | boolean | undefined): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    return parseDotNetBoolean(value);
}

function equalsIgnoreCase(left: string | undefined, right: string | undefined): boolean {
    return !!left && !!right && left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
}

function requireInteger(text: string, message: string): number {
    const value = parseDotNetInt32(text);
    if (value === undefined) {
        throw new Error(message);
    }
    return value;
}

export function getResultFilter(allowPartiallySucceededBuilds: boolean, allowFailedBuilds: boolean, allowCanceledBuilds: boolean): number {
    let result = BuildResult.Succeeded;

    if (allowPartiallySucceededBuilds) {
        result |= BuildResult.PartiallySucceeded;
    }

    if (allowFailedBuilds) {
        result |= BuildResult.Failed;
    }

    if (allowCanceledBuilds) {
        result |= BuildResult.Canceled;
    }

    return result;
}

export function resolveTriggeringPipelineId(getVariable: VariableGetter, pipelineDefinition: string, debug?: LogFunction): number {
    const hostType = getVariable('system.hostType');
    let triggeringPipeline: string | undefined;

    if (hostType && !isNullOrWhiteSpace(hostType) && hostType.toLowerCase() !== 'build') {
        debug?.('Environment: Release');
        const releaseAlias = getVariable('release.triggeringartifact.alias');
        const prefix = `release.artifacts.${releaseAlias ?? ''}.`;
        const definitionIdTriggered = getVariable(prefix + 'definitionId');
        if (equalsIgnoreCase(definitionIdTriggered, pipelineDefinition)) {
            triggeringPipeline = getVariable(prefix + 'buildId');
            if (triggeringPipeline && !isNullOrWhiteSpace(triggeringPipeline)) {
                debug?.(`TrigerringPipeline: ${triggeringPipeline}`);
            }
        }
    } else {
        debug?.('Environment: Build');
        const definitionIdTriggered = getVariable('build.triggeredBy.definitionId');
        if (equalsIgnoreCase(definitionIdTriggered, pipelineDefinition)) {
            triggeringPipeline = getVariable('build.triggeredBy.buildId');
            if (triggeringPipeline && !isNullOrWhiteSpace(triggeringPipeline)) {
                debug?.(`TrigerringPipeline: ${triggeringPipeline}`);
            }
        }
    }

    if (triggeringPipeline && !isNullOrWhiteSpace(triggeringPipeline)) {
        return requireInteger(triggeringPipeline, `Triggering pipeline id is not valid: ${triggeringPipeline}`);
    }

    return 0;
}

export async function resolveProjectId(context: BuildSelectionContext, projectNameOrId: string): Promise<string> {
    const guid = parseDotNetGuid(projectNameOrId);
    if (guid) {
        return guid;
    }

    try {
        return await context.buildClient.getProjectId(projectNameOrId, context.signal);
    } catch (error) {
        throw new Error(`Get project failed for project: ${projectNameOrId}`);
    }
}

export async function resolveDefinitionId(context: BuildSelectionContext, project: string, pipelineDefinition: string): Promise<number> {
    if (!pipelineDefinition || isNullOrWhiteSpace(pipelineDefinition)) {
        throw new Error(context.loc('CannotBeNullOrEmpty', 'Pipeline Definition'));
    }

    const definitionId = parseDotNetInt32(pipelineDefinition);
    if (definitionId !== undefined) {
        return definitionId;
    }

    const definitions = await context.buildClient.getDefinitionsByName(project, pipelineDefinition, context.signal);
    const definition = definitions[0];
    if (!definition) {
        throw new Error(context.loc('PipelineDoesNotExist', pipelineDefinition));
    }

    return definition.id;
}

export async function selectLatestBuildId(context: BuildSelectionContext, options: LatestBuildSelectionOptions): Promise<number> {
    const definitionId = await resolveDefinitionId(context, options.project, options.pipelineDefinition);
    const builds = await context.buildClient.getBuilds(options.project, {
        definitions: [definitionId],
        branchName: options.runVersion === RunVersion.LatestFromBranch ? options.branchName : undefined,
        tagFilters: options.tagFilters,
        queryOrder: 'finishTimeDescending',
        resultFilter: options.resultFilter
    }, context.signal);

    if (builds.length < 1) {
        throw new Error(context.loc('BuildsDoesNotExist'));
    }

    return builds[0].id;
}

export async function resolveSpecificRun(context: BuildSelectionContext, options: SpecificRunSelectionOptions): Promise<ResolvedSpecificRun> {
    if (!options.projectInput) {
        throw new Error(context.loc('CannotBeNullOrEmpty', 'Project Name'));
    }

    const projectId = await resolveProjectId(context, options.projectInput);
    let pipelineId = 0;

    if (parseBoolean(options.preferTriggeringPipeline)) {
        context.debug?.('TrigerringPipeline: true');
        pipelineId = resolveTriggeringPipelineId(options.getVariable, options.pipelineDefinition, context.debug);
        context.debug?.(`PipelineId from trigerringBuild: ${pipelineId}`);
    }

    if (pipelineId === 0) {
        context.debug?.(`PipelineVersionToDownload: ${options.runVersion}`);
        if (options.runVersion === RunVersion.Latest) {
            pipelineId = await selectLatestBuildId(context, {
                pipelineDefinition: options.pipelineDefinition,
                project: projectId,
                runVersion: options.runVersion,
                tagFilters: options.tagFilters,
                resultFilter: options.resultFilter
            });
        } else if (options.runVersion === RunVersion.Specific) {
            pipelineId = requireInteger(options.runIdInput ?? '', context.loc('RunIDNotValid', options.runIdInput ?? ''));
        } else if (options.runVersion === RunVersion.LatestFromBranch) {
            pipelineId = await selectLatestBuildId(context, {
                pipelineDefinition: options.pipelineDefinition,
                project: projectId,
                runVersion: options.runVersion,
                tagFilters: options.tagFilters,
                resultFilter: options.resultFilter,
                branchName: options.branchName
            });
        } else {
            throw new Error('Unreachable code!');
        }
        context.debug?.(`PipelineId from non-trigerringBuild: ${pipelineId}`);
    }

    return { projectId, pipelineId };
}
