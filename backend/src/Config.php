<?php

class Config {
    private static $instance = null;

    public static function getInstance() {
        if (static::$instance === null) {
            // if (!file_exists(APP_PATH . '/config-cache.json')) {
            //     $process = new Symfony\Component\Process\Process(APP_PATH . "/../export_paths.sh");
            //     $process->mustRun();
            //     $json = $process->getOutput();
            //     file_put_contents(APP_PATH . '/config-cache.json', $json);
            //     static::$instance = json_decode($json, true);
            // } else {
                static::$instance = json_decode(file_get_contents(APP_PATH . '/config-cache.json'), true);
            // }
        }

        return static::$instance;
    }

    protected function __construct() {}
    private function __clone() {}
    private function __wakeup() {}
}
