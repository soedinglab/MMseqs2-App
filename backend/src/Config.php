<?php

class Config {
    private static $instance = null;

    public static function getInstance() {
        if (static::$instance === null) {
            static::$instance = json_decode(file_get_contents(APP_PATH . '/mmseqs-web.json'), true);
        }

        return static::$instance;
    }

    protected function __construct() {}
    private function __clone() {}
    private function __wakeup() {}
}