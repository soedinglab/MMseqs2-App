const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin');
const ImageMinimizerPlugin = require("image-minimizer-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const { init, compress } = require('@bokuweb/zstd-wasm');

const isElectron = typeof(process.env.ELECTRON) != "undefined";
const isLocal = typeof(process.env.LOCAL) != "undefined";

const frontendApp = process.env.FRONTEND_APP;
if (typeof(frontendApp) == "undefined") {
    console.error("Specify FRONTEND_APP environment variable to choose which app should be built (mmseqs|foldseek)");
    process.exit(1);
}

if (['mmseqs', 'foldseek', 'foldmason'].includes(frontendApp) == false) {
    console.error("FRONTEND_APP environment variable must be one of mmseqs|foldseek|foldmason");
    process.exit(1);
}

const fs = require('fs');
const parsePo = require('./lib/po-reader');
const appStrings = {
    mmseqs: parsePo(fs.readFileSync('./frontend/assets/mmseqs.en_US.po', { encoding: 'utf8', flag: 'r' })).translations,
    foldseek: parsePo(fs.readFileSync('./frontend/assets/foldseek.en_US.po', { encoding: 'utf8', flag: 'r' })).translations,
    foldmason: parsePo(fs.readFileSync('./frontend/assets/foldmason.en_US.po', { encoding: 'utf8', flag: 'r' })).translations,
};

function NullPlugin() { }
NullPlugin.prototype.apply = function () { };

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    var exports = {
        entry: isLocal ? path.resolve(__dirname, './main_local.js') : path.resolve(__dirname, './main.js'),
        target: isElectron ? 'electron-renderer' : 'web',
        mode: argv.mode,
        output: {
            path: path.resolve(__dirname, '../dist'),
            publicPath: isElectron ? '' : '/',
            filename: isElectron ? 'renderer.js' : (isLocal ? '[name].js' : '[contenthash:20].js'),
            crossOriginLoading: 'anonymous',
        },
        cache: {
            type: 'filesystem'
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
                        path.resolve(__dirname, '../node_modules/vuetify/src')
                    ]
                },
                {
                    test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
                    type: 'asset/resource',
                    generator: {
                        emit: !isLocal
                    }
                },
                {
                    test: /\.(ttf|woff2?|eot|wasm)(\?.*)?$/,
                    type: isLocal ? 'asset/inline' : 'asset/resource'
                },

                {
                    test: /\.css$/,
                    use: [isProduction && !isLocal ? MiniCssExtractPlugin.loader : 'vue-style-loader', 'css-loader']
                },
                {
                    test: /\.sass$/i,
                    use: [
                        isProduction && !isLocal ? MiniCssExtractPlugin.loader : 'vue-style-loader',
                        { loader: 'css-loader', options: { esModule: false } },
                        {
                            loader: 'sass-loader',
                            options: {
                                sassOptions: {
                                    includePaths: [path.resolve(__dirname, "assets")]
                                },
                                additionalData: `@import "_variables.scss"`
                            }
                        }
                    ]
                },
                {
                    test: /\.scss$/i,
                    use: [
                        isProduction && !isLocal ? MiniCssExtractPlugin.loader : 'vue-style-loader',
                        { loader: 'css-loader', options: { esModule: false } },
                        {
                            loader: 'sass-loader',
                            options: {
                                sassOptions: {
                                    includePaths: [path.resolve(__dirname, "assets")]
                                },
                                additionalData: `@import "_variables.scss";`
                            }
                        }
                    ]
                },
                {
                    test: /\.po$/,
                    use: [
                        { loader: path.resolve('./frontend/lib/po-loader.js') },
                    ]
                }
            ]
        },
        resolve: {
            extensions: ['.js', '.vue', '.json'],
            alias: {
                'vue$': 'vue/dist/vue.runtime.esm.js'
            }
        },
        experiments: {
            asyncWebAssembly: false
        },
        plugins: [
            new webpack.DefinePlugin({
                __TITLE__: JSON.stringify(appStrings[frontendApp]["APP_NAME"]),
                __CONFIG__: JSON.stringify(require('../package.json').configuration),
                __ELECTRON__: isElectron,
                __LOCAL__: isLocal,
                __APP__: JSON.stringify(frontendApp),
                'process.env': {
                    NODE_ENV: JSON.stringify(argv.mode)
                },
            }),
            new VueLoaderPlugin(),
            new VuetifyLoaderPlugin(),
            !isElectron && isProduction && !isLocal ?
                new FaviconsWebpackPlugin({
                    logo: frontendApp == 'mmseqs'
                        ? path.resolve(__dirname, './assets/marv1.svg')
                        : path.resolve(__dirname, './assets/marv-foldseek.png'),
                    prefix: 'f-[contenthash:20]/',
                    favicons: {
                        icons: {
                            appleStartup: false,
                            android: false,
                            coast: false,
                            windows: false,
                            yandex: false,
                            firefox: false
                        }
                    }
                }) : new NullPlugin(),
            new HtmlWebpackPlugin({
                filename: 'index.html',
                template: path.resolve(__dirname, !isLocal ? './index.html' : './index.ejs'),
                templateParameters: {
                    STRINGS: appStrings[frontendApp],
                    ENABLE_CSP: isElectron && isProduction
                },
                inject: !isLocal,
                cache: !isLocal,
            }),
            isProduction && !isLocal?
                new MiniCssExtractPlugin({
                    filename: isElectron ? 'style.css' : '[contenthash:20].css',
                }) : new NullPlugin(),
            new SubresourceIntegrityPlugin({
                enabled: isProduction && !isElectron,
                hashFuncNames: ['sha256', 'sha384']
            }),
            // !isElectron ? new CompressionPlugin({
            isProduction && !isElectron ? new CompressionPlugin({
                test: /\.(js|html|css|svg|woff2?|map|ico|wasm)(\?.*)?$/i,
                minRatio: 1,
                filename:  !isLocal ? '[path][base].gz' : '[path][base].zst',
                algorithm: !isLocal ? 'gzip' : (input, compressionOptions, callback) => {
                    (async () => {
                        await init();
                        callback(false, compress(input, 22));
                    })();
                }
            }) : new NullPlugin(),
            isProduction ? new ImageMinimizerPlugin({
                minimizer: {
                    implementation: ImageMinimizerPlugin.imageminMinify,
                    options: {
                        plugins: [
                            ["pngquant", { speed: 1, strip: true }],
                        ],
                    },
                },
            }) : new NullPlugin(),
            isLocal ?  new webpack.optimize.LimitChunkCountPlugin({
                maxChunks: 3,
              }) : new NullPlugin(),
            !isProduction && isElectron ?
                new webpack.HotModuleReplacementPlugin() : new NullPlugin(),
        ],
        devtool: isProduction ? 'source-map' : 'eval-source-map',
    }
    
    if (isLocal) {
        exports.optimization = {
            moduleIds: 'deterministic',
            chunkIds: 'deterministic',
            minimize: true,
            minimizer: [new TerserPlugin({
                terserOptions: {
                    format: {
                        beautify: true
                    }
                }
            })],
            splitChunks: {
                minSize: 0,
                minSizeReduction: 0,
                cacheGroups: {
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendor',
                        chunks: 'all',
                        priority: -10,
                        reuseExistingChunk: true,
                        enforce: true
                    },
                    workerGroup: {
                        test: /TMAlignWorker\.js$/,
                        name: 'tmworker',
                        chunks: 'all',
                        priority: -15,
                        reuseExistingChunk: true,
                        enforce: true
                    },
                    frontend: {
                        name: 'frontend',
                        chunks: 'all',
                        priority: -20,
                        reuseExistingChunk: true,
                        enforce: true
                    },
                },
            }
        };
    }

    if (!isProduction && !isElectron) {
        exports.devServer = {
            historyApiFallback: true,
            proxy: {
                '/api': {
                    target: 'http://localhost:3000'
                }
            }
        };
    }

    return exports;
}
