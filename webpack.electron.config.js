'use strict'

const path = require('path')

let mainConfig = {
  entry: {
    main: path.join(__dirname, './electron/index.js')
  },
  mode: "development",
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      }
    ]
  },
  node: {
    __dirname: process.env.NODE_ENV !== 'production',
    __filename: process.env.NODE_ENV !== 'production'
  },
  output: {
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, './dist')
  },
  resolve: {
    extensions: ['.js', '.json', '.node']
  },
  target: 'electron-main'
}
module.exports = mainConfig
