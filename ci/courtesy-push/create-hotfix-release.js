const azdev = require('azure-devops-node-api');

const token = process.env.TOKEN;
if (!token) {
    throw new Exception('No token provided');
}

const hotfixFolder = process.argv[2];
if (!hotfixFolder) {
    throw new Exception('No hotfixFolder provided');
}

const taskName = process.argv[3];
if (!taskName) {
    throw new Exception('No description provided');
}

const scriptPath = `${hotfixFolder}/${taskName}.ps1`
console.log(scriptPath);

const description = `Hotfix for ${taskName} task`;

const authHandler = azdev.getPersonalAccessTokenHandler(token);
const orgUrl = 'https://dev.azure.com/v-mazayt0'; // TODO - update
const definitionId = 3; // "TFS - Prod Config Change" release definition id

const createRelease = async () => {
  console.log('Getting connection');

  const connection = new azdev.WebApi(orgUrl, authHandler);
  console.log('Getting Git API');
  const releaseApi = await connection.getReleaseApi();

  console.log('Creating TFS - Prod Config Change release');

  const command = 'run';
  const projectName = 'TestProject'

  const releaseMetadata = {
    definitionId: definitionId,
    description: description,
    variables: {
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
