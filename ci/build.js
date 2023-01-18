const buildId = process.argv[2];
const sourceBranchName = process.argv[3];
const newVersion = `${+buildId + 1}-${sourceBranchName}`;

console.log(newVersion);