const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin');

const isElectron = typeof (process.env.ELECTRON) != "undefined";

function NullPlugin() { }
NullPlugin.prototype.apply = function () { };

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    var exports = {
        entry: path.resolve(__dirname, './main.js'),
        target: isElectron ? 'electron-renderer' : 'web',
        mode: argv.mode,
        output: {
            path: path.resolve(__dirname, '../dist'),
            publicPath: isElectron ? '' : '/',
            filename: isElectron ? 'renderer.js' : 'build.[contenthash:8].js',
            crossOriginLoading: 'anonymous',
        },
        module: {
            rules: [
                {
                    test: /\.vue$/,
                    loader: 'vue-loader',
                    options: {
                        transformAssetUrls: {
                            video: ['src', 'poster'],
                            source: 'src',
                            img: 'src',
                            image: 'xlink:href',
                            object: 'data'
                        },
                        include: [
                            path.resolve(__dirname),
                            path.resolve(__dirname, '../node_modules/vuetify/src'),
                        ]
                    }
                },
                {
                    test: /\.js$/,
                    loader: 'babel-loader',
                    include: [
                        path.resolve(__dirname),
                        path.resolve(__dirname, '../node_modules/vuetify/src'),
                        path.resolve(__dirname, '../node_modules/vue-localstorage/src'),
                        path.resolve(__dirname, '../node_modules/vue-resource'),
                    ],
                    exclude: [
                        path.resolve(__dirname, './lib/d3'),
                    ]
                },
                {
                    test: /\.(png|jpe?g|gif|svg|ttf|woff2?|eot)(\?.*)?$/,
                    loader: 'file-loader',
                    options: {
                        name: isElectron ? '[name].[ext]' : '[name].[contenthash:8].[ext]',
                        esModule: false
                    }
                },
                {
                    test: /\.css$/,
                    use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader']
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader', 'sass-loader']
                }
            ]
        },
        resolve: {
            extensions: ['.js', '.vue', '.json'],
            alias: {
                'vue$': 'vue/dist/vue.runtime.esm.js',
                'vue-resource$': 'vue-resource/src/index.js'
            }
        },
        externals: {
            got: 'got'
        },
        plugins: [
            new webpack.DefinePlugin({
                __CONFIG__: JSON.stringify(require('../package.json').configuration),
                __ELECTRON__: isElectron,
                'process.env': {
                    NODE_ENV: JSON.stringify(argv.mode)
                }
            }),
            new VueLoaderPlugin(),
            new VuetifyLoaderPlugin(),
            !isElectron ? new FaviconsWebpackPlugin(path.resolve(__dirname, './assets/marv1.svg')) : new NullPlugin(),
            new HtmlWebpackPlugin({
                template: path.resolve(__dirname, './index.html')
            }),
            isProduction ?
                new MiniCssExtractPlugin({
                    filename: isElectron ? 'style.css' : 'style.[contenthash:8].css',
                }) : new NullPlugin(),
            new SubresourceIntegrityPlugin({
                enabled: isProduction && !isElectron,
                hashFuncNames: ['sha256', 'sha384']
            }),
            new CompressionPlugin({
                test: isProduction && !isElectron ? /\.(js|html|css|svg)(\?.*)?$/i : undefined,
                minRatio: 1
            }),
            !isProduction && isElectron ?
                new webpack.HotModuleReplacementPlugin() : new NullPlugin(),
        ],
        devtool: isProduction ? 'source-map' : 'eval-source-map'
    }

    if (!isProduction && !isElectron) {
        exports.devServer = {
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

    return exports;
}
