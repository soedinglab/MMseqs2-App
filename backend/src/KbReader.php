<?php

class KbReader {
    public static function get($column, $isLegacy = false) {
        $db = Config::getInstance()['dbpath'] . '/uniprotkb_' . Config::getInstance()['release'] . '_' . $column;
        return ReaderRegistry::get($db, 1, $isLegacy);
    }
}
