<?php

class ReaderRegistry {
	private static $readers = array();

	public static function get($name, $type = 0,  $isLegacy = false) {
		if(!isset($readers[$name])) {
            if(!$isLegacy) {
                $dataFile = $name;
                $indexFile = $name . '.index';
            } else {
                $dataFile = $name . '.ffdata';
                $indexFile = $name . '.ffindex';
            }

            if ($type == 0) {
                $readers[$name.$type] = new IntDBReader($dataFile, $indexFile, 1);
            } else if ($type == 1) {
                $readers[$name.$type] = new StringDBReader($dataFile, $indexFile, 1);
            } else {
                throw new Exception("Invalid Reader Type!", 1);
            }
        }

		return $readers[$name.$type];
	}
}