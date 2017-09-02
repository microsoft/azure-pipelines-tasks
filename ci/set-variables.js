// .npmrc
console.log(`##vso[task.setvariable variable=NPM_CONFIG_USERCONFIG]${path.join(__dirname, '.npmrc')}`);

// npm auth
var npmAuth = Buffer.from('u:' + process.env.SYSTEM_ACCESSTOKEN).toString('base64');
console.log(`##vso[task.setSecret]${npmAuth}`);
console.log(`##vso[task.setVariable variable=system_accessToken_npm]${npmAuth}`);
