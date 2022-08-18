export default function makeOptions(/** @type {string} */ token, /** @type {string} */ method = 'GET') {
  return { method, headers: { Authorization: `token ${token}`, 'User-Agent': 'tomashubelbauer' } };
}