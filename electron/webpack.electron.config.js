'use strict'

const webpack = require('webpack');
const path = require('path')

const frontendApp = process.env.FRONTEND_APP;
if (typeof(frontendApp) == "undefined") {
    console.error("Specify FRONTEND_APP environment variable to choose which app should be built (mmseqs|foldseek)");
    process.exit(1);
}

if (['mmseqs', 'foldseek'].includes(frontendApp) == false) {
    console.error("FRONTEND_APP environment variable must be one of mmseqs|foldseek");
    process.exit(1);
}

let mainConfig = {
  entry: {
    main: path.join(__dirname, './index.js')
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
    path: path.join(__dirname, '../dist')
  },
  resolve: {
    extensions: ['.js', '.json', '.node']
  },
  plugins: [
    new webpack.DefinePlugin({
        __APP__: JSON.stringify(frontendApp)
    }),
  ],
  target: 'electron-main'
}
module.exports = mainConfig
