const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CompressionPlugin = require("compression-webpack-plugin");
const SriPlugin = require('webpack-subresource-integrity');

module.exports = {
	entry: './src/main.js',
	output: {
		path: path.resolve(__dirname, './dist'),
		publicPath: '/',
		filename: 'build.[hash:7].js',
		crossOriginLoading: 'anonymous',
	},
	module: {
		rules: [
			{
				test: /\.vue$/,
				loader: 'vue-loader',
				options: {
                    transformToRequire : { img: 'src', image: 'xlink:href', object: 'data' },
					loaders: {
						css: ExtractTextPlugin.extract({
							use: 'css-loader',
							fallback: 'vue-style-loader'
						})
					}
				}
			},
			{
				test: /\.js$/,
				loader: 'babel-loader',
                include: [ path.resolve(__dirname, './src') ]
			},
			{
				test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
				loader: 'file-loader',
				options: {
					name: '[name].[hash:7].[ext]'
				}
			},
		]
	},
	resolve: {
		alias: {
			'vue$': 'vue/dist/vue.esm.js'
		}
	},
	plugins: [
		new SriPlugin({
		 	hashFuncNames: ['sha256', 'sha384'],
            enabled: process.env.NODE_ENV === 'production',
		}),
		new FaviconsWebpackPlugin({ 
			logo: './src/assets/marv1.svg'
		}),
		new HtmlWebpackPlugin({
			template: './src/index.html',
            attrs: ['img:src', 'object:data']
		}),
		new ExtractTextPlugin('style.[hash:7].css'),
	],
	devServer: {
		historyApiFallback: true,
		noInfo: true,
		proxy: {
			'/api': {
                target: 'http://localhost:8000',
				pathRewrite: {'^/api' : '/backend'},
				logLevel: 'debug'
			}
		}
	},
	devtool: '#eval-source-map'
}

if (process.env.NODE_ENV === 'production') {
	module.exports.devtool = '#source-map'
	// http://vue-loader.vuejs.org/en/workflow/production.html
	module.exports.plugins = (module.exports.plugins || []).concat([
		new webpack.DefinePlugin({
			'process.env': {
				NODE_ENV: '"production"'
			}
		}),
		new webpack.optimize.UglifyJsPlugin({
			compress: {
				warnings: false
			}
		}),
		new webpack.LoaderOptionsPlugin({
			minimize: true
		}),
        new CompressionPlugin({
            asset: "[path].gz[query]",
            algorithm: "gzip",
            test: /\.(js|html|css|svg)$/,
            minRatio: 0
        }),
	])
}
