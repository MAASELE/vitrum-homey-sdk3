'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

const SHUTTER_BUTTONS = [
  { id: 'button.shutter_up', endpoint: 2, title: { en: 'Raise shutter', it: 'Alza tapparella' } },
  { id: 'button.shutter_down', endpoint: 4, title: { en: 'Lower shutter', it: 'Abbassa tapparella' } },
];

class Vitrum4OnOffDevice extends ZwaveDevice {

  /**
   * onNodeInit is called when the device is initialized.
   */
  async onNodeInit() {
    if (this.node.isMultiChannelNode) {
      await this.addCapability('onoff');
      this.registerCapability('onoff', 'BASIC');
      this.registerReportListener('BASIC', 'BASIC_SET', (rawReport, parsedReport) => {
        if (Number(rawReport.Value) === 0) {
          this.setCapabilityValue('onoff', false);
        } else this.setCapabilityValue('onoff', true);
      });
    } else {
      if (this.hasCapability('onoff')) await this.removeCapability('onoff');
      await this._configureShutterButtons(this.getSetting('mixed_shutter_layout') === true);
    }

    this.log('Vitrum IV Device has been initialized');
  }

  _supportsShutterLayout() {
    return !this.node.isMultiChannelNode
      && Number(this.getSetting('zw_manufacturer_id')) === 266
      && Number(this.getSetting('zw_product_type_id')) === 17408
      && Number(this.getSetting('zw_product_id')) === 25600;
  }

  _validateShutterLayout() {
    if (!this._supportsShutterLayout()) {
      throw new Error('This shutter layout requires the Vitrum panel 266/17408/25600.');
    }
    for (const { endpoint } of SHUTTER_BUTTONS) {
      const commandClass = this.getCommandClass('BASIC', { multiChannelNodeId: endpoint });
      if (typeof commandClass.BASIC_SET !== 'function') {
        throw new Error(`Shutter control is unavailable on button ${endpoint}.`);
      }
    }
  }

  async _configureShutterButtons(enabled) {
    if (enabled) this._validateShutterLayout();
    this._shutterButtonsEnabled = false;
    for (const { id, endpoint, title } of SHUTTER_BUTTONS) {
      if (enabled) {
        if (!this.hasCapability(id)) await this.addCapability(id);
        await this.setCapabilityOptions(id, { title, uiQuickAction: false });
        this.registerCapabilityListener(id, async () => {
          if (!this._shutterButtonsEnabled) throw new Error('The shutter layout is disabled.');
          this._validateShutterLayout();
          // These are directional commands, not two independent motor relays.
          // BASIC 0 reverses motion on this panel and must never be used as Stop.
          await this.getCommandClass('BASIC', { multiChannelNodeId: endpoint })
            .BASIC_SET({ Value: 255 });
        });
      } else if (this.hasCapability(id)) {
        await this.removeCapability(id);
      }
    }
    this._shutterButtonsEnabled = enabled;
  }

  async onSettings(event) {
    const layoutChanged = event.changedKeys.includes('mixed_shutter_layout');
    const enabled = event.newSettings.mixed_shutter_layout === true;
    if (layoutChanged && enabled) this._validateShutterLayout();
    await super.onSettings(event);
    if (layoutChanged) await this._configureShutterButtons(enabled);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    if (this.hasCapability('onoff')) {
      this.setCapabilityValue('onoff', false).catch(this.error);
    }
    this.log('Vitrum III has been added');
  }

}

module.exports = Vitrum4OnOffDevice;
