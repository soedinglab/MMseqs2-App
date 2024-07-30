// Author: Raheman Vaiya
// License: WTFPL
//
// A tiny zip generator in < 70 lines of javascript.
// Produces an uncompressed zip blob when fed an array
// of the form:
//
// [{name: 'filename', data: <Uint8Array>}]
//
// Useful for bookmarklets, don't use this in production :P. 
//
// Less than 2% the size of minified jszip (without all the bells and whistles).
//
// Refs:
//
// https://en.wikipedia.org/wiki/ZIP_(file_format)
// https://gist.github.com/rvaiya/9b39813d74ce3d5e1412e6b813a29c3b#file-zip-implementation-go

export default function zip(files) {
    // Generate the crc32 table instead of hardcoding it to avoid having a giant constant
    // in the minified output...
    const crc32_table = function() {
            const tbl = [];
            var c;
            for(var n = 0; n < 256; n++){
                    c = n;
                    for(var k =0; k < 8; k++){
                            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
                    }

                    tbl[n] = c;
            }

            return tbl;
    }();

    function crc32(arr) {
            var crc = -1;
            for(var i=0; i<arr.length; i++) {
                    crc = (crc >>> 8) ^ crc32_table[(crc ^ arr[i]) & 0xFF];
            }
            return (crc ^ (-1)) >>> 0;
    }

    function putUint32s(arr, offset, ...values) {
            const dv = new DataView(arr.buffer);
            values.forEach((v,i)=>dv.setUint32(offset+i*4, v, true));
    }

    function putUint16s(arr, offset, ...values) {
            const dv = new DataView(arr.buffer);
            values.forEach((v,i)=>dv.setUint16(offset+i*2, v, true));
    }


    const records = [];
    const te = new TextEncoder('utf8');

    var offset = 0;
    var cdSz = 0;

    files.forEach(file => {
            const fh = new Uint8Array(30+file.name.length);
            const fname = te.encode(file.name);
            const chksum = crc32(file.data);

            putUint32s(fh, 0, 0x04034b50);
            putUint32s(fh, 14, chksum, file.data.length, file.data.length);
            putUint16s(fh, 26, file.name.length);

            fh.set(fname, 30);

            file.header = fh;
            file.offset = offset;

            records.push(fh);
            records.push(file.data);

            //Create CD records pending flush at the end...
            file.cdr = new Uint8Array(46+file.name.length);

            putUint32s(file.cdr, 0, 0x02014b50);
            putUint32s(file.cdr, 16, chksum, file.data.length, file.data.length);
            putUint16s(file.cdr, 28, file.name.length);
            putUint32s(file.cdr, 42, offset);

            file.cdr.set(fname, 46);

            cdSz += file.cdr.length;
            offset += file.header.length + file.data.length;
    });

    //Push all accrued CD records..
    files.forEach(f=>records.push(f.cdr));
    
    //Add EOCD record...
    const eocd = new Uint8Array(22);

    putUint32s(eocd, 0, 0x06054b50);
    putUint16s(eocd, 8, files.length, files.length);
    putUint32s(eocd, 12, cdSz, offset);

    records.push(eocd);

    return new Blob(records, {type : 'application/zip'});
}