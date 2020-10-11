#!/usr/bin/env node
// Copyright (c) 2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

import { Collector, getAppParams } from './Collector';
import { Logger } from '@turtlepay/logger';
import { getDatabase, checkProduction } from './Common';

(async () => {
    checkProduction();

    const database = await getDatabase();

    const app_options = getAppParams();

    const collector = new Collector(database, app_options);

    collector.on('error', error =>
        Logger.error(error.toString()));

    collector.on('info', notice =>
        Logger.info(notice));

    collector.on('update', nodes =>
        Logger.info('Updated node list with %s nodes', nodes.length));

    collector.on('polling', nodes =>
        Logger.info('Saved polling events for %s nodes', nodes.length));

    Logger.info('Collector starting...');

    await collector.start();
})();
