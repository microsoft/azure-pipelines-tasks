const azdev = require('azure-devops-node-api');

const token = process.env.TOKEN;
if (!token) {
    throw new Exception('No token provided');
}

const orgUrl = 'https://dev.azure.com/v-mazayt0';
const authHandler = azdev.getPersonalAccessTokenHandler(token);

const createRelease = async () => {
 console.log('Getting connection');
  const connection = new azdev.WebApi(orgUrl, authHandler);
  console.log('Getting Git API');
  const releaseApi = await connection.getReleaseApi();

  console.log('Creating TFS - Prod Config Change release');

  const definitionId = 120;
  const command = 'run';
  const scriptPath = 'path';
  const description = 'Task hotfix';
  const projectName = 'AzureDevOps'

  const releaseMetadata = {
    definitionId: definitionId,
    description: description,
    variables: {
      Command: { value: command },
      ScriptPath: { value: scriptPath }
    }
  };
  const release = await releaseApi.createRelease(releaseMetadata, projectName);
  console.log(release);
};

try {
    createRelease();
   // createPullRequest();
} catch (err) {
    console.log(err);
    throw err;
}
