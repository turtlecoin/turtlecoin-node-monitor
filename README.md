![Prerequisite](https://img.shields.io/badge/node-%3E%3D12-blue.svg) [![Documentation](https://img.shields.io/badge/documentation-yes-brightgreen.svg)](https://github.com/TurtleCoin/turtlecoin-node-monitor#readme) [![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/TurtleCoin/turtlecoin-node-monitor/graphs/commit-activity) [![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-yellow.svg)](https://github.com/TurtleCoin/turtlecoin-node-monitor/blob/master/LICENSE) [![Twitter: TurtlePay](https://img.shields.io/twitter/follow/_TurtleCoin.svg?style=social)](https://twitter.com/_TurtleCoin)

[![NPM](https://nodeico.herokuapp.com/@turtlecoin/node-monitor.svg)](https://npmjs.com/package/@turtlecoin/node-monitor)

## Prerequisites

- node >= 12
- One of the following DBMS
    - MariaDB/MySQL with InnoDB support
    - Postgres *or* a Postgres compatible SQL interface
    - SQLite (built-in)
    
## Documentation

Full library documentation is available at [https://node-monitor.turtlecoin.dev](https://node-monitor.turtlecoin.dev)

## Install

### Collection Service

```shell
npm install -g yarn
git clone https://github.com/turtlecoin/turtlecoin-node-monitor
cd turtlecoin-node-monitor
yarn && yarn build
```

#### MySQL/MariaDB

1) Set your environment variables and start the service up

```sh
export USE_MYSQL=true
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=yourdbusername
export DB_PASS=yourdbpassword
export DB_NAME=turtlecoin
yarn start
```

#### Postgres

1) Set your environment variables and start the service up

```sh
export USE_POSTGRES=true
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=yourdbusername
export DB_PASS=yourdbpassword
export DB_NAME=turtlecoin
yarn start
```

#### SQLite

1) Set your environment variables and start the service up

```sh
export USE_SQLITE=true
export SQLITE_PATH=node-monitor.sqlite3
yarn start
```

**Note:** SQLite is not the best solution if you are running this as part of a web service.

#### Additional Options

```sh
export NODE_HISTORY_DAYS=<# of days to keep history (default: 6 hours)>
export NODE_UPDATE_INTERVAL=<# of seconds between updating node list (default: 1 hour)>
export NODE_POLLING_INTERVAL=<# of seconds between checking nodes (default: 120s)>
export NODE_LIST_URL=<Full URL to node list (default: turtlecoin-nodes-json)>
```

### As a Module in your App

```sh
yarn add @turtlecoin/node-monitor
```

#### Sample Code

```javascript
import { NodeMonitorDB, getDatabase } from '@turtlecoin/node-monitor';

(async() => {
  const database = await getDatabase();

  const StatsDatabase = new NodeMonitorDB(database);

  const stats = await StatsDatabase.stats();
})();
```

## Author

**The TurtleCoin Developers**

* Twitter: [@turtlecoin](https://twitter.com/_turtlecoin )
* Github: [@turtlecoin](https://github.com/turtlecoin)

## License

Copyright © 2019-2020 [The TurtleCoin Developers](https://github.com/turtlecoin).<br />
This project is [AGPL-3.0](https://github.com/turtlecoin/cryptodira/blob/master/LICENSE) licensed.
