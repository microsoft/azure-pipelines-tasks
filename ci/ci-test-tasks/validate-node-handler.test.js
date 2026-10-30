const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { validateTasks } = require('./validate-node-handler');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value));
}

function createRepository(tasks) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-node-handler-'));
  writeJson(path.join(root, 'make-options.json'), { tasks });
  return root;
}

function createTask(root, taskName, task, generatedTaskName) {
  const taskFolder = generatedTaskName
    ? path.join(root, '_generated', generatedTaskName)
    : path.join(root, 'Tasks', taskName);
  writeJson(path.join(taskFolder, 'task.json'), task);
}

test('accepts the requested handler in the source task', t => {
  const root = createRepository(['ExampleV1']);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  createTask(root, 'ExampleV1', {
    execution: {
      Node20_1: { target: 'main.js' },
      Node24: { target: 'main.js' }
    }
  });

  assert.deepStrictEqual(validateTasks('Node24', ['ExampleV1'], root), []);
});

test('accepts the requested handler in a generated build config', t => {
  const root = createRepository(['ExampleV1']);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  createTask(root, 'ExampleV1', {
    execution: {
      Node20_1: { target: 'main.js' }
    }
  });
  createTask(root, 'ExampleV1', {
    execution: {
      Node20_1: { target: 'main.js' },
      Node24: { target: 'main.js' }
    }
  }, 'ExampleV1_Node24');

  assert.deepStrictEqual(validateTasks('Node24', ['ExampleV1'], root), []);
});

test('skips deprecated and non-Node tasks', t => {
  const root = createRepository(['DeprecatedV1', 'PowerShellV1']);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  createTask(root, 'DeprecatedV1', {
    deprecated: true,
    execution: {
      Node20_1: { target: 'main.js' }
    }
  });
  createTask(root, 'PowerShellV1', {
    execution: {
      PowerShell3: { target: 'main.ps1' }
    }
  });

  assert.deepStrictEqual(validateTasks('Node24', ['DeprecatedV1', 'PowerShellV1'], root), []);
});

test('fails when a Node-backed lifecycle section is missing the requested handler', t => {
  const root = createRepository(['ExampleV1']);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  createTask(root, 'ExampleV1', {
    execution: {
      Node20_1: { target: 'main.js' },
      Node24: { target: 'main.js' }
    },
    postjobexecution: {
      Node20_1: { target: 'cleanup.js' }
    }
  });

  const errors = validateTasks('Node24', ['ExampleV1'], root);
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /Node24 is missing/);
});
