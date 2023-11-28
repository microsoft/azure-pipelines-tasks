var path = require('path');

var util = require('../make-util');
var rm = util.rm;
var mkdir = util.mkdir;
var ensureExists = util.ensureExists;
var validateTask = util.validateTask;
var createYamlSnippetFile = util.createYamlSnippetFile;
var fileToJson = util.fileToJson;
var banner = util.banner;
var createMarkdownDocFile = util.createMarkdownDocFile;

var gendocsPath = path.join(__dirname, '_gendocs');
var tasksPath = path.join(__dirname, 'Tasks');
var test = util.test;

//
// Generate documentation (currently only YAML snippets)
// ex: node make.js gendocs
// ex: node make.js gendocs --task ShellScript
//
function gendocs(argv) {
    rm('-Rf', gendocsPath);
    mkdir('-p', gendocsPath);
    console.log();
    console.log('> generating docs');

    argv.taskList.forEach(function(taskName) {
        var taskPath = path.join(tasksPath, taskName);
        ensureExists(taskPath);

        // load the task.json
        var taskJsonPath = path.join(taskPath, 'task.json');
        if (test('-f', taskJsonPath)) {
            var taskDef = fileToJson(taskJsonPath);
            validateTask(taskDef);

            // create YAML snippet Markdown
            var yamlOutputFilename = taskName + '.md';
            createYamlSnippetFile(taskDef, gendocsPath, yamlOutputFilename);

            // create Markdown documentation file
            var mdDocOutputFilename = taskName + '.md';
            createMarkdownDocFile(taskDef, taskJsonPath, gendocsPath, mdDocOutputFilename);
        }
    });

    banner('Generating docs successful', true);
}

module.exports = gendocs;