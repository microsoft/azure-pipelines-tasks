import * as path from 'path';
import * as assert from 'assert';
import * as tl from 'azure-pipelines-task-lib';
import * as fs from 'fs';

describe('VsTest Suite', function() {
    this.timeout(10000);

    if (!tl.osType().match(/^Win/)) {
        return;
    }

    before((done) => {
        done();
    });

    it('InputDataContract parity between task and dtaExecutionhost', (done: Mocha.Done) => {
        console.log('TestCaseName: InputDataContract parity between task and dtaExecutionhost');

        console.log('\n');

        // Read the output of the parity tool and get the json representation of the C# data contract class
        const inputDataContractParityTool = tl.tool(path.join(__dirname, './InputDataContractParityTool.exe'));
        inputDataContractParityTool.arg('../_build/Tasks/VsTestV2/Modules/MS.VS.TestService.Common.dll');
        const inputDataContractParityToolOutput = JSON.parse(inputDataContractParityTool.execSync().stdout);

        // Read the typescript representation of the data contract interface
        const inputDataContractInterfaceFileContents = fs.readFileSync('../Tasks/VsTestV2/inputdatacontract.ts', 'utf8').toString();
        const listOfInterfaces = inputDataContractInterfaceFileContents.replace(/export interface (.*) \{([\s][^{}]*)+\}(\s)*/g, '$1 ').trim().split(' ');

        const interfacesDictionary : { [key: string] : any } = <{ [key: string] : any} >{};

        listOfInterfaces.forEach(interfaceName => {
            const regex = new RegExp(interfaceName + ' \\{\\s([\\s][^\\{\\}]*)+\\}');
            const interfaceContents = inputDataContractInterfaceFileContents.match(regex)[1];

            const interfaceProperties = interfaceContents.replace(/(\w+) \: (\w+([\[\]])*)\;/g, '$1 $2').split('\n');
            const interfacePropertiesDictionary : { [key: string] : string } = <{ [key: string] : string }>{};
            interfaceProperties.forEach(property => {
                property = property.trim();
                interfacePropertiesDictionary[property.split(' ')[0]] = property.split(' ')[1];
            });

            interfacesDictionary[interfaceName] = interfacePropertiesDictionary;
        });

        console.log('#######################################################################################################################');
        console.log('Ensure that the interfaces file is well formatted without extra newlines or whitespaces as the parser this test uses depends on the correct formatting of the inputdatacontract.ts file');
        console.log('#######################################################################################################################');
        
        checkParity(inputDataContractParityToolOutput, interfacesDictionary, interfacesDictionary.InputDataContract);

        function checkParity(dataContractObject: any, interfacesDictionary: any, subInterface: any) {

            if (dataContractObject === null || dataContractObject === undefined ) {
                return;
            }

            const keys = Object.keys(dataContractObject);

            for (const index in Object.keys(dataContractObject)) {

                if (typeof dataContractObject[keys[index]] !== 'object') {

                    //console.log(`${keys[index]}:${dataContractObject[keys[index]]} ===> ${subInterface.hasOwnProperty(keys[index])}, ${subInterface[keys[index]] === dataContractObject[keys[index]]}`);
                    assert(subInterface.hasOwnProperty(keys[index]), `${keys[index]} not present in the typescript version of the data contract.`);
                    assert(subInterface[keys[index]] === dataContractObject[keys[index]], `Data type of ${keys[index]} in typescript is ${subInterface[keys[index]]} and in C# is ${dataContractObject[keys[index]]}`);
                    delete subInterface[keys[index]];

                } else {
                    //console.log(`${keys[index]}:${JSON.stringify(dataContractObject[keys[index]])} ===> ${subInterface.hasOwnProperty(keys[index])}`);
                    assert(subInterface.hasOwnProperty(keys[index]), `${keys[index]} not present in the typescript version of the data contract.`);
                    checkParity(dataContractObject[keys[index]], interfacesDictionary, interfacesDictionary[keys[index]]);
                    delete subInterface[keys[index]];
                }
            }

            //console.log(JSON.stringify(subInterface));
            assert(Object.keys(subInterface).length === 1, `${JSON.stringify(subInterface)} properties are not present in the C# data contract.`);
        }

        done();
    });
});
