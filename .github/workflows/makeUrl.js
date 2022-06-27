export default function makeUrl(/** @type {string} */ route, /** @type {Record<string, string>} */ params) {
  return 'https://api.github.com/' + route + (params ? '?' + new URLSearchParams(params).toString() : '');
}