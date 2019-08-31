CREATE TABLE IF NOT EXISTS `nodes` (
  `id` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `hostname` varchar(255) NOT NULL,
  `port` int(11) NOT NULL DEFAULT 11898,
  `ssl` int(11) NOT NULL DEFAULT 0,
  `cache` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `ssl` (`ssl`),
  KEY `cache` (`cache`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `node_polling` (
  `id` varchar(64) NOT NULL,
  `timestamp` bigint(1) unsigned NOT NULL,
  `status` int(11) NOT NULL DEFAULT 0,
  `feeAddress` varchar(255) DEFAULT NULL,
  `feeAmount` bigint(20) NOT NULL DEFAULT 0,
  `height` bigint(20) NOT NULL DEFAULT 0,
  `version` varchar(20) NOT NULL DEFAULT '0.0.0',
  `connectionsIn` int(11) NOT NULL DEFAULT 0,
  `connectionsOut` int(11) NOT NULL DEFAULT 0,
  `difficulty` bigint(20) NOT NULL DEFAULT 0,
  `hashrate` bigint(20) NOT NULL DEFAULT 0,
  `txPoolSize` bigint(20) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`,`timestamp`),
  KEY `status` (`status`),
  KEY `feeAmount` (`feeAmount`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 ROW_FORMAT=COMPRESSED;

