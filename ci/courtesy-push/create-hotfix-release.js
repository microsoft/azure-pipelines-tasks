const azdev = require('azure-devops-node-api');

const token = process.env.TOKEN;
if (!token) {
  throw new Error('No token provided');
}

const hotfixFolder = process.argv[2];
if (!hotfixFolder) {
  throw new Error('No hotfixFolder provided');
}

const taskName = process.argv[3];
if (!taskName) {
  throw new Error('No description provided');
}

const scriptPath = `${hotfixFolder}/hotfix.ps1`;
const description = `Hotfixing tasks ${taskName.split(',')}`;

const authHandler = azdev.getPersonalAccessTokenHandler(token);
const orgUrl = 'https://dev.azure.com/mseng';
const definitionId = 120; // "TFS - Prod Config Change" release definition id

const projectName = 'AzureDevOps';

const releaseMetadata = {
  definitionId: definitionId,
  description: description,
  variables: {
    ScriptPath: { value: scriptPath }
  }
};

const createRelease = async () => {
  console.log('Getting connection');
  const connection = new azdev.WebApi(orgUrl, authHandler);

  try {
    console.log('Getting Release API');
    const releaseApi = await connection.getReleaseApi();

    console.log('Creating TFS - Prod Config Change release');
    const release = await releaseApi.createRelease(releaseMetadata, projectName);

    const releaseLink = `${orgUrl}/${projectName}/_releaseProgress?_a=release-pipeline-progress&releaseId=${release.id}`;
    console.log(`Link to the Release: ${releaseLink}`);
  } catch (err) {
    console.log('##vso[task.logissue type=error]Failed to create config change release');
    console.error(err);
    process.exit(1);
  }
};

createRelease();
