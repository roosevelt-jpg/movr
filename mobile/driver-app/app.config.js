const fs = require('fs');
const path = require('path');

const config = require('./app.json');

if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
  config.expo.android = config.expo.android || {};
  config.expo.android.googleServicesFile = './google-services.json';
}

module.exports = config;
