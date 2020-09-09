const path = require('path');
const fs = require('fs');

versionReplace = function(pathToUnifiedDeps, pathToNewUnifiedDeps, outputPath) {
    var currentDeps = fs.readFileSync(pathToUnifiedDeps, "utf8");
    var newDeps = fs.readFileSync(pathToNewUnifiedDeps, "utf8");

    var currentDepsArr = currentDeps.split('\n');
    var newDepsArr = newDeps.split('\n');
    var newDepsDict = {};

    newDepsArr.forEach(function (newDep) {
        // add to dictionary
        var depDetails = newDep.split("\"");
        console.log(JSON.stringify(depDetails));
        var name = depDetails[1];
        var version = depDetails[3];
        console.log(name + ' ' + version);
        newDepsDict[name] = version;
    });

    var updatedDeps = [];

    currentDepsArr.forEach(function (currentDep) {
        var depDetails = currentDep.split("\"");
        var name = depDetails[1];

        // find if there is a match in new (ignoring case)
        if (name) {
            var newDepsKey = Object.keys(newDepsDict).find(key => key.toLowerCase() === name.toLowerCase());
            if (newDepsKey && newDepsDict[newDepsKey]) {
                // update the version
                depDetails[3] = newDepsDict[newDepsKey];
                updatedDeps.push(depDetails.join('\"'));
            } else {
                updatedDeps.push(currentDep);
                console.log(`"${currentDep}"`);
            }
        }
        else {
            updatedDeps.push(currentDep);
        }
    });

    // write it as a new file where currentDeps is
    fs.writeFileSync(outputPath, updatedDeps.join("\n"));
    console.log('Done.');
}

const unifiedDeps = process.argv[2];
const newDeps = process.argv[3];

versionReplace(unifiedDeps, newDeps, unifiedDeps); 
