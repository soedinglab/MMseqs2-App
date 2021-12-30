/**
 * Adapted from https://github.com/smhg/gettext-parser
 * 
 * Copyright (c) 2014-2015 Andris Reinman
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

// see https://www.gnu.org/software/gettext/manual/html_node/Header-Entry.html
const HEADERS = new Map([
    ['project-id-version', 'Project-Id-Version'],
    ['report-msgid-bugs-to', 'Report-Msgid-Bugs-To'],
    ['pot-creation-date', 'POT-Creation-Date'],
    ['po-revision-date', 'PO-Revision-Date'],
    ['last-translator', 'Last-Translator'],
    ['language-team', 'Language-Team'],
    ['language', 'Language'],
    ['content-type', 'Content-Type'],
    ['content-transfer-encoding', 'Content-Transfer-Encoding'],
    ['plural-forms', 'Plural-Forms']
]);

/**
 * State constants for parsing FSM
 */
const STATES = {
    none: 0x01,
    comments: 0x02,
    key: 0x03,
    string: 0x04
};

/**
 * Value types for lexer
 */
const TYPES = {
    comments: 0x01,
    key: 0x02,
    string: 0x03
};

/**
 * String matches for lexer
 */
const SYMBOLS = {
    quotes: /["']/,
    comments: /#/,
    whitespace: /\s/,
    key: /[\w\-[\]]/,
    keyNames: /^(?:msgctxt|msgid(?:_plural)?|msgstr(?:\[\d+])?)$/
};

function parseHeader(str = '') {
    return str.split('\n')
        .reduce((headers, line) => {
            const parts = line.split(':');
            let key = (parts.shift() || '').trim();

            if (key) {
                const value = parts.join(':').trim();

                key = HEADERS.get(key.toLowerCase()) || key;

                headers[key] = value;
            }

            return headers;
        }, {});
}

function joinStringValues(tokens) {
    const response = [];
    let lastNode;

    for (let i = 0, len = tokens.length; i < len; i++) {
        if (lastNode && tokens[i].type === TYPES.string && lastNode.type === TYPES.string) {
            lastNode.value += tokens[i].value;
        } else if (lastNode && tokens[i].type === TYPES.comments && lastNode.type === TYPES.comments) {
            lastNode.value += '\n' + tokens[i].value;
        } else {
            response.push(tokens[i]);
            lastNode = tokens[i];
        }
    }

    return response;
}

function normalize(tokens) {
    const table = {
        headers: undefined,
        translations: {}
    };
    // let msgctxt;

    for (let i = 0, len = tokens.length; i < len; i++) {
        // msgctxt = tokens[i].msgctxt || '';

        // if (!table.translations[msgctxt]) {
        //     table.translations[msgctxt] = {};
        // }

        if (!table.headers /* && !msgctxt */ && !tokens[i].msgid) {
            table.headers = parseHeader(tokens[i].msgstr[0]);
            continue;
        }
        table.translations/*[msgctxt]*/[tokens[i].msgid] = tokens[i].msgstr[0];
    }

    return table;
}

function parseComments(tokens) {
    // parse comments
    tokens.forEach(node => {
        let comment;
        let lines;

        if (node && node.type === TYPES.comments) {
            comment = {
                translator: [],
                extracted: [],
                reference: [],
                flag: [],
                previous: []
            };

            lines = (node.value || '').split(/\n/);

            lines.forEach(line => {
                switch (line.charAt(0) || '') {
                    case ':':
                        comment.reference.push(line.substr(1).trim());
                        break;
                    case '.':
                        comment.extracted.push(line.substr(1).replace(/^\s+/, ''));
                        break;
                    case ',':
                        comment.flag.push(line.substr(1).replace(/^\s+/, ''));
                        break;
                    case '|':
                        comment.previous.push(line.substr(1).replace(/^\s+/, ''));
                        break;
                    default:
                        comment.translator.push(line.replace(/^\s+/, ''));
                }
            });

            node.value = {};

            Object.keys(comment).forEach(key => {
                if (comment[key] && comment[key].length) {
                    node.value[key] = comment[key].join('\n');
                }
            });
        }
    });
};

function handleKeys(tokens) {
    const response = [];
    let lastNode;

    for (let i = 0, len = tokens.length; i < len; i++) {
        if (tokens[i].type === TYPES.key) {
            lastNode = {
                key: tokens[i].value
            };
            if (i && tokens[i - 1].type === TYPES.comments) {
                lastNode.comments = tokens[i - 1].value;
            }
            lastNode.value = '';
            response.push(lastNode);
        } else if (tokens[i].type === TYPES.string && lastNode) {
            lastNode.value += tokens[i].value;
        }
    }

    return response;
};

function handleValues(tokens) {
    const response = [];
    let lastNode;
    let curContext;
    let curComments;

    for (let i = 0, len = tokens.length; i < len; i++) {
        if (tokens[i].key.toLowerCase() === 'msgctxt') {
            curContext = tokens[i].value;
            curComments = tokens[i].comments;
        } else if (tokens[i].key.toLowerCase() === 'msgid') {
            lastNode = {
                msgid: tokens[i].value
            };

            if (curContext) {
                lastNode.msgctxt = curContext;
            }

            if (curComments) {
                lastNode.comments = curComments;
            }

            if (tokens[i].comments && !lastNode.comments) {
                lastNode.comments = tokens[i].comments;
            }

            curContext = false;
            curComments = false;
            response.push(lastNode);
        } else if (tokens[i].key.toLowerCase() === 'msgid_plural') {
            if (lastNode) {
                lastNode.msgid_plural = tokens[i].value;
            }

            if (tokens[i].comments && !lastNode.comments) {
                lastNode.comments = tokens[i].comments;
            }

            curContext = false;
            curComments = false;
        } else if (tokens[i].key.substr(0, 6).toLowerCase() === 'msgstr') {
            if (lastNode) {
                lastNode.msgstr = (lastNode.msgstr || []).concat(tokens[i].value);
            }

            if (tokens[i].comments && !lastNode.comments) {
                lastNode.comments = tokens[i].comments;
            }

            curContext = false;
            curComments = false;
        }
    }

    return response;
}

function parse(fileContents) {
    var lex = [];
    var escaped = false;
    var node = {};
    var state = STATES.none;
    var lineNumber = 1;
    var chunk = fileContents;

    let chr;
    for (let i = 0, len = chunk.length; i < len; i++) {
        chr = chunk.charAt(i);

        if (chr === '\n') {
            lineNumber += 1;
        }

        switch (state) {
            case STATES.none:
                if (chr.match(SYMBOLS.quotes)) {
                    node = {
                        type: TYPES.string,
                        value: '',
                        quote: chr
                    };
                    lex.push(node);
                    state = STATES.string;
                } else if (chr.match(SYMBOLS.comments)) {
                    node = {
                        type: TYPES.comments,
                        value: ''
                    };
                    lex.push(node);
                    state = STATES.comments;
                } else if (!chr.match(SYMBOLS.whitespace)) {
                    node = {
                        type: TYPES.key,
                        value: chr
                    };
                    lex.push(node);
                    state = STATES.key;
                }
                break;
            case STATES.comments:
                if (chr === '\n') {
                    state = STATES.none;
                } else if (chr !== '\r') {
                    node.value += chr;
                }
                break;
            case STATES.string:
                if (escaped) {
                    switch (chr) {
                        case 't':
                            node.value += '\t';
                            break;
                        case 'n':
                            node.value += '\n';
                            break;
                        case 'r':
                            node.value += '\r';
                            break;
                        default:
                            node.value += chr;
                    }
                    escaped = false;
                } else {
                    if (chr === node.quote) {
                        state = STATES.none;
                    } else if (chr === '\\') {
                        escaped = true;
                        break;
                    } else {
                        node.value += chr;
                    }
                    escaped = false;
                }
                break;
            case STATES.key:
                if (!chr.match(SYMBOLS.key)) {
                    if (!node.value.match(SYMBOLS.keyNames)) {
                        const err = new SyntaxError(`Error parsing PO data: Invalid key name "${node.value}" at line ${lineNumber}. This can be caused by an unescaped quote character in a msgid or msgstr value.`);

                        err.lineNumber = lineNumber;

                        throw err;
                    }
                    state = STATES.none;
                    i--;
                } else {
                    node.value += chr;
                }
                break;
        }
    }
    let data = joinStringValues(lex);

    parseComments(data);
    data = handleKeys(data);
    data = handleValues(data);
    return normalize(data);
}

module.exports = function (source) {
    // const logger = this.getLogger('po-loader');
    // var result = parse(source);
    // logger.error(result);
    // result = `export default ${JSON.stringify(parse(source))}`;
    // logger.error(result);
    return `export default ${JSON.stringify(parse(source).translations)}`;
}

// const fs = require('fs');
// const data = fs.readFileSync('../assets/mmseqs.en_US.po', { encoding: 'utf8', flag: 'r' });
// var result = parse(data);
// console.log(result.translations);