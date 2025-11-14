const fs = require('fs');
const path = require('path');

function findGradleTests(rootDir) {
  const testNames = new Set();

  function traverseDirectory(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        traverseDirectory(filePath);
      } else if (file.endsWith('.java') || file.endsWith('.groovy')) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const matches = fileContent.match(/@Test\s*void\s*(\w+)/g);

        if (matches) {
          const className = path.relative(rootDir, filePath).replace(/\\/g, '/').replace(/\.(java|groovy)$/, '');
          matches.forEach(match => {
            const methodName = match.match(/@Test\s*void\s*(\w+)/)[1];
            testNames.add(`${className}.${methodName}`);
          });
        }
      }
    }
  }

  traverseDirectory(rootDir);

  return Array.from(testNames);
}

// Example usage
const rootDir = 'C:\\Users\\triptijain\\Downloads\\gradle_working';
const tests = findGradleTests(rootDir);

console.log('List of Gradle tests:');
console.log(tests);
