<?php
require_once APP_PATH . '../vendor/autoload.php';

class Config {
    private static $instance = null;

    public static function getInstance() {
        if (static::$instance === null) {
            static::$instance = json_decode(file_get_contents(APP_PATH . 'mmseqs-web.json'), true);
        }

        return static::$instance;
    }

    protected function __construct() {}
    private function __clone() {}
    private function __wakeup() {}
}

class DB {
    private static $instance = null;

    public static function getInstance() {
        if (static::$instance === null) {
            $config = Config::getInstance();
            static::$instance = new PDO($config['pdoDSN']);
        }

        return static::$instance;
    }

    protected function __construct() {}
    private function __clone() {}
    private function __wakeup() {}
}

class ReaderRegistry {
	private static $readers = array();

	public static function get($name, $type = 0,  $isLegacy = false) {
		if(!isset($readers[$name])) {
            if(!$isLegacy) {
                $dataFile = $name;
                $indexFile = $name . '.index';
            } else {
                $dataFile = $name . '.ffdata';
                $indexFile = $name . '.ffindex';
            }

            if ($type == 0) {
                $readers[$name.$type] = new IntDBReader($dataFile, $indexFile, 1);
            } else if ($type == 1) {
                $readers[$name.$type] = new StringDBReader($dataFile, $indexFile, 1);
            } else {
                throw new Exception("Invalid Reader Type!", 1);
            }
        }

		return $readers[$name.$type];
	}
}

class UniclustReader {
    public static function get($type, $name = '', $isLegacy = false, $typo = 0) {
        $db = Config::getInstance()['dbpath'] . '/' . $type . '_' . Config::getInstance()['release'];
        if($name != '') {
            $db .= '_' . $name;
        }
        return ReaderRegistry::get($db, $type, $isLegacy);
    }
}

class KbReader {
    public static function get($column, $isLegacy = false) {
        $db = Config::getInstance()['dbpath'] . '/uniprotkb_' . Config::getInstance()['release'] . '_' . $column;
        return ReaderRegistry::get($db, 1, $isLegacy);
    }
}

function execute_external_command($command, $in) {
    $spec = array(
        0 => array("pipe", "r"),
        1 => array("pipe", "w")
    );

    $process = proc_open($command, $spec, $pipes);
    if (is_resource($process)) {
        fwrite($pipes[0], $in);
        fclose($pipes[0]);

        $result = stream_get_contents($pipes[1]);
        fclose($pipes[1]);

        $status = proc_close($process);
        return $result;
    }

    return "";
}
