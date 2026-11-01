'use strict';

const Homey = require('homey');

class MyApp extends Homey.App {
  onInit() {
    this.log('Vitrum V3 is running...');
  }
}

module.exports = MyApp;
