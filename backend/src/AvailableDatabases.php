<?php

class AvailableDatabases {
    private static $instance = null;

    public static function getInstance() {
        if (static::$instance === null) {
            static::$instance = apcu_entry('mmseqs-web-databases', function () {
                return self::getDatabases();
            }, 120);
        }

        return static::$instance;
    }

    private static function getDatabases() {
        $config = Config::getInstance();
        $base = $config["databases"];
        $result = [];
        foreach(glob($base . '/*.params', GLOB_MARK | GLOB_NOSORT) as $filename) {
            if (preg_match('/' . preg_quote($base . '/', '/') . '(.+)\.params/', $filename, $match) === 1) {
                $fullpath = $base . '/' . $match[1] . '.params';
                $result[] = [ "db" => $match[1], "params" => json_decode(file_get_contents($fullpath), true)["display"] ];
            }
        }
        usort($result, function($o1, $o2) {
            $a = (int) $o1["params"]["order"];
            $b = (int) $o2["params"]["order"];
            if ($a == $b) {
                return 0;
            }
            return ($a < $b) ? -1 : 1;
        });

        return $result;
    } 

    protected function __construct() {}
    private function __clone() {}
    private function __wakeup() {}
}
