import * as path from 'path';

export function getPipelineNamesForTask(taskName: string): string[] {
  const pipelineNames: string[] = [taskName];
  
  try {
    // Using path.resolve for robust JSON file path resolution
    const mappingPath = path.resolve(__dirname, 'task-pipeline-mapping.json');
    const mapping = (require as any)(mappingPath);
    
    if (mapping && mapping[taskName]) {
      const additionalPipelines = mapping[taskName];
      
      if (Array.isArray(additionalPipelines)) {
        console.log(`📋 Task-to-pipeline mapping found for ${taskName}: adding ${additionalPipelines.length} additional pipeline(s) [${additionalPipelines.join(', ')}]`);
        pipelineNames.push(...additionalPipelines);
      } else {
        console.log(`⚠️  Invalid mapping format for ${taskName}: expected array, got ${typeof additionalPipelines}`);
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not load task-pipeline mapping: ${(error as Error).message}, using default pipeline only`);
  }
  
  return pipelineNames;
}
