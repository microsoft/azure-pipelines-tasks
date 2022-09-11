import https from 'https';
import promisify from './promisify.js';
import buffer from './buffer.js';
import makeOptions from './makeOptions.js';
import makeUrl from './makeUrl.js';

export default async function callGitHub(
  /** @type {string} */ token,
  /** @type {string} */ route,
  {
    /** @type {Record<string, string>} */ params,
    /** @type {string} */ method,
    /** @type {object} */ body,
  } = {}) {
  const options = makeOptions(token, method);
  const url = makeUrl(route, params);
  const response = await promisify(https.request, body ? JSON.stringify(body) : undefined)(url, options);
  const data = await buffer(response);
  if (data.length === 0) {
    return;
  }

  return JSON.parse(data);
}