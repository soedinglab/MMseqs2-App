'use strict'

const electron = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')
const webpackHotMiddleware = require('webpack-hot-middleware')

const mainConfig = require('./webpack.electron.config')
const rendererConfig = require('../frontend/webpack.frontend.config')(null, { mode: "development" })

let electronProcess = null
let manualRestart = false
let hotMiddleware

function logStats (proc, data) {
  let log = ''

  log += `┏ ${proc} Process ${new Array((19 - proc.length) + 1).join('-')}`
  log += '\n\n'

  if (typeof data === 'object') {
    data.toString({
      colors: true,
      chunks: false
    }).split(/\r?\n/).forEach(line => {
      log += '  ' + line + '\n'
    })
  } else {
    log += `  ${data}\n`
  }

  log += '\n' + `┗ ${new Array(28 + 1).join('-')}` + '\n'

  console.log(log)
}

let rendererCompiler = null
function startRenderer () {
  return new Promise((resolve, reject) => {
    rendererConfig.entry = [path.join(__dirname, 'dev-client')].concat(rendererConfig.entry)

    rendererCompiler = webpack(rendererConfig)
    hotMiddleware = webpackHotMiddleware(rendererCompiler, {
      log: false, 
      heartbeat: 2500 
    })

    rendererCompiler.hooks.compilation.tap('html-webpack-plugin-after-emit', () => {
        hotMiddleware.publish({ action: 'reload' })
    })

    rendererCompiler.hooks.done.tap('done', stats => {
      logStats('Renderer', stats)
    })

    const server = new WebpackDevServer(
      rendererCompiler,
      {
        contentBase: path.join(__dirname, '../'),
        quiet: true,
        before (app, ctx) {
          app.use(hotMiddleware)
          ctx.middleware.waitUntilValid(() => {
            resolve()
          })
        }
      }
    )

    server.listen(9080)
  })
}

let mainCompiler = null
function startMain () {
  return new Promise((resolve, reject) => {
    mainConfig.entry.main = [path.join(__dirname, './index.dev.js')].concat(mainConfig.entry.main)

    mainCompiler = webpack(mainConfig)

    mainCompiler.hooks.watchRun.tapAsync('watch-run', (compilation, done) => {
      hotMiddleware.publish({ action: 'compiling' })
      done()
    })

    mainCompiler.watch({}, (err, stats) => {
      if (err) {
        console.log(err)
        return
      }

      logStats('Main', stats)

      if (electronProcess && electronProcess.kill) {
        manualRestart = true
        process.kill(electronProcess.pid)
        electronProcess = null
        startElectron()

        setTimeout(() => {
          manualRestart = false
        }, 5000)
      }

      resolve()
    })
  })
}

function startElectron () {
  electronProcess = spawn(electron, ['--inspect=5858', path.join(__dirname, '../dist/main.js')])

  electronProcess.stdout.on('data', data => {
    electronLog(data)
  })
  electronProcess.stderr.on('data', data => {
    electronLog(data)
  })

  electronProcess.on('close', () => {
    if (!manualRestart) {
      if (rendererCompiler != null && 'close' in rendererCompiler) {
        rendererCompiler.close((err) => { if (err) electronLog(err) });
      }
      if (mainCompiler != null && 'close' in mainCompiler) {
        mainCompiler.close((err) => { if (err) electronLog(err) });
      }
      process.exit()
    }
  })
}

function electronLog (data) {
  let log = ''
  data = data.toString().split(/\r?\n/)
  data.forEach(line => {
    log += `  ${line}\n`
  })
  if (/[0-9A-z]+/.test(log)) {
    console.log(
      '┏ Electron -------------------' +
      '\n\n' +
      log +
      '┗ ----------------------------' +
      '\n'
    )
  }
}

function init () {
  Promise.all([startRenderer(), startMain()])
    .then(() => {
      startElectron()
    })
    .catch(err => {
      console.error(err)
    })
}

init()
