// Copyright (c) 2019-2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

import { EventEmitter } from 'events';
import { createHmac } from 'crypto';
import { Interfaces } from './Types';
import fetch from 'node-fetch';
import { IDatabase } from 'db-abstraction';
import { NodeMonitorDB } from './NodeMonitorDB';
import { TurtleCoind, TurtleCoindTypes } from 'turtlecoin-utils';
import { BigInteger } from 'turtlecoin-utils/dist/Types';
import { Metronome } from 'node-metronome';

/** @ignore */
require('dotenv').config();

/** @ignore */
import ITurtleCoind = TurtleCoindTypes.ITurtleCoind;

/** @ignore */
const DefaultConfig: Interfaces.CollectorConfig = {
    pollingInterval: 60,
    updateInterval: 360,
    historyDays: 0.25,
    nodeList: 'https://raw.githubusercontent.com/turtlecoin/turtlecoin-nodes-json/master/turtlecoin-nodes.json'
};

/**
 * An interface provided for polling and collecting data of node/daemons
 */
export class Collector extends EventEmitter {
    private readonly m_db: NodeMonitorDB;
    private readonly m_config: Interfaces.CollectorConfig;
    private m_nodes: Interfaces.NetworkNode[] = [];
    private readonly m_pollingTimer: Metronome;
    private readonly m_updateTimer: Metronome;

    /**
     * Creates a new instance of the collector interface
     * @param database the underlying database interface to interact with
     * @param options collector options
     */
    constructor (database: IDatabase, options?: Interfaces.ICollectorConfig) {
        super();

        this.m_config = mergeConfig(DefaultConfig, options);

        this.m_db = new NodeMonitorDB(database);

        this.m_pollingTimer = new Metronome(this.config.pollingInterval * 1000, false);

        this.m_pollingTimer.on('tick', async () => {
            const timestamp = new Date();

            const promises: Promise<Interfaces.NodePollingEvent>[] = [];

            for (const node of this.nodes) {
                promises.push(fetchNodeInfo(node, timestamp));
            }

            const results = await Promise.all(promises);

            try {
                await this.m_db.savePollingEvent(results);

                this.emit('polling', results);
            } catch (error) {
                this.emit('error',
                    new Error('Could not save polling event for ' + this.nodes.length +
                        ' in the database: ' + error.toString()));
            }
        });

        this.m_updateTimer = new Metronome(this.config.updateInterval * 1000, false);

        this.m_updateTimer.on('tick', async () => {
            try {
                this.m_nodes = await fetchNodeList(this.config.nodeList);

                await this.m_db.saveNodes(this.nodes);

                this.emit('update', this.nodes);
            } catch (error) {
                this.emit('error', new Error('Could not update the public node list: ' + error.toString()));
            }
        });

        this.m_updateTimer.on('tick', async () => {
            const now = (new Date()).getTime();
            const historySeconds = this.config.historyDays * 24 * 60 * 60 * 1000;
            const cutoff = new Date(now - historySeconds);

            try {
                await this.m_db.cleanHistory(cutoff);

                this.emit('info', 'Cleaned old polling history before: ' + cutoff.toUTCString());
            } catch (error) {
                this.emit('error',
                    new Error('Could not clear old history from before ' + cutoff.toUTCString()) +
                    ': ' + error.toString());
            }
        });
    }

    /**
     * Retrieves the list of known nodes from memory
     */
    public get nodes (): Interfaces.NetworkNode[] {
        return this.m_nodes;
    }

    /**
     * Retrieves the current collector configuration
     */
    public get config (): Interfaces.CollectorConfig {
        return this.m_config;
    }

    public on(event: 'error', listener: (error: Error) => void): this;

    public on(event: 'info', listener: (notice: string) => void): this;

    public on(event: 'update', listener: (nodes: Interfaces.NetworkNode[]) => void): this;

    public on(event: 'polling', listener: (nodes: Interfaces.NodePollingEvent[]) => void): this;

    public on (event: any, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    /**
     * Starts the collector process
     */
    public async start () {
        await this.m_db.init();

        this.m_updateTimer.paused = false;

        this.once('update', () => {
            this.m_pollingTimer.paused = false;

            this.m_pollingTimer.tick();
        });

        this.m_updateTimer.tick();
    }

    /**
     * Stops the collector process
     */
    public async stop () {
        this.m_pollingTimer.destroy();

        this.m_updateTimer.destroy();
    }
}

/** @ignore */
async function fetchNodeInfo (
    node: Interfaces.NetworkNode,
    timestamp: Date
): Promise<Interfaces.NodePollingEvent> {
    const result: Interfaces.NodePollingEvent = {
        id: node.id,
        timestamp: timestamp,
        height: 0,
        feeAddress: '',
        feeAmount: BigInteger.zero,
        version: 'offline',
        synced: false,
        connectionsIn: 0,
        connectionsOut: 0,
        difficulty: 0,
        hashrate: 0,
        transactionPoolSize: 0
    };

    try {
        const daemon: ITurtleCoind = new TurtleCoind(node.hostname, node.port, 5000, node.ssl);

        const info = await daemon.info();

        if (info.version.major >= 1 && !info.isCacheApi) {
            result.connectionsIn = info.incomingConnections;
            result.connectionsOut = info.outgoingConnections;
            result.transactionPoolSize = info.transactionsPoolSize;
        } else {
            result.connectionsIn = (info as any).incoming_connections_count;
            result.connectionsOut = (info as any).outgoing_connections_count;
            result.transactionPoolSize = (info as any).tx_pool_size;
        }

        result.height = info.height;
        result.version = info.version.major + '.' + info.version.minor + '.' + info.version.patch;
        result.synced = info.synced;
        result.difficulty = info.difficulty;
        result.hashrate = info.hashrate;

        const feeInfo = await daemon.fee();

        result.feeAddress = feeInfo.address;
        result.feeAmount = feeInfo.amount;
    } catch {}

    return result;
}

/** @ignore */
interface IListEntry {
    name: string;
    url: string;
    port: number;
    ssl: boolean;
    cache: boolean;
}

/** @ignore */
async function fetchNodeList (nodeList: string): Promise<Interfaces.NetworkNode[]> {
    const response = await fetch(nodeList);

    const result = await response.json();

    const results: Interfaces.NetworkNode[] = [];

    for (const entry of (result.nodes as IListEntry[])) {
        results.push({
            id: generateNodeID(entry),
            name: entry.name.replace(/'/g, ''),
            hostname: entry.url,
            port: entry.port,
            ssl: entry.ssl,
            cache: entry.cache
        });
    }

    return results;
}

/** @ignore */
function generateNodeID (node: IListEntry): string {
    const sha256 = (message: string): string => {
        return createHmac('sha256', message).digest('hex');
    };

    return sha256(JSON.stringify({ hostname: node.url, port: node.port, ssl: (node.ssl) ? 1 : 0 }));
}

/** @ignore */
function mergeConfig (
    b: Interfaces.CollectorConfig,
    a?: Interfaces.ICollectorConfig
): Interfaces.CollectorConfig {
    if (a) {
        Object.keys(a)
            .forEach(key => {
                if (a[key]) {
                    b[key] = a[key];
                }
            });
    }

    return b;
}

/**
 * Retrieves the application configuration values from the environment variables
 * @ignore
 */
export function getAppParams (): Interfaces.CollectorConfig {
    return mergeConfig(DefaultConfig, {
        pollingInterval:
            (process.env.NODE_POLLING_INTERVAL) ? parseInt(process.env.NODE_POLLING_INTERVAL, 10) : undefined,
        updateInterval:
            (process.env.NODE_UPDATE_INTERVAL) ? parseInt(process.env.NODE_UPDATE_INTERVAL, 10) : undefined,
        historyDays:
            (process.env.NODE_HISTORY_DAYS) ? parseFloat(process.env.NODE_HISTORY_DAYS) : undefined,
        nodeList:
            (process.env.NODE_LIST_URL) ? process.env.NODE_LIST_URL : undefined
    });
}
