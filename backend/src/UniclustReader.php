<?php

class UniclustReader {
    public static function get($type, $name = '', $isLegacy = false, $typo = 0) {
        $db = Config::getInstance()['dbpath'] . '/' . $type . '_' . Config::getInstance()['release'];
        if($name != '') {
            $db .= '_' . $name;
        }
        return ReaderRegistry::get($db, $type, $isLegacy);
    }
}