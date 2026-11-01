'use strict';

const { Device } = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');

class Vitrum2EUShutterDevice extends ZwaveDevice {

  /**
   * onInit is called when the device is initialized.
   */
  async onNodeInit() {
   
		this.registerCapability('windowcoverings_state', 'SWITCH_BINARY');
		this.registerCapability('dim', 'SWITCH_MULTILEVEL');
    this.log('Vitrum II EU Roller Shutter has been initialized');
  
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Vitrum II EU Roller Shutter has been added');
  }
}

module.exports = Vitrum2EUShutterDevice;
