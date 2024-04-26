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
    tasksWithPackageJson.push(folderName);
    var packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());
    if (packageJson.name) {
      tasksWithName.push(folderName);
    } else {
      tasksWithoutName.push(folderName);
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

console.log(tasksWithPackageJson.length);
console.log(tasksWithoutPackageJson.length);
console.log('with Name: ' + tasksWithName.length);
console.log('w/o Name: ' + tasksWithoutName.length);
console.log('with versions: ' + tasksWithVersion.length);
console.log('w/o versions: ' + tasksWithoutVersion.length);
