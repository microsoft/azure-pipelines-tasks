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
var test = util.test;

var consts = require('./consts');

/**
 * Generate documentation (currently only YAML snippets)
 * ex: node make.js gendocs
 * ex: node make.js gendocs --task ShellScript
 * @deprecated
 * @param {*} argv
 */
function gendocs(argv) {
    rm('-Rf', consts.gendocsPath);
    mkdir('-p', consts.gendocsPath);
    console.log();
    console.log('> generating docs');

    argv.taskList.forEach(function(taskName) {
        var taskPath = path.join(consts.tasksPath, taskName);
        ensureExists(taskPath);

        // load the task.json
        var taskJsonPath = path.join(taskPath, 'task.json');
        if (test('-f', taskJsonPath)) {
            var taskDef = fileToJson(taskJsonPath);
            validateTask(taskDef);

            // create YAML snippet Markdown
            var yamlOutputFilename = taskName + '.md';
            createYamlSnippetFile(taskDef, consts.gendocsPath, yamlOutputFilename);

            // create Markdown documentation file
            var mdDocOutputFilename = taskName + '.md';
            createMarkdownDocFile(taskDef, taskJsonPath, consts.gendocsPath, mdDocOutputFilename);
        }
    });

    banner('Generating docs successful', true);
}

module.exports = gendocs;