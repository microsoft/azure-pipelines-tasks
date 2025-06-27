import * as mapping from './task-pipeline-mapping.json';

export function getPipelineNamesForTask(taskName: string): string[] {
  const pipelineNames: string[] = [taskName];
  
  if (mapping && (mapping as any)[taskName]) {
    const additionalPipelines = (mapping as any)[taskName];
    
    if (Array.isArray(additionalPipelines)) {
      console.log(`📋 Task-to-pipeline mapping found for ${taskName}: adding ${additionalPipelines.length} additional pipeline(s) [${additionalPipelines.join(', ')}]`);
      pipelineNames.push(...additionalPipelines);
    } else {
      console.log(`⚠️  Invalid mapping format for ${taskName}: expected array, got ${typeof additionalPipelines}`);
    }
  }
  
  return pipelineNames;
}
