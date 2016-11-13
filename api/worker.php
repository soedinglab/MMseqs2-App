<?php

ini_set('max_execution_time', 0);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../vendor/autoload.php';
define('APP_PATH', __DIR__ . '/../api/');
set_include_path(APP_PATH . PATH_SEPARATOR . get_include_path());

require_once 'lib/uniclust.php';

function getJobTicket() {
    $statement = DB::getInstance()->prepare(
    "UPDATE tickets SET status = 'RUNNING'
    WHERE uuid IN (
            SELECT uuid FROM tickets
            WHERE
                STATUS = 'WAITING'
            ORDER BY 
                priority DESC, created ASC
            LIMIT 1 FOR UPDATE)
    RETURNING *;");
    $statement->execute();
    return $statement->fetch(PDO::FETCH_ASSOC);
}

function setJobStatus($uuid, $status, $result) {
    $statement = DB::getInstance()->prepare("UPDATE tickets SET status = :status, result = :result WHERE uuid = :uuid");
    $statement->bindParam(':uuid', $uuid);
    $s = $status;
    $statement->bindParam(':status', $s);
    $r = $result;
    $statement->bindParam(':result', $r);
    $statement->execute();
}

abstract class Job {
    protected $uuid = NULL;
    protected $params = NULL;

    function __construct($uuid, $params) {
        $this->uuid = $uuid;
        $this->params = json_decode($params, true);
    }

    function execute() {
        return $this->perform();
    }

    abstract public function perform();
}

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

    static function parse($line) {
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
}

class Search extends Job {
    protected $databases = array(
        "uc90" => "/Users/mirdita/tmp/uniprot_db",
        "uc50" => "/Users/mirdita/tmp/uniprot_db",
        "uc90" => "/Users/mirdita/tmp/uniprot_db"
    );

    protected $presets = array(
        "very-fast" => "--k-score 145",
        "fast" => "--k-score 115",
        "normal" => "--k-score 95",
        "sensitive" => "--k-score 85"
    );

    function perform() {
        $config = Config::getInstance();
        $workdir = $config["tmp"] + "/" + $this->uuid;
        if (is_dir($workdir) || is_file($workdir) || is_link($workdir)) {
            throw new Exception("Work directory exists already");
        }

        if (mkdir($workdir . "/tmp", 0700, true) === FALSE) {
            throw new Exception("Work directory could not be created");
        }

        if (file_put_contents("{$workdir}/query.fasta", $this->params["query"]) === FALSE) {
            throw new Exception("Could not write query to disk");
        }

        if (system("mmseqs createdb {$workdir}/query.fasta {$workdir}/querydb") === FALSE) {
            throw new Exception("Could not create mmseqs database");
        }

        $database = $this->databases[$his->params["database"]];
        $preset = $this->presets[$his->params["preset"]];
        if (system("mmseqs search {$workdir}/querydb {$database} {$workdir}/aln_result {$workdir}/tmp {$preset}") === FALSE) {
            throw new Exception("Search failed");
        }
        
        if (!file_exists("{$workdir}/aln_result") || !file_exists("{$workdir}/aln_result.index")) {
            throw new Exception("Alignment result was not found");
        }

        $result = array();
        $reader =  new IntDBReader("{$workdir}/aln_result","{$workdir}/aln_result.index", 1);
        for($i = 0; $i < $reader->getSize(); ++$i) {
            $entry = trim($reader->getData($i), "\n");
        
            $record = array();
            foreach(explode("\n", $entry) as $line) {
                $record[] = AlignmentResult::parse($line);
            }

            $result[] = array("key" => $reader->getDbKey($i), "data" => $record);
        }

        return json_encode($result);
    }
}

function processJob() {
    $job = getJobTicket();
    if($job === FALSE)
        return;

    $uuid = $job["uuid"];
    try {
        $class = $job["class"];
        setJobStatus($uuid, "RUNNING", "");
        $task = new $class($uuid, $job["parameters"]);
        $result = $task->execute();
        setJobStatus($uuid, "COMPLETED", (string) $result);
    } catch (Exception $e) {
        setJobStatus($uuid, "FAILED", (string) $e);
    }
}

while(true) {
    sleep(2);
    processJob();
}