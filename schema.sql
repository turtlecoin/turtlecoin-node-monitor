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
