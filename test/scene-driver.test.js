'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

test('four-button Triac registers its own scene card and delegates matching', async () => {
  const filename = path.join(__dirname, '../drivers/vitrum_4_triac_eu/driver.js');
  const context = {
    module: { exports: {} },
    require: (id) => {
      assert.equal(id, 'homey');
      return { Driver: class {} };
    },
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const Driver = context.module.exports;
  const driver = new Driver();
  let listener;
  driver.homey = {
    flow: {
      getDeviceTriggerCard: (id) => {
        assert.equal(id, 'vitrum4_scene');
        return {
          registerRunListener: (fn) => {
            listener = fn;
          },
        };
      },
    },
  };
  driver.log = () => {};
  await driver.onInit();
  const state = { button: '3', scene: 'Key Released' };
  const args = {
    device: {
      vitrumSceneRunListener: (actualArgs, actualState) => {
        assert.equal(actualArgs, args);
        assert.equal(actualState, state);
        return false;
      },
    },
  };
  assert.equal(await listener(args, state), false);
});
