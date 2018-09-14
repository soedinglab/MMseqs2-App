function writeEntry() {
    printf "%s\0", data >> outfile;
    size=length(data)+1;
    data="";

    print id"\t"offset"\t"size >> outindex;
    offset=offset+size;
}

BEGIN {
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

/^>ss_/ {
    inss = 1
    entry = 0
    next
}

inss == 1 {
    inss = 0
    next
}

/^>/ && entry == 0 {
    if (id > 1) {
        writeEntry()
    }
    id=id+1;

    data=">"substr($1, 2)"\n"
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
    close(outfile);
    close(outfile".index");
}
