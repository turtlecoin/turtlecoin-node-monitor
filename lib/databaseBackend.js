// Copyright (c) 2019, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const MySQL = require('mysql')

function DatabaseBackend (opts) {
  opts = opts || {}
  if (!(this instanceof DatabaseBackend)) return new DatabaseBackend(opts)
  this.host = opts.host || '127.0.0.1'
  this.port = opts.port || 3306
  this.username = opts.username || ''
  this.password = opts.password || ''
  this.database = opts.database || ''
  this.socketPath = opts.socketPath || false
  this.connectionLimit = opts.connectionLimit || 10

  this.db = MySQL.createPool({
    connectionLimit: this.connectionLimit,
    host: this.host,
    port: this.port,
    user: this.username,
    password: this.password,
    database: this.database,
    socketPath: this.socketPath
  })
}

DatabaseBackend.prototype.getNodeStats = function () {
  return new Promise((resolve, reject) => {
    const nodeList = []

    function setNodePropertyValue (id, property, value) {
      for (var i = 0; i < nodeList.length; i++) {
        if (nodeList[i].id === id) {
          nodeList[i][property] = value
        }
      }
    }

    query(this.db, 'SELECT * FROM `nodes` ORDER BY `name`', []).then((nodes) => {
      nodes.forEach(node => nodeList.push(node))

      return query(this.db, [
        'SELECT `id`, ((SUM(`status`) / COUNT(*)) * 100) AS `availability` ',
        'FROM (SELECT `timestamp` AS `stamp` FROM `node_polling` GROUP BY `timestamp` ORDER BY `timestamp` DESC LIMIT 20) AS `last` ',
        'LEFT JOIN `node_polling` ON `node_polling`.`timestamp` = `last`.`stamp` ',
        'GROUP BY `id`'
      ].join(''), [])
    }).then((rows) => {
      rows.forEach((row) => {
        setNodePropertyValue(row.id, 'availability', row.availability)
      })

      return query(this.db, 'SELECT MAX(`timestamp`) AS `timestamp` FROM `node_polling`', [])
    }).then((rows) => {
      if (rows.length === 0) throw new Error('No timestamp information in the database')
      return query(this.db, 'SELECT * FROM `node_polling` WHERE `timestamp` = ?', [rows[0].timestamp || 0])
    }).then((rows) => {
      rows.forEach((row) => {
        setNodePropertyValue(row.id, 'status', (row.status === 1))
        setNodePropertyValue(row.id, 'feeAddress', row.feeAddress || '')
        setNodePropertyValue(row.id, 'feeAmount', row.feeAmount)
        setNodePropertyValue(row.id, 'height', row.height)
        setNodePropertyValue(row.id, 'version', row.version)
        setNodePropertyValue(row.id, 'connectionsIn', row.connectionsIn)
        setNodePropertyValue(row.id, 'connectionsOut', row.connectionsOut)
        setNodePropertyValue(row.id, 'difficulty', row.difficulty)
        setNodePropertyValue(row.id, 'hashrate', row.hashrate)
        setNodePropertyValue(row.id, 'txPoolSize', row.txPoolSize)
        setNodePropertyValue(row.id, 'lastCheckTimestamp', row.timestamp)
      })

      return query(this.db, [
        'SELECT `id`, `status`, `timestamp` ',
        'FROM (SELECT `timestamp` AS `stamp` FROM `node_polling` GROUP BY `timestamp` ORDER BY `timestamp` DESC LIMIT 20) AS `last` ',
        'LEFT JOIN `node_polling` ON `node_polling`.`timestamp` = `last`.`stamp` ',
        'ORDER BY `id` ASC, `timestamp` DESC'
      ].join(''), [])
    }).then((rows) => {
      const temp = {}

      rows.forEach((row) => {
        if (!temp[row.id]) temp[row.id] = []
        temp[row.id].push({ timestamp: row.timestamp, status: (row.status === 1) })
      })

      Object.keys(temp).forEach((key) => {
        setNodePropertyValue(key, 'history', temp[key])
      })
    }).then(() => {
      return resolve(nodeList)
    }).catch((err) => {
      return reject(err)
    })
  })
}

DatabaseBackend.prototype.saveNodes = function (nodes) {
  const stmts = []

  nodes.forEach((node) => {
    stmts.push({
      query: 'REPLACE INTO `nodes` (`id`, `name`, `hostname`, `port`, `ssl`, `cache`) VALUES (?,?,?,?,?,?)',
      args: [
        node.id,
        node.name,
        node.url,
        node.port,
        node.ssl,
        node.cache
      ]
    })
  })

  return transaction(this.db, stmts)
}

DatabaseBackend.prototype.saveNodesPolling = function (timestamp, nodeData) {
  const stmts = []

  nodeData.forEach((data) => {
    stmts.push({
      query: [
        'REPLACE INTO `node_polling` (`id`, `timestamp`, `status`, `feeAddress`, ',
        '`feeAmount`, `height`, `version`, `connectionsIn`, `connectionsOut`, ',
        '`difficulty`, `hashrate`, `txPoolSize` ',
        ') VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
      ].join(''),
      args: [
        data.id,
        timestamp,
        data.status,
        data.feeAddress,
        data.feeAmount,
        data.height,
        data.version,
        data.connectionsIn,
        data.connectionsOut,
        data.difficulty,
        data.hashrate,
        data.txPoolSize
      ]
    })
  })

  return transaction(this.db, stmts)
}

DatabaseBackend.prototype.cleanPollingHistory = function (before) {
  return query(this.db, 'DELETE FROM `node_polling` WHERE `timestamp` < ?', [before])
}

/* Executes the single query provided with the arguments provided
   against the provided database pool */
function query (db, query, args) {
  return new Promise((resolve, reject) => {
    db.query(query, args, (error, results, fields) => {
      if (error) return reject(error)
      return resolve(results, fields)
    })
  })
}

/* Executes a transaction (with rollback support) consisting of the
   queries provided in the querySet against the provided database pool */
function transaction (db, querySet) {
  function beginTransaction (conn) {
    return new Promise((resolve, reject) => {
      conn.beginTransaction((error) => {
        if (error) return reject(error)
        return resolve()
      })
    })
  }

  function commit (conn) {
    return new Promise((resolve, reject) => {
      conn.commit((error) => {
        if (error) return reject(error)
        return resolve()
      })
    })
  }

  function connection (db) {
    return new Promise((resolve, reject) => {
      db.getConnection((error, connection) => {
        if (error) return reject(error)
        return resolve(connection)
      })
    })
  }

  function q (conn, query, args) {
    return new Promise((resolve, reject) => {
      conn.query(query, args, (error, results, fields) => {
        if (error) return reject(error)
        return resolve(results, fields)
      })
    })
  }

  function rollback (conn) {
    return new Promise((resolve, reject) => {
      conn.rollback(() => {
        return resolve()
      })
    })
  }

  return new Promise((resolve, reject) => {
    var dbConnection = false
    var results = false

    connection(db).then((conn) => {
      dbConnection = conn
      return beginTransaction(dbConnection)
    }).then(() => {
      var promises = []

      querySet.forEach((stmt) => {
        promises.push(q(dbConnection, stmt.query, stmt.args))
      })

      return Promise.all(promises)
    }).then((querySetResults) => {
      results = querySetResults
      return commit(dbConnection)
    }).then(() => {
      dbConnection.release()
      return resolve(results)
    }).catch((error) => {
      if (dbConnection) {
        rollback(dbConnection).then(() => {
          dbConnection.release()
          return reject(error)
        }).catch((error) => {
          dbConnection.release()
          return reject(error)
        })
      } else {
        return reject(error)
      }
    })
  })
}

module.exports = DatabaseBackend
