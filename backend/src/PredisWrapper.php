<?php

class SortedSetPop extends Predis\Command\ScriptCommand
{
    public function getKeysCount()
    {
        return 1;
    }

    public function getScript()
    {
        return <<<LUA
local result = redis.call('zrange', KEYS[1], -1, -1, "WITHSCORES")
if result then redis.call('zremrangebyrank', KEYS[1], -1, -1) end
return result
LUA;
    }
}

class PredisWrapper {
    public static function wrap() {
        $config = Config::getInstance();  
        $redis = [];
        if (isset($config['redis-scheme'])) {
            $redis['scheme'] = $config['redis-scheme'];
        }
        if (isset($config['redis-host'])) {
            $redis['host'] = $config['redis-host'];
        }
        if (isset($config['redis-port'])) {
            $redis['port'] = $config['redis-port'];
        }
        if (isset($config['redis-database'])) {
            $redis['database'] = $config['redis-database'];
        }

        $client = new Predis\Client($redis);
        $client->getProfile()->defineCommand('zpop', 'SortedSetPop');
        return $client;
    }
}
