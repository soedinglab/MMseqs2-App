const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CompressionPlugin = require("compression-webpack-plugin");
const SriPlugin = require('webpack-subresource-integrity');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackIncludeAssetsPlugin = require('html-webpack-include-assets-plugin');

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
                include: [ 
					path.resolve(__dirname, './src'),
					path.resolve(__dirname, './node_modules/vue-strap/src'),
					path.resolve(__dirname, './node_modules/vue-localstorage'),
				],
				exclude: [
					path.resolve(__dirname, './src/msa.min.js'),
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
                test: /\.less$/,
                use: ExtractTextPlugin.extract([ 'css-loader', 'less-loader' ])
            },
		]
	},
	resolve: {
		alias: {
			'vue$': 'vue/dist/vue.esm.js'
		}
	},
	externals: {
		msa: 'msa'
	},
	plugins: [
		new SriPlugin({
		 	hashFuncNames: ['sha256', 'sha384'],
            enabled: process.env.NODE_ENV === 'production',
		}),
		new FaviconsWebpackPlugin({ 
			logo: './src/assets/marv1.svg'
		}),
		new CopyWebpackPlugin([
			{ 
				from: process.env.NODE_ENV === 'production'
						? './src/msa.min.js'
						: './src/msa.js',
				to: 'msa.js'
			},
			{
				from: './src/assets/*x.png',
				to: 'assets',
				flatten: true
			},
            {
				from: './src/assets/marv-search-gray.png',
				to: 'assets',
				flatten: true
			}
		]),
		new HtmlWebpackPlugin({
			template: './src/index.html',
            attrs: ['img:src', 'object:data']
		}),
		new HtmlWebpackIncludeAssetsPlugin({
			assets: ['msa.js'],
			append: false,
			hash: true
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
