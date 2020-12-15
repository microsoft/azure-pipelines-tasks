import tl = require("azure-pipelines-task-lib/task");
import path = require("path");

tl.setResourcePath(path.join(__dirname, "task.json"));

console.log("hello world")

var fooStringInput = tl.getInput("fooStringInput");
console.log(`fooStringInput = ${fooStringInput}`);

var fooListInput = tl.getInput("fooListInput");
console.log(`fooListInput = ${fooListInput}`);

var fooMultilineInput = tl.getInput("fooMultilineInput");
console.log(`fooMultilineInput = ${fooMultilineInput}`);

var str = tl.loc("FooMessage1")
console.log(str);


