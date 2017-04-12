<?php
namespace MMseqs;

class AlignmentResult {
    public $query;
    public $target;
    public $seqId;
    public $alnLength;
    public $missmatches;
    public $gapsopened;
    public $qStartPos;
    public $qEndPos;
    public $dbStartPos;
    public $dbEndPos;
    public $eval;
    public $score;

    static function parseLine($line) {
        $values = explode("\t", $line);
        $aln = new AlignmentResult();
        $aln->query = $values[0];
        $aln->target = $values[1];
        $aln->seqId = $values[2];
        $aln->alnLength = $values[3];
        $aln->missmatches = $values[4];
        $aln->gapsopened = $values[5];
        $aln->qStartPos = $values[6];
        $aln->qEndPos = $values[7];
        $aln->dbStartPos = $values[8];
        $aln->dbEndPos = $values[9];
        $aln->eval = $values[10];
        $aln->score = $values[11];
        
        return $aln;
    }

    static function parseEntry($db, $entry) {
        if (!file_exists($db) || !file_exists($db . ".index")) {
            throw new \Exception("Alignment result was not found");
        }

        $result = array();
        $reader =  new \IntDBReader($db, $db . ".index", 1);
		$entry = trim($reader->getData($entry), "\n");

		$record = array();
		foreach(explode("\n", $entry) as $line) {
			$record[] = AlignmentResult::parseLine($line);
		}

        unset($reader);

        return $record;
    }

    static function parseDB($db) {
        if (!file_exists($db) || !file_exists($db . ".index")) {
            throw new \Exception("Alignment result was not found");
        }

        $result = array();
        $reader =  new \IntDBReader($db, $db . ".index", 1);
        for($i = 0; $i < $reader->getSize(); ++$i) {
            $entry = trim($reader->getData($i), "\n");
        
            $record = array();
            foreach(explode("\n", $entry) as $line) {
                $record[] = AlignmentResult::parseLine($line);
            }

            unset($reader);

            $result[] = array("key" => $reader->getDbKey($i), "data" => $record);
        }

        return $result;
    }
}
