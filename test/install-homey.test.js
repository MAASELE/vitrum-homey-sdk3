'use strict';

// Exercise the exact transitive API copy used by the installed Homey CLI.
/* eslint-disable import/no-dynamic-require, node/no-extraneous-require */

const assert = require('node:assert/strict');
const path = require('node:path');
const { Readable } = require('node:stream');
const { test } = require('node:test');
const { installHomey } = require('../scripts/install-homey.cjs');

const cliRoot = path.dirname(require.resolve('homey/package.json'));
const apiRoot = path.dirname(require.resolve('homey-api/package.json', { paths: [cliRoot] }));
const HomeyAPI = require(path.join(apiRoot, 'lib/HomeyAPI/HomeyAPIV2'));
const ManagerDevkit = require(path.join(apiRoot, 'lib/HomeyAPI/HomeyAPIV3Local/ManagerDevkit'));
const Util = require(path.join(apiRoot, 'lib/Util'));
const { Request, Response } = require(require.resolve('node-fetch', { paths: [apiRoot] }));

function createHomey() {
  const homey = {
    id: 'test-homey',
    constructor: HomeyAPI,
    __token: 'expired',
    __api: {},
    __versionCache: {},
    __tierCache: {},
    __debug: () => {},
    baseUrl: 'http://test.invalid',
    call: HomeyAPI.prototype.call,
    refreshForToken: async () => {
      homey.__token = 'fresh';
    },
  };
  homey.devkit = { homey, runApp: ManagerDevkit.prototype.runApp };
  homey.sessions = {
    getSessionMe: async (options) => {
      assert.deepEqual(options, { $socket: false, $cache: false });
      return homey.call({ method: 'GET', path: '/api/manager/sessions/session/me' });
    },
  };
  return homey;
}

async function withTransport(callback) {
  const requests = [];
  const originalFetch = Util.fetch;
  Util.fetch = async (url, options) => {
    const request = new Request(url, options);
    const chunks = [];
    if (Buffer.isBuffer(request.body)) chunks.push(request.body);
    else if (typeof request.body === 'string') chunks.push(Buffer.from(request.body));
    else if (request.body) {
      await new Promise((resolve, reject) => {
        request.body.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        request.body.once('end', resolve);
        request.body.once('error', reject);
        request.body.resume();
      });
    }
    const body = Buffer.concat(chunks).toString();
    const contentType = request.headers.get('content-type');
    const hasApp = body.includes('name="app"');
    requests.push({ method: request.method, contentType, hasApp });
    let status = 200;
    let result = request.method === 'GET' ? { id: 'session' } : { appId: 'com.vitrum.v3' };
    if (request.headers.get('authorization') === 'Bearer expired') {
      status = 401;
      result = { error: 'Session expired' };
    } else if (request.method === 'POST' && (!hasApp || !contentType.startsWith('multipart/form-data;'))) {
      status = 400;
      result = { error: "Parameter 'app' is required" };
    }
    return new Response(JSON.stringify(result), { status, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    await callback(requests);
  } finally {
    Util.fetch = originalFetch;
  }
}

test('an expired upload reproduces the upstream missing-app retry bug', async () => {
  await withTransport(async (requests) => {
    const homey = createHomey();
    await assert.rejects(homey.devkit.runApp({ app: Readable.from(['test archive']) }), /Parameter 'app' is required/);
    assert.equal(requests.length, 2);
    assert.match(requests[0].contentType, /^multipart\/form-data;/);
    assert.equal(requests[0].hasApp, true);
    assert.equal(requests[1].contentType, 'application/json');
    assert.equal(requests[1].hasApp, false);
  });
});

test('installer refreshes the session before upload and preserves the multipart app field', async () => {
  await withTransport(async (requests) => {
    const homey = createHomey();
    const originalRunApp = homey.devkit.runApp;
    const result = await installHomey({
      appPath: '/test-project',
      getActiveHomey: async () => homey,
      createApp: (appPath) => {
        assert.equal(appPath, '/test-project');
        return {
          install: async (options) => {
            assert.equal(options.homey, homey);
            assert.equal(options.clean, false);
            return homey.devkit.runApp({ app: Readable.from(['test archive']) });
          },
        };
      },
    });
    assert.deepEqual(result, { appId: 'com.vitrum.v3' });
    assert.deepEqual(requests.map((request) => request.method), ['GET', 'GET', 'POST']);
    assert.match(requests[2].contentType, /^multipart\/form-data;/);
    assert.equal(requests[2].hasApp, true);
    assert.equal(homey.devkit.runApp, originalRunApp);
  });
});

test('authentication failure prevents the upload and restores the original method', async () => {
  const homey = createHomey();
  let uploaded = false;
  homey.devkit.runApp = async () => {
    uploaded = true;
  };
  homey.sessions.getSessionMe = async () => {
    throw new Error('Authentication failed');
  };
  const originalRunApp = homey.devkit.runApp;
  await assert.rejects(installHomey({
    getActiveHomey: async () => homey,
    createApp: () => ({ install: async () => homey.devkit.runApp({}) }),
    appPath: '/test-project',
  }), /Authentication failed/);
  assert.equal(uploaded, false);
  assert.equal(homey.devkit.runApp, originalRunApp);
});
