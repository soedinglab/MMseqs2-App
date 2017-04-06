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
    $service->config = Config::getInstance();

    $app->register('redis', function() use ($service) {
        return PredisWrapper::wrap();
    });

    $service->addValidator('in', function ($element, $array) {
        return in_array($element, $array);
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
    $service->validateParam('database')->in(array("uc90", "uc50", "uc30"));
    $service->validateParam('preset')->in(array("very-fast", "fast", "normal", "sensitive"));

    $jobid = Uuid::generate();
    $app->redis->zadd('mmseqs:pending', 1, $jobid);
    $app->redis->set('mmseqs:status:' . $jobid, "{ status: 'PENDING' }");
    
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
