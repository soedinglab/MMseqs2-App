'use strict'

const path = require('path');

process.env.ELECTRON_ROOT = path.resolve('..');

let rendererConfig = require('../src/renderer/webpack.config')

rendererConfig.output = {
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, '../dist/electron')
};

rendererConfig.target = 'electron-renderer';

module.exports = rendererConfig;
