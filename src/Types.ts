// Copyright (c) 2019-2020, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.

import { BigInteger } from 'turtlecoin-utils/dist/Types';

export namespace Interfaces {
    /**
     * Represents a possible collector configuration
     */
    export interface ICollectorConfig {
        pollingInterval?: number;
        updateInterval?: number;
        historyDays?: number;
        nodeList?: string;

        [key: string]: any;
    }

    /** @ignore */
    export interface CollectorConfig extends ICollectorConfig {
        pollingInterval: number;
        updateInterval: number;
        historyDays: number;
        nodeList: string;
    }

    /**
     * Represents the base of a node/daemon polling event
     */
    interface INodePollingEvent {
        timestamp: Date;

        synced: boolean;

        feeAddress: string;

        feeAmount: BigInteger.BigInteger;

        height: number;

        version: string;

        connectionsIn: number;

        connectionsOut: number;

        difficulty: number;

        hashrate: number;

        transactionPoolSize: number;
    }

    /**
     * Represents a node/daemon polling event
     */
    export interface NodePollingEvent extends INodePollingEvent {
        id: string;
    }

    /**
     * Represents a node/daemon
     */
    export interface NetworkNode {
        id: string;

        name: string;

        hostname: string;

        port: number;

        ssl: boolean;

        cache: boolean;
    }

    /**
     * Represents the base status history of a node/daemon
     */
    interface IStatusHistory {
        synced: boolean;

        timestamp: Date;
    }

    /**
     * Represents the status history of a node/daemon
     */
    export interface NetworkNodeStatusHistory extends IStatusHistory {
        id: string;
    }

    /**
     * Represents node/daemon statistics
     */
    export interface NetworkNodeStats extends NetworkNode {
        availability: number;

        info: INodePollingEvent;

        history: IStatusHistory[];
    }
}
