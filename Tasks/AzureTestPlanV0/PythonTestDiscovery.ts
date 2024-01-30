const { exec } = require('child_process');

function runPytestCollectOnly() {
  return new Promise((resolve, reject) => {
    // Run pytest --collect-only command
    exec('pytest --collect-only', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      // Process the stdout to extract test names
      const testNames = parsePytestCollectOnlyOutput(stdout);

      resolve(testNames);
    });
  });
}

function parsePytestCollectOnlyOutput(output) {
  // Implement your logic to parse the output and extract test names
  // This may involve using regular expressions or other string manipulation
  // Depending on the output format of pytest --collect-only
  // For simplicity, let's assume the output contains lines starting with "collected" and includes the test names

  const testNames = output
    .split('\n')
    .filter(line => line.startsWith('collected'))
    .map(line => line.split('::').join('::')); // Adjust the parsing logic based on the actual output format

  return testNames;
}

// Run the function and handle the result
runPytestCollectOnly()
  .then(testNames => {
    console.log('List of fully qualified test names:', testNames);
  })
  .catch(error => {
    console.error('Error running pytest --collect-only:', error);
  });
