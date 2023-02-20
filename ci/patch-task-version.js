const fs = require('fs');
const path = require('path');
const params = [];
process.argv.slice(2).forEach(item => {
  var param = item.split('=');
  if(param.length === 2) {
    params[param[0].substring(2)] = param[1];
  }
});
console.log(params);
if(!params.task || !params.version) {
  throw new "Missing args --task && --version"
}
const pathToJson = path.join('Tasks', params.task, 'task.json')

var content = JSON.parse(fs.readFileSync(pathToJson));

const version = {
  major: params.version.split('.')[0],
  minor: params.version.split('.')[1],
  patch: params.version.split('.')[2],
}

console.log(version);

// content.version.Major = version.major;
content.version.Minor = version.minor;
content.version.Patch = version.patch;

fs.writeFileSync(pathToJson, JSON.stringify(content));
