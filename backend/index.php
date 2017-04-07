<?php
require_once 'vendor/autoload.php';

ini_set('max_execution_time', 0);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

define('BASE_URL', '/backend');
define('APP_PATH', __DIR__);

$klein = new \Klein\Klein();

$klein->respond(function ($request, $response, $service, $app) use ($klein) {
    $app->register('config', function() use ($service) {
        return Config::getInstance();
    });

    $app->register('redis', function() use ($service) {
        return PredisWrapper::wrap();
    });

    $service->addValidator('in', function ($element, $array) {
        return in_array($element, $array);
    });

    $service->addValidator('eachIn', function ($elements, $array) {
        foreach ($elements as $element) {
            if (!in_array($element, $array)) {
                return false;
            }
        }
        return true;
    });

    $service->addValidator('fasta', function ($element) {
        return true;
    });

    $service->addValidator('uuid', function ($uuid) {
        $UUIDv4 = '/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i';
        return preg_match($UUIDv4, $uuid) === 1;
    });

    $klein->onHttpError(function ($code) use ($klein) {
        $klein->response()->body($code);

    });

    // $klein->onError(function ($response, $msg, $type, $err) {
    //     $response->json('test');

    // });

    $response->header('Access-Control-Allow-Origin', '*');
});

$klein->respond('GET', '/', function($request, $response, $service, $app) {
    $response->body("Hello World!");
});

$klein->respond('POST', '/ticket', function ($request, $response, $service, $app) {
    $service->validateParam('q')->fasta();
    $service->validateParam('database')->in(array("uc90", "uc30"));
    $service->validateParam('preset')->in(array("very-fast", "fast", "normal", "sensitive"));
    $service->validateParam('annotations')->eachIn(array("pfam", "pdb70", "eggnog"));

    $jobid = Uuid::generate();
    $params = [
        "database" => preg_replace("/[^0-9]/","", $request->database),
        "annotations" => $request->annotations,
        "preset" => $request->preset
    ];
    file_put_contents($app->config["jobdir"] . "/" . $jobid . ".json", json_encode($params));
    file_put_contents($app->config["jobdir"] . "/" . $jobid . ".fasta", $request->q);

    $app->redis->transaction()
        ->zadd('mmseqs:pending', 1, $jobid)
        ->set('mmseqs:status:' . $jobid, "{ status: 'PENDING' }")
        ->execute();

    $response->json($jobid);
});

$klein->respond('GET', '/ticket/[:ticket]', function ($request, $response, $service, $app) {
    $service->validateParam('ticket')->uuid();
    $json = $app->redis->get('mmseqs:status:' . $request->ticket);

    // $result = json_decode($json);

    $response->body($json);
});

$request = \Klein\Request::createFromGlobals();
$uri = $request->server()->get('REQUEST_URI');
$request->server()->set('REQUEST_URI', substr($uri, strlen(BASE_URL)));
$klein->dispatch($request);
