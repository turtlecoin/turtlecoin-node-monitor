[![NPM](https://nodei.co/npm/turtlecoin-node-monitor.png?downloads=true&stars=true)](https://nodei.co/npm/turtlecoin-node-monitor/)

<h1 align="center"></h1>
<p>
  <img alt="Version" src="https://img.shields.io/badge/version-0.0.1-blue.svg?cacheSeconds=2592000" />
  <a href="https://github.com/turtlecoin/turtlecoin-node-monitor#readme">
    <img alt="Documentation" src="https://img.shields.io/badge/documentation-meh-brightgreen.svg" target="_blank" />
  </a>
  <a href="https://github.com/turtlecoin/turtlecoin-node-monitor/graphs/commit-activity">
    <img alt="Maintenance" src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" target="_blank" />
  </a>
  <a href="https://github.com/turtlecoin/turtlecoin-node-monitor/blob/master/LICENSE">
    <img alt="License: AGPL-3.0" src="https://img.shields.io/badge/License-AGPL-yellow.svg" target="_blank" />
  </a>
  <a href="https://twitter.com/ ">
    <img alt="Twitter:  " src="https://img.shields.io/twitter/follow/_turtlecoin.svg?style=social" target="_blank" />
  </a>
</p>

## Prerequisites

* Node.js >= 6.x
* MySQL/MariaDB
  * Load the [database schema](#database-schema)

## Install



### Collection Service

```sh
npm install -g turtlecoin-node-monitor
export MYSQL_HOST=<server ip>
export MYSQL_PORT=<server port>
export MYSQL_USERNAME=<server username>
export MYSQL_PASSWORD=<server password>
export MYSQL_DATABASE=<database>
turtlecoin-node-monitor
```

#### Additional Options

```sh
export MYSQL_SOCKET=<server socket path (default: not set)>
export MYSQL_CONNECTION_LIMIT=<# of maximum server connections (default: 10)>
export HISTORY_DAYS=<# of days to keep history (default: 7 days)>
export UPDATE_INTERVAL=<# of seconds between updating node list (default: 1 hour)>
export POLLING_INTERVAL=<# of seconds between checking nodes (default: 120s)>
export NODE_LIST_URL=<Full URL to node list (default: turtlecoin-nodes-json)>
```

### As a Module for Pulling Stats

```sh
npm install --save turtlecoin-node-monitor
```

#### Sample Code

```javascript
const StatsDatabase = require('turtlecoin-node-monitor')

const db = new StatsDatabase({
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'password',
  database: 'turtlecoin',
  connectionLimit: 10
})

db.getNodeStats().then((stats) => {
  console.log(stats)
})
```

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS `nodes`
  (
     `id`       VARCHAR(64) NOT NULL,
     `name`     VARCHAR(255) NOT NULL,
     `hostname` VARCHAR(255) NOT NULL,
     `port`     INT(11) NOT NULL DEFAULT 11898,
     `ssl`      INT(11) NOT NULL DEFAULT 0,
     `cache`    INT(11) NOT NULL DEFAULT 0,
     PRIMARY KEY (`id`),
     KEY `ssl` (`ssl`),
     KEY `cache` (`cache`)
  )
engine=innodb
DEFAULT charset=utf8;

CREATE TABLE `node_polling`
  (
     `id`             VARCHAR(64) NOT NULL,
     `timestamp`      BIGINT(1) UNSIGNED NOT NULL,
     `status`         INT(11) NOT NULL DEFAULT 0,
     `feeaddress`     VARCHAR(255) DEFAULT NULL,
     `feeamount`      BIGINT(20) NOT NULL DEFAULT 0,
     `height`         BIGINT(20) NOT NULL DEFAULT 0,
     `version`        VARCHAR(20) NOT NULL DEFAULT '0.0.0',
     `connectionsin`  INT(11) NOT NULL DEFAULT 0,
     `connectionsout` INT(11) NOT NULL DEFAULT 0,
     PRIMARY KEY (`id`, `timestamp`),
     KEY `status` (`status`),
     KEY `feeamount` (`feeamount`)
  )
engine=innodb
DEFAULT charset=utf8;
```

## Author

**The TurtleCoin Developers**

* Twitter: [@turtlecoin](https://twitter.com/_turtlecoin )
* Github: [@turtlecoin](https://github.com/turtlecoin)

## License

Copyright © 2019 [The TurtleCoin Developers](https://github.com/turtlecoin).<br />
This project is [AGPL-3.0](https://github.com/turtlecoin/cryptodira/blob/master/LICENSE) licensed.
