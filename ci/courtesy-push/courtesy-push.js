const fs = require('fs');

const versionReplace = (pathToUnifiedDeps, pathToNewUnifiedDeps, outputPath) => {
    const currentDeps = fs.readFileSync(pathToUnifiedDeps, 'utf8');
    const newDeps = fs.readFileSync(pathToNewUnifiedDeps, 'utf8');

    const currentDepsArr = currentDeps.split('\n');
    const newDepsArr = newDeps.split('\n');
    const newDepsDict = {};

    newDepsArr.forEach(newDep => {
        // add to dictionary
        const depDetails = newDep.split('"');
        console.log(JSON.stringify(depDetails));
        const name = depDetails[1];
        const version = depDetails[3];
        console.log(name + ' ' + version);
        newDepsDict[name] = version;
    });

    const updatedDeps = [];

    currentDepsArr.forEach(currentDep => {
        const depDetails = currentDep.split('"');
        const name = depDetails[1];

        // find if there is a match in new (ignoring case)
        if (name) {
            const newDepsKey = Object.keys(newDepsDict).find(key => key.toLowerCase() === name.toLowerCase());
            if (newDepsKey && newDepsDict[newDepsKey]) {
                // update the version
                depDetails[3] = newDepsDict[newDepsKey];
                updatedDeps.push(depDetails.join('"'));
            } else {
                updatedDeps.push(currentDep);
                console.log(`"${currentDep}"`);
            }
        } else {
            updatedDeps.push(currentDep);
        }
    });

    // write it as a new file where currentDeps is
    fs.writeFileSync(outputPath, updatedDeps.join('\n'));
    console.log('Done.');
};

const unifiedDeps = process.argv[2];
const newDeps = process.argv[3];

versionReplace(unifiedDeps, newDeps, unifiedDeps); 
