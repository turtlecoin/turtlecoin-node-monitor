// Copyright (c) 2019, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const Crypto = require('crypto')
const DatabaseBackend = require('./databaseBackend.js')
const EventEmitter = require('events').EventEmitter
const inherits = require('util').inherits
const Metronome = require('node-metronome')
const request = require('request-promise-native')
const TurtleCoinRPC = require('turtlecoin-rpc').TurtleCoind
const util = require('util')

function Collector (opts) {
  opts = opts || {}
  if (!(this instanceof Collector)) return new Collector(opts)
  this.nodeList = opts.nodeList || false
  this.pollingInterval = opts.pollingInterval || 60 // 1 minute
  this.updateInterval = opts.updateInterval || (60 * 60) // 1 hour
  this.historyDays = opts.historyDays || 0.25 // 6 hours

  if (!this.nodeList) throw new Error('Must supply url to node list')

  this.database = new DatabaseBackend(opts.database || {})

  var nodeListCache = []

  this.pollingTimer = new Metronome(this.pollingInterval * 1000)
  this.pollingTimer.on('tick', () => {
    const timestamp = parseInt((new Date()).getTime() / 1000)

    const promises = []

    nodeListCache.forEach((node) => {
      promises.push(getNodeStatus(
        getNodeId(node),
        node.url,
        node.port,
        node.ssl
      ))
    })

    Promise.all(promises).then((responses) => {
      if (responses.length !== 0) {
        return this.database.saveNodesPolling(timestamp, responses)
      }
    }).then(() => {
      this.emit('info', util.format('Saved polling event for %s nodes in the database', nodeListCache.length))
    }).catch((err) => {
      this.emit('error', util.format('Could not save polling event for %s nodes in the database: %s', nodeListCache.length, err.toString()))
    })
  })

  this.updateTimer = new Metronome(this.updateInterval * 1000)
  this.updateTimer.pause = true
  this.updateTimer.on('tick', () => {
    getList(this.nodeList).then((list) => {
      nodeListCache = list
      this.emit('update', list)
    }).catch((err) => {
      this.emit('error', util.format('Could not update the public node list: %s', err.toString()))
    })
  })

  this.updateTimer.on('tick', () => {
    const currentTimestamp = parseInt((new Date()).getTime() / 1000)
    const historySeconds = this.historyDays * 24 * 60 * 60
    const cutoff = currentTimestamp - historySeconds

    this.database.cleanPollingHistory(cutoff).then(() => {
      this.emit('info', util.format('Cleaned old polling history before %s', cutoff))
    }).catch((err) => {
      this.emit('error', util.format('Could not clear old history from before %s: %s', cutoff, err.toString()))
    })
  })

  this.on('update', (nodes) => {
    this.database.saveNodes(nodes).then(() => {
      this.emit('info', util.format('Saved %s nodes in the database', nodes.length))
    }).catch((err) => {
      this.emit('error', util.format('Could not save %s nodes in the database: %s', nodes.length, err.toString()))
    })
  })
}
inherits(Collector, EventEmitter)

Collector.prototype.start = function () {
  this.updateTimer.pause = false
  this.updateTimer.tick()
}

Collector.prototype.stop = function () {
  this.pollingTimer.pause = true
  this.updateTimer.pause = true
}

function getList (url) {
  return new Promise((resolve, reject) => {
    request({
      uri: url,
      json: true
    }).then((response) => {
      if (response.nodes) {
        for (var i = 0; i < response.nodes.length; i++) {
          response.nodes[i].id = getNodeId(response.nodes[i])
          response.nodes[i].ssl = (response.nodes[i].ssl) ? 1 : 0
          response.nodes[i].cache = (response.nodes[i].cache) ? 1 : 0
        }
        return resolve(response.nodes)
      } else {
        return reject(new Error('Node list not found'))
      }
    }).catch((err) => {
      return reject(err)
    })
  })
}

function getNodeStatus (id, host, port, ssl) {
  return new Promise((resolve, reject) => {
    const rpc = new TurtleCoinRPC({
      host: host,
      port: port,
      ssl: ssl,
      timeout: 10000
    })

    const payload = {
      id: id,
      height: 0,
      feeAddress: '',
      feeAmount: 0,
      version: 'offline',
      status: 0,
      connectionsIn: 0,
      connectionsOut: 0,
      difficulty: 0,
      hashrate: 0,
      txPoolSize: 0
    }
    rpc.info().then((response) => {
      payload.height = response.height
      payload.connectionsIn = response.incoming_connections_count
      payload.connectionsOut = response.outgoing_connections_count
      payload.version = response.version
      payload.status = (response.synced) ? 1 : 0
      payload.difficulty = response.difficulty
      payload.hashrate = response.hashrate
      payload.txPoolSize = response.tx_pool_size

      return rpc.fee()
    }).then((response) => {
      payload.feeAddress = response.address
      payload.feeAmount = response.amount
    }).then(() => {
      return resolve(payload)
    }).catch(() => {
      return resolve(payload)
    })
  })
}

function getNodeId (node) {
  function sha256 (message) {
    return Crypto.createHmac('sha256', message).digest('hex')
  }

  return sha256(util.format('%s:%s-%s', node.url, node.port, (node.ssl) ? 1 : 0))
}

module.exports = Collector
