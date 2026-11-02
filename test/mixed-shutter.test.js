'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function createDevice({ enabled = false, child = false, productType = '17408' } = {}) {
  const calls = [];
  const listeners = {};
  const capabilities = new Set(child ? ['onoff'] : []);
  const settings = {
    mixed_shutter_layout: enabled,
    zw_manufacturer_id: '266',
    zw_product_type_id: productType,
    zw_product_id: '25600',
  };
  class ZwaveDevice {

    async onSettings(event) {
      calls.push({ settings: event.changedKeys });
    }

  }
  const context = {
    module: { exports: {} },
    require: (id) => {
      assert.equal(id, 'homey-zwavedriver');
      return { ZwaveDevice };
    },
  };
  const filename = path.join(__dirname, '../drivers/vitrum_4_onoff_eu/device.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const DriverDevice = context.module.exports;
  const device = new DriverDevice();
  device.node = { isMultiChannelNode: child };
  device.getSetting = (key) => settings[key];
  device.hasCapability = (id) => capabilities.has(id);
  device.addCapability = async (id) => capabilities.add(id);
  device.removeCapability = async (id) => capabilities.delete(id);
  device.setCapabilityOptions = async () => {};
  device.registerCapabilityListener = (id, listener) => {
    listeners[id] = listener;
  };
  device.registerCapability = (id, commandClass) => {
    calls.push({ id, commandClass });
  };
  device.registerReportListener = () => {};
  device.getCommandClass = (id, { multiChannelNodeId }) => {
    assert.equal(id, 'BASIC');
    return {
      BASIC_SET: async ({ Value }) => {
        calls.push({ endpoint: multiChannelNodeId, Value });
      },
    };
  };
  device.log = () => {};
  return {
    device, calls, listeners, capabilities,
  };
}

test('default layout remains unchanged and initialization does not move the shutter', async () => {
  const { device, calls, capabilities } = createDevice();
  await device.onNodeInit();
  assert.equal(capabilities.size, 0);
  assert.equal(calls.length, 0);
});

test('mixed layout sends one verified On command per press, never an Off command', async () => {
  const {
    device, calls, listeners, capabilities,
  } = createDevice({ enabled: true });
  await device.onNodeInit();
  assert.equal(calls.length, 0);
  assert.deepEqual([...capabilities], ['button.shutter_up', 'button.shutter_down']);
  await listeners['button.shutter_up'](true);
  await listeners['button.shutter_down'](true);
  assert.deepEqual(calls, [{ endpoint: 2, Value: 255 }, { endpoint: 4, Value: 255 }]);
  assert.equal(capabilities.has('windowcoverings_state'), false);
});

test('layout settings apply without re-pairing or movement and preserve superclass handling', async () => {
  const {
    device, calls, listeners, capabilities,
  } = createDevice();
  await device.onNodeInit();
  await device.onSettings({
    changedKeys: ['mixed_shutter_layout'],
    newSettings: { mixed_shutter_layout: true },
  });
  assert.equal(capabilities.size, 2);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { settings: ['mixed_shutter_layout'] });
  await device.onSettings({
    changedKeys: ['mixed_shutter_layout'],
    newSettings: { mixed_shutter_layout: false },
  });
  assert.equal(capabilities.size, 0);
  await assert.rejects(listeners['button.shutter_up'](true), /disabled/);
  assert.equal(calls.some((call) => 'endpoint' in call), false);
});

test('mixed layout does not change existing child switch capabilities', async () => {
  const {
    device, capabilities, listeners, calls,
  } = createDevice({ enabled: true, child: true });
  await device.onNodeInit();
  assert.deepEqual([...capabilities], ['onoff']);
  assert.deepEqual(listeners, {});
  assert.deepEqual(calls, [{ id: 'onoff', commandClass: 'BASIC' }]);
});

test('unknown model cannot enable the mixed layout', async () => {
  const { device, calls, capabilities } = createDevice({ productType: '28949' });
  await device.onNodeInit();
  await assert.rejects(device.onSettings({
    changedKeys: ['mixed_shutter_layout'],
    newSettings: { mixed_shutter_layout: true },
  }), /266\/17408\/25600/);
  assert.equal(capabilities.size, 0);
  assert.equal(calls.length, 0);
});

test('radio errors reach the caller without trying the reverse direction', async () => {
  const { device, listeners, calls } = createDevice({ enabled: true });
  await device.onNodeInit();
  device.getCommandClass = () => ({
    BASIC_SET: async () => {
      throw new Error('Radio failed');
    },
  });
  await assert.rejects(listeners['button.shutter_up'](true), /Radio failed/);
  assert.equal(calls.length, 0);
});
