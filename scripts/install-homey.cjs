'use strict';

// CLI entry point: resolve the installed CLI lazily and close its API handles on exit.
/* eslint-disable import/no-dynamic-require, global-require, no-process-exit, no-console */

const path = require('node:path');

async function installHomey({ getActiveHomey, createApp, appPath }) {
  const homey = await getActiveHomey();
  const { devkit } = homey;
  const originalRunApp = devkit.runApp;

  devkit.runApp = async function runApp(options) {
    // Refresh an expired session with a replayable GET before creating the upload.
    // homey-api 3.21.2 incorrectly retries an expired multipart upload as JSON.
    await homey.sessions.getSessionMe({ $socket: false, $cache: false });
    return originalRunApp.call(this, options);
  };

  try {
    return await createApp(appPath).install({ homey, clean: false });
  } finally {
    devkit.runApp = originalRunApp;
  }
}

async function main() {
  const cliRoot = path.dirname(require.resolve('homey/package.json'));
  const AthomApi = require(path.join(cliRoot, 'services/AthomApi.js'));
  const AppFactory = require(path.join(cliRoot, 'lib/AppFactory.js'));
  await installHomey({
    getActiveHomey: () => AthomApi.getActiveHomey(),
    createApp: (appPath) => AppFactory.getAppInstance(appPath),
    appPath: path.resolve(__dirname, '..'),
  });
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { installHomey };
