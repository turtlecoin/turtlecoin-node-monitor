// Copyright (c) 2019-2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

import { Interfaces } from './Types';
import { IDatabase, Interfaces as DBInterfaces, prepareCreateTable } from 'db-abstraction';
import { BigInteger } from 'turtlecoin-utils/dist/Types';

/** @ignore */
import FKAction = DBInterfaces.FKAction;

/** @ignore */
import IValueArray = DBInterfaces.IValueArray;

/**
 * An interface for interacting with the node monitor database
 */
export class NodeMonitorDB {
    private readonly m_db: IDatabase;

    /**
     * Constructs a new instance
     * @param database the underlying database interface to interact with
     */
    constructor (database: IDatabase) {
        this.m_db = database;
    }

    /**
     * Initializes the database schema if required
     */
    public async init (): Promise<void> {
        const stmts: DBInterfaces.IBulkQuery[] = [];

        let create: { table: string, indexes: string[]};

        const addQuery = () => {
            stmts.push({ query: create.table });

            create.indexes.map(index => stmts.push({ query: index }));
        };

        create = prepareCreateTable(this.m_db.type, 'nodes', [
            { name: 'id', type: this.m_db.hashType },
            { name: 'name', type: this.m_db.blobType },
            { name: 'hostname', type: this.m_db.blobType },
            { name: 'port', type: this.m_db.uint32Type, default: 11898 },
            { name: 'ssl', type: this.m_db.uint32Type },
            { name: 'cache', type: this.m_db.uint32Type }
        ], ['id'], this.m_db.tableOptions);

        addQuery();

        create = prepareCreateTable(this.m_db.type, 'node_polling', [
            {
                name: 'id',
                type: this.m_db.hashType,
                foreign: {
                    table: 'nodes',
                    column: 'id',
                    delete: FKAction.CASCADE,
                    update: FKAction.CASCADE
                }
            },
            { name: 'utcTimestamp', type: this.m_db.uint64Type },
            { name: 'status', type: this.m_db.uint32Type, default: 0 },
            { name: 'feeAddress', type: this.m_db.blobType },
            { name: 'feeAmount', type: this.m_db.uint64Type, default: 0 },
            { name: 'height', type: this.m_db.uint32Type, default: 0 },
            { name: 'version', type: this.m_db.blobType },
            { name: 'connectionsIn', type: this.m_db.uint32Type, default: 0 },
            { name: 'connectionsOut', type: this.m_db.uint32Type, default: 0 },
            { name: 'difficulty', type: this.m_db.uint32Type, default: 0 },
            { name: 'hashrate', type: this.m_db.uint32Type, default: 0 },
            { name: 'transactionPoolSize', type: this.m_db.uint32Type, default: 0 }
        ], ['id', 'utcTimestamp'], this.m_db.tableOptions);

        addQuery();

        return this.m_db.transaction(stmts);
    }

    /**
     * Cleans any node polling history before the specified date
     * @param before the date to clean data until
     */
    public async cleanHistory (before: Date): Promise<void> {
        await this.m_db.query('DELETE FROM node_polling WHERE utcTimestamp < ?', [before.getTime()]);
    }

    /**
     * Returns all of the saved nodes in the database
     */
    public async nodes (): Promise<Interfaces.NetworkNode[]> {
        const [, rows] = await this.m_db.query(
            'SELECT * FROM nodes ORDER BY name');

        return rows.map(row => {
            return {
                id: row.id,
                name: row.name,
                hostname: row.hostname,
                port: row.port,
                ssl: (row.ssl === 1),
                cache: (row.cache === 1)
            };
        });
    }

    /**
     * Saves a list of nodes to the database
     * @param nodes the list of network nodes from the JSON provided list
     */
    public async saveNodes (nodes: Interfaces.NetworkNode[]): Promise<void> {
        if (nodes.length === 0) {
            return;
        }

        let l_nodes: IValueArray = [];

        for (const node of nodes) {
            l_nodes.push([node.id, node.name, node.hostname, node.port, (node.ssl) ? 1 : 0, (node.cache) ? 1 : 0]);
        }

        const stmts: DBInterfaces.IBulkQuery[] = [];

        while (l_nodes.length > 0) {
            const records = l_nodes.slice(0, 25);

            l_nodes = l_nodes.slice(25);

            const stmt = this.m_db.prepareMultiUpdate(
                'nodes', ['id'], ['name', 'hostname', 'port', 'ssl', 'cache'], records);

            stmts.push({ query: stmt });
        }

        return this.m_db.transaction(stmts);
    }

    /**
     * Saves the result of polling events of nodes to the database
     * @param events the list of polling events
     */
    public async savePollingEvent (events: Interfaces.NodePollingEvent[]): Promise<void> {
        if (events.length === 0) {
            return;
        }

        const stmts: DBInterfaces.IBulkQuery[] = [];

        let l_events: IValueArray = [];

        for (const event of events) {
            l_events.push([
                event.id, event.timestamp.getTime(), (event.synced) ? 1 : 0, event.feeAddress,
                event.feeAddress.toString(), event.height, event.version, event.connectionsIn,
                event.connectionsOut, event.difficulty, event.hashrate, event.transactionPoolSize]);
        }

        while (l_events.length > 0) {
            const records = l_events.slice(0, 25);

            l_events = l_events.slice(25);

            const stmt = this.m_db.prepareMultiInsert('node_polling',
                ['id', 'utctimestamp', 'status', 'feeAddress', 'feeAmount',
                    'height', 'version', 'connectionsIn', 'connectionsOut', 'difficulty',
                    'hashrate', 'transactionPoolSize'], records);

            stmts.push({ query: stmt });
        }

        return this.m_db.transaction(stmts);
    }

    /**
     * Retrieves the maximum polling timestamp from the database
     */
    public async maxTimestamp (): Promise<Date> {
        const [count, rows] = await this.m_db.query(
            'SELECT MAX(utctimestamp) AS utctimestamp FROM node_polling');

        if (count !== 1) {
            return new Date();
        }

        return new Date(rows[0].utctimestamp);
    }

    /**
     * Calculates and returns the node availabilities over the last 20 polling cycles
     */
    public async nodeAvailabilities (): Promise<{id: string, availability: number}[]> {
        const [, rows] = await this.m_db.query(
            'SELECT id, ((SUM(status) / COUNT(*)) * 100) AS availability ' +
            'FROM (SELECT utctimestamp FROM node_polling GROUP BY utctimestamp ' +
            'ORDER BY utctimestamp DESC LIMIT 20) AS last ' +
            'LEFT JOIN node_polling ON node_polling.utctimestamp = last.utctimestamp GROUP BY id');

        return rows.map(row => {
            return {
                id: row.id,
                availability: row.availability
            };
        });
    }

    /**
     * Provides a brief history of the node availability over the last 20 polling cycles
     */
    public async nodeHistory (): Promise<Interfaces.NetworkNodeStatusHistory[]> {
        const [, rows] = await this.m_db.query(
            'SELECT id, status, node_polling.utctimestamp AS utctimestamp  ' +
            'FROM (SELECT utctimestamp FROM node_polling GROUP BY utctimestamp ' +
            'ORDER BY utctimestamp DESC LIMIT 20) AS last ' +
            'LEFT JOIN node_polling ON node_polling.utctimestamp = last.utctimestamp ' +
            'ORDER BY id ASC, utctimestamp DESC');

        return rows.map(row => {
            return {
                id: row.id,
                synced: (row.status === 1),
                timestamp: new Date(row.utctimestamp)
            };
        });
    }

    /**
     * Retrieves all of the node polling events for the give timestamp
     * @param timestamp the timestamp to select
     */
    public async events (timestamp: Date): Promise<Interfaces.NodePollingEvent[]> {
        const [, rows] = await this.m_db.query(
            'SELECT * FROM node_polling WHERE utctimestamp = ?', [timestamp.getTime()]);

        return rows.map(row => {
            return {
                id: row.id,
                timestamp: new Date(row.utctimestamp || row.utcTimestamp),
                synced: (row.status === 1),
                feeAddress: row.feeaddress || row.feeAddress || '',
                feeAmount: (row.feeamount || row.feeAmount) ? BigInteger(row.feeamount || row.feeAmount) : BigInteger.zero,
                height: row.height,
                version: row.version,
                connectionsIn: row.connectionsin || row.connectionsIn,
                connectionsOut: row.connectionsout || row.connectionsOut,
                difficulty: row.difficulty,
                hashrate: row.hashrate,
                transactionPoolSize: row.transactionpoolsize || row.transactionPoolSize
            };
        });
    }

    /**
     * Retrieves the node/daemon statistics including its availability percentage and the last 20 histories for
     * the node for all nodes in the database
     */
    public async stats (): Promise<Interfaces.NetworkNodeStats[]> {
        function fetch<T> (array: T[], id: string): T {
            const result = array.filter(value => (value as any).id === id);

            if (result.length === 1) {
                return result[0];
            }

            throw new ReferenceError('Unknown value');
        }

        const results: Interfaces.NetworkNodeStats[] = [];

        const nodes = await this.nodes();

        const availabilities = await this.nodeAvailabilities();

        const maxTimestamp = await this.maxTimestamp();

        const last_events = await this.events(maxTimestamp);

        const histories = await this.nodeHistory();

        for (const node of nodes) {
            try {
                const avail = fetch<{id: string, availability: number}>(availabilities, node.id);

                const last = fetch<Interfaces.NodePollingEvent>(last_events, node.id);

                const history = histories.filter(history => history.id === node.id);

                results.push({
                    id: node.id,
                    name: node.name,
                    hostname: node.hostname,
                    port: node.port,
                    ssl: node.ssl,
                    cache: node.cache,
                    availability: avail.availability,
                    info: last,
                    history: history
                });
            } catch {}
        }

        return results;
    }
}
