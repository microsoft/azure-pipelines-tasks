import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as ts2json from './TypeScriptSourceToJson'
var shell = require('shelljs');

function header(line: string) {
    console.log();
    console.log(' ===== ' + line +  ' ====');
    console.log();
}

var srcOptions = require('../tsconfig.json');
var docs = require('./docs.json');

// ensure we're generating docs using same module and target as src
let options: ts.CompilerOptions = {
    module: srcOptions['module'],
    target: srcOptions['target']
}

const jsonDocName: string = "azure-pipelines-task-lib.json";
const mdDocName: string = "azure-pipelines-task-lib.md";

header('Generating ' + jsonDocName);
let doc: ts2json.DocEntry = ts2json.generate(docs.files, options);
fs.writeFileSync(jsonDocName, JSON.stringify(doc,null, 2));

//--------------------------------------------------------------
// Generate markdown
//--------------------------------------------------------------
header('Generating ' + mdDocName)
let mdpath = path.join(__dirname, mdDocName);

function writeLine(line?: string) {
    fs.appendFileSync(mdpath, (line || ' ') + os.EOL);
}

function mdEscape(val: string) {
    return (val || '').replace(/[-\\`*_{}[\]()#+!|]/g, '\\$&');
}

function anchorName(name) {
    return name.replace(/\./g, '').replace(/ /g, '');
}

shell.rm('-rf', mdpath);
var docsStructure = docs.structure;
var aliasCache = {} as { string : [ts2json.DocEntry]};

function getDocEntry(namespace: string): ts2json.DocEntry {
    let d: ts2json.DocEntry;
    let parts: string[] = namespace.split('.');
    while (parts.length) {
        if (!d) {
            d = doc.members[parts.shift()];
        }
        else {
            d = d.members[parts.shift()];
        }

        if (!d) {
            console.error(namespace + ' invalid.  doc entry not found.');
            process.exit(1);
        }
    }

    return d;
}

// TODO: enums
// TODO: params type

var writeFunction = function(name: string, item: ts2json.DocEntry) {
    writeLine("<br/>");
    writeLine('<div id="' + anchorName(name) + '">');
    writeLine();
    writeLine('### ' + mdEscape(name) + ' <a href="#index">(^)</a>');

    let sigs = item.signatures;
    sigs.forEach((sig: ts2json.DocEntry) => {
        // comments
        if (sig.documentation) {
            writeLine(sig.documentation);
        }

        // signature

        let sigLine = item.name + '(';

        if (sig.parameters) {
            for (let i = 0; i < sig.parameters.length; i++) {
                let param = sig.parameters[i];
                sigLine += param.name;

                if (param.optional) {
                    sigLine += '?';
                }

                sigLine += (':' + param.type);

                if (i < (sig.parameters.length - 1)) {
                    sigLine += ', ';
                }
            }
        }

        sigLine += '):' + sig.return; 

        writeLine('```javascript');
        writeLine(sigLine);
        writeLine('```');

        // params table

        if (sig.parameters.length) {
            writeLine();
            writeLine('Param | Type | Description');
            writeLine('--- | --- | ---');
            for (let param of sig.parameters) {
                let escapedName = mdEscape(param.name);
                let escapedType = mdEscape(param.type);
                let escapedDescription = mdEscape((param.documentation || '').replace(/\n/g, ' ')); // remove newlines
                writeLine(escapedName + ' | ' + escapedType + ' | ' + escapedDescription);
            }
        }

        writeLine();
    });
}

var writeInterface = function(name: string, item: ts2json.DocEntry) {
    writeLine("<br/>");
    writeLine('<div id="' + anchorName(name) + '">');
    writeLine();
    writeLine('### ' + mdEscape(name) + ' <a href="#index">(^)</a>');

    // comments
    if (item.documentation) {
        writeLine(mdEscape(item.documentation));
    }

    // members
    writeLine();
    writeLine('Property | Type | Description');
    writeLine('--- | --- | ---');
    for (let memberName in item.members) {
        let member: ts2json.DocEntry = item.members[memberName];
        let escapedName = mdEscape(memberName);
        let escapedType = mdEscape((member.return || '').replace(/\|/g, 'or'));
        let escapedDescription = mdEscape((member.documentation || '').replace(/\n/g, ' ')); // remove newlines
        writeLine(escapedName + ' | ' + escapedType + ' | ' + escapedDescription);
    }
    writeLine();
}

writeLine('# AZURE-DEVOPS-TASK-LIB TYPESCRIPT API');
writeLine();
writeLine('## Dependencies');
writeLine('A [cross platform agent](https://github.com/Microsoft/vso-agent) OR a TFS 2015 Update 2 Windows agent (or higher) is required to run a Node task end-to-end. However, an agent is not required for interactively testing the task.');
writeLine();
writeLine('## Importing');
writeLine('For now, the built azure-pipelines-task-lib (in _build) should be packaged with your task in a node_modules folder');
writeLine();
writeLine('The build generates a azure-pipelines-task-lib.d.ts file for use when compiling tasks');
writeLine('In the example below, it is in a folder named definitions above the tasks lib');
writeLine();
writeLine('```');
writeLine('/// <reference path="../definitions/azure-pipelines-task-lib.d.ts" />');
writeLine("import tl = require('azure-pipelines-task-lib/task')");
writeLine('```');
writeLine();
writeLine('## [Release notes](releases.md)');
writeLine();

//
// Index
//
writeLine('<div id="index">');
writeLine();
writeLine('## Index');
for (var sectionName in docsStructure) {
    writeLine();
    writeLine('### ' + sectionName + ' <a href="#' + anchorName(sectionName) + '">(v)</a>');
    writeLine();

    var section = docsStructure[sectionName];
    var docItems: string[] = section.Document as string[];
    docItems.forEach((docItem: string) => {
        var docEntry: ts2json.DocEntry  = getDocEntry(docItem);

        if (docEntry) {
            writeLine('<a href="#' + anchorName(docItem) + '">' + docItem.substr(docItem.indexOf('.') + 1) + '</a> <br/>');
        }
    })
}

//
// Docs
//
for (var sectionName in docsStructure) {
    writeLine();
    writeLine("<br/>");
    writeLine('<div id="' + anchorName(sectionName) + '">');
    writeLine();
    writeLine('## ' + mdEscape(sectionName));
    writeLine();
    writeLine('---');
    writeLine();

    var sec = docsStructure[sectionName];
    if (sec.Summary) {
        writeLine(sec.Summary);
    }

    if (sec.Sample) {
        try {
            writeLine();
            var contents = fs.readFileSync(path.join(__dirname, sec.Sample));    
            writeLine("```javascript");
            if (!contents || contents.length == 0) {
                writeLine('No content');
            }
            writeLine(contents.toString());
            writeLine("```");
        }
        catch(err) {
            console.error(err);
        }
    }

    var documents = sec.Document;
    documents.forEach((docItem) => {
        console.log('docItem', docItem);
        var item: ts2json.DocEntry = getDocEntry(docItem);

        if (item) {
            switch (item.kind) {
                case "Constructor":
                case "method":
                //case "Enumeration":
                case "function":
                    writeFunction(docItem, item);
                    break;

                case "interface":
                    writeInterface(docItem, item);
                    break;

                // case "class":
                default:
                    console.log('warning: skipping ' + item.kind);
                    console.log(item);
                    process.exit();
            }             
        }
    })
}

console.log('Done');

