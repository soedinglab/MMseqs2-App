<?php
namespace MMseqs;

class Lookup {
    static public function read($file, $limit, $page) {
        $handle = fopen($file, "r");
        if ($handle) {
            $i = 0;
            $start = ((int)$page) * $limit;
            $result = [];
            $hasNext = false;
            while (($line = fgets($handle)) !== false) {
                $current = $i++;
                if ($current < $start) {
                    continue;
                }
                if ($current >= ($start+$limit)) {
                    $hasNext = (fgets($handle) !== false);
                    break;
                }
                $values = explode("\t", $line);
                $result[] = [ "id" => ((int) $values[0] - 1), "name" => trim($values[1]) ]; 
            }
            fclose($handle);
            return [ "items" => $result, "hasNext" => $hasNext ];
        } else {
            throw new Exception("Could not read input.lookup!");
        } 
    }
}
