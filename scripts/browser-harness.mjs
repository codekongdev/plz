// Shared setup for the Chromium browser tests: a local page server, the browser launch, and the network route
// that serves three.js from the pinned npm package at its CDN URLs. Tests never need the live CDN or web fonts,
// and every other external request is rejected.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

export const threeCdnPrefix = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
const threeRoot = dirname(dirname(createRequire(import.meta.url).resolve('three')));

// Serves HTML from `pageFor(path)`, which returns the page source (string or Buffer) or null for a 404.
export async function startPageServer(pageFor) {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname.slice(1);
    try {
      const body = await pageFor(path);
      if (body === null || body === undefined) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(body);
    } catch (error) {
      res.destroy(error);
    }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(ok => server.close(ok)),
  };
}

// Software WebGL so the axo kit renders in headless Chromium.
export function launchBrowser() {
  return chromium.launch({ chromiumSandbox: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}

// Route every request of `context`: the page origin passes, three.js comes from node_modules (or is aborted when
// `cdn(url)` returns 'abort'; it may also wait), stylesheets are empty, everything else is blocked.
// `onThree(url)` sees every three.js request.
export async function routeNetwork(context, origin, { cdn = () => 'serve', onThree = () => {} } = {}) {
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(`${origin}/`)) return route.continue();
    if (url.startsWith(threeCdnPrefix)) {
      onThree(url);
      if (await cdn(url) === 'abort') return route.abort('failed');
      const path = resolve(threeRoot, url.slice(threeCdnPrefix.length));
      assert.ok(path.startsWith(`${threeRoot}${sep}`), 'CDN route must stay inside the pinned three package');
      return route.fulfill({
        contentType: 'application/javascript',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: await readFile(path),
      });
    }
    if (route.request().resourceType() === 'stylesheet') return route.fulfill({ contentType: 'text/css', body: '' });
    return route.abort('blockedbyclient');
  });
}
