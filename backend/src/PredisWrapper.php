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
        $client = new Predis\Client();
        $client->getProfile()->defineCommand('zpop', 'SortedSetPop');
        return $client;
    }
}