#!/home/mpg05/mmirdit/.linuxbrew/bin/gawk -f
function writeEntry() {
    printf "%s\0", data >> outfile;
    size=length(data)+1;
    data="";

    print id"\t"offset"\t"size >> outindex;
    offset=offset+size;
    id=id+1;
}

BEGIN {
    current="";
    data="";
    offset=0;
    id=1;

    if (length(outfile) == 0) {
        outfile="output";
    }
    outindex=outfile".index";

    printf("") > outfile;
    printf("") > outindex;
}

/^#/ && NR == 1 {
    current=substr($1,2)
    next
}

/^#/ && NR > 1 {
    current=substr($1,2)
    writeEntry()
    entry = 0
    next
}

/^>ss_/ {
    inss = 1
    next
}

inss == 1 {
    inss = 0
    next
}

/^>/ && entry == 0 {
    data=data">"current"\n"
    entry = entry + 1
    next
}

entry > 0 {
    data=data""$0"\n"
    entry = entry + 1
    next
}

END {
    writeEntry()
    entry = 0
    close(outfile);
    close(outfile".index");

    #system("ffindex_build -as "outfile" "outindex);
}
