const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CompressionPlugin = require("compression-webpack-plugin");
const SriPlugin = require('webpack-subresource-integrity');
const HtmlWebpackIncludeAssetsPlugin = require('html-webpack-include-assets-plugin');

const isElectron = typeof(process.env.ELECTRON) != "undefined";
const isProduction = process.env.NODE_ENV === 'production';

function NullPlugin() { }
NullPlugin.prototype.apply = function () { };

module.exports = {
    entry: path.resolve(__dirname, './frontend/main.js'),
    target: isElectron ? 'electron-renderer' : 'web',
    output: {
        path: path.resolve(__dirname, './dist'),
        publicPath: isElectron ? '' : '/',
        filename: isElectron ? 'renderer.js' : 'build.[hash:7].js',
        libraryTarget: isElectron ? 'commonjs2' : 'var',
        crossOriginLoading: 'anonymous',
    },
    module: {
        rules: [
            {
                test: /\.vue$/,
                loader: 'vue-loader',
                options: {
                    extractCSS: true,
                    transformToRequire : { object: 'data' },
                    include: [
                        path.resolve(__dirname, './frontend'),
                        path.resolve(__dirname, './node_modules/vuetify/src'),
                    ]
                }
            },
            {
                test: /\.js$/,
                loader: 'babel-loader',
                include: [ 
                    path.resolve(__dirname, './frontend'),
                    path.resolve(__dirname, './node_modules/vuetify/src'),
                    path.resolve(__dirname, './node_modules/vue-localstorage/src'),
                    path.resolve(__dirname, './node_modules/vue-resource'),
                ],
                exclude: [
                    path.resolve(__dirname, './frontend/lib'),
                ]
            },
            {
                test: /\.(png|jpe?g|gif|svg|ttf|woff2?|eot)(\?.*)?$/,
                loader: 'file-loader',
                options: {
                    name: isElectron ? '[name].[ext]' : '[name].[hash:7].[ext]'
                }
            },
            {
                test: /\.css$/,
                use: ExtractTextPlugin.extract([ 'css-loader' ])
            },
            {
                test: /\.styl$/,
                use: ExtractTextPlugin.extract([ 'css-loader', 'stylus-loader' ])
            }
        ]
    },
    resolve: {
        extensions: ['.js', '.vue', '.json'],
        alias: {
            'vue$': 'vue/dist/vue.esm.js'
        }
    },
    externals: {
        got: 'got'
    },
    plugins: [
        new webpack.DefinePlugin({
            __CONFIG__: JSON.stringify(require('./package.json').configuration),
            __ELECTRON__: isElectron
        }),
        !isElectron ? new FaviconsWebpackPlugin({
            logo: path.resolve(__dirname, './frontend/assets/marv1.svg')
        }) : new NullPlugin(),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, './frontend/index.html')
        }),
        new ExtractTextPlugin({
            filename: isElectron ? 'style.css' : 'style.[hash:7].css',
        }),
        !isElectron ? new HtmlWebpackIncludeAssetsPlugin({
            assets: [{ path: 'https://fonts.googleapis.com/css?family=Material+Icons', type: 'css' }],
            append: false,
            publicPath: ''
        }) : new NullPlugin(),
        isProduction ? new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: '"production"'
            },
        }) : new NullPlugin(),
        isProduction ? new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false
            }
        }) : new NullPlugin(),
        isProduction && !isElectron ? new SriPlugin({
            hashFuncNames: ['sha256', 'sha384']
        }) : new NullPlugin(),
        isProduction && !isElectron ? new CompressionPlugin({
            asset: "[path].gz[query]",
            algorithm: "gzip",
            test: /\.(js|html|css|svg)$/,
            minRatio: 0
        }) : new NullPlugin(),
        !isProduction && isElectron ? 
            new webpack.HotModuleReplacementPlugin() : new NullPlugin(),
    ],
    devtool: isProduction ? '#source-map' : '#eval-source-map'
}

if (!isProduction && !isElectron) {
    module.exports.devServer = {
        historyApiFallback: true,
        noInfo: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                logLevel: 'debug'
            }
        }
    };
}
