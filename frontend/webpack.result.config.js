const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const frontendApp = process.env.FRONTEND_APP;
if (typeof(frontendApp) == "undefined") {
    console.error("Specify FRONTEND_APP environment variable to choose which app should be built (mmseqs|foldseek)");
    process.exit(1);
}

if (['mmseqs', 'foldseek'].includes(frontendApp) == false) {
    console.error("FRONTEND_APP environment variable must be one of mmseqs|foldseek");
    process.exit(1);
}

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    var exports = {
        entry: path.resolve(__dirname, 'result.js'),
        target: 'web',
        mode: argv.mode,
        experiments: {
            asyncWebAssembly: false,
        },
        output: {
            path: path.resolve(__dirname, '../dist'),
            publicPath: '/',
            filename: 'result.js',
            crossOriginLoading: 'anonymous',
        },
        module: {
            rules: [
                {
                    test: /\.js$/,
                    loader: 'babel-loader',
                    include: [
                        path.resolve(__dirname),
                    ]
                },
                {
                    test: /\.(png|jpe?g|gif|svg|ttf|woff2?|eot)(\?.*)?$/,
                    type: 'asset/inline',
                },
                {
                    test: /\.wasm$/,
                    type: 'asset/inline',
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                },
                {
                    test: /\.s[ac]ss$/i,
                    use: ['style-loader', 'css-loader', 'sass-loader']
                }
            ]
        },
        plugins: [
            new HtmlWebpackPlugin({
                inject: false,
                cache: false,
                template: path.resolve(__dirname, 'result.ejs'),
                filename: 'index.html',
                chunks: 'all'
            }),
            new webpack.DefinePlugin({
                __TITLE__: frontendApp === 'foldseek'
                    ? JSON.stringify('Foldseek')
                    : JSON.stringify('MMseqs2'),
                __APP__: JSON.stringify(frontendApp)
            }),
            new webpack.optimize.LimitChunkCountPlugin({
                maxChunks: 1
            })
        ],
        devtool: isProduction ? false : 'eval-source-map'
    }

    return exports;
}
