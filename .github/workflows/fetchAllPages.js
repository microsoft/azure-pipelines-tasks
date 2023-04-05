import callGitHub from './callGitHub.js';
import https from 'https';
import promisify from './promisify.js';
import makeOptions from './makeOptions.js';
import makeUrl from './makeUrl.js';

export default async function fetchAllPages(/** @type {string} */ token, /** @type {string} */ route, /** @type {Record<string, string>} */ params = {}) {
  // Note that the lack of the Link header indicates a single page of results
  const response = await promisify(https.request)(makeUrl(route, { per_page: 100, ...params }), makeOptions(token, 'HEAD'));
  const pages = response.headers.link ? +response.headers.link.match(/(\d+)>; rel="last"/)[1] : 1;
  console.log('Found', pages, 'pages');

  let items = [];
  for (let page = 1; page <= pages; page++) {
    const pageItems = await callGitHub(token, route, { params: { per_page: 100, page, ...params } });
    if (!Array.isArray(pageItems)) {
      console.log(pageItems);
      throw new Error('The API did not return an array.');
    }

    console.log('Fetched', pageItems.length, 'items on page', page);
    items.push(...pageItems);
  }

  return items;
}