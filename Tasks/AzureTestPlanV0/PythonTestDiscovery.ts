const { exec } = require('child_process');

function getPythonTests(callback) {
  const command = 'pytest --collect-only';

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command: ${error.message}`);
      return callback(error);
    }

    if (stderr) {
      console.error(`Command error: ${stderr}`);
      return callback(new Error(stderr));
    }

    const tests = parseTestNames(stdout);
    callback(null, tests);
  });
}

function parseTestNames(output) {
  // Extracting test names from the pytest output
  const testNames = output
    .split('\n')
    .filter(line => line.trim().startsWith('<Function'));

  return testNames.map(line => line.match(/"(.*?)"/)[1]);
}

// Example usage
getPythonTests((error, tests) => {
  if (!error) {
    console.log('List of Python tests:');
    console.log(tests);
  }
});
