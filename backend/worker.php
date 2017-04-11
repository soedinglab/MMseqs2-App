<?php

require_once 'vendor/autoload.php';

ini_set('max_execution_time', 0);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

define('APP_PATH', __DIR__);

function processJob($redis, $config) {
    $result = $redis->zpop('mmseqs:pending');
    if (count($result) == 0) {
        return;
    }

    $uuid = $result[0];
    try {
        $redis->set('mmseqs:status:' . $uuid, '{ "status" : "RUNNING" }');

        $basedir = $config["workbase"] . "/" . $uuid;
        $params = json_decode(file_get_contents($basedir . ".json"), true);
        $command = '"' . $config["search-pipeline"]
            . '" "' . $uuid
            . '" "' . $basedir . '.fasta'
            . '" "' . $params['database'] . '"';

        $process = new Symfony\Component\Process\Process($command);
        $process->mustRun();

        $redis->set('mmseqs:status:' . $uuid, '{ "status" : "COMPLETED" }');
    } catch (Exception $e) {
        $redis->set('mmseqs:status:' . $uuid, json_encode(["status" => "FAILED", "error" => $e->getMessage()]));
    }
}

$redis = PredisWrapper::wrap();
$config = Config::getInstance();
while(true) {
    processJob($redis, $config);
    usleep(500);
}
