<?php
namespace MMSeqs;

class AlignmentResult {
    public $dbKey;
    public $score;
    public $seqId;
    public $eval;
    public $alnLength;
    public $qStartPos;
    public $qEndPos;
    public $qLen;
    public $dbStartPos;
    public $dbEndPos;

    static function parseLine($line) {
        $values = explode("\t", $line);
        $aln = new AlignmentResult();
        $aln->dbKey = $values[0];
        $aln->score = $values[1];
        $aln->seqId = $values[2];
        $aln->eval = $values[3];
        $aln->alnLength = $values[4];
        $aln->qStartPos = $values[5];
        $aln->qEndPos = $values[6];
        $aln->qLen = $values[7];
        $aln->dbStartPos = $values[8];
        $aln->dbEndPos = $values[9];
        return $aln;
    }

    static function parseDB($db) {
        if (!file_exists($db) || !file_exists($workdir . ".index")) {
            throw new Exception("Alignment result was not found");
        }

        $result = array();
        $reader =  new IntDBReader($db, $db . ".index", 1);
        for($i = 0; $i < $reader->getSize(); ++$i) {
            $entry = trim($reader->getData($i), "\n");
        
            $record = array();
            foreach(explode("\n", $entry) as $line) {
                $record[] = AlignmentResult::parse($line);
            }

            $result[] = array("key" => $reader->getDbKey($i), "data" => $record);
        }

        return $result;
    }
}