const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    var exports = {
        entry: path.resolve(__dirname, 'result.js'),
        target: 'web',
        mode: argv.mode,
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
                    ],
                    exclude: [
                        path.resolve(__dirname, 'lib/d3'),
                    ]
                },
                {
                    test: /\.(png|jpe?g|gif|svg|ttf|woff2?|eot)(\?.*)?$/,
                    use: ['url-loader']
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

            }),
        ],
        devtool: isProduction ? false : 'eval-source-map'
    }

    return exports;
}