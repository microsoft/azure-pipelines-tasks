const fs = require('node:fs');
const path = require('node:path');
const { tasksSourcePath } = require('./ci-util');

const content = fs.readdirSync(tasksSourcePath);
const tasksWithPackageJson = [];
const tasksWithoutPackageJson = [];
const tasksWithName = [];
const tasksWithoutName = [];
const tasksWithVersion = [];
const tasksWithoutVersion = [];

content.forEach(folderName => {
  var packageJsonPath = path.join(tasksSourcePath, folderName, 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    var packageJson = JSON.parse(fs.readFileSync(packageJsonPath));
    tasksWithPackageJson.push(folderName);
    if (packageJson.name) {
      tasksWithName.push(folderName);
    } else {
      tasksWithoutName.push(folderName);

      //packageJson.name = folderName.toLocaleLowerCase();

      const name = folderName.toLocaleLowerCase().replace(/v\d*/g, '');
      packageJson = insertKey('name', name, packageJson, 0);

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

      var packageLockJsonPath = path.join(tasksSourcePath, folderName, 'package-lock.json');
      if (fs.existsSync(packageLockJsonPath)) {
        var packageLockJson = JSON.parse(fs.readFileSync(packageLockJsonPath));
        packageLockJson = insertKey('name', name, packageLockJson, 0);
        fs.writeFileSync(packageLockJsonPath, JSON.stringify(packageLockJson, null, 2));
      } else {
        var npmShrinkwrapJsonPath = path.join(tasksSourcePath, folderName, 'npm-shrinkwrap.json');
        if (fs.existsSync(npmShrinkwrapJsonPath)) {
          var npmShrinkwrapJson = JSON.parse(fs.readFileSync(npmShrinkwrapJsonPath));
          npmShrinkwrapJson = insertKey('name', name, npmShrinkwrapJson, 0);
          fs.writeFileSync(npmShrinkwrapJsonPath, JSON.stringify(npmShrinkwrapJson, null, 2));
        }
      }
    }
    if (packageJson.version) {
      tasksWithVersion.push(folderName);
    } else {
      tasksWithoutVersion.push(folderName);
    }
  } else {
    tasksWithoutPackageJson.push(folderName);
  }
});

function insertKey(key, value, obj, pos) {
  return Object.keys(obj).reduce((ac, a, i) => {
    if (i === pos) ac[key] = value;
    ac[a] = obj[a];
    return ac;
  }, {});
}

console.log(tasksWithPackageJson.length);
console.log(tasksWithoutPackageJson.length);
console.log('with Name: ' + tasksWithName);
console.log(tasksWithoutName);
console.log('with versions: ' + tasksWithVersion);
console.log('w/o versions: ' + tasksWithoutVersion);

// ContainerBuildV0,
//   DockerComposeV0,
//   DockerInstallerV0,
//   DockerV0,
//   DockerV1,
//   DockerV2,
//   DuffleInstallerV0,
//   FuncToolsInstallerV0,
//   HelmDeployV0,
//   HelmInstallerV0,
//   HelmInstallerV1,
//   KubectlInstallerV0,
//   KubernetesManifestV0,
//   KubernetesManifestV1,
//   KubernetesV0,
//   KubernetesV1,
//   NodeTaskRunnerInstallerV0,
//   PublishCodeCoverageResultsV1,
//   PublishCodeCoverageResultsV2,
//   SshV0;
