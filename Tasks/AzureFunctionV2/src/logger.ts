import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as tl from 'azure-pipelines-task-lib/task';
import * as util from 'util';

const writeFile = util.promisify(fs.writeFile);

export async function logEnvVarsToFile(filename: string): Promise<void> {
  try {
    // Get all environment variables
    const envVars = process.env;

    // Convert to formatted JSON string
    const envVarsJson = JSON.stringify(envVars, null, 2);

    // Write to file
    await writeFile(filename, envVarsJson);

    console.log(`Environment variables logged to: ${filename}`);
  } catch (error) {
    console.error(`Error writing environment variables to file: ${error}`);
  }
}
