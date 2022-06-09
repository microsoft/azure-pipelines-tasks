import http from 'http';
import https from 'https';

/** @typedef {http['get'] | https['get'] | http['request'] | https['request']} Fn */

/** @returns {Promise<Fn>} */
export default function promisify(/** @type {Fn} */ fn, /** @type {Parameters<http.ClientRequest['end']>} */ end) {
  return function (/** @type {Parameters<Fn>} */ ...args) {
    return new Promise((resolve, reject) => fn(...args, resolve).once('error', reject).end(end));
  }
}