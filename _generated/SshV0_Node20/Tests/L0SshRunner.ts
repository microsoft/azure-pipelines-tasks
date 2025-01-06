import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'ssh.js');
let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

if (process.env['sshEndpoint']) {
    tmr.setInput('sshEndpoint', process.env['sshEndpoint']);
}
if (process.env['commands']) {
    tmr.setInput('commands', process.env['commands']);
}
if (process.env['runOptions']) {
    tmr.setInput('runOptions', process.env['runOptions']);
}
if (process.env['readyTimeout']) {
    tmr.setInput('readyTimeout', process.env['readyTimeout']);
}

const tl = require('azure-pipelines-task-lib/mock-task');
const tlClone = Object.assign({}, tl);
tlClone.getEndpointAuthorizationParameter = function (id: string, key: string, optional: boolean) {
    key = key.toUpperCase();
    if (key == 'USERNAME') {
        if (['IDValidKey', 'IDInvalidKey'].indexOf(id) > -1) {
            return 'username';
        }
        if (['IDPasswordNotSet', 'IDHostNotSet', 'IDPortNotSet'].indexOf(id) > -1) {
            return 'user';
        }
    }
    if (key == 'PASSWORD') {
        if (['IDValidKey', 'IDInvalidKey', 'IDUserNameNotSet', 'IDHostNotSet', 'IDPortNotSet'].indexOf(id) > -1) {
            return 'password';
        }
    }
    if (optional) {
        return '';
    }
    throw new Error(`Endpoint auth data not present: ${id}`);
}

tlClone.getEndpointDataParameter = function (id: string, key: string, optional: boolean) {
    key = key.toUpperCase();
    if (key == 'HOST') {
        if (['IDValidKey', 'IDInvalidKey', 'IDPasswordNotSet', 'IDPortNotSet'].indexOf(id) > -1) {
            return 'host';
        }
    }
    if (key == 'PORT') {
        if (['IDValidKey', 'IDInvalidKey', 'IDPasswordNotSet', 'IDHostNotSet'].indexOf(id) > -1) {
            return 'port';
        }
    }
    if (optional) {
        return '';
    }
    throw new Error(`Endpoint auth data not present: ${id}`);
}
tmr.registerMock('azure-pipelines-task-lib/mock-task', tlClone);

process.env['ENDPOINT_DATA_IDValidKey_PRIVATEKEY'] = '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: AES-128-CBC,CA14F355C3F7B8C1BBFB0D82E3ABCA0D\n\nWsGY24YaokaY8JzaMI/CFoSG5u/zBeO7RbiNpIVU+wthDfSQi439xnCcU+zysJw1\nDOOItKl4ZdorDjhWLi4kUlDshHZgc8eYR2y45u0i5IqcgS7QM9ey5UBPp7/L5OoG\ncmynCtbEwUKbb5+b/rO+0O0zRBnB3NJDtVW5gBQu0xPJCoZ1fUqtZLd3d9XwjUC8\na7DVJ0jUJtfl3vI5LPSE7mQNw98CgSOuOrsKBYeN40oOm6VQTlPpqFW2MhrFgUt4\n4rSpmGpq/0vSlYf9KxgwO1HxtMJEnLRsFdz2/WKao500XKDUaDNBzICb8rCsdK//\nKnn0BwpmZXf+vRuCwSifb0t5IeXZg/znSNJhx8uwNUbe/BPM9oQcex9h5VJdUNbQ\neS7nw09BwAvVY58xkhmEJJq0pLsEPgol44ai39HSv+8vts9vLmM410l6QsE4cfBO\nIYqkxj+0pEGzUMTPWD9kle0Gf25dH+tHF9NxccpvdGyRljjK/138p2RAZEGoMDH7\nduTBxPO3BqCkdzQooaDzrdskc/+uIVqGhpAnvCuCn3KahAmCAMM78UKQ2NC2kFsb\nZpsXXR7A8gztKIlhjo3m0xuvmXolyEDyxgNpWkS+yrVe8wOZqAdeZ4P+rP2un8vd\nHQHBZTNt5MS0C7R4bpTzxT+BCjWT2bWQ5xFRuoVsX2aP9QyosIYPkP4maKcEPazb\nu3H1DwglKAagbk1iWEeI58ni1WqCNQAPWup5A2VXugvOqnDyWAGlvU+5E8RvdDCo\n3+52r0Mp0T1CwdTzjIenh+wxZ75IF0HfqUn1hvzXChCx/FRagEVwBVWd6T4gecCI\nMZyHzkkDiXrsoCqIBrpOz44hXWeBZRQ+moDT7ezoNyA78KwHN9tK2Prxt9NdHxV/\n24PBNmrxQzTXzpQwqNihexhRWVjV7OTbVc4XiBtPcg3NM09E4sCa2bI0yQZz0ypF\nHzkbrRh8Y2NTIWxdQPHIXiD1aO6M21KG6DFiajFy3wlzALxuuwK8m2jRnfuPkF6s\nNVcWCmHzDeupuPaURtUYA94EyKL1SD7oz/mzxLsfkOtGyM+majFEZ8tCvr23l6KP\niFpngbRCZlWLuKY1DMwgr9RBtybte5lSPJKS6dcACZDkPLFqKzlT/jziU2oJNJJ3\nnUWT2z3tmJtxDFZnr0HY514YdbnWv4Rq25H+hH+/yM7KJpCgc0pAJCnJvDG5fRN/\nLCjmKw9fN65x7ye3h3SmKc+bMlesGTCNchYDNaLtUSqOXGHBBD4bSQokO6AW9HYF\nFOjwXAxn3XmxBSLuuXucCWfXEbgq6hHIEruQvC1KmiYjirwYlLk5atP5hWMNLM2s\naqlOzreyU0FQkBFWpLZoEYt1Pmsdyxz61qUklA7oPmbsO9JvgiFzU5jG66yqsrUi\nS8nhIw4oU452SjwnC7V+sAzUMjLizy412X5QL4UHNHvp4rn3R6aRWF1nNU00XadL\nQoGs/qgm7ykissIKYDDqltTjsWYOCTBF8QTdTZwXI3lXlDve9Y0dshZ5GRF0QCv4\n9MFnQNkYAu5Y3JgnqYWJoSjlqQlk6pxuhIrxRmX6Ywk660Zs6uvjrKgwkNjplqtt\n-----END RSA PRIVATE KEY-----';
process.env['ENDPOINT_DATA_IDInvalidKey_PRIVATEKEY'] = 'private key file contents';

tmr.run();

