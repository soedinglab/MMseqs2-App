const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CompressionPlugin = require("compression-webpack-plugin");

module.exports = {
	entry: './src/main.js',
	output: {
		path: path.resolve(__dirname, './dist'),
		publicPath: '/',
		filename: 'build.js',
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
							loader: 'css-loader',
							fallbackLoader: 'vue-style-loader'
						})
					}
				}
			},
			{
				test: /\.js$/,
				loader: 'babel-loader',
				exclude: /node_modules/
			},
			{
				test: /\.(png|jpg|gif|svg)$/,
				loader: 'file-loader',
				options: {
					name: '[name].[ext]?[hash]'
				}
			},
			{
				test: /\.hbs$/,
				loader: 'handlebars-loader'
			}
		]
	},
	resolve: {
		alias: {
			'vue$': 'vue/dist/vue'
		}
	},
	plugins: [
		new FaviconsWebpackPlugin({ 
			logo: './src/assets/marv1.svg'
		}),
		// new SriPlugin({
		// 	hashFuncNames: ['sha256', 'sha384'],
		// 	enabled: process.env.NODE_ENV === 'production',
		// }),
		new HtmlWebpackPlugin({
			template: './src/index.hbs',
			title: 'MMseqs Search Service',
            attrs: ['img:src', 'object:data']
		}),
		new ExtractTextPlugin('style.css'),
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
            minRatio: 0.8
        }),
	])
}
