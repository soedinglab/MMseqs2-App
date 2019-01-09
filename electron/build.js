'use strict'

process.env.NODE_ENV = 'production'

const del = require('del')
const webpack = require('webpack')

const mainConfig = require('../webpack.electron.config')
const rendererConfig = require('../webpack.frontend.config')(null, { mode: process.env.NODE_ENV })

const doneLog = ' DONE '
const errorLog = ' ERROR  '
const okayLog = ' OKAY  '

if (process.env.BUILD_TARGET === 'clean') clean()
else build()

function clean () {
  del.sync(['build/*', '!build/icons', '!build/icons/icon.*'])
  console.log(`\n${doneLog}\n`)
  process.exit()
}

function build () {
  del.sync(['dist/electron/*', '!.gitkeep'])

  pack(mainConfig).then(result => {
    console.log(result)
  }).catch(err => {
    console.log(`\n  ${errorLog}failed to build main process`)
    console.error(`\n${err}\n`)
    process.exit(1)
  })

  pack(rendererConfig).then(result => {
    console.log(result)
  }).catch(err => {
    console.log(`\n  ${errorLog}failed to build renderer process`)
    console.error(`\n${err}\n`)
    process.exit(1)
  })
}

function pack (config) {
  return new Promise((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (err) reject(err.stack || err)
      else if (stats.hasErrors()) {
        let err = ''

        stats.toString({
          chunks: false,
          colors: true
        })
        .split(/\r?\n/)
        .forEach(line => {
          err += `    ${line}\n`
        })

        reject(err)
      } else {
        resolve(stats.toString({
          chunks: false,
          colors: true
        }))
      }
    })
  })
}
