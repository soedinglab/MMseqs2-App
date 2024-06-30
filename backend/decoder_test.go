package main

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func TestParseTSV(t *testing.T) {
	tsvData := "job	MGYP003416764702.pdb.gz	74.000	27	7	0	1	27	1	27	0.999	3.179E-01	96	28	38	YCESCGVEIGIRRLEARPTADLCIDCK	YCESCGEEIGLKRLEARPVTTLCIRCK	10.123,0.971,0.677,-11.251,-7.304,12.998	YCESCGEEIGLKRLEARPVTTLCIRCKEDQERVERDFG	9606	Homo sapiens\n" +
		"job	MGYP001608907542.pdb.gz	81.400	27	5	0	1	27	35	61	0.998	4.008E-01	93	28	73	YCESCGVEIGIRRLEARPTADLCIDCK	FCDSCGVEIGLKRLEARPTAPLCIDCK	21.560,5.233,-22.520,14.412,17.200,4.409	ETDIALELRNRDRERKLIKKIDETLGRIDGDEYGFCDSCGVEIGLKRLEARPTAPLCIDCKTLEEVREKQVAK	9606	Homo sapiens\n"

	reader := strings.NewReader(tsvData)

	entries := make([]FoldseekAlignmentEntry, 0)
	var aln FoldseekAlignmentEntry
	aln.MarshalFormat = MarshalDefault
	parser := NewTsvParser(reader, &aln)

	for {
		eof, err := parser.Next()
		if eof {
			break
		}
		if err != nil {
			t.Errorf("Failed to parse record: %s", err)
			return
		}
		entries = append(entries, aln)
	}

	expected := []FoldseekAlignmentEntry{
		{
			MarshalFormat: MarshalDefault,
			Query:         "job",
			Target:        "MGYP003416764702.pdb.gz",
			SeqId:         74.000,
			AlnLength:     27,
			Missmatches:   7,
			Gapsopened:    0,
			QueryStartPos: 1,
			QueryEndPos:   27,
			DbStartPos:    1,
			DbEndPos:      27,
			Prob:          0.999,
			Eval:          3.179e-01,
			Score:         96,
			QueryLength:   28,
			DbLength:      38,
			QueryAln:      "YCESCGVEIGIRRLEARPTADLCIDCK",
			DbAln:         "YCESCGEEIGLKRLEARPVTTLCIRCK",
			TargetCa:      "10.123,0.971,0.677,-11.251,-7.304,12.998",
			TargetSeq:     "YCESCGEEIGLKRLEARPVTTLCIRCKEDQERVERDFG",
			TaxonId:       "9606",
			TaxonName:     "Homo sapiens",
		},
		{
			MarshalFormat: MarshalDefault,
			Query:         "job",
			Target:        "MGYP001608907542.pdb.gz",
			SeqId:         81.400,
			AlnLength:     27,
			Missmatches:   5,
			Gapsopened:    0,
			QueryStartPos: 1,
			QueryEndPos:   27,
			DbStartPos:    35,
			DbEndPos:      61,
			Prob:          0.998,
			Eval:          4.008e-01,
			Score:         93,
			QueryLength:   28,
			DbLength:      73,
			QueryAln:      "YCESCGVEIGIRRLEARPTADLCIDCK",
			DbAln:         "FCDSCGVEIGLKRLEARPTAPLCIDCK",
			TargetCa:      "21.560,5.233,-22.520,14.412,17.200,4.409",
			TargetSeq:     "ETDIALELRNRDRERKLIKKIDETLGRIDGDEYGFCDSCGVEIGLKRLEARPTAPLCIDCKTLEEVREKQVAK",
			TaxonId:       "9606",
			TaxonName:     "Homo sapiens",
		},
	}

	if !reflect.DeepEqual(entries, expected) {
		t.Errorf("Parsed results do not match expected data. Got %+v, want %+v", aln, expected)
	}
}

func TestParseTSVMarshalTargetNumeric(t *testing.T) {
	tsvData := "job	MGYP003416764702.pdb.gz	74.000	27	7	0	1	27	1	27	0.999	3.179E-01	96	28	38	YCESCGVEIGIRRLEARPTADLCIDCK	YCESCGEEIGLKRLEARPVTTLCIRCK	0	0\n" +
		"job	MGYP001608907542.pdb.gz	81.400	27	5	0	1	27	35	61	0.998	4.008E-01	93	28	73	YCESCGVEIGIRRLEARPTADLCIDCK	FCDSCGVEIGLKRLEARPTAPLCIDCK	1	1\n"

	reader := strings.NewReader(tsvData)

	entries := make([]FoldseekAlignmentEntry, 0)
	var aln FoldseekAlignmentEntry
	aln.MarshalFormat = MarshalTargetNumeric
	parser := NewTsvParser(reader, &aln)

	for {
		eof, err := parser.Next()
		if eof {
			break
		}
		if err != nil {
			t.Errorf("Failed to parse record: %s", err)
			return
		}
		entries = append(entries, aln)
	}

	var builder strings.Builder
	_ = json.NewEncoder(&builder).Encode([]FoldseekAlignmentEntry(entries))
	output := builder.String()
	expected := `[{"query":"job","target":"MGYP003416764702.pdb.gz","seqId":74,"alnLength":27,"missmatches":7,"gapsopened":0,"qStartPos":1,"qEndPos":27,"dbStartPos":1,"dbEndPos":27,"prob":0.999,"eval":0.3179,"score":96,"qLen":28,"dbLen":38,"qAln":"YCESCGVEIGIRRLEARPTADLCIDCK","dbAln":"YCESCGEEIGLKRLEARPVTTLCIRCK","tCa":0,"tSeq":0},{"query":"job","target":"MGYP001608907542.pdb.gz","seqId":81.4,"alnLength":27,"missmatches":5,"gapsopened":0,"qStartPos":1,"qEndPos":27,"dbStartPos":35,"dbEndPos":61,"prob":0.998,"eval":0.4008,"score":93,"qLen":28,"dbLen":73,"qAln":"YCESCGVEIGIRRLEARPTADLCIDCK","dbAln":"FCDSCGVEIGLKRLEARPTAPLCIDCK","tCa":1,"tSeq":1}]` + "\n"
	if !reflect.DeepEqual(output, expected) {
		t.Errorf("Parsed results do not match expected data. Got %+v, want %+v", output, expected)
	}
}

func TestParseTSVMarshalTargetOnly(t *testing.T) {
	tsvData := "job	MGYP003416764702.pdb.gz	74.000	27	7	0	1	27	1	27	0.999	3.179E-01	96	28	38	YCESCGVEIGIRRLEARPTADLCIDCK	YCESCGEEIGLKRLEARPVTTLCIRCK	10.123,0.971,0.677,-11.251,-7.304,12.998	YCESCGEEIGLKRLEARPVTTLCIRCKEDQERVERDFG	9606	Homo sapiens\n" +
		"job	MGYP001608907542.pdb.gz	81.400	27	5	0	1	27	35	61	0.998	4.008E-01	93	28	73	YCESCGVEIGIRRLEARPTADLCIDCK	FCDSCGVEIGLKRLEARPTAPLCIDCK	21.560,5.233,-22.520,14.412,17.200,4.409	ETDIALELRNRDRERKLIKKIDETLGRIDGDEYGFCDSCGVEIGLKRLEARPTAPLCIDCKTLEEVREKQVAK	9606	Homo sapiens\n"

	reader := strings.NewReader(tsvData)

	entries := make([]FoldseekAlignmentEntry, 0)
	var aln FoldseekAlignmentEntry
	aln.MarshalFormat = MarshalTargetOnly
	parser := NewTsvParser(reader, &aln)

	for {
		eof, err := parser.Next()
		if eof {
			break
		}
		if err != nil {
			t.Errorf("Failed to parse record: %s", err)
			return
		}
		entries = append(entries, aln)
	}

	var builder strings.Builder
	_ = json.NewEncoder(&builder).Encode([]FoldseekAlignmentEntry(entries))
	output := builder.String()
	expected := `[{"tSeq":"YCESCGEEIGLKRLEARPVTTLCIRCKEDQERVERDFG","tCa":"10.123,0.971,0.677,-11.251,-7.304,12.998"},{"tSeq":"ETDIALELRNRDRERKLIKKIDETLGRIDGDEYGFCDSCGVEIGLKRLEARPTAPLCIDCKTLEEVREKQVAK","tCa":"21.560,5.233,-22.520,14.412,17.200,4.409"}]` + "\n"
	if !reflect.DeepEqual(output, expected) {
		t.Errorf("Parsed results do not match expected data. Got %+v, want %+v", output, expected)
	}
}
