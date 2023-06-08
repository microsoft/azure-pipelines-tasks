const fs = require('fs');
const path = require('path');


 function detectBuildConfig(task) {
    console.log(`checking buildconfig for ${task}`);
    try {
        const files = fs.readdirSync('_generated');
        const tasksToTest = [];
    
        files.forEach((item) => {
          const filePath = path.join('_generated', item);
          const stats = fs.statSync(filePath);
    
          if (stats.isDirectory() && item.indexOf(task) !== -1) {
            tasksToTest.push(item);
          }
        });
        return tasksToTest;
      } catch (error) {
        console.error('Error reading subdirectories:', error);
        return [task];
      }

}


console.log( detectBuildConfig('MavenV4'));