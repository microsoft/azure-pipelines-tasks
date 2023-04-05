import http from 'http';

export default async function buffer(/** @type {http.IncomingMessage} */ response) {
  /** @type {Buffer[]} */
  const buffers = [];
  for await (const buffer of response) {
    buffers.push(buffer);
  }

  return Buffer.concat(buffers);
}