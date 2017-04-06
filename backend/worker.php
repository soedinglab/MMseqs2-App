<?php

require_once 'vendor/autoload.php';

ini_set('max_execution_time', 0);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

function processJob($redis) {
    $result = $redis->zpop('mmseqs:pending');
    if (count($result) == 0) {
        return;
    }

    $uuid = $result[0];
    try {
        $redis->set('mmseqs:status:' . $uuid, "{ status : 'RUNNING' }"); 

        $process = new Symfony\Component\Process\Process('false');
        $process->mustRun();

        $redis->set('mmseqs:status:' . $uuid, "{ status: 'COMPLETED' }");
    } catch (Exception $e) {
        $redis->set('mmseqs:status:' . $uuid, json_encode(["status" => "FAILED", "error" => $e->getMessage()]));
    }
}

$redis = PredisWrapper::wrap();
while(true) {
    processJob($redis);
    usleep(500);
}
