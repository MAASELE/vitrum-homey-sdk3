'use strict';

const Homey = require('homey');
const { ZwaveDevice } = require('homey-zwavedriver');

const CONFIGURED_MULTI_CHANNEL_ASSOCIATION = 'configuredMCAssociation';

class Vitrum1RelayDevice extends ZwaveDevice {
	/**
	 * onInit is called when the device is initialized.
	 */
	async onNodeInit() {
		//this.enableDebug();
		//this.printNode();

		this._vitrumSceneTrigger = this.driver.vitrumSceneTrigger;
		this._vitrumMultiLevelSwitchTrigger = this.driver.vitrumMultiLevelSwitchTrigger;

		// If not multi channel node this is the main node, use multi channel node 1 for that
		if (!this.node.isMultiChannelNode) {
			this.log('no multichannel node detected');
			// Migration step to configure multi channel association reporting
			await this._configureMultiChannelNodeReporting();

			// Register report listener for central scene on root node
			let holdTimeout = null;

			await this.registerReportListener('CENTRAL_SCENE', 'CENTRAL_SCENE_NOTIFICATION', report => {
				if (report['Properties1']
					&& report.Properties1['Key Attributes']
					&& report['Scene Number']) {
					const data = {
						button: '' + report['Scene Number'],
						scene: report.Properties1['Key Attributes'],
					};
					//this.log('registerReportListener', report, data);
					// Hold Key Scene activation
					if (report.Properties1['Key Attributes'] === 'Key Held Down') {
						// timer not started yet
						if (!holdTimeout) {
							this._vitrumSceneTrigger.trigger(this, null, data).catch(this.error);
							holdTimeout = setTimeout(() => {
								// happens only in case a Key Released event was not received
								data.scene = 'Key Released';
								this.log('hold timeout detected', data);
								this._vitrumSceneTrigger.trigger(this, null, data).catch(this.error);
							}, 2200);
						}
						// timer is running, ignore subsequent hold key events and restart the timer
						else {
							this.log('hold timeout running, ignoring');
							clearTimeout(holdTimeout);
							holdTimeout = setTimeout(() => {
								// happens only in case a Key Released event was not received
								data.scene = 'Key Released';
								this.log('hold timeout detected', data);
								this._vitrumSceneTrigger.trigger(this, null, data).catch(this.error);
							}, 2200);
						}
					}
					// Key released event received
					else if (report.Properties1['Key Attributes'] === 'Key Released') {
						// check if timer is running from a previous Hold event
						if (holdTimeout) {
							this.log('key release detected before timeout');
							clearTimeout(holdTimeout);
							holdTimeout = null;
						}
						this._vitrumSceneTrigger.trigger(this, null, data).catch(this.error);
					}
					// handle all other events
					else {
						this._vitrumSceneTrigger.trigger(this, null, data).catch(this.error);
					}
				}
			});

		}
		else {
			// Register capabilities
			this.log('multichannel node detected');
			this.registerCapability('onoff', 'SWITCH_BINARY');

			this.registerReportListener('SWITCH_BINARY', 'SWITCH_BINARY_REPORT', (rawReport, parsedReport) => {
				console.log('registerReportListener Switch Binary', rawReport, parsedReport);
			});

			// Basic flow triggers
			this.registerReportListener('BASIC', 'BASIC_REPORT', (rawReport, parsedReport) => {
				//console.log('registerReportListener Basic', rawReport, parsedReport);
				if (rawReport.Value == 0)
					this.setCapabilityValue('onoff', false);
				else
					this.setCapabilityValue('onoff', true);
			});

			// // Multilevel Switch flow triggers
			// this.registerReportListener('SWITCH_MULTILEVEL', 'SWITCH_MULTILEVEL_START_LEVEL_CHANGE', (rawReport, parsedReport) => {
			// 	console.log('registerReportListener MLS Start Level Change', rawReport, parsedReport);
			// 	if (
			// 		report['Level'] !== undefined
			// 		&& report.Level['Up/ Down'] !== undefined
			// 	) {
			// 		if (report.Level['Up/ Down']) this._vitrumMultiLevelSwitchTrigger.trigger(this, null, { value: 'down' }).catch(this.error);
			// 		else this._vitrumMultiLevelSwitchTrigger.trigger(this, null, { value: 'up' }).catch(this.error);
			// 	}
			// });

			// this.registerReportListener('SWITCH_MULTILEVEL', 'SWITCH_MULTILEVEL_STOP_LEVEL_CHANGE', report => {
			// 	console.log('registerReportListener MLS Stop Level Change', report);
			// 	this._vitrumMultiLevelSwitchTrigger.trigger(this, null, { value: 'stop' }).catch(this.error);
			// });

			// // get the node by our Device's instance
			// const node = await this.homey.zwave.getNode(this);
			// // register for 'report' events
			// node.CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL.on("report", (command, report) => {
			// 	console.log('doing it the hard way');
			// 	this.log(command.name); // e.g. BASIC_REPORT
			// 	this.log(report); // e.g. { Value: true }
			//   });
		}

		this.log('Vitrum 1 Relay has been initialized');
	}

	/**
	 * Method that sets a multi channel association (1.1) if not set before.
	 * @returns {Promise<void>}
	 * @private
	 */
	async _configureMultiChannelNodeReporting() {
		const configuredMultiChannelReporting = this.getStoreValue(CONFIGURED_MULTI_CHANNEL_ASSOCIATION);
		if (!configuredMultiChannelReporting && this.getSetting('zw_group_1') !== '1.1' && this.node.CommandClass.COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION) {
			if (this.node.CommandClass.COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION.MULTI_CHANNEL_ASSOCIATION_SET) {
				await this.node.CommandClass.COMMAND_CLASS_ASSOCIATION.ASSOCIATION_REMOVE(Buffer.from([1, 1]));
				await this.node.CommandClass.COMMAND_CLASS_MULTI_CHANNEL_ASSOCIATION.MULTI_CHANNEL_ASSOCIATION_SET(
					Buffer.from([1, 0x00, 1, 1])
				);
				await this.setSettings({ zw_group_1: '1.1' });
				await this.setStoreValue(CONFIGURED_MULTI_CHANNEL_ASSOCIATION, true);
				this.log('configured multi channel node reporting');
			}
		}
	}

	/**
	 * onAdded is called when the user adds the device, called just after pairing.
	 */
	async onAdded() {
		if (this.hasCapability('onoff')) {
			this.setCapabilityValue('onoff', false).catch(this.error);
		}
		this.log('Vitrum 1 Relay has been added');
	}

	async vitrumSceneRunListener(args, state) {
		if (!args) throw new Error('No arguments provided');
		if (!state) throw new Error('No state provided');

		this.log('Vitrum 1 Relay scene triggered');

		if (args.button && state.button
			&& args.scene && state.scene) {
			return (args.button === state.button && args.scene === state.scene);
		} throw new Error('Button or scene undefined in args or state');
	}

	// async vitrumMultiLevelSwitchRunListener(args, state) {
	// 	this.log('Vitrum 1 Relay MLS triggered');
	// 	if (
	// 		args.value !== undefined
	// 		&& state.value !== undefined
	// 	) {
	// 		return (args.value === state.value);
	// 	}
	// 	return false;
	// }

}

module.exports = Vitrum1RelayDevice;
