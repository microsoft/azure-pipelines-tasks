export function getPipelineNamesForTask(taskName: string): string[] {
  const pipelineNames: string[] = [taskName];
  
  try {
    // Using require for JSON file to avoid TypeScript configuration issues
    const mapping = (require as any)('./task-pipeline-mapping.json');
    
    if (mapping[taskName]) {
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
