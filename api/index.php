<?php

ini_set('max_execution_time', 0);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../vendor/autoload.php';

define('BASE_URL', '/mmseqs/api');
define('APP_PATH', __DIR__ . '/../api/');
set_include_path(APP_PATH . PATH_SEPARATOR . get_include_path());

require_once 'lib/mmseqs-web.php';

$klein = new \Klein\Klein();

$klein->respond(function ($request, $response, $service, $app) use ($klein) {
    $service->config = Config::getInstance();

    $app->register('db', function() use ($service) {
        return new PDO($service->config['pdoDSN']);
    });

    $service->addValidator('in', function ($element, $array) {
        return in_array($element, $array);
    });

    $service->addValidator('fasta', function ($element) {
        return true;
    });

    $klein->onError(function ($this, $msg, $type, $err) {
        if($err instanceof \Klein\Exceptions\ValidationException) {
            // TODO: handle
        }
    });

    $response->header('Access-Control-Allow-Origin', '*');
});

$klein->respond('POST', '/ticket', function ($request, $response, $service, $app) {
    $service->validateParam('q')->fasta();
    $service->validateParam('database')->in(array("uc90", "uc50", "uc30"));
    $service->validateParam('preset')->in(array("very-fast", "fast", "normal", "sensitive"));

    $params = json_encode(array("query" => $request->q, "database" => $request->database, "preset" => $request->preset));
    $statement = $app->db->prepare("INSERT INTO tickets (class, parameters) VALUES ('search', :params) RETURNING uuid;");
    $statement->bindParam(':params', $params);
    $statement->execute();
    $result = $statement->fetch(PDO::FETCH_ASSOC);

    $response->json($result["uuid"]);
});

$klein->respond('GET', '/ticket/[:ticket]', function ($request, $response, $service, $app) {
    $service->validateParam('ticket')->notNull();

    $statement = $app->db->prepare("SELECT * FROM tickets WHERE uuid = :ticket;");
    $ticket = $request->ticket;
    $statement->bindParam(':ticket', $ticket);
    $statement->execute();
    $response->json($statement->fetch(PDO::FETCH_ASSOC));
});

$request = \Klein\Request::createFromGlobals();
$uri = $request->server()->get('REQUEST_URI');
$request->server()->set('REQUEST_URI', substr($uri, strlen(BASE_URL)));
$klein->dispatch($request);
