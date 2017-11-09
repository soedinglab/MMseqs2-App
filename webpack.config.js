const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CompressionPlugin = require("compression-webpack-plugin");
const SriPlugin = require('webpack-subresource-integrity');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackIncludeAssetsPlugin = require('html-webpack-include-assets-plugin');
const isElectron = !!process.env.ELECTRON_ROOT;
const __root = isElectron ? process.env.ELECTRON_ROOT : __dirname;
const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
	entry: path.resolve(__dirname, './src/main.js'),
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
					extractCSS: true,
					transformToRequire : { img: 'src', image: 'xlink:href', object: 'data' },
					include: [
						path.resolve(__dirname, './src'),
						path.resolve(__root, './node_modules/vuetify/src'),
					]
				}
			},
			{
				test: /\.js$/,
				loader: 'babel-loader',
				include: [ 
					path.resolve(__dirname, './src'),
					path.resolve(__root, './node_modules/vuetify/src'),
					path.resolve(__root, './node_modules/vue-localstorage/src'),
					path.resolve(__root, './node_modules/vue-resource'),
				],
				exclude: [
					path.resolve(__dirname, './src/lib'),
				]
			},
			{
				test: /\.(png|jpe?g|gif|svg|ttf|woff2?|eot)(\?.*)?$/,
				loader: 'file-loader',
				options: {
					name: '[name].[hash:7].[ext]'
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
		d3: 'd3',
		got: 'got'
	},
	plugins: [
		new webpack.DefinePlugin({
			__CONFIG__: JSON.stringify(require('./package.json').configuration),
			__ELECTRON__: isElectron
		}),
		new CopyWebpackPlugin([
			{
				from: path.resolve(__dirname, './src/lib/d3/d3.js'),
				to: 'd3.js',
				flatten: true
			},
			{
				from: path.resolve(__dirname, './src/assets/') + '/*x.png',
				to: 'assets',
				flatten: true
			},
			{
				from: path.resolve(__dirname, './src/assets/marv-search-gray.png'),
				to: 'assets',
				flatten: true
			}
		]),
		new HtmlWebpackPlugin({
			template: path.resolve(__dirname, './src/index.html'),
			attrs: ['img:src', 'object:data']
		}),
		new HtmlWebpackIncludeAssetsPlugin({
			assets: ['d3.js'],
			append: false,
			hash: true
		}),
		new ExtractTextPlugin({
			filename: 'style.[hash:7].css',
		}),
	],
	devtool: '#eval-source-map'
}

if (!isElectron) {
	module.exports.plugins = (module.exports.plugins || []).concat([
		new HtmlWebpackIncludeAssetsPlugin({
			assets: [ { path: 'https://fonts.googleapis.com/css?family=Material+Icons', type: 'css' } ],
			append: false,
			publicPath: ''
		})
	]);
}

if (isProduction) {
	module.exports.devtool = '#source-map'
	module.exports.plugins = (module.exports.plugins || []).concat([
		new webpack.DefinePlugin({
			'process.env': {
				NODE_ENV: '"production"'
			},
		}),
		new webpack.optimize.UglifyJsPlugin({
			compress: {
				warnings: false
			}
		}),
	])

	if (!isElectron) {
		module.exports.plugins = (module.exports.plugins || []).concat([
			new FaviconsWebpackPlugin({ 
				logo: path.resolve(__dirname, './src/assets/marv1.svg')
			}),
			new SriPlugin({
				hashFuncNames: ['sha256', 'sha384']
			}),
			new CompressionPlugin({
				asset: "[path].gz[query]",
				algorithm: "gzip",
				test: /\.(js|html|css|svg)$/,
				minRatio: 0
			}),
		])
	}
} else {
	if (isElectron) {
		module.exports.plugins = (module.exports.plugins || []).concat([
			new webpack.HotModuleReplacementPlugin(),
		]);
	} else {
		module.exports.devServer = {
			historyApiFallback: true,
			noInfo: true,
			proxy: {
				'/api': {
					target: 'http://localhost:8000',
					pathRewrite: {'^/api' : '/backend'},
					logLevel: 'debug'
				}
			}
		};
	}
}
