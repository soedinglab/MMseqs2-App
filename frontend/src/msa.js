/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var _index = __webpack_require__(1);
	
	var MSA = _interopRequireWildcard(_index);
	
	function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }
	
	// trick to bundle the css
	__webpack_require__(128);
	
	var msa = MSA.default;
	// workaround against es6 exports
	// we want to expose the MSA constructor by default
	for (var key in MSA) {
	    if (MSA.hasOwnProperty(key)) {
	        msa[key] = MSA[key];
	    }
	}
	if (!!window) {
	    window.msa = msa;
	}
	module.exports = msa;

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.version = exports.io = exports.boneView = exports.view = exports.selcol = exports.selection = exports.utils = exports.model = exports.msa = undefined;
	
	var _Selection = __webpack_require__(2);
	
	Object.defineProperty(exports, "selection", {
	    enumerable: true,
	    get: function get() {
	        return _interopRequireDefault(_Selection).default;
	    }
	});
	
	var _SelectionCol = __webpack_require__(13);
	
	Object.defineProperty(exports, "selcol", {
	    enumerable: true,
	    get: function get() {
	        return _interopRequireDefault(_SelectionCol).default;
	    }
	});
	
	var _backboneViewj = __webpack_require__(14);
	
	Object.defineProperty(exports, "view", {
	    enumerable: true,
	    get: function get() {
	        return _interopRequireDefault(_backboneViewj).default;
	    }
	});
	
	var _backboneChilds = __webpack_require__(16);
	
	Object.defineProperty(exports, "boneView", {
	    enumerable: true,
	    get: function get() {
	        return _interopRequireDefault(_backboneChilds).default;
	    }
	});
	
	var _msa = __webpack_require__(17);
	
	var _msa2 = _interopRequireDefault(_msa);
	
	var _model2 = __webpack_require__(127);
	
	var _model = _interopRequireWildcard(_model2);
	
	var _utils2 = __webpack_require__(121);
	
	var _utils = _interopRequireWildcard(_utils2);
	
	var _bio = __webpack_require__(67);
	
	function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var MSAWrapper = function MSAWrapper() {
	    var msa = function msa(args) {
	        return _msa2.default.apply(this, args);
	    };
	    msa.prototype = _msa2.default.prototype;
	    return new msa(arguments);
	};
	exports.default = MSAWrapper;
	exports.msa = _msa2.default;
	
	// models
	
	exports.model = _model;
	
	// extra plugins, extensions
	//export * as menu from "./menu";
	
	exports.utils = _utils;
	
	// probably needed more often
	
	
	// convenience
	exports.$ = __webpack_require__(15); 
	
	// parser (are currently bundled - so we can also expose them)
	
	var io = {
	    xhr: __webpack_require__(70),
	    fasta: _bio.fasta,
	    clustal: _bio.clustal,
	    gff: _bio.gff
	};
	
	exports.io = io;
	
	// version will be automatically injected by webpack
	// MSA_VERSION is only defined if loaded via webpack
	
	var VERSION = "imported";
	if (true) {
	    VERSION = ("0.0.0");
	}
	
	var version = exports.version = VERSION;

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.columnsel = exports.rowsel = exports.possel = exports.sel = undefined;
	
	var _lodash = __webpack_require__(3);
	
	var Model = __webpack_require__(6).Model;
	
	// holds the current user selection
	var Selection = Model.extend({
	  defaults: { type: "super" }
	});
	
	var RowSelection = Selection.extend({
	  defaults: (0, _lodash.extend)({}, Selection.prototype.defaults, { type: "row",
	    seqId: ""
	  }),
	
	  inRow: function inRow(seqId) {
	    return seqId === this.get("seqId");
	  },
	  inColumn: function inColumn(rowPos) {
	    return true;
	  },
	  getLength: function getLength() {
	    return 1;
	  }
	});
	
	var ColumnSelection = Selection.extend({
	  defaults: (0, _lodash.extend)({}, Selection.prototype.defaults, { type: "column",
	    xStart: -1,
	    xEnd: -1
	  }),
	
	  inRow: function inRow() {
	    return true;
	  },
	  inColumn: function inColumn(rowPos) {
	    return xStart <= rowPos && rowPos <= xEnd;
	  },
	  getLength: function getLength() {
	    return xEnd - xStart;
	  }
	});
	
	// pos is a mixin of column and row
	// start with Row and only overwrite "inColumn" from Column
	var PosSelection = RowSelection.extend((0, _lodash.extend)({}, (0, _lodash.pick)(ColumnSelection, "inColumn"), (0, _lodash.pick)(ColumnSelection, "getLength"),
	// merge both defaults
	{ defaults: (0, _lodash.extend)({}, ColumnSelection.prototype.defaults, RowSelection.prototype.defaults, { type: "pos"
	  })
	}));
	
	exports.sel = Selection;
	exports.possel = PosSelection;
	exports.rowsel = RowSelection;
	exports.columnsel = ColumnSelection;

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;/* WEBPACK VAR INJECTION */(function(global, module) {'use strict';var _typeof=typeof Symbol==="function"&&typeof Symbol.iterator==="symbol"?function(obj){return typeof obj;}:function(obj){return obj&&typeof Symbol==="function"&&obj.constructor===Symbol&&obj!==Symbol.prototype?"symbol":typeof obj;};/**
	 * @license
	 * Lodash <https://lodash.com/>
	 * Copyright JS Foundation and other contributors <https://js.foundation/>
	 * Released under MIT license <https://lodash.com/license>
	 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
	 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	 */;(function(){/** Used as a safe reference for `undefined` in pre-ES5 environments. */var undefined;/** Used as the semantic version number. */var VERSION='4.17.2';/** Used as the size to enable large array optimizations. */var LARGE_ARRAY_SIZE=200;/** Error message constants. */var CORE_ERROR_TEXT='Unsupported core-js use. Try https://npms.io/search?q=ponyfill.',FUNC_ERROR_TEXT='Expected a function';/** Used to stand-in for `undefined` hash values. */var HASH_UNDEFINED='__lodash_hash_undefined__';/** Used as the maximum memoize cache size. */var MAX_MEMOIZE_SIZE=500;/** Used as the internal argument placeholder. */var PLACEHOLDER='__lodash_placeholder__';/** Used to compose bitmasks for cloning. */var CLONE_DEEP_FLAG=1,CLONE_FLAT_FLAG=2,CLONE_SYMBOLS_FLAG=4;/** Used to compose bitmasks for value comparisons. */var COMPARE_PARTIAL_FLAG=1,COMPARE_UNORDERED_FLAG=2;/** Used to compose bitmasks for function metadata. */var WRAP_BIND_FLAG=1,WRAP_BIND_KEY_FLAG=2,WRAP_CURRY_BOUND_FLAG=4,WRAP_CURRY_FLAG=8,WRAP_CURRY_RIGHT_FLAG=16,WRAP_PARTIAL_FLAG=32,WRAP_PARTIAL_RIGHT_FLAG=64,WRAP_ARY_FLAG=128,WRAP_REARG_FLAG=256,WRAP_FLIP_FLAG=512;/** Used as default options for `_.truncate`. */var DEFAULT_TRUNC_LENGTH=30,DEFAULT_TRUNC_OMISSION='...';/** Used to detect hot functions by number of calls within a span of milliseconds. */var HOT_COUNT=800,HOT_SPAN=16;/** Used to indicate the type of lazy iteratees. */var LAZY_FILTER_FLAG=1,LAZY_MAP_FLAG=2,LAZY_WHILE_FLAG=3;/** Used as references for various `Number` constants. */var INFINITY=1/0,MAX_SAFE_INTEGER=9007199254740991,MAX_INTEGER=1.7976931348623157e+308,NAN=0/0;/** Used as references for the maximum length and index of an array. */var MAX_ARRAY_LENGTH=4294967295,MAX_ARRAY_INDEX=MAX_ARRAY_LENGTH-1,HALF_MAX_ARRAY_LENGTH=MAX_ARRAY_LENGTH>>>1;/** Used to associate wrap methods with their bit flags. */var wrapFlags=[['ary',WRAP_ARY_FLAG],['bind',WRAP_BIND_FLAG],['bindKey',WRAP_BIND_KEY_FLAG],['curry',WRAP_CURRY_FLAG],['curryRight',WRAP_CURRY_RIGHT_FLAG],['flip',WRAP_FLIP_FLAG],['partial',WRAP_PARTIAL_FLAG],['partialRight',WRAP_PARTIAL_RIGHT_FLAG],['rearg',WRAP_REARG_FLAG]];/** `Object#toString` result references. */var argsTag='[object Arguments]',arrayTag='[object Array]',asyncTag='[object AsyncFunction]',boolTag='[object Boolean]',dateTag='[object Date]',domExcTag='[object DOMException]',errorTag='[object Error]',funcTag='[object Function]',genTag='[object GeneratorFunction]',mapTag='[object Map]',numberTag='[object Number]',nullTag='[object Null]',objectTag='[object Object]',promiseTag='[object Promise]',proxyTag='[object Proxy]',regexpTag='[object RegExp]',setTag='[object Set]',stringTag='[object String]',symbolTag='[object Symbol]',undefinedTag='[object Undefined]',weakMapTag='[object WeakMap]',weakSetTag='[object WeakSet]';var arrayBufferTag='[object ArrayBuffer]',dataViewTag='[object DataView]',float32Tag='[object Float32Array]',float64Tag='[object Float64Array]',int8Tag='[object Int8Array]',int16Tag='[object Int16Array]',int32Tag='[object Int32Array]',uint8Tag='[object Uint8Array]',uint8ClampedTag='[object Uint8ClampedArray]',uint16Tag='[object Uint16Array]',uint32Tag='[object Uint32Array]';/** Used to match empty string literals in compiled template source. */var reEmptyStringLeading=/\b__p \+= '';/g,reEmptyStringMiddle=/\b(__p \+=) '' \+/g,reEmptyStringTrailing=/(__e\(.*?\)|\b__t\)) \+\n'';/g;/** Used to match HTML entities and HTML characters. */var reEscapedHtml=/&(?:amp|lt|gt|quot|#39);/g,reUnescapedHtml=/[&<>"']/g,reHasEscapedHtml=RegExp(reEscapedHtml.source),reHasUnescapedHtml=RegExp(reUnescapedHtml.source);/** Used to match template delimiters. */var reEscape=/<%-([\s\S]+?)%>/g,reEvaluate=/<%([\s\S]+?)%>/g,reInterpolate=/<%=([\s\S]+?)%>/g;/** Used to match property names within property paths. */var reIsDeepProp=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,reIsPlainProp=/^\w*$/,reLeadingDot=/^\./,rePropName=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;/**
	   * Used to match `RegExp`
	   * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
	   */var reRegExpChar=/[\\^$.*+?()[\]{}|]/g,reHasRegExpChar=RegExp(reRegExpChar.source);/** Used to match leading and trailing whitespace. */var reTrim=/^\s+|\s+$/g,reTrimStart=/^\s+/,reTrimEnd=/\s+$/;/** Used to match wrap detail comments. */var reWrapComment=/\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/,reWrapDetails=/\{\n\/\* \[wrapped with (.+)\] \*/,reSplitDetails=/,? & /;/** Used to match words composed of alphanumeric characters. */var reAsciiWord=/[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g;/** Used to match backslashes in property paths. */var reEscapeChar=/\\(\\)?/g;/**
	   * Used to match
	   * [ES template delimiters](http://ecma-international.org/ecma-262/7.0/#sec-template-literal-lexical-components).
	   */var reEsTemplate=/\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;/** Used to match `RegExp` flags from their coerced string values. */var reFlags=/\w*$/;/** Used to detect bad signed hexadecimal string values. */var reIsBadHex=/^[-+]0x[0-9a-f]+$/i;/** Used to detect binary string values. */var reIsBinary=/^0b[01]+$/i;/** Used to detect host constructors (Safari). */var reIsHostCtor=/^\[object .+?Constructor\]$/;/** Used to detect octal string values. */var reIsOctal=/^0o[0-7]+$/i;/** Used to detect unsigned integer values. */var reIsUint=/^(?:0|[1-9]\d*)$/;/** Used to match Latin Unicode letters (excluding mathematical operators). */var reLatin=/[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g;/** Used to ensure capturing order of template delimiters. */var reNoMatch=/($^)/;/** Used to match unescaped characters in compiled string literals. */var reUnescapedString=/['\n\r\u2028\u2029\\]/g;/** Used to compose unicode character classes. */var rsAstralRange='\\ud800-\\udfff',rsComboMarksRange='\\u0300-\\u036f',reComboHalfMarksRange='\\ufe20-\\ufe2f',rsComboSymbolsRange='\\u20d0-\\u20ff',rsComboRange=rsComboMarksRange+reComboHalfMarksRange+rsComboSymbolsRange,rsDingbatRange='\\u2700-\\u27bf',rsLowerRange='a-z\\xdf-\\xf6\\xf8-\\xff',rsMathOpRange='\\xac\\xb1\\xd7\\xf7',rsNonCharRange='\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf',rsPunctuationRange='\\u2000-\\u206f',rsSpaceRange=' \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000',rsUpperRange='A-Z\\xc0-\\xd6\\xd8-\\xde',rsVarRange='\\ufe0e\\ufe0f',rsBreakRange=rsMathOpRange+rsNonCharRange+rsPunctuationRange+rsSpaceRange;/** Used to compose unicode capture groups. */var rsApos='[\'\u2019]',rsAstral='['+rsAstralRange+']',rsBreak='['+rsBreakRange+']',rsCombo='['+rsComboRange+']',rsDigits='\\d+',rsDingbat='['+rsDingbatRange+']',rsLower='['+rsLowerRange+']',rsMisc='[^'+rsAstralRange+rsBreakRange+rsDigits+rsDingbatRange+rsLowerRange+rsUpperRange+']',rsFitz='\\ud83c[\\udffb-\\udfff]',rsModifier='(?:'+rsCombo+'|'+rsFitz+')',rsNonAstral='[^'+rsAstralRange+']',rsRegional='(?:\\ud83c[\\udde6-\\uddff]){2}',rsSurrPair='[\\ud800-\\udbff][\\udc00-\\udfff]',rsUpper='['+rsUpperRange+']',rsZWJ='\\u200d';/** Used to compose unicode regexes. */var rsMiscLower='(?:'+rsLower+'|'+rsMisc+')',rsMiscUpper='(?:'+rsUpper+'|'+rsMisc+')',rsOptContrLower='(?:'+rsApos+'(?:d|ll|m|re|s|t|ve))?',rsOptContrUpper='(?:'+rsApos+'(?:D|LL|M|RE|S|T|VE))?',reOptMod=rsModifier+'?',rsOptVar='['+rsVarRange+']?',rsOptJoin='(?:'+rsZWJ+'(?:'+[rsNonAstral,rsRegional,rsSurrPair].join('|')+')'+rsOptVar+reOptMod+')*',rsOrdLower='\\d*(?:(?:1st|2nd|3rd|(?![123])\\dth)\\b)',rsOrdUpper='\\d*(?:(?:1ST|2ND|3RD|(?![123])\\dTH)\\b)',rsSeq=rsOptVar+reOptMod+rsOptJoin,rsEmoji='(?:'+[rsDingbat,rsRegional,rsSurrPair].join('|')+')'+rsSeq,rsSymbol='(?:'+[rsNonAstral+rsCombo+'?',rsCombo,rsRegional,rsSurrPair,rsAstral].join('|')+')';/** Used to match apostrophes. */var reApos=RegExp(rsApos,'g');/**
	   * Used to match [combining diacritical marks](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks) and
	   * [combining diacritical marks for symbols](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks_for_Symbols).
	   */var reComboMark=RegExp(rsCombo,'g');/** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */var reUnicode=RegExp(rsFitz+'(?='+rsFitz+')|'+rsSymbol+rsSeq,'g');/** Used to match complex or compound words. */var reUnicodeWord=RegExp([rsUpper+'?'+rsLower+'+'+rsOptContrLower+'(?='+[rsBreak,rsUpper,'$'].join('|')+')',rsMiscUpper+'+'+rsOptContrUpper+'(?='+[rsBreak,rsUpper+rsMiscLower,'$'].join('|')+')',rsUpper+'?'+rsMiscLower+'+'+rsOptContrLower,rsUpper+'+'+rsOptContrUpper,rsOrdUpper,rsOrdLower,rsDigits,rsEmoji].join('|'),'g');/** Used to detect strings with [zero-width joiners or code points from the astral planes](http://eev.ee/blog/2015/09/12/dark-corners-of-unicode/). */var reHasUnicode=RegExp('['+rsZWJ+rsAstralRange+rsComboRange+rsVarRange+']');/** Used to detect strings that need a more robust regexp to match words. */var reHasUnicodeWord=/[a-z][A-Z]|[A-Z]{2,}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/;/** Used to assign default `context` object properties. */var contextProps=['Array','Buffer','DataView','Date','Error','Float32Array','Float64Array','Function','Int8Array','Int16Array','Int32Array','Map','Math','Object','Promise','RegExp','Set','String','Symbol','TypeError','Uint8Array','Uint8ClampedArray','Uint16Array','Uint32Array','WeakMap','_','clearTimeout','isFinite','parseInt','setTimeout'];/** Used to make template sourceURLs easier to identify. */var templateCounter=-1;/** Used to identify `toStringTag` values of typed arrays. */var typedArrayTags={};typedArrayTags[float32Tag]=typedArrayTags[float64Tag]=typedArrayTags[int8Tag]=typedArrayTags[int16Tag]=typedArrayTags[int32Tag]=typedArrayTags[uint8Tag]=typedArrayTags[uint8ClampedTag]=typedArrayTags[uint16Tag]=typedArrayTags[uint32Tag]=true;typedArrayTags[argsTag]=typedArrayTags[arrayTag]=typedArrayTags[arrayBufferTag]=typedArrayTags[boolTag]=typedArrayTags[dataViewTag]=typedArrayTags[dateTag]=typedArrayTags[errorTag]=typedArrayTags[funcTag]=typedArrayTags[mapTag]=typedArrayTags[numberTag]=typedArrayTags[objectTag]=typedArrayTags[regexpTag]=typedArrayTags[setTag]=typedArrayTags[stringTag]=typedArrayTags[weakMapTag]=false;/** Used to identify `toStringTag` values supported by `_.clone`. */var cloneableTags={};cloneableTags[argsTag]=cloneableTags[arrayTag]=cloneableTags[arrayBufferTag]=cloneableTags[dataViewTag]=cloneableTags[boolTag]=cloneableTags[dateTag]=cloneableTags[float32Tag]=cloneableTags[float64Tag]=cloneableTags[int8Tag]=cloneableTags[int16Tag]=cloneableTags[int32Tag]=cloneableTags[mapTag]=cloneableTags[numberTag]=cloneableTags[objectTag]=cloneableTags[regexpTag]=cloneableTags[setTag]=cloneableTags[stringTag]=cloneableTags[symbolTag]=cloneableTags[uint8Tag]=cloneableTags[uint8ClampedTag]=cloneableTags[uint16Tag]=cloneableTags[uint32Tag]=true;cloneableTags[errorTag]=cloneableTags[funcTag]=cloneableTags[weakMapTag]=false;/** Used to map Latin Unicode letters to basic Latin letters. */var deburredLetters={// Latin-1 Supplement block.
	'\xc0':'A','\xc1':'A','\xc2':'A','\xc3':'A','\xc4':'A','\xc5':'A','\xe0':'a','\xe1':'a','\xe2':'a','\xe3':'a','\xe4':'a','\xe5':'a','\xc7':'C','\xe7':'c','\xd0':'D','\xf0':'d','\xc8':'E','\xc9':'E','\xca':'E','\xcb':'E','\xe8':'e','\xe9':'e','\xea':'e','\xeb':'e','\xcc':'I','\xcd':'I','\xce':'I','\xcf':'I','\xec':'i','\xed':'i','\xee':'i','\xef':'i','\xd1':'N','\xf1':'n','\xd2':'O','\xd3':'O','\xd4':'O','\xd5':'O','\xd6':'O','\xd8':'O','\xf2':'o','\xf3':'o','\xf4':'o','\xf5':'o','\xf6':'o','\xf8':'o','\xd9':'U','\xda':'U','\xdb':'U','\xdc':'U','\xf9':'u','\xfa':'u','\xfb':'u','\xfc':'u','\xdd':'Y','\xfd':'y','\xff':'y','\xc6':'Ae','\xe6':'ae','\xde':'Th','\xfe':'th','\xdf':'ss',// Latin Extended-A block.
	'\u0100':'A','\u0102':'A','\u0104':'A','\u0101':'a','\u0103':'a','\u0105':'a','\u0106':'C','\u0108':'C','\u010A':'C','\u010C':'C','\u0107':'c','\u0109':'c','\u010B':'c','\u010D':'c','\u010E':'D','\u0110':'D','\u010F':'d','\u0111':'d','\u0112':'E','\u0114':'E','\u0116':'E','\u0118':'E','\u011A':'E','\u0113':'e','\u0115':'e','\u0117':'e','\u0119':'e','\u011B':'e','\u011C':'G','\u011E':'G','\u0120':'G','\u0122':'G','\u011D':'g','\u011F':'g','\u0121':'g','\u0123':'g','\u0124':'H','\u0126':'H','\u0125':'h','\u0127':'h','\u0128':'I','\u012A':'I','\u012C':'I','\u012E':'I','\u0130':'I','\u0129':'i','\u012B':'i','\u012D':'i','\u012F':'i','\u0131':'i','\u0134':'J','\u0135':'j','\u0136':'K','\u0137':'k','\u0138':'k','\u0139':'L','\u013B':'L','\u013D':'L','\u013F':'L','\u0141':'L','\u013A':'l','\u013C':'l','\u013E':'l','\u0140':'l','\u0142':'l','\u0143':'N','\u0145':'N','\u0147':'N','\u014A':'N','\u0144':'n','\u0146':'n','\u0148':'n','\u014B':'n','\u014C':'O','\u014E':'O','\u0150':'O','\u014D':'o','\u014F':'o','\u0151':'o','\u0154':'R','\u0156':'R','\u0158':'R','\u0155':'r','\u0157':'r','\u0159':'r','\u015A':'S','\u015C':'S','\u015E':'S','\u0160':'S','\u015B':'s','\u015D':'s','\u015F':'s','\u0161':'s','\u0162':'T','\u0164':'T','\u0166':'T','\u0163':'t','\u0165':'t','\u0167':'t','\u0168':'U','\u016A':'U','\u016C':'U','\u016E':'U','\u0170':'U','\u0172':'U','\u0169':'u','\u016B':'u','\u016D':'u','\u016F':'u','\u0171':'u','\u0173':'u','\u0174':'W','\u0175':'w','\u0176':'Y','\u0177':'y','\u0178':'Y','\u0179':'Z','\u017B':'Z','\u017D':'Z','\u017A':'z','\u017C':'z','\u017E':'z','\u0132':'IJ','\u0133':'ij','\u0152':'Oe','\u0153':'oe','\u0149':"'n",'\u017F':'s'};/** Used to map characters to HTML entities. */var htmlEscapes={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};/** Used to map HTML entities to characters. */var htmlUnescapes={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"};/** Used to escape characters for inclusion in compiled string literals. */var stringEscapes={'\\':'\\',"'":"'",'\n':'n','\r':'r','\u2028':'u2028','\u2029':'u2029'};/** Built-in method references without a dependency on `root`. */var freeParseFloat=parseFloat,freeParseInt=parseInt;/** Detect free variable `global` from Node.js. */var freeGlobal=(typeof global==='undefined'?'undefined':_typeof(global))=='object'&&global&&global.Object===Object&&global;/** Detect free variable `self`. */var freeSelf=(typeof self==='undefined'?'undefined':_typeof(self))=='object'&&self&&self.Object===Object&&self;/** Used as a reference to the global object. */var root=freeGlobal||freeSelf||Function('return this')();/** Detect free variable `exports`. */var freeExports=( false?'undefined':_typeof(exports))=='object'&&exports&&!exports.nodeType&&exports;/** Detect free variable `module`. */var freeModule=freeExports&&( false?'undefined':_typeof(module))=='object'&&module&&!module.nodeType&&module;/** Detect the popular CommonJS extension `module.exports`. */var moduleExports=freeModule&&freeModule.exports===freeExports;/** Detect free variable `process` from Node.js. */var freeProcess=moduleExports&&freeGlobal.process;/** Used to access faster Node.js helpers. */var nodeUtil=function(){try{return freeProcess&&freeProcess.binding&&freeProcess.binding('util');}catch(e){}}();/* Node.js helper references. */var nodeIsArrayBuffer=nodeUtil&&nodeUtil.isArrayBuffer,nodeIsDate=nodeUtil&&nodeUtil.isDate,nodeIsMap=nodeUtil&&nodeUtil.isMap,nodeIsRegExp=nodeUtil&&nodeUtil.isRegExp,nodeIsSet=nodeUtil&&nodeUtil.isSet,nodeIsTypedArray=nodeUtil&&nodeUtil.isTypedArray;/*--------------------------------------------------------------------------*//**
	   * Adds the key-value `pair` to `map`.
	   *
	   * @private
	   * @param {Object} map The map to modify.
	   * @param {Array} pair The key-value pair to add.
	   * @returns {Object} Returns `map`.
	   */function addMapEntry(map,pair){// Don't return `map.set` because it's not chainable in IE 11.
	map.set(pair[0],pair[1]);return map;}/**
	   * Adds `value` to `set`.
	   *
	   * @private
	   * @param {Object} set The set to modify.
	   * @param {*} value The value to add.
	   * @returns {Object} Returns `set`.
	   */function addSetEntry(set,value){// Don't return `set.add` because it's not chainable in IE 11.
	set.add(value);return set;}/**
	   * A faster alternative to `Function#apply`, this function invokes `func`
	   * with the `this` binding of `thisArg` and the arguments of `args`.
	   *
	   * @private
	   * @param {Function} func The function to invoke.
	   * @param {*} thisArg The `this` binding of `func`.
	   * @param {Array} args The arguments to invoke `func` with.
	   * @returns {*} Returns the result of `func`.
	   */function apply(func,thisArg,args){switch(args.length){case 0:return func.call(thisArg);case 1:return func.call(thisArg,args[0]);case 2:return func.call(thisArg,args[0],args[1]);case 3:return func.call(thisArg,args[0],args[1],args[2]);}return func.apply(thisArg,args);}/**
	   * A specialized version of `baseAggregator` for arrays.
	   *
	   * @private
	   * @param {Array} [array] The array to iterate over.
	   * @param {Function} setter The function to set `accumulator` values.
	   * @param {Function} iteratee The iteratee to transform keys.
	   * @param {Object} accumulator The initial aggregated object.
	   * @returns {Function} Returns `accumulator`.
	   */function arrayAggregator(array,setter,iteratee,accumulator){var index=-1,length=array==null?0:array.length;while(++index<length){var value=array[index];setter(accumulator,value,iteratee(value),array);}return accumulator;}/**
	   * A specialized version of `_.forEach` for arrays without support for
	   * iteratee shorthands.
	   *
	   * @private
	   * @param {Array} [array] The array to iterate over.
	   * @param {Function} iteratee The function invoked per iteration.
	   * @returns {Array} Returns `array`.
	   */function arrayEach(array,iteratee){var index=-1,length=array==null?0:array.length;while(++index<length){if(iteratee(array[index],index,array)===false){break;}}return array;}/**
	   * A specialized version of `_.forEachRight` for arrays without support for
	   * iteratee shorthands.
	   *
	   * @private
	   * @param {Array} [array] The array to iterate over.
	   * @param {Function} iteratee The function invoked per iteration.
	   * @returns {Array} Returns `array`.
	   */function arrayEachRight(array,iteratee){var length=array==null?0:array.length;while(length--){if(iteratee(array[length],length,array)===false){break;}}return array;}/**
	   * A specialized version of `_.every` for arrays without support for
	   * iteratee shorthands.
	   *
	   * @private
	   * @param {Array} [array] The array to iterate over.
	   * @param {Function} predicate The function invoked per iteration.
	   * @returns {boolean} Returns `true` if all elements pass the predicate check,
	   *  else `false`.
	   */function arrayEvery(array,predicate){var index=-1,length=array==null?0:array.length;while(++index<length){if(!predicate(array[index],index,array)){return false;}}return true;}/**
	   * A specialized version of `_.filter` for arrays without support for
	   * iteratee shorthands.
	   *
	   * @private
	   * @param {Array} [array] The array to iterate over.
	   * @param {Function} predicate The function invoked per iteration.
	   * @returns {Array} Returns the new filtered array.
	   */function arrayFilter(array,predicate){var index=-1,length=array==null?0:array.length,resIndex=0,result=[];while(++index<length){var value=array[index];if(predicate(value,index,array)){result[resIndex++]=value;}}return result;}/**
	   * A specialized version of `_.includes` for arrays without support for
	   * specifying an index to search from.
	   *
	   * @private
	   * @param {Array} [array] The array to inspect.
	   * @param {*} target The value to search for.
	   * @returns {boolean} Returns `true` if `target` is found, else `false`.
	   */function arrayIncludes(array,value){var length=array==null?0:array.length;return!!length&&baseIndexOf(array,value,0)>-1;}/**
	   * This function is like `arrayIncludes` except that it accepts a comparator.
	   *
	   * @private
	   * @param {Array} [array] The array to inspect.
	   * @param {*} target The value to search for.
	   * @param {Function} comparator The comparator invoked per element.
	   * @returns {boolean} Returns `true` if `target` is found, else `false`.
	   */function arrayIncludesWith(array,value,comparator){var index=-1,length=array==null?0:array.length;while(++index<length){if(comparator(value,array[index])){return true;}}return false;}/**
	   * A specialized version of `_.map` for arrays without support for iteratee
	   * shorthands.
	   *
	   * @private
	   * @param {Array} [array] The array to iterate over.
	   * @param {Function} iteratee The function invoked per iteration.
	   * @returns {Array} Returns the new mapped array.
	   */function arrayMap(array,iteratee){var index=-1,length=array==null?0:array.length,result=Array(length);while(++index<length){result[index]=iteratee(array[index],index,array);}return result;}/**
	   * Appends the elements of `values` to `array`.
	   *
	   * @private
	   * @param {Array} array The array to modify.
	   * @param {Array} values The values to append.
	   * @returns {Array} Returns `array`.
	   */function arrayPush(array,values){var index=-1,length=values.length,offset=array.length;while(++index<length){array[offset+index]=values[index];}return array;}/**
	   * A specialized version of `_.reduce` for arrays without support for
	   * iteratee shorthands.
	   *
	   * @private
	   * @param {Array} [array] The array to iterate over.
	   * @param {Function} iteratee The function invoked per iteration.
	   * @param {*} [accumulator] The initial value.
	   * @param {boolean} [initAccum] Specify using the first element of `array` as
	   *  the initial value.
	   * @returns {*} Returns the accumulated value.
	   */function arrayReduce(array,iteratee,accumulator,initAccum){var index=-1,length=array==null?0:array.length;if(initAccum&&length){accumulator=array[++index];}while(++index<length){accumulator=iteratee(accumulator,array[index],index,array);}return accumulator;}/**
	   * A specialized version of `_.reduceRight` for arrays without support for
	   * iteratee shorthands.
	   *
	   * @private
	   * @param {Array} [array] The array to iterate over.
	   * @param {Function} iteratee The function invoked per iteration.
	   * @param {*} [accumulator] The initial value.
	   * @param {boolean} [initAccum] Specify using the last element of `array` as
	   *  the initial value.
	   * @returns {*} Returns the accumulated value.
	   */function arrayReduceRight(array,iteratee,accumulator,initAccum){var length=array==null?0:array.length;if(initAccum&&length){accumulator=array[--length];}while(length--){accumulator=iteratee(accumulator,array[length],length,array);}return accumulator;}/**
	   * A specialized version of `_.some` for arrays without support for iteratee
	   * shorthands.
	   *
	   * @private
	   * @param {Array} [array] The array to iterate over.
	   * @param {Function} predicate The function invoked per iteration.
	   * @returns {boolean} Returns `true` if any element passes the predicate check,
	   *  else `false`.
	   */function arraySome(array,predicate){var index=-1,length=array==null?0:array.length;while(++index<length){if(predicate(array[index],index,array)){return true;}}return false;}/**
	   * Gets the size of an ASCII `string`.
	   *
	   * @private
	   * @param {string} string The string inspect.
	   * @returns {number} Returns the string size.
	   */var asciiSize=baseProperty('length');/**
	   * Converts an ASCII `string` to an array.
	   *
	   * @private
	   * @param {string} string The string to convert.
	   * @returns {Array} Returns the converted array.
	   */function asciiToArray(string){return string.split('');}/**
	   * Splits an ASCII `string` into an array of its words.
	   *
	   * @private
	   * @param {string} The string to inspect.
	   * @returns {Array} Returns the words of `string`.
	   */function asciiWords(string){return string.match(reAsciiWord)||[];}/**
	   * The base implementation of methods like `_.findKey` and `_.findLastKey`,
	   * without support for iteratee shorthands, which iterates over `collection`
	   * using `eachFunc`.
	   *
	   * @private
	   * @param {Array|Object} collection The collection to inspect.
	   * @param {Function} predicate The function invoked per iteration.
	   * @param {Function} eachFunc The function to iterate over `collection`.
	   * @returns {*} Returns the found element or its key, else `undefined`.
	   */function baseFindKey(collection,predicate,eachFunc){var result;eachFunc(collection,function(value,key,collection){if(predicate(value,key,collection)){result=key;return false;}});return result;}/**
	   * The base implementation of `_.findIndex` and `_.findLastIndex` without
	   * support for iteratee shorthands.
	   *
	   * @private
	   * @param {Array} array The array to inspect.
	   * @param {Function} predicate The function invoked per iteration.
	   * @param {number} fromIndex The index to search from.
	   * @param {boolean} [fromRight] Specify iterating from right to left.
	   * @returns {number} Returns the index of the matched value, else `-1`.
	   */function baseFindIndex(array,predicate,fromIndex,fromRight){var length=array.length,index=fromIndex+(fromRight?1:-1);while(fromRight?index--:++index<length){if(predicate(array[index],index,array)){return index;}}return-1;}/**
	   * The base implementation of `_.indexOf` without `fromIndex` bounds checks.
	   *
	   * @private
	   * @param {Array} array The array to inspect.
	   * @param {*} value The value to search for.
	   * @param {number} fromIndex The index to search from.
	   * @returns {number} Returns the index of the matched value, else `-1`.
	   */function baseIndexOf(array,value,fromIndex){return value===value?strictIndexOf(array,value,fromIndex):baseFindIndex(array,baseIsNaN,fromIndex);}/**
	   * This function is like `baseIndexOf` except that it accepts a comparator.
	   *
	   * @private
	   * @param {Array} array The array to inspect.
	   * @param {*} value The value to search for.
	   * @param {number} fromIndex The index to search from.
	   * @param {Function} comparator The comparator invoked per element.
	   * @returns {number} Returns the index of the matched value, else `-1`.
	   */function baseIndexOfWith(array,value,fromIndex,comparator){var index=fromIndex-1,length=array.length;while(++index<length){if(comparator(array[index],value)){return index;}}return-1;}/**
	   * The base implementation of `_.isNaN` without support for number objects.
	   *
	   * @private
	   * @param {*} value The value to check.
	   * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
	   */function baseIsNaN(value){return value!==value;}/**
	   * The base implementation of `_.mean` and `_.meanBy` without support for
	   * iteratee shorthands.
	   *
	   * @private
	   * @param {Array} array The array to iterate over.
	   * @param {Function} iteratee The function invoked per iteration.
	   * @returns {number} Returns the mean.
	   */function baseMean(array,iteratee){var length=array==null?0:array.length;return length?baseSum(array,iteratee)/length:NAN;}/**
	   * The base implementation of `_.property` without support for deep paths.
	   *
	   * @private
	   * @param {string} key The key of the property to get.
	   * @returns {Function} Returns the new accessor function.
	   */function baseProperty(key){return function(object){return object==null?undefined:object[key];};}/**
	   * The base implementation of `_.propertyOf` without support for deep paths.
	   *
	   * @private
	   * @param {Object} object The object to query.
	   * @returns {Function} Returns the new accessor function.
	   */function basePropertyOf(object){return function(key){return object==null?undefined:object[key];};}/**
	   * The base implementation of `_.reduce` and `_.reduceRight`, without support
	   * for iteratee shorthands, which iterates over `collection` using `eachFunc`.
	   *
	   * @private
	   * @param {Array|Object} collection The collection to iterate over.
	   * @param {Function} iteratee The function invoked per iteration.
	   * @param {*} accumulator The initial value.
	   * @param {boolean} initAccum Specify using the first or last element of
	   *  `collection` as the initial value.
	   * @param {Function} eachFunc The function to iterate over `collection`.
	   * @returns {*} Returns the accumulated value.
	   */function baseReduce(collection,iteratee,accumulator,initAccum,eachFunc){eachFunc(collection,function(value,index,collection){accumulator=initAccum?(initAccum=false,value):iteratee(accumulator,value,index,collection);});return accumulator;}/**
	   * The base implementation of `_.sortBy` which uses `comparer` to define the
	   * sort order of `array` and replaces criteria objects with their corresponding
	   * values.
	   *
	   * @private
	   * @param {Array} array The array to sort.
	   * @param {Function} comparer The function to define sort order.
	   * @returns {Array} Returns `array`.
	   */function baseSortBy(array,comparer){var length=array.length;array.sort(comparer);while(length--){array[length]=array[length].value;}return array;}/**
	   * The base implementation of `_.sum` and `_.sumBy` without support for
	   * iteratee shorthands.
	   *
	   * @private
	   * @param {Array} array The array to iterate over.
	   * @param {Function} iteratee The function invoked per iteration.
	   * @returns {number} Returns the sum.
	   */function baseSum(array,iteratee){var result,index=-1,length=array.length;while(++index<length){var current=iteratee(array[index]);if(current!==undefined){result=result===undefined?current:result+current;}}return result;}/**
	   * The base implementation of `_.times` without support for iteratee shorthands
	   * or max array length checks.
	   *
	   * @private
	   * @param {number} n The number of times to invoke `iteratee`.
	   * @param {Function} iteratee The function invoked per iteration.
	   * @returns {Array} Returns the array of results.
	   */function baseTimes(n,iteratee){var index=-1,result=Array(n);while(++index<n){result[index]=iteratee(index);}return result;}/**
	   * The base implementation of `_.toPairs` and `_.toPairsIn` which creates an array
	   * of key-value pairs for `object` corresponding to the property names of `props`.
	   *
	   * @private
	   * @param {Object} object The object to query.
	   * @param {Array} props The property names to get values for.
	   * @returns {Object} Returns the key-value pairs.
	   */function baseToPairs(object,props){return arrayMap(props,function(key){return[key,object[key]];});}/**
	   * The base implementation of `_.unary` without support for storing metadata.
	   *
	   * @private
	   * @param {Function} func The function to cap arguments for.
	   * @returns {Function} Returns the new capped function.
	   */function baseUnary(func){return function(value){return func(value);};}/**
	   * The base implementation of `_.values` and `_.valuesIn` which creates an
	   * array of `object` property values corresponding to the property names
	   * of `props`.
	   *
	   * @private
	   * @param {Object} object The object to query.
	   * @param {Array} props The property names to get values for.
	   * @returns {Object} Returns the array of property values.
	   */function baseValues(object,props){return arrayMap(props,function(key){return object[key];});}/**
	   * Checks if a `cache` value for `key` exists.
	   *
	   * @private
	   * @param {Object} cache The cache to query.
	   * @param {string} key The key of the entry to check.
	   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	   */function cacheHas(cache,key){return cache.has(key);}/**
	   * Used by `_.trim` and `_.trimStart` to get the index of the first string symbol
	   * that is not found in the character symbols.
	   *
	   * @private
	   * @param {Array} strSymbols The string symbols to inspect.
	   * @param {Array} chrSymbols The character symbols to find.
	   * @returns {number} Returns the index of the first unmatched string symbol.
	   */function charsStartIndex(strSymbols,chrSymbols){var index=-1,length=strSymbols.length;while(++index<length&&baseIndexOf(chrSymbols,strSymbols[index],0)>-1){}return index;}/**
	   * Used by `_.trim` and `_.trimEnd` to get the index of the last string symbol
	   * that is not found in the character symbols.
	   *
	   * @private
	   * @param {Array} strSymbols The string symbols to inspect.
	   * @param {Array} chrSymbols The character symbols to find.
	   * @returns {number} Returns the index of the last unmatched string symbol.
	   */function charsEndIndex(strSymbols,chrSymbols){var index=strSymbols.length;while(index--&&baseIndexOf(chrSymbols,strSymbols[index],0)>-1){}return index;}/**
	   * Gets the number of `placeholder` occurrences in `array`.
	   *
	   * @private
	   * @param {Array} array The array to inspect.
	   * @param {*} placeholder The placeholder to search for.
	   * @returns {number} Returns the placeholder count.
	   */function countHolders(array,placeholder){var length=array.length,result=0;while(length--){if(array[length]===placeholder){++result;}}return result;}/**
	   * Used by `_.deburr` to convert Latin-1 Supplement and Latin Extended-A
	   * letters to basic Latin letters.
	   *
	   * @private
	   * @param {string} letter The matched letter to deburr.
	   * @returns {string} Returns the deburred letter.
	   */var deburrLetter=basePropertyOf(deburredLetters);/**
	   * Used by `_.escape` to convert characters to HTML entities.
	   *
	   * @private
	   * @param {string} chr The matched character to escape.
	   * @returns {string} Returns the escaped character.
	   */var escapeHtmlChar=basePropertyOf(htmlEscapes);/**
	   * Used by `_.template` to escape characters for inclusion in compiled string literals.
	   *
	   * @private
	   * @param {string} chr The matched character to escape.
	   * @returns {string} Returns the escaped character.
	   */function escapeStringChar(chr){return'\\'+stringEscapes[chr];}/**
	   * Gets the value at `key` of `object`.
	   *
	   * @private
	   * @param {Object} [object] The object to query.
	   * @param {string} key The key of the property to get.
	   * @returns {*} Returns the property value.
	   */function getValue(object,key){return object==null?undefined:object[key];}/**
	   * Checks if `string` contains Unicode symbols.
	   *
	   * @private
	   * @param {string} string The string to inspect.
	   * @returns {boolean} Returns `true` if a symbol is found, else `false`.
	   */function hasUnicode(string){return reHasUnicode.test(string);}/**
	   * Checks if `string` contains a word composed of Unicode symbols.
	   *
	   * @private
	   * @param {string} string The string to inspect.
	   * @returns {boolean} Returns `true` if a word is found, else `false`.
	   */function hasUnicodeWord(string){return reHasUnicodeWord.test(string);}/**
	   * Converts `iterator` to an array.
	   *
	   * @private
	   * @param {Object} iterator The iterator to convert.
	   * @returns {Array} Returns the converted array.
	   */function iteratorToArray(iterator){var data,result=[];while(!(data=iterator.next()).done){result.push(data.value);}return result;}/**
	   * Converts `map` to its key-value pairs.
	   *
	   * @private
	   * @param {Object} map The map to convert.
	   * @returns {Array} Returns the key-value pairs.
	   */function mapToArray(map){var index=-1,result=Array(map.size);map.forEach(function(value,key){result[++index]=[key,value];});return result;}/**
	   * Creates a unary function that invokes `func` with its argument transformed.
	   *
	   * @private
	   * @param {Function} func The function to wrap.
	   * @param {Function} transform The argument transform.
	   * @returns {Function} Returns the new function.
	   */function overArg(func,transform){return function(arg){return func(transform(arg));};}/**
	   * Replaces all `placeholder` elements in `array` with an internal placeholder
	   * and returns an array of their indexes.
	   *
	   * @private
	   * @param {Array} array The array to modify.
	   * @param {*} placeholder The placeholder to replace.
	   * @returns {Array} Returns the new array of placeholder indexes.
	   */function replaceHolders(array,placeholder){var index=-1,length=array.length,resIndex=0,result=[];while(++index<length){var value=array[index];if(value===placeholder||value===PLACEHOLDER){array[index]=PLACEHOLDER;result[resIndex++]=index;}}return result;}/**
	   * Converts `set` to an array of its values.
	   *
	   * @private
	   * @param {Object} set The set to convert.
	   * @returns {Array} Returns the values.
	   */function setToArray(set){var index=-1,result=Array(set.size);set.forEach(function(value){result[++index]=value;});return result;}/**
	   * Converts `set` to its value-value pairs.
	   *
	   * @private
	   * @param {Object} set The set to convert.
	   * @returns {Array} Returns the value-value pairs.
	   */function setToPairs(set){var index=-1,result=Array(set.size);set.forEach(function(value){result[++index]=[value,value];});return result;}/**
	   * A specialized version of `_.indexOf` which performs strict equality
	   * comparisons of values, i.e. `===`.
	   *
	   * @private
	   * @param {Array} array The array to inspect.
	   * @param {*} value The value to search for.
	   * @param {number} fromIndex The index to search from.
	   * @returns {number} Returns the index of the matched value, else `-1`.
	   */function strictIndexOf(array,value,fromIndex){var index=fromIndex-1,length=array.length;while(++index<length){if(array[index]===value){return index;}}return-1;}/**
	   * A specialized version of `_.lastIndexOf` which performs strict equality
	   * comparisons of values, i.e. `===`.
	   *
	   * @private
	   * @param {Array} array The array to inspect.
	   * @param {*} value The value to search for.
	   * @param {number} fromIndex The index to search from.
	   * @returns {number} Returns the index of the matched value, else `-1`.
	   */function strictLastIndexOf(array,value,fromIndex){var index=fromIndex+1;while(index--){if(array[index]===value){return index;}}return index;}/**
	   * Gets the number of symbols in `string`.
	   *
	   * @private
	   * @param {string} string The string to inspect.
	   * @returns {number} Returns the string size.
	   */function stringSize(string){return hasUnicode(string)?unicodeSize(string):asciiSize(string);}/**
	   * Converts `string` to an array.
	   *
	   * @private
	   * @param {string} string The string to convert.
	   * @returns {Array} Returns the converted array.
	   */function stringToArray(string){return hasUnicode(string)?unicodeToArray(string):asciiToArray(string);}/**
	   * Used by `_.unescape` to convert HTML entities to characters.
	   *
	   * @private
	   * @param {string} chr The matched character to unescape.
	   * @returns {string} Returns the unescaped character.
	   */var unescapeHtmlChar=basePropertyOf(htmlUnescapes);/**
	   * Gets the size of a Unicode `string`.
	   *
	   * @private
	   * @param {string} string The string inspect.
	   * @returns {number} Returns the string size.
	   */function unicodeSize(string){var result=reUnicode.lastIndex=0;while(reUnicode.test(string)){++result;}return result;}/**
	   * Converts a Unicode `string` to an array.
	   *
	   * @private
	   * @param {string} string The string to convert.
	   * @returns {Array} Returns the converted array.
	   */function unicodeToArray(string){return string.match(reUnicode)||[];}/**
	   * Splits a Unicode `string` into an array of its words.
	   *
	   * @private
	   * @param {string} The string to inspect.
	   * @returns {Array} Returns the words of `string`.
	   */function unicodeWords(string){return string.match(reUnicodeWord)||[];}/*--------------------------------------------------------------------------*//**
	   * Create a new pristine `lodash` function using the `context` object.
	   *
	   * @static
	   * @memberOf _
	   * @since 1.1.0
	   * @category Util
	   * @param {Object} [context=root] The context object.
	   * @returns {Function} Returns a new `lodash` function.
	   * @example
	   *
	   * _.mixin({ 'foo': _.constant('foo') });
	   *
	   * var lodash = _.runInContext();
	   * lodash.mixin({ 'bar': lodash.constant('bar') });
	   *
	   * _.isFunction(_.foo);
	   * // => true
	   * _.isFunction(_.bar);
	   * // => false
	   *
	   * lodash.isFunction(lodash.foo);
	   * // => false
	   * lodash.isFunction(lodash.bar);
	   * // => true
	   *
	   * // Create a suped-up `defer` in Node.js.
	   * var defer = _.runInContext({ 'setTimeout': setImmediate }).defer;
	   */var runInContext=function runInContext(context){context=context==null?root:_.defaults(root.Object(),context,_.pick(root,contextProps));/** Built-in constructor references. */var Array=context.Array,Date=context.Date,Error=context.Error,Function=context.Function,Math=context.Math,Object=context.Object,RegExp=context.RegExp,String=context.String,TypeError=context.TypeError;/** Used for built-in method references. */var arrayProto=Array.prototype,funcProto=Function.prototype,objectProto=Object.prototype;/** Used to detect overreaching core-js shims. */var coreJsData=context['__core-js_shared__'];/** Used to resolve the decompiled source of functions. */var funcToString=funcProto.toString;/** Used to check objects for own properties. */var hasOwnProperty=objectProto.hasOwnProperty;/** Used to generate unique IDs. */var idCounter=0;/** Used to detect methods masquerading as native. */var maskSrcKey=function(){var uid=/[^.]+$/.exec(coreJsData&&coreJsData.keys&&coreJsData.keys.IE_PROTO||'');return uid?'Symbol(src)_1.'+uid:'';}();/**
	     * Used to resolve the
	     * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	     * of values.
	     */var nativeObjectToString=objectProto.toString;/** Used to infer the `Object` constructor. */var objectCtorString=funcToString.call(Object);/** Used to restore the original `_` reference in `_.noConflict`. */var oldDash=root._;/** Used to detect if a method is native. */var reIsNative=RegExp('^'+funcToString.call(hasOwnProperty).replace(reRegExpChar,'\\$&').replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,'$1.*?')+'$');/** Built-in value references. */var Buffer=moduleExports?context.Buffer:undefined,_Symbol=context.Symbol,Uint8Array=context.Uint8Array,allocUnsafe=Buffer?Buffer.allocUnsafe:undefined,getPrototype=overArg(Object.getPrototypeOf,Object),objectCreate=Object.create,propertyIsEnumerable=objectProto.propertyIsEnumerable,splice=arrayProto.splice,spreadableSymbol=_Symbol?_Symbol.isConcatSpreadable:undefined,symIterator=_Symbol?_Symbol.iterator:undefined,symToStringTag=_Symbol?_Symbol.toStringTag:undefined;var defineProperty=function(){try{var func=getNative(Object,'defineProperty');func({},'',{});return func;}catch(e){}}();/** Mocked built-ins. */var ctxClearTimeout=context.clearTimeout!==root.clearTimeout&&context.clearTimeout,ctxNow=Date&&Date.now!==root.Date.now&&Date.now,ctxSetTimeout=context.setTimeout!==root.setTimeout&&context.setTimeout;/* Built-in method references for those with the same name as other `lodash` methods. */var nativeCeil=Math.ceil,nativeFloor=Math.floor,nativeGetSymbols=Object.getOwnPropertySymbols,nativeIsBuffer=Buffer?Buffer.isBuffer:undefined,nativeIsFinite=context.isFinite,nativeJoin=arrayProto.join,nativeKeys=overArg(Object.keys,Object),nativeMax=Math.max,nativeMin=Math.min,nativeNow=Date.now,nativeParseInt=context.parseInt,nativeRandom=Math.random,nativeReverse=arrayProto.reverse;/* Built-in method references that are verified to be native. */var DataView=getNative(context,'DataView'),Map=getNative(context,'Map'),Promise=getNative(context,'Promise'),Set=getNative(context,'Set'),WeakMap=getNative(context,'WeakMap'),nativeCreate=getNative(Object,'create');/** Used to store function metadata. */var metaMap=WeakMap&&new WeakMap();/** Used to lookup unminified function names. */var realNames={};/** Used to detect maps, sets, and weakmaps. */var dataViewCtorString=toSource(DataView),mapCtorString=toSource(Map),promiseCtorString=toSource(Promise),setCtorString=toSource(Set),weakMapCtorString=toSource(WeakMap);/** Used to convert symbols to primitives and strings. */var symbolProto=_Symbol?_Symbol.prototype:undefined,symbolValueOf=symbolProto?symbolProto.valueOf:undefined,symbolToString=symbolProto?symbolProto.toString:undefined;/*------------------------------------------------------------------------*//**
	     * Creates a `lodash` object which wraps `value` to enable implicit method
	     * chain sequences. Methods that operate on and return arrays, collections,
	     * and functions can be chained together. Methods that retrieve a single value
	     * or may return a primitive value will automatically end the chain sequence
	     * and return the unwrapped value. Otherwise, the value must be unwrapped
	     * with `_#value`.
	     *
	     * Explicit chain sequences, which must be unwrapped with `_#value`, may be
	     * enabled using `_.chain`.
	     *
	     * The execution of chained methods is lazy, that is, it's deferred until
	     * `_#value` is implicitly or explicitly called.
	     *
	     * Lazy evaluation allows several methods to support shortcut fusion.
	     * Shortcut fusion is an optimization to merge iteratee calls; this avoids
	     * the creation of intermediate arrays and can greatly reduce the number of
	     * iteratee executions. Sections of a chain sequence qualify for shortcut
	     * fusion if the section is applied to an array of at least `200` elements
	     * and any iteratees accept only one argument. The heuristic for whether a
	     * section qualifies for shortcut fusion is subject to change.
	     *
	     * Chaining is supported in custom builds as long as the `_#value` method is
	     * directly or indirectly included in the build.
	     *
	     * In addition to lodash methods, wrappers have `Array` and `String` methods.
	     *
	     * The wrapper `Array` methods are:
	     * `concat`, `join`, `pop`, `push`, `shift`, `sort`, `splice`, and `unshift`
	     *
	     * The wrapper `String` methods are:
	     * `replace` and `split`
	     *
	     * The wrapper methods that support shortcut fusion are:
	     * `at`, `compact`, `drop`, `dropRight`, `dropWhile`, `filter`, `find`,
	     * `findLast`, `head`, `initial`, `last`, `map`, `reject`, `reverse`, `slice`,
	     * `tail`, `take`, `takeRight`, `takeRightWhile`, `takeWhile`, and `toArray`
	     *
	     * The chainable wrapper methods are:
	     * `after`, `ary`, `assign`, `assignIn`, `assignInWith`, `assignWith`, `at`,
	     * `before`, `bind`, `bindAll`, `bindKey`, `castArray`, `chain`, `chunk`,
	     * `commit`, `compact`, `concat`, `conforms`, `constant`, `countBy`, `create`,
	     * `curry`, `debounce`, `defaults`, `defaultsDeep`, `defer`, `delay`,
	     * `difference`, `differenceBy`, `differenceWith`, `drop`, `dropRight`,
	     * `dropRightWhile`, `dropWhile`, `extend`, `extendWith`, `fill`, `filter`,
	     * `flatMap`, `flatMapDeep`, `flatMapDepth`, `flatten`, `flattenDeep`,
	     * `flattenDepth`, `flip`, `flow`, `flowRight`, `fromPairs`, `functions`,
	     * `functionsIn`, `groupBy`, `initial`, `intersection`, `intersectionBy`,
	     * `intersectionWith`, `invert`, `invertBy`, `invokeMap`, `iteratee`, `keyBy`,
	     * `keys`, `keysIn`, `map`, `mapKeys`, `mapValues`, `matches`, `matchesProperty`,
	     * `memoize`, `merge`, `mergeWith`, `method`, `methodOf`, `mixin`, `negate`,
	     * `nthArg`, `omit`, `omitBy`, `once`, `orderBy`, `over`, `overArgs`,
	     * `overEvery`, `overSome`, `partial`, `partialRight`, `partition`, `pick`,
	     * `pickBy`, `plant`, `property`, `propertyOf`, `pull`, `pullAll`, `pullAllBy`,
	     * `pullAllWith`, `pullAt`, `push`, `range`, `rangeRight`, `rearg`, `reject`,
	     * `remove`, `rest`, `reverse`, `sampleSize`, `set`, `setWith`, `shuffle`,
	     * `slice`, `sort`, `sortBy`, `splice`, `spread`, `tail`, `take`, `takeRight`,
	     * `takeRightWhile`, `takeWhile`, `tap`, `throttle`, `thru`, `toArray`,
	     * `toPairs`, `toPairsIn`, `toPath`, `toPlainObject`, `transform`, `unary`,
	     * `union`, `unionBy`, `unionWith`, `uniq`, `uniqBy`, `uniqWith`, `unset`,
	     * `unshift`, `unzip`, `unzipWith`, `update`, `updateWith`, `values`,
	     * `valuesIn`, `without`, `wrap`, `xor`, `xorBy`, `xorWith`, `zip`,
	     * `zipObject`, `zipObjectDeep`, and `zipWith`
	     *
	     * The wrapper methods that are **not** chainable by default are:
	     * `add`, `attempt`, `camelCase`, `capitalize`, `ceil`, `clamp`, `clone`,
	     * `cloneDeep`, `cloneDeepWith`, `cloneWith`, `conformsTo`, `deburr`,
	     * `defaultTo`, `divide`, `each`, `eachRight`, `endsWith`, `eq`, `escape`,
	     * `escapeRegExp`, `every`, `find`, `findIndex`, `findKey`, `findLast`,
	     * `findLastIndex`, `findLastKey`, `first`, `floor`, `forEach`, `forEachRight`,
	     * `forIn`, `forInRight`, `forOwn`, `forOwnRight`, `get`, `gt`, `gte`, `has`,
	     * `hasIn`, `head`, `identity`, `includes`, `indexOf`, `inRange`, `invoke`,
	     * `isArguments`, `isArray`, `isArrayBuffer`, `isArrayLike`, `isArrayLikeObject`,
	     * `isBoolean`, `isBuffer`, `isDate`, `isElement`, `isEmpty`, `isEqual`,
	     * `isEqualWith`, `isError`, `isFinite`, `isFunction`, `isInteger`, `isLength`,
	     * `isMap`, `isMatch`, `isMatchWith`, `isNaN`, `isNative`, `isNil`, `isNull`,
	     * `isNumber`, `isObject`, `isObjectLike`, `isPlainObject`, `isRegExp`,
	     * `isSafeInteger`, `isSet`, `isString`, `isUndefined`, `isTypedArray`,
	     * `isWeakMap`, `isWeakSet`, `join`, `kebabCase`, `last`, `lastIndexOf`,
	     * `lowerCase`, `lowerFirst`, `lt`, `lte`, `max`, `maxBy`, `mean`, `meanBy`,
	     * `min`, `minBy`, `multiply`, `noConflict`, `noop`, `now`, `nth`, `pad`,
	     * `padEnd`, `padStart`, `parseInt`, `pop`, `random`, `reduce`, `reduceRight`,
	     * `repeat`, `result`, `round`, `runInContext`, `sample`, `shift`, `size`,
	     * `snakeCase`, `some`, `sortedIndex`, `sortedIndexBy`, `sortedLastIndex`,
	     * `sortedLastIndexBy`, `startCase`, `startsWith`, `stubArray`, `stubFalse`,
	     * `stubObject`, `stubString`, `stubTrue`, `subtract`, `sum`, `sumBy`,
	     * `template`, `times`, `toFinite`, `toInteger`, `toJSON`, `toLength`,
	     * `toLower`, `toNumber`, `toSafeInteger`, `toString`, `toUpper`, `trim`,
	     * `trimEnd`, `trimStart`, `truncate`, `unescape`, `uniqueId`, `upperCase`,
	     * `upperFirst`, `value`, and `words`
	     *
	     * @name _
	     * @constructor
	     * @category Seq
	     * @param {*} value The value to wrap in a `lodash` instance.
	     * @returns {Object} Returns the new `lodash` wrapper instance.
	     * @example
	     *
	     * function square(n) {
	     *   return n * n;
	     * }
	     *
	     * var wrapped = _([1, 2, 3]);
	     *
	     * // Returns an unwrapped value.
	     * wrapped.reduce(_.add);
	     * // => 6
	     *
	     * // Returns a wrapped value.
	     * var squares = wrapped.map(square);
	     *
	     * _.isArray(squares);
	     * // => false
	     *
	     * _.isArray(squares.value());
	     * // => true
	     */function lodash(value){if(isObjectLike(value)&&!isArray(value)&&!(value instanceof LazyWrapper)){if(value instanceof LodashWrapper){return value;}if(hasOwnProperty.call(value,'__wrapped__')){return wrapperClone(value);}}return new LodashWrapper(value);}/**
	     * The base implementation of `_.create` without support for assigning
	     * properties to the created object.
	     *
	     * @private
	     * @param {Object} proto The object to inherit from.
	     * @returns {Object} Returns the new object.
	     */var baseCreate=function(){function object(){}return function(proto){if(!isObject(proto)){return{};}if(objectCreate){return objectCreate(proto);}object.prototype=proto;var result=new object();object.prototype=undefined;return result;};}();/**
	     * The function whose prototype chain sequence wrappers inherit from.
	     *
	     * @private
	     */function baseLodash(){}// No operation performed.
	/**
	     * The base constructor for creating `lodash` wrapper objects.
	     *
	     * @private
	     * @param {*} value The value to wrap.
	     * @param {boolean} [chainAll] Enable explicit method chain sequences.
	     */function LodashWrapper(value,chainAll){this.__wrapped__=value;this.__actions__=[];this.__chain__=!!chainAll;this.__index__=0;this.__values__=undefined;}/**
	     * By default, the template delimiters used by lodash are like those in
	     * embedded Ruby (ERB). Change the following template settings to use
	     * alternative delimiters.
	     *
	     * @static
	     * @memberOf _
	     * @type {Object}
	     */lodash.templateSettings={/**
	       * Used to detect `data` property values to be HTML-escaped.
	       *
	       * @memberOf _.templateSettings
	       * @type {RegExp}
	       */'escape':reEscape,/**
	       * Used to detect code to be evaluated.
	       *
	       * @memberOf _.templateSettings
	       * @type {RegExp}
	       */'evaluate':reEvaluate,/**
	       * Used to detect `data` property values to inject.
	       *
	       * @memberOf _.templateSettings
	       * @type {RegExp}
	       */'interpolate':reInterpolate,/**
	       * Used to reference the data object in the template text.
	       *
	       * @memberOf _.templateSettings
	       * @type {string}
	       */'variable':'',/**
	       * Used to import variables into the compiled template.
	       *
	       * @memberOf _.templateSettings
	       * @type {Object}
	       */'imports':{/**
	         * A reference to the `lodash` function.
	         *
	         * @memberOf _.templateSettings.imports
	         * @type {Function}
	         */'_':lodash}};// Ensure wrappers are instances of `baseLodash`.
	lodash.prototype=baseLodash.prototype;lodash.prototype.constructor=lodash;LodashWrapper.prototype=baseCreate(baseLodash.prototype);LodashWrapper.prototype.constructor=LodashWrapper;/*------------------------------------------------------------------------*//**
	     * Creates a lazy wrapper object which wraps `value` to enable lazy evaluation.
	     *
	     * @private
	     * @constructor
	     * @param {*} value The value to wrap.
	     */function LazyWrapper(value){this.__wrapped__=value;this.__actions__=[];this.__dir__=1;this.__filtered__=false;this.__iteratees__=[];this.__takeCount__=MAX_ARRAY_LENGTH;this.__views__=[];}/**
	     * Creates a clone of the lazy wrapper object.
	     *
	     * @private
	     * @name clone
	     * @memberOf LazyWrapper
	     * @returns {Object} Returns the cloned `LazyWrapper` object.
	     */function lazyClone(){var result=new LazyWrapper(this.__wrapped__);result.__actions__=copyArray(this.__actions__);result.__dir__=this.__dir__;result.__filtered__=this.__filtered__;result.__iteratees__=copyArray(this.__iteratees__);result.__takeCount__=this.__takeCount__;result.__views__=copyArray(this.__views__);return result;}/**
	     * Reverses the direction of lazy iteration.
	     *
	     * @private
	     * @name reverse
	     * @memberOf LazyWrapper
	     * @returns {Object} Returns the new reversed `LazyWrapper` object.
	     */function lazyReverse(){if(this.__filtered__){var result=new LazyWrapper(this);result.__dir__=-1;result.__filtered__=true;}else{result=this.clone();result.__dir__*=-1;}return result;}/**
	     * Extracts the unwrapped value from its lazy wrapper.
	     *
	     * @private
	     * @name value
	     * @memberOf LazyWrapper
	     * @returns {*} Returns the unwrapped value.
	     */function lazyValue(){var array=this.__wrapped__.value(),dir=this.__dir__,isArr=isArray(array),isRight=dir<0,arrLength=isArr?array.length:0,view=getView(0,arrLength,this.__views__),start=view.start,end=view.end,length=end-start,index=isRight?end:start-1,iteratees=this.__iteratees__,iterLength=iteratees.length,resIndex=0,takeCount=nativeMin(length,this.__takeCount__);if(!isArr||arrLength<LARGE_ARRAY_SIZE||arrLength==length&&takeCount==length){return baseWrapperValue(array,this.__actions__);}var result=[];outer:while(length--&&resIndex<takeCount){index+=dir;var iterIndex=-1,value=array[index];while(++iterIndex<iterLength){var data=iteratees[iterIndex],iteratee=data.iteratee,type=data.type,computed=iteratee(value);if(type==LAZY_MAP_FLAG){value=computed;}else if(!computed){if(type==LAZY_FILTER_FLAG){continue outer;}else{break outer;}}}result[resIndex++]=value;}return result;}// Ensure `LazyWrapper` is an instance of `baseLodash`.
	LazyWrapper.prototype=baseCreate(baseLodash.prototype);LazyWrapper.prototype.constructor=LazyWrapper;/*------------------------------------------------------------------------*//**
	     * Creates a hash object.
	     *
	     * @private
	     * @constructor
	     * @param {Array} [entries] The key-value pairs to cache.
	     */function Hash(entries){var index=-1,length=entries==null?0:entries.length;this.clear();while(++index<length){var entry=entries[index];this.set(entry[0],entry[1]);}}/**
	     * Removes all key-value entries from the hash.
	     *
	     * @private
	     * @name clear
	     * @memberOf Hash
	     */function hashClear(){this.__data__=nativeCreate?nativeCreate(null):{};this.size=0;}/**
	     * Removes `key` and its value from the hash.
	     *
	     * @private
	     * @name delete
	     * @memberOf Hash
	     * @param {Object} hash The hash to modify.
	     * @param {string} key The key of the value to remove.
	     * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	     */function hashDelete(key){var result=this.has(key)&&delete this.__data__[key];this.size-=result?1:0;return result;}/**
	     * Gets the hash value for `key`.
	     *
	     * @private
	     * @name get
	     * @memberOf Hash
	     * @param {string} key The key of the value to get.
	     * @returns {*} Returns the entry value.
	     */function hashGet(key){var data=this.__data__;if(nativeCreate){var result=data[key];return result===HASH_UNDEFINED?undefined:result;}return hasOwnProperty.call(data,key)?data[key]:undefined;}/**
	     * Checks if a hash value for `key` exists.
	     *
	     * @private
	     * @name has
	     * @memberOf Hash
	     * @param {string} key The key of the entry to check.
	     * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	     */function hashHas(key){var data=this.__data__;return nativeCreate?data[key]!==undefined:hasOwnProperty.call(data,key);}/**
	     * Sets the hash `key` to `value`.
	     *
	     * @private
	     * @name set
	     * @memberOf Hash
	     * @param {string} key The key of the value to set.
	     * @param {*} value The value to set.
	     * @returns {Object} Returns the hash instance.
	     */function hashSet(key,value){var data=this.__data__;this.size+=this.has(key)?0:1;data[key]=nativeCreate&&value===undefined?HASH_UNDEFINED:value;return this;}// Add methods to `Hash`.
	Hash.prototype.clear=hashClear;Hash.prototype['delete']=hashDelete;Hash.prototype.get=hashGet;Hash.prototype.has=hashHas;Hash.prototype.set=hashSet;/*------------------------------------------------------------------------*//**
	     * Creates an list cache object.
	     *
	     * @private
	     * @constructor
	     * @param {Array} [entries] The key-value pairs to cache.
	     */function ListCache(entries){var index=-1,length=entries==null?0:entries.length;this.clear();while(++index<length){var entry=entries[index];this.set(entry[0],entry[1]);}}/**
	     * Removes all key-value entries from the list cache.
	     *
	     * @private
	     * @name clear
	     * @memberOf ListCache
	     */function listCacheClear(){this.__data__=[];this.size=0;}/**
	     * Removes `key` and its value from the list cache.
	     *
	     * @private
	     * @name delete
	     * @memberOf ListCache
	     * @param {string} key The key of the value to remove.
	     * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	     */function listCacheDelete(key){var data=this.__data__,index=assocIndexOf(data,key);if(index<0){return false;}var lastIndex=data.length-1;if(index==lastIndex){data.pop();}else{splice.call(data,index,1);}--this.size;return true;}/**
	     * Gets the list cache value for `key`.
	     *
	     * @private
	     * @name get
	     * @memberOf ListCache
	     * @param {string} key The key of the value to get.
	     * @returns {*} Returns the entry value.
	     */function listCacheGet(key){var data=this.__data__,index=assocIndexOf(data,key);return index<0?undefined:data[index][1];}/**
	     * Checks if a list cache value for `key` exists.
	     *
	     * @private
	     * @name has
	     * @memberOf ListCache
	     * @param {string} key The key of the entry to check.
	     * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	     */function listCacheHas(key){return assocIndexOf(this.__data__,key)>-1;}/**
	     * Sets the list cache `key` to `value`.
	     *
	     * @private
	     * @name set
	     * @memberOf ListCache
	     * @param {string} key The key of the value to set.
	     * @param {*} value The value to set.
	     * @returns {Object} Returns the list cache instance.
	     */function listCacheSet(key,value){var data=this.__data__,index=assocIndexOf(data,key);if(index<0){++this.size;data.push([key,value]);}else{data[index][1]=value;}return this;}// Add methods to `ListCache`.
	ListCache.prototype.clear=listCacheClear;ListCache.prototype['delete']=listCacheDelete;ListCache.prototype.get=listCacheGet;ListCache.prototype.has=listCacheHas;ListCache.prototype.set=listCacheSet;/*------------------------------------------------------------------------*//**
	     * Creates a map cache object to store key-value pairs.
	     *
	     * @private
	     * @constructor
	     * @param {Array} [entries] The key-value pairs to cache.
	     */function MapCache(entries){var index=-1,length=entries==null?0:entries.length;this.clear();while(++index<length){var entry=entries[index];this.set(entry[0],entry[1]);}}/**
	     * Removes all key-value entries from the map.
	     *
	     * @private
	     * @name clear
	     * @memberOf MapCache
	     */function mapCacheClear(){this.size=0;this.__data__={'hash':new Hash(),'map':new(Map||ListCache)(),'string':new Hash()};}/**
	     * Removes `key` and its value from the map.
	     *
	     * @private
	     * @name delete
	     * @memberOf MapCache
	     * @param {string} key The key of the value to remove.
	     * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	     */function mapCacheDelete(key){var result=getMapData(this,key)['delete'](key);this.size-=result?1:0;return result;}/**
	     * Gets the map value for `key`.
	     *
	     * @private
	     * @name get
	     * @memberOf MapCache
	     * @param {string} key The key of the value to get.
	     * @returns {*} Returns the entry value.
	     */function mapCacheGet(key){return getMapData(this,key).get(key);}/**
	     * Checks if a map value for `key` exists.
	     *
	     * @private
	     * @name has
	     * @memberOf MapCache
	     * @param {string} key The key of the entry to check.
	     * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	     */function mapCacheHas(key){return getMapData(this,key).has(key);}/**
	     * Sets the map `key` to `value`.
	     *
	     * @private
	     * @name set
	     * @memberOf MapCache
	     * @param {string} key The key of the value to set.
	     * @param {*} value The value to set.
	     * @returns {Object} Returns the map cache instance.
	     */function mapCacheSet(key,value){var data=getMapData(this,key),size=data.size;data.set(key,value);this.size+=data.size==size?0:1;return this;}// Add methods to `MapCache`.
	MapCache.prototype.clear=mapCacheClear;MapCache.prototype['delete']=mapCacheDelete;MapCache.prototype.get=mapCacheGet;MapCache.prototype.has=mapCacheHas;MapCache.prototype.set=mapCacheSet;/*------------------------------------------------------------------------*//**
	     *
	     * Creates an array cache object to store unique values.
	     *
	     * @private
	     * @constructor
	     * @param {Array} [values] The values to cache.
	     */function SetCache(values){var index=-1,length=values==null?0:values.length;this.__data__=new MapCache();while(++index<length){this.add(values[index]);}}/**
	     * Adds `value` to the array cache.
	     *
	     * @private
	     * @name add
	     * @memberOf SetCache
	     * @alias push
	     * @param {*} value The value to cache.
	     * @returns {Object} Returns the cache instance.
	     */function setCacheAdd(value){this.__data__.set(value,HASH_UNDEFINED);return this;}/**
	     * Checks if `value` is in the array cache.
	     *
	     * @private
	     * @name has
	     * @memberOf SetCache
	     * @param {*} value The value to search for.
	     * @returns {number} Returns `true` if `value` is found, else `false`.
	     */function setCacheHas(value){return this.__data__.has(value);}// Add methods to `SetCache`.
	SetCache.prototype.add=SetCache.prototype.push=setCacheAdd;SetCache.prototype.has=setCacheHas;/*------------------------------------------------------------------------*//**
	     * Creates a stack cache object to store key-value pairs.
	     *
	     * @private
	     * @constructor
	     * @param {Array} [entries] The key-value pairs to cache.
	     */function Stack(entries){var data=this.__data__=new ListCache(entries);this.size=data.size;}/**
	     * Removes all key-value entries from the stack.
	     *
	     * @private
	     * @name clear
	     * @memberOf Stack
	     */function stackClear(){this.__data__=new ListCache();this.size=0;}/**
	     * Removes `key` and its value from the stack.
	     *
	     * @private
	     * @name delete
	     * @memberOf Stack
	     * @param {string} key The key of the value to remove.
	     * @returns {boolean} Returns `true` if the entry was removed, else `false`.
	     */function stackDelete(key){var data=this.__data__,result=data['delete'](key);this.size=data.size;return result;}/**
	     * Gets the stack value for `key`.
	     *
	     * @private
	     * @name get
	     * @memberOf Stack
	     * @param {string} key The key of the value to get.
	     * @returns {*} Returns the entry value.
	     */function stackGet(key){return this.__data__.get(key);}/**
	     * Checks if a stack value for `key` exists.
	     *
	     * @private
	     * @name has
	     * @memberOf Stack
	     * @param {string} key The key of the entry to check.
	     * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
	     */function stackHas(key){return this.__data__.has(key);}/**
	     * Sets the stack `key` to `value`.
	     *
	     * @private
	     * @name set
	     * @memberOf Stack
	     * @param {string} key The key of the value to set.
	     * @param {*} value The value to set.
	     * @returns {Object} Returns the stack cache instance.
	     */function stackSet(key,value){var data=this.__data__;if(data instanceof ListCache){var pairs=data.__data__;if(!Map||pairs.length<LARGE_ARRAY_SIZE-1){pairs.push([key,value]);this.size=++data.size;return this;}data=this.__data__=new MapCache(pairs);}data.set(key,value);this.size=data.size;return this;}// Add methods to `Stack`.
	Stack.prototype.clear=stackClear;Stack.prototype['delete']=stackDelete;Stack.prototype.get=stackGet;Stack.prototype.has=stackHas;Stack.prototype.set=stackSet;/*------------------------------------------------------------------------*//**
	     * Creates an array of the enumerable property names of the array-like `value`.
	     *
	     * @private
	     * @param {*} value The value to query.
	     * @param {boolean} inherited Specify returning inherited property names.
	     * @returns {Array} Returns the array of property names.
	     */function arrayLikeKeys(value,inherited){var isArr=isArray(value),isArg=!isArr&&isArguments(value),isBuff=!isArr&&!isArg&&isBuffer(value),isType=!isArr&&!isArg&&!isBuff&&isTypedArray(value),skipIndexes=isArr||isArg||isBuff||isType,result=skipIndexes?baseTimes(value.length,String):[],length=result.length;for(var key in value){if((inherited||hasOwnProperty.call(value,key))&&!(skipIndexes&&(// Safari 9 has enumerable `arguments.length` in strict mode.
	key=='length'||// Node.js 0.10 has enumerable non-index properties on buffers.
	isBuff&&(key=='offset'||key=='parent')||// PhantomJS 2 has enumerable non-index properties on typed arrays.
	isType&&(key=='buffer'||key=='byteLength'||key=='byteOffset')||// Skip index properties.
	isIndex(key,length)))){result.push(key);}}return result;}/**
	     * A specialized version of `_.sample` for arrays.
	     *
	     * @private
	     * @param {Array} array The array to sample.
	     * @returns {*} Returns the random element.
	     */function arraySample(array){var length=array.length;return length?array[baseRandom(0,length-1)]:undefined;}/**
	     * A specialized version of `_.sampleSize` for arrays.
	     *
	     * @private
	     * @param {Array} array The array to sample.
	     * @param {number} n The number of elements to sample.
	     * @returns {Array} Returns the random elements.
	     */function arraySampleSize(array,n){return shuffleSelf(copyArray(array),baseClamp(n,0,array.length));}/**
	     * A specialized version of `_.shuffle` for arrays.
	     *
	     * @private
	     * @param {Array} array The array to shuffle.
	     * @returns {Array} Returns the new shuffled array.
	     */function arrayShuffle(array){return shuffleSelf(copyArray(array));}/**
	     * Used by `_.defaults` to customize its `_.assignIn` use.
	     *
	     * @private
	     * @param {*} objValue The destination value.
	     * @param {*} srcValue The source value.
	     * @param {string} key The key of the property to assign.
	     * @param {Object} object The parent object of `objValue`.
	     * @returns {*} Returns the value to assign.
	     */function assignInDefaults(objValue,srcValue,key,object){if(objValue===undefined||eq(objValue,objectProto[key])&&!hasOwnProperty.call(object,key)){return srcValue;}return objValue;}/**
	     * This function is like `assignValue` except that it doesn't assign
	     * `undefined` values.
	     *
	     * @private
	     * @param {Object} object The object to modify.
	     * @param {string} key The key of the property to assign.
	     * @param {*} value The value to assign.
	     */function assignMergeValue(object,key,value){if(value!==undefined&&!eq(object[key],value)||value===undefined&&!(key in object)){baseAssignValue(object,key,value);}}/**
	     * Assigns `value` to `key` of `object` if the existing value is not equivalent
	     * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	     * for equality comparisons.
	     *
	     * @private
	     * @param {Object} object The object to modify.
	     * @param {string} key The key of the property to assign.
	     * @param {*} value The value to assign.
	     */function assignValue(object,key,value){var objValue=object[key];if(!(hasOwnProperty.call(object,key)&&eq(objValue,value))||value===undefined&&!(key in object)){baseAssignValue(object,key,value);}}/**
	     * Gets the index at which the `key` is found in `array` of key-value pairs.
	     *
	     * @private
	     * @param {Array} array The array to inspect.
	     * @param {*} key The key to search for.
	     * @returns {number} Returns the index of the matched value, else `-1`.
	     */function assocIndexOf(array,key){var length=array.length;while(length--){if(eq(array[length][0],key)){return length;}}return-1;}/**
	     * Aggregates elements of `collection` on `accumulator` with keys transformed
	     * by `iteratee` and values set by `setter`.
	     *
	     * @private
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} setter The function to set `accumulator` values.
	     * @param {Function} iteratee The iteratee to transform keys.
	     * @param {Object} accumulator The initial aggregated object.
	     * @returns {Function} Returns `accumulator`.
	     */function baseAggregator(collection,setter,iteratee,accumulator){baseEach(collection,function(value,key,collection){setter(accumulator,value,iteratee(value),collection);});return accumulator;}/**
	     * The base implementation of `_.assign` without support for multiple sources
	     * or `customizer` functions.
	     *
	     * @private
	     * @param {Object} object The destination object.
	     * @param {Object} source The source object.
	     * @returns {Object} Returns `object`.
	     */function baseAssign(object,source){return object&&copyObject(source,keys(source),object);}/**
	     * The base implementation of `_.assignIn` without support for multiple sources
	     * or `customizer` functions.
	     *
	     * @private
	     * @param {Object} object The destination object.
	     * @param {Object} source The source object.
	     * @returns {Object} Returns `object`.
	     */function baseAssignIn(object,source){return object&&copyObject(source,keysIn(source),object);}/**
	     * The base implementation of `assignValue` and `assignMergeValue` without
	     * value checks.
	     *
	     * @private
	     * @param {Object} object The object to modify.
	     * @param {string} key The key of the property to assign.
	     * @param {*} value The value to assign.
	     */function baseAssignValue(object,key,value){if(key=='__proto__'&&defineProperty){defineProperty(object,key,{'configurable':true,'enumerable':true,'value':value,'writable':true});}else{object[key]=value;}}/**
	     * The base implementation of `_.at` without support for individual paths.
	     *
	     * @private
	     * @param {Object} object The object to iterate over.
	     * @param {string[]} paths The property paths to pick.
	     * @returns {Array} Returns the picked elements.
	     */function baseAt(object,paths){var index=-1,length=paths.length,result=Array(length),skip=object==null;while(++index<length){result[index]=skip?undefined:get(object,paths[index]);}return result;}/**
	     * The base implementation of `_.clamp` which doesn't coerce arguments.
	     *
	     * @private
	     * @param {number} number The number to clamp.
	     * @param {number} [lower] The lower bound.
	     * @param {number} upper The upper bound.
	     * @returns {number} Returns the clamped number.
	     */function baseClamp(number,lower,upper){if(number===number){if(upper!==undefined){number=number<=upper?number:upper;}if(lower!==undefined){number=number>=lower?number:lower;}}return number;}/**
	     * The base implementation of `_.clone` and `_.cloneDeep` which tracks
	     * traversed objects.
	     *
	     * @private
	     * @param {*} value The value to clone.
	     * @param {boolean} bitmask The bitmask flags.
	     *  1 - Deep clone
	     *  2 - Flatten inherited properties
	     *  4 - Clone symbols
	     * @param {Function} [customizer] The function to customize cloning.
	     * @param {string} [key] The key of `value`.
	     * @param {Object} [object] The parent object of `value`.
	     * @param {Object} [stack] Tracks traversed objects and their clone counterparts.
	     * @returns {*} Returns the cloned value.
	     */function baseClone(value,bitmask,customizer,key,object,stack){var result,isDeep=bitmask&CLONE_DEEP_FLAG,isFlat=bitmask&CLONE_FLAT_FLAG,isFull=bitmask&CLONE_SYMBOLS_FLAG;if(customizer){result=object?customizer(value,key,object,stack):customizer(value);}if(result!==undefined){return result;}if(!isObject(value)){return value;}var isArr=isArray(value);if(isArr){result=initCloneArray(value);if(!isDeep){return copyArray(value,result);}}else{var tag=getTag(value),isFunc=tag==funcTag||tag==genTag;if(isBuffer(value)){return cloneBuffer(value,isDeep);}if(tag==objectTag||tag==argsTag||isFunc&&!object){result=isFlat||isFunc?{}:initCloneObject(value);if(!isDeep){return isFlat?copySymbolsIn(value,baseAssignIn(result,value)):copySymbols(value,baseAssign(result,value));}}else{if(!cloneableTags[tag]){return object?value:{};}result=initCloneByTag(value,tag,baseClone,isDeep);}}// Check for circular references and return its corresponding clone.
	stack||(stack=new Stack());var stacked=stack.get(value);if(stacked){return stacked;}stack.set(value,result);var keysFunc=isFull?isFlat?getAllKeysIn:getAllKeys:isFlat?keysIn:keys;var props=isArr?undefined:keysFunc(value);arrayEach(props||value,function(subValue,key){if(props){key=subValue;subValue=value[key];}// Recursively populate clone (susceptible to call stack limits).
	assignValue(result,key,baseClone(subValue,bitmask,customizer,key,value,stack));});return result;}/**
	     * The base implementation of `_.conforms` which doesn't clone `source`.
	     *
	     * @private
	     * @param {Object} source The object of property predicates to conform to.
	     * @returns {Function} Returns the new spec function.
	     */function baseConforms(source){var props=keys(source);return function(object){return baseConformsTo(object,source,props);};}/**
	     * The base implementation of `_.conformsTo` which accepts `props` to check.
	     *
	     * @private
	     * @param {Object} object The object to inspect.
	     * @param {Object} source The object of property predicates to conform to.
	     * @returns {boolean} Returns `true` if `object` conforms, else `false`.
	     */function baseConformsTo(object,source,props){var length=props.length;if(object==null){return!length;}object=Object(object);while(length--){var key=props[length],predicate=source[key],value=object[key];if(value===undefined&&!(key in object)||!predicate(value)){return false;}}return true;}/**
	     * The base implementation of `_.delay` and `_.defer` which accepts `args`
	     * to provide to `func`.
	     *
	     * @private
	     * @param {Function} func The function to delay.
	     * @param {number} wait The number of milliseconds to delay invocation.
	     * @param {Array} args The arguments to provide to `func`.
	     * @returns {number|Object} Returns the timer id or timeout object.
	     */function baseDelay(func,wait,args){if(typeof func!='function'){throw new TypeError(FUNC_ERROR_TEXT);}return setTimeout(function(){func.apply(undefined,args);},wait);}/**
	     * The base implementation of methods like `_.difference` without support
	     * for excluding multiple arrays or iteratee shorthands.
	     *
	     * @private
	     * @param {Array} array The array to inspect.
	     * @param {Array} values The values to exclude.
	     * @param {Function} [iteratee] The iteratee invoked per element.
	     * @param {Function} [comparator] The comparator invoked per element.
	     * @returns {Array} Returns the new array of filtered values.
	     */function baseDifference(array,values,iteratee,comparator){var index=-1,includes=arrayIncludes,isCommon=true,length=array.length,result=[],valuesLength=values.length;if(!length){return result;}if(iteratee){values=arrayMap(values,baseUnary(iteratee));}if(comparator){includes=arrayIncludesWith;isCommon=false;}else if(values.length>=LARGE_ARRAY_SIZE){includes=cacheHas;isCommon=false;values=new SetCache(values);}outer:while(++index<length){var value=array[index],computed=iteratee==null?value:iteratee(value);value=comparator||value!==0?value:0;if(isCommon&&computed===computed){var valuesIndex=valuesLength;while(valuesIndex--){if(values[valuesIndex]===computed){continue outer;}}result.push(value);}else if(!includes(values,computed,comparator)){result.push(value);}}return result;}/**
	     * The base implementation of `_.forEach` without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} iteratee The function invoked per iteration.
	     * @returns {Array|Object} Returns `collection`.
	     */var baseEach=createBaseEach(baseForOwn);/**
	     * The base implementation of `_.forEachRight` without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} iteratee The function invoked per iteration.
	     * @returns {Array|Object} Returns `collection`.
	     */var baseEachRight=createBaseEach(baseForOwnRight,true);/**
	     * The base implementation of `_.every` without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} predicate The function invoked per iteration.
	     * @returns {boolean} Returns `true` if all elements pass the predicate check,
	     *  else `false`
	     */function baseEvery(collection,predicate){var result=true;baseEach(collection,function(value,index,collection){result=!!predicate(value,index,collection);return result;});return result;}/**
	     * The base implementation of methods like `_.max` and `_.min` which accepts a
	     * `comparator` to determine the extremum value.
	     *
	     * @private
	     * @param {Array} array The array to iterate over.
	     * @param {Function} iteratee The iteratee invoked per iteration.
	     * @param {Function} comparator The comparator used to compare values.
	     * @returns {*} Returns the extremum value.
	     */function baseExtremum(array,iteratee,comparator){var index=-1,length=array.length;while(++index<length){var value=array[index],current=iteratee(value);if(current!=null&&(computed===undefined?current===current&&!isSymbol(current):comparator(current,computed))){var computed=current,result=value;}}return result;}/**
	     * The base implementation of `_.fill` without an iteratee call guard.
	     *
	     * @private
	     * @param {Array} array The array to fill.
	     * @param {*} value The value to fill `array` with.
	     * @param {number} [start=0] The start position.
	     * @param {number} [end=array.length] The end position.
	     * @returns {Array} Returns `array`.
	     */function baseFill(array,value,start,end){var length=array.length;start=toInteger(start);if(start<0){start=-start>length?0:length+start;}end=end===undefined||end>length?length:toInteger(end);if(end<0){end+=length;}end=start>end?0:toLength(end);while(start<end){array[start++]=value;}return array;}/**
	     * The base implementation of `_.filter` without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} predicate The function invoked per iteration.
	     * @returns {Array} Returns the new filtered array.
	     */function baseFilter(collection,predicate){var result=[];baseEach(collection,function(value,index,collection){if(predicate(value,index,collection)){result.push(value);}});return result;}/**
	     * The base implementation of `_.flatten` with support for restricting flattening.
	     *
	     * @private
	     * @param {Array} array The array to flatten.
	     * @param {number} depth The maximum recursion depth.
	     * @param {boolean} [predicate=isFlattenable] The function invoked per iteration.
	     * @param {boolean} [isStrict] Restrict to values that pass `predicate` checks.
	     * @param {Array} [result=[]] The initial result value.
	     * @returns {Array} Returns the new flattened array.
	     */function baseFlatten(array,depth,predicate,isStrict,result){var index=-1,length=array.length;predicate||(predicate=isFlattenable);result||(result=[]);while(++index<length){var value=array[index];if(depth>0&&predicate(value)){if(depth>1){// Recursively flatten arrays (susceptible to call stack limits).
	baseFlatten(value,depth-1,predicate,isStrict,result);}else{arrayPush(result,value);}}else if(!isStrict){result[result.length]=value;}}return result;}/**
	     * The base implementation of `baseForOwn` which iterates over `object`
	     * properties returned by `keysFunc` and invokes `iteratee` for each property.
	     * Iteratee functions may exit iteration early by explicitly returning `false`.
	     *
	     * @private
	     * @param {Object} object The object to iterate over.
	     * @param {Function} iteratee The function invoked per iteration.
	     * @param {Function} keysFunc The function to get the keys of `object`.
	     * @returns {Object} Returns `object`.
	     */var baseFor=createBaseFor();/**
	     * This function is like `baseFor` except that it iterates over properties
	     * in the opposite order.
	     *
	     * @private
	     * @param {Object} object The object to iterate over.
	     * @param {Function} iteratee The function invoked per iteration.
	     * @param {Function} keysFunc The function to get the keys of `object`.
	     * @returns {Object} Returns `object`.
	     */var baseForRight=createBaseFor(true);/**
	     * The base implementation of `_.forOwn` without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Object} object The object to iterate over.
	     * @param {Function} iteratee The function invoked per iteration.
	     * @returns {Object} Returns `object`.
	     */function baseForOwn(object,iteratee){return object&&baseFor(object,iteratee,keys);}/**
	     * The base implementation of `_.forOwnRight` without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Object} object The object to iterate over.
	     * @param {Function} iteratee The function invoked per iteration.
	     * @returns {Object} Returns `object`.
	     */function baseForOwnRight(object,iteratee){return object&&baseForRight(object,iteratee,keys);}/**
	     * The base implementation of `_.functions` which creates an array of
	     * `object` function property names filtered from `props`.
	     *
	     * @private
	     * @param {Object} object The object to inspect.
	     * @param {Array} props The property names to filter.
	     * @returns {Array} Returns the function names.
	     */function baseFunctions(object,props){return arrayFilter(props,function(key){return isFunction(object[key]);});}/**
	     * The base implementation of `_.get` without support for default values.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @param {Array|string} path The path of the property to get.
	     * @returns {*} Returns the resolved value.
	     */function baseGet(object,path){path=castPath(path,object);var index=0,length=path.length;while(object!=null&&index<length){object=object[toKey(path[index++])];}return index&&index==length?object:undefined;}/**
	     * The base implementation of `getAllKeys` and `getAllKeysIn` which uses
	     * `keysFunc` and `symbolsFunc` to get the enumerable property names and
	     * symbols of `object`.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @param {Function} keysFunc The function to get the keys of `object`.
	     * @param {Function} symbolsFunc The function to get the symbols of `object`.
	     * @returns {Array} Returns the array of property names and symbols.
	     */function baseGetAllKeys(object,keysFunc,symbolsFunc){var result=keysFunc(object);return isArray(object)?result:arrayPush(result,symbolsFunc(object));}/**
	     * The base implementation of `getTag` without fallbacks for buggy environments.
	     *
	     * @private
	     * @param {*} value The value to query.
	     * @returns {string} Returns the `toStringTag`.
	     */function baseGetTag(value){if(value==null){return value===undefined?undefinedTag:nullTag;}value=Object(value);return symToStringTag&&symToStringTag in value?getRawTag(value):objectToString(value);}/**
	     * The base implementation of `_.gt` which doesn't coerce arguments.
	     *
	     * @private
	     * @param {*} value The value to compare.
	     * @param {*} other The other value to compare.
	     * @returns {boolean} Returns `true` if `value` is greater than `other`,
	     *  else `false`.
	     */function baseGt(value,other){return value>other;}/**
	     * The base implementation of `_.has` without support for deep paths.
	     *
	     * @private
	     * @param {Object} [object] The object to query.
	     * @param {Array|string} key The key to check.
	     * @returns {boolean} Returns `true` if `key` exists, else `false`.
	     */function baseHas(object,key){return object!=null&&hasOwnProperty.call(object,key);}/**
	     * The base implementation of `_.hasIn` without support for deep paths.
	     *
	     * @private
	     * @param {Object} [object] The object to query.
	     * @param {Array|string} key The key to check.
	     * @returns {boolean} Returns `true` if `key` exists, else `false`.
	     */function baseHasIn(object,key){return object!=null&&key in Object(object);}/**
	     * The base implementation of `_.inRange` which doesn't coerce arguments.
	     *
	     * @private
	     * @param {number} number The number to check.
	     * @param {number} start The start of the range.
	     * @param {number} end The end of the range.
	     * @returns {boolean} Returns `true` if `number` is in the range, else `false`.
	     */function baseInRange(number,start,end){return number>=nativeMin(start,end)&&number<nativeMax(start,end);}/**
	     * The base implementation of methods like `_.intersection`, without support
	     * for iteratee shorthands, that accepts an array of arrays to inspect.
	     *
	     * @private
	     * @param {Array} arrays The arrays to inspect.
	     * @param {Function} [iteratee] The iteratee invoked per element.
	     * @param {Function} [comparator] The comparator invoked per element.
	     * @returns {Array} Returns the new array of shared values.
	     */function baseIntersection(arrays,iteratee,comparator){var includes=comparator?arrayIncludesWith:arrayIncludes,length=arrays[0].length,othLength=arrays.length,othIndex=othLength,caches=Array(othLength),maxLength=Infinity,result=[];while(othIndex--){var array=arrays[othIndex];if(othIndex&&iteratee){array=arrayMap(array,baseUnary(iteratee));}maxLength=nativeMin(array.length,maxLength);caches[othIndex]=!comparator&&(iteratee||length>=120&&array.length>=120)?new SetCache(othIndex&&array):undefined;}array=arrays[0];var index=-1,seen=caches[0];outer:while(++index<length&&result.length<maxLength){var value=array[index],computed=iteratee?iteratee(value):value;value=comparator||value!==0?value:0;if(!(seen?cacheHas(seen,computed):includes(result,computed,comparator))){othIndex=othLength;while(--othIndex){var cache=caches[othIndex];if(!(cache?cacheHas(cache,computed):includes(arrays[othIndex],computed,comparator))){continue outer;}}if(seen){seen.push(computed);}result.push(value);}}return result;}/**
	     * The base implementation of `_.invert` and `_.invertBy` which inverts
	     * `object` with values transformed by `iteratee` and set by `setter`.
	     *
	     * @private
	     * @param {Object} object The object to iterate over.
	     * @param {Function} setter The function to set `accumulator` values.
	     * @param {Function} iteratee The iteratee to transform values.
	     * @param {Object} accumulator The initial inverted object.
	     * @returns {Function} Returns `accumulator`.
	     */function baseInverter(object,setter,iteratee,accumulator){baseForOwn(object,function(value,key,object){setter(accumulator,iteratee(value),key,object);});return accumulator;}/**
	     * The base implementation of `_.invoke` without support for individual
	     * method arguments.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @param {Array|string} path The path of the method to invoke.
	     * @param {Array} args The arguments to invoke the method with.
	     * @returns {*} Returns the result of the invoked method.
	     */function baseInvoke(object,path,args){path=castPath(path,object);object=parent(object,path);var func=object==null?object:object[toKey(last(path))];return func==null?undefined:apply(func,object,args);}/**
	     * The base implementation of `_.isArguments`.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is an `arguments` object,
	     */function baseIsArguments(value){return isObjectLike(value)&&baseGetTag(value)==argsTag;}/**
	     * The base implementation of `_.isArrayBuffer` without Node.js optimizations.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is an array buffer, else `false`.
	     */function baseIsArrayBuffer(value){return isObjectLike(value)&&baseGetTag(value)==arrayBufferTag;}/**
	     * The base implementation of `_.isDate` without Node.js optimizations.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a date object, else `false`.
	     */function baseIsDate(value){return isObjectLike(value)&&baseGetTag(value)==dateTag;}/**
	     * The base implementation of `_.isEqual` which supports partial comparisons
	     * and tracks traversed objects.
	     *
	     * @private
	     * @param {*} value The value to compare.
	     * @param {*} other The other value to compare.
	     * @param {boolean} bitmask The bitmask flags.
	     *  1 - Unordered comparison
	     *  2 - Partial comparison
	     * @param {Function} [customizer] The function to customize comparisons.
	     * @param {Object} [stack] Tracks traversed `value` and `other` objects.
	     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	     */function baseIsEqual(value,other,bitmask,customizer,stack){if(value===other){return true;}if(value==null||other==null||!isObject(value)&&!isObjectLike(other)){return value!==value&&other!==other;}return baseIsEqualDeep(value,other,bitmask,customizer,baseIsEqual,stack);}/**
	     * A specialized version of `baseIsEqual` for arrays and objects which performs
	     * deep comparisons and tracks traversed objects enabling objects with circular
	     * references to be compared.
	     *
	     * @private
	     * @param {Object} object The object to compare.
	     * @param {Object} other The other object to compare.
	     * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	     * @param {Function} customizer The function to customize comparisons.
	     * @param {Function} equalFunc The function to determine equivalents of values.
	     * @param {Object} [stack] Tracks traversed `object` and `other` objects.
	     * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	     */function baseIsEqualDeep(object,other,bitmask,customizer,equalFunc,stack){var objIsArr=isArray(object),othIsArr=isArray(other),objTag=arrayTag,othTag=arrayTag;if(!objIsArr){objTag=getTag(object);objTag=objTag==argsTag?objectTag:objTag;}if(!othIsArr){othTag=getTag(other);othTag=othTag==argsTag?objectTag:othTag;}var objIsObj=objTag==objectTag,othIsObj=othTag==objectTag,isSameTag=objTag==othTag;if(isSameTag&&isBuffer(object)){if(!isBuffer(other)){return false;}objIsArr=true;objIsObj=false;}if(isSameTag&&!objIsObj){stack||(stack=new Stack());return objIsArr||isTypedArray(object)?equalArrays(object,other,bitmask,customizer,equalFunc,stack):equalByTag(object,other,objTag,bitmask,customizer,equalFunc,stack);}if(!(bitmask&COMPARE_PARTIAL_FLAG)){var objIsWrapped=objIsObj&&hasOwnProperty.call(object,'__wrapped__'),othIsWrapped=othIsObj&&hasOwnProperty.call(other,'__wrapped__');if(objIsWrapped||othIsWrapped){var objUnwrapped=objIsWrapped?object.value():object,othUnwrapped=othIsWrapped?other.value():other;stack||(stack=new Stack());return equalFunc(objUnwrapped,othUnwrapped,bitmask,customizer,stack);}}if(!isSameTag){return false;}stack||(stack=new Stack());return equalObjects(object,other,bitmask,customizer,equalFunc,stack);}/**
	     * The base implementation of `_.isMap` without Node.js optimizations.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a map, else `false`.
	     */function baseIsMap(value){return isObjectLike(value)&&getTag(value)==mapTag;}/**
	     * The base implementation of `_.isMatch` without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Object} object The object to inspect.
	     * @param {Object} source The object of property values to match.
	     * @param {Array} matchData The property names, values, and compare flags to match.
	     * @param {Function} [customizer] The function to customize comparisons.
	     * @returns {boolean} Returns `true` if `object` is a match, else `false`.
	     */function baseIsMatch(object,source,matchData,customizer){var index=matchData.length,length=index,noCustomizer=!customizer;if(object==null){return!length;}object=Object(object);while(index--){var data=matchData[index];if(noCustomizer&&data[2]?data[1]!==object[data[0]]:!(data[0]in object)){return false;}}while(++index<length){data=matchData[index];var key=data[0],objValue=object[key],srcValue=data[1];if(noCustomizer&&data[2]){if(objValue===undefined&&!(key in object)){return false;}}else{var stack=new Stack();if(customizer){var result=customizer(objValue,srcValue,key,object,source,stack);}if(!(result===undefined?baseIsEqual(srcValue,objValue,COMPARE_PARTIAL_FLAG|COMPARE_UNORDERED_FLAG,customizer,stack):result)){return false;}}}return true;}/**
	     * The base implementation of `_.isNative` without bad shim checks.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a native function,
	     *  else `false`.
	     */function baseIsNative(value){if(!isObject(value)||isMasked(value)){return false;}var pattern=isFunction(value)?reIsNative:reIsHostCtor;return pattern.test(toSource(value));}/**
	     * The base implementation of `_.isRegExp` without Node.js optimizations.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a regexp, else `false`.
	     */function baseIsRegExp(value){return isObjectLike(value)&&baseGetTag(value)==regexpTag;}/**
	     * The base implementation of `_.isSet` without Node.js optimizations.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a set, else `false`.
	     */function baseIsSet(value){return isObjectLike(value)&&getTag(value)==setTag;}/**
	     * The base implementation of `_.isTypedArray` without Node.js optimizations.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
	     */function baseIsTypedArray(value){return isObjectLike(value)&&isLength(value.length)&&!!typedArrayTags[baseGetTag(value)];}/**
	     * The base implementation of `_.iteratee`.
	     *
	     * @private
	     * @param {*} [value=_.identity] The value to convert to an iteratee.
	     * @returns {Function} Returns the iteratee.
	     */function baseIteratee(value){// Don't store the `typeof` result in a variable to avoid a JIT bug in Safari 9.
	// See https://bugs.webkit.org/show_bug.cgi?id=156034 for more details.
	if(typeof value=='function'){return value;}if(value==null){return identity;}if((typeof value==='undefined'?'undefined':_typeof(value))=='object'){return isArray(value)?baseMatchesProperty(value[0],value[1]):baseMatches(value);}return property(value);}/**
	     * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the array of property names.
	     */function baseKeys(object){if(!isPrototype(object)){return nativeKeys(object);}var result=[];for(var key in Object(object)){if(hasOwnProperty.call(object,key)&&key!='constructor'){result.push(key);}}return result;}/**
	     * The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the array of property names.
	     */function baseKeysIn(object){if(!isObject(object)){return nativeKeysIn(object);}var isProto=isPrototype(object),result=[];for(var key in object){if(!(key=='constructor'&&(isProto||!hasOwnProperty.call(object,key)))){result.push(key);}}return result;}/**
	     * The base implementation of `_.lt` which doesn't coerce arguments.
	     *
	     * @private
	     * @param {*} value The value to compare.
	     * @param {*} other The other value to compare.
	     * @returns {boolean} Returns `true` if `value` is less than `other`,
	     *  else `false`.
	     */function baseLt(value,other){return value<other;}/**
	     * The base implementation of `_.map` without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} iteratee The function invoked per iteration.
	     * @returns {Array} Returns the new mapped array.
	     */function baseMap(collection,iteratee){var index=-1,result=isArrayLike(collection)?Array(collection.length):[];baseEach(collection,function(value,key,collection){result[++index]=iteratee(value,key,collection);});return result;}/**
	     * The base implementation of `_.matches` which doesn't clone `source`.
	     *
	     * @private
	     * @param {Object} source The object of property values to match.
	     * @returns {Function} Returns the new spec function.
	     */function baseMatches(source){var matchData=getMatchData(source);if(matchData.length==1&&matchData[0][2]){return matchesStrictComparable(matchData[0][0],matchData[0][1]);}return function(object){return object===source||baseIsMatch(object,source,matchData);};}/**
	     * The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
	     *
	     * @private
	     * @param {string} path The path of the property to get.
	     * @param {*} srcValue The value to match.
	     * @returns {Function} Returns the new spec function.
	     */function baseMatchesProperty(path,srcValue){if(isKey(path)&&isStrictComparable(srcValue)){return matchesStrictComparable(toKey(path),srcValue);}return function(object){var objValue=get(object,path);return objValue===undefined&&objValue===srcValue?hasIn(object,path):baseIsEqual(srcValue,objValue,COMPARE_PARTIAL_FLAG|COMPARE_UNORDERED_FLAG);};}/**
	     * The base implementation of `_.merge` without support for multiple sources.
	     *
	     * @private
	     * @param {Object} object The destination object.
	     * @param {Object} source The source object.
	     * @param {number} srcIndex The index of `source`.
	     * @param {Function} [customizer] The function to customize merged values.
	     * @param {Object} [stack] Tracks traversed source values and their merged
	     *  counterparts.
	     */function baseMerge(object,source,srcIndex,customizer,stack){if(object===source){return;}baseFor(source,function(srcValue,key){if(isObject(srcValue)){stack||(stack=new Stack());baseMergeDeep(object,source,key,srcIndex,baseMerge,customizer,stack);}else{var newValue=customizer?customizer(object[key],srcValue,key+'',object,source,stack):undefined;if(newValue===undefined){newValue=srcValue;}assignMergeValue(object,key,newValue);}},keysIn);}/**
	     * A specialized version of `baseMerge` for arrays and objects which performs
	     * deep merges and tracks traversed objects enabling objects with circular
	     * references to be merged.
	     *
	     * @private
	     * @param {Object} object The destination object.
	     * @param {Object} source The source object.
	     * @param {string} key The key of the value to merge.
	     * @param {number} srcIndex The index of `source`.
	     * @param {Function} mergeFunc The function to merge values.
	     * @param {Function} [customizer] The function to customize assigned values.
	     * @param {Object} [stack] Tracks traversed source values and their merged
	     *  counterparts.
	     */function baseMergeDeep(object,source,key,srcIndex,mergeFunc,customizer,stack){var objValue=object[key],srcValue=source[key],stacked=stack.get(srcValue);if(stacked){assignMergeValue(object,key,stacked);return;}var newValue=customizer?customizer(objValue,srcValue,key+'',object,source,stack):undefined;var isCommon=newValue===undefined;if(isCommon){var isArr=isArray(srcValue),isBuff=!isArr&&isBuffer(srcValue),isTyped=!isArr&&!isBuff&&isTypedArray(srcValue);newValue=srcValue;if(isArr||isBuff||isTyped){if(isArray(objValue)){newValue=objValue;}else if(isArrayLikeObject(objValue)){newValue=copyArray(objValue);}else if(isBuff){isCommon=false;newValue=cloneBuffer(srcValue,true);}else if(isTyped){isCommon=false;newValue=cloneTypedArray(srcValue,true);}else{newValue=[];}}else if(isPlainObject(srcValue)||isArguments(srcValue)){newValue=objValue;if(isArguments(objValue)){newValue=toPlainObject(objValue);}else if(!isObject(objValue)||srcIndex&&isFunction(objValue)){newValue=initCloneObject(srcValue);}}else{isCommon=false;}}if(isCommon){// Recursively merge objects and arrays (susceptible to call stack limits).
	stack.set(srcValue,newValue);mergeFunc(newValue,srcValue,srcIndex,customizer,stack);stack['delete'](srcValue);}assignMergeValue(object,key,newValue);}/**
	     * The base implementation of `_.nth` which doesn't coerce arguments.
	     *
	     * @private
	     * @param {Array} array The array to query.
	     * @param {number} n The index of the element to return.
	     * @returns {*} Returns the nth element of `array`.
	     */function baseNth(array,n){var length=array.length;if(!length){return;}n+=n<0?length:0;return isIndex(n,length)?array[n]:undefined;}/**
	     * The base implementation of `_.orderBy` without param guards.
	     *
	     * @private
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function[]|Object[]|string[]} iteratees The iteratees to sort by.
	     * @param {string[]} orders The sort orders of `iteratees`.
	     * @returns {Array} Returns the new sorted array.
	     */function baseOrderBy(collection,iteratees,orders){var index=-1;iteratees=arrayMap(iteratees.length?iteratees:[identity],baseUnary(getIteratee()));var result=baseMap(collection,function(value,key,collection){var criteria=arrayMap(iteratees,function(iteratee){return iteratee(value);});return{'criteria':criteria,'index':++index,'value':value};});return baseSortBy(result,function(object,other){return compareMultiple(object,other,orders);});}/**
	     * The base implementation of `_.pick` without support for individual
	     * property identifiers.
	     *
	     * @private
	     * @param {Object} object The source object.
	     * @param {string[]} paths The property paths to pick.
	     * @returns {Object} Returns the new object.
	     */function basePick(object,paths){object=Object(object);return basePickBy(object,paths,function(value,path){return hasIn(object,path);});}/**
	     * The base implementation of  `_.pickBy` without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Object} object The source object.
	     * @param {string[]} paths The property paths to pick.
	     * @param {Function} predicate The function invoked per property.
	     * @returns {Object} Returns the new object.
	     */function basePickBy(object,paths,predicate){var index=-1,length=paths.length,result={};while(++index<length){var path=paths[index],value=baseGet(object,path);if(predicate(value,path)){baseSet(result,castPath(path,object),value);}}return result;}/**
	     * A specialized version of `baseProperty` which supports deep paths.
	     *
	     * @private
	     * @param {Array|string} path The path of the property to get.
	     * @returns {Function} Returns the new accessor function.
	     */function basePropertyDeep(path){return function(object){return baseGet(object,path);};}/**
	     * The base implementation of `_.pullAllBy` without support for iteratee
	     * shorthands.
	     *
	     * @private
	     * @param {Array} array The array to modify.
	     * @param {Array} values The values to remove.
	     * @param {Function} [iteratee] The iteratee invoked per element.
	     * @param {Function} [comparator] The comparator invoked per element.
	     * @returns {Array} Returns `array`.
	     */function basePullAll(array,values,iteratee,comparator){var indexOf=comparator?baseIndexOfWith:baseIndexOf,index=-1,length=values.length,seen=array;if(array===values){values=copyArray(values);}if(iteratee){seen=arrayMap(array,baseUnary(iteratee));}while(++index<length){var fromIndex=0,value=values[index],computed=iteratee?iteratee(value):value;while((fromIndex=indexOf(seen,computed,fromIndex,comparator))>-1){if(seen!==array){splice.call(seen,fromIndex,1);}splice.call(array,fromIndex,1);}}return array;}/**
	     * The base implementation of `_.pullAt` without support for individual
	     * indexes or capturing the removed elements.
	     *
	     * @private
	     * @param {Array} array The array to modify.
	     * @param {number[]} indexes The indexes of elements to remove.
	     * @returns {Array} Returns `array`.
	     */function basePullAt(array,indexes){var length=array?indexes.length:0,lastIndex=length-1;while(length--){var index=indexes[length];if(length==lastIndex||index!==previous){var previous=index;if(isIndex(index)){splice.call(array,index,1);}else{baseUnset(array,index);}}}return array;}/**
	     * The base implementation of `_.random` without support for returning
	     * floating-point numbers.
	     *
	     * @private
	     * @param {number} lower The lower bound.
	     * @param {number} upper The upper bound.
	     * @returns {number} Returns the random number.
	     */function baseRandom(lower,upper){return lower+nativeFloor(nativeRandom()*(upper-lower+1));}/**
	     * The base implementation of `_.range` and `_.rangeRight` which doesn't
	     * coerce arguments.
	     *
	     * @private
	     * @param {number} start The start of the range.
	     * @param {number} end The end of the range.
	     * @param {number} step The value to increment or decrement by.
	     * @param {boolean} [fromRight] Specify iterating from right to left.
	     * @returns {Array} Returns the range of numbers.
	     */function baseRange(start,end,step,fromRight){var index=-1,length=nativeMax(nativeCeil((end-start)/(step||1)),0),result=Array(length);while(length--){result[fromRight?length:++index]=start;start+=step;}return result;}/**
	     * The base implementation of `_.repeat` which doesn't coerce arguments.
	     *
	     * @private
	     * @param {string} string The string to repeat.
	     * @param {number} n The number of times to repeat the string.
	     * @returns {string} Returns the repeated string.
	     */function baseRepeat(string,n){var result='';if(!string||n<1||n>MAX_SAFE_INTEGER){return result;}// Leverage the exponentiation by squaring algorithm for a faster repeat.
	// See https://en.wikipedia.org/wiki/Exponentiation_by_squaring for more details.
	do{if(n%2){result+=string;}n=nativeFloor(n/2);if(n){string+=string;}}while(n);return result;}/**
	     * The base implementation of `_.rest` which doesn't validate or coerce arguments.
	     *
	     * @private
	     * @param {Function} func The function to apply a rest parameter to.
	     * @param {number} [start=func.length-1] The start position of the rest parameter.
	     * @returns {Function} Returns the new function.
	     */function baseRest(func,start){return setToString(overRest(func,start,identity),func+'');}/**
	     * The base implementation of `_.sample`.
	     *
	     * @private
	     * @param {Array|Object} collection The collection to sample.
	     * @returns {*} Returns the random element.
	     */function baseSample(collection){return arraySample(values(collection));}/**
	     * The base implementation of `_.sampleSize` without param guards.
	     *
	     * @private
	     * @param {Array|Object} collection The collection to sample.
	     * @param {number} n The number of elements to sample.
	     * @returns {Array} Returns the random elements.
	     */function baseSampleSize(collection,n){var array=values(collection);return shuffleSelf(array,baseClamp(n,0,array.length));}/**
	     * The base implementation of `_.set`.
	     *
	     * @private
	     * @param {Object} object The object to modify.
	     * @param {Array|string} path The path of the property to set.
	     * @param {*} value The value to set.
	     * @param {Function} [customizer] The function to customize path creation.
	     * @returns {Object} Returns `object`.
	     */function baseSet(object,path,value,customizer){if(!isObject(object)){return object;}path=castPath(path,object);var index=-1,length=path.length,lastIndex=length-1,nested=object;while(nested!=null&&++index<length){var key=toKey(path[index]),newValue=value;if(index!=lastIndex){var objValue=nested[key];newValue=customizer?customizer(objValue,key,nested):undefined;if(newValue===undefined){newValue=isObject(objValue)?objValue:isIndex(path[index+1])?[]:{};}}assignValue(nested,key,newValue);nested=nested[key];}return object;}/**
	     * The base implementation of `setData` without support for hot loop shorting.
	     *
	     * @private
	     * @param {Function} func The function to associate metadata with.
	     * @param {*} data The metadata.
	     * @returns {Function} Returns `func`.
	     */var baseSetData=!metaMap?identity:function(func,data){metaMap.set(func,data);return func;};/**
	     * The base implementation of `setToString` without support for hot loop shorting.
	     *
	     * @private
	     * @param {Function} func The function to modify.
	     * @param {Function} string The `toString` result.
	     * @returns {Function} Returns `func`.
	     */var baseSetToString=!defineProperty?identity:function(func,string){return defineProperty(func,'toString',{'configurable':true,'enumerable':false,'value':constant(string),'writable':true});};/**
	     * The base implementation of `_.shuffle`.
	     *
	     * @private
	     * @param {Array|Object} collection The collection to shuffle.
	     * @returns {Array} Returns the new shuffled array.
	     */function baseShuffle(collection){return shuffleSelf(values(collection));}/**
	     * The base implementation of `_.slice` without an iteratee call guard.
	     *
	     * @private
	     * @param {Array} array The array to slice.
	     * @param {number} [start=0] The start position.
	     * @param {number} [end=array.length] The end position.
	     * @returns {Array} Returns the slice of `array`.
	     */function baseSlice(array,start,end){var index=-1,length=array.length;if(start<0){start=-start>length?0:length+start;}end=end>length?length:end;if(end<0){end+=length;}length=start>end?0:end-start>>>0;start>>>=0;var result=Array(length);while(++index<length){result[index]=array[index+start];}return result;}/**
	     * The base implementation of `_.some` without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} predicate The function invoked per iteration.
	     * @returns {boolean} Returns `true` if any element passes the predicate check,
	     *  else `false`.
	     */function baseSome(collection,predicate){var result;baseEach(collection,function(value,index,collection){result=predicate(value,index,collection);return!result;});return!!result;}/**
	     * The base implementation of `_.sortedIndex` and `_.sortedLastIndex` which
	     * performs a binary search of `array` to determine the index at which `value`
	     * should be inserted into `array` in order to maintain its sort order.
	     *
	     * @private
	     * @param {Array} array The sorted array to inspect.
	     * @param {*} value The value to evaluate.
	     * @param {boolean} [retHighest] Specify returning the highest qualified index.
	     * @returns {number} Returns the index at which `value` should be inserted
	     *  into `array`.
	     */function baseSortedIndex(array,value,retHighest){var low=0,high=array==null?low:array.length;if(typeof value=='number'&&value===value&&high<=HALF_MAX_ARRAY_LENGTH){while(low<high){var mid=low+high>>>1,computed=array[mid];if(computed!==null&&!isSymbol(computed)&&(retHighest?computed<=value:computed<value)){low=mid+1;}else{high=mid;}}return high;}return baseSortedIndexBy(array,value,identity,retHighest);}/**
	     * The base implementation of `_.sortedIndexBy` and `_.sortedLastIndexBy`
	     * which invokes `iteratee` for `value` and each element of `array` to compute
	     * their sort ranking. The iteratee is invoked with one argument; (value).
	     *
	     * @private
	     * @param {Array} array The sorted array to inspect.
	     * @param {*} value The value to evaluate.
	     * @param {Function} iteratee The iteratee invoked per element.
	     * @param {boolean} [retHighest] Specify returning the highest qualified index.
	     * @returns {number} Returns the index at which `value` should be inserted
	     *  into `array`.
	     */function baseSortedIndexBy(array,value,iteratee,retHighest){value=iteratee(value);var low=0,high=array==null?0:array.length,valIsNaN=value!==value,valIsNull=value===null,valIsSymbol=isSymbol(value),valIsUndefined=value===undefined;while(low<high){var mid=nativeFloor((low+high)/2),computed=iteratee(array[mid]),othIsDefined=computed!==undefined,othIsNull=computed===null,othIsReflexive=computed===computed,othIsSymbol=isSymbol(computed);if(valIsNaN){var setLow=retHighest||othIsReflexive;}else if(valIsUndefined){setLow=othIsReflexive&&(retHighest||othIsDefined);}else if(valIsNull){setLow=othIsReflexive&&othIsDefined&&(retHighest||!othIsNull);}else if(valIsSymbol){setLow=othIsReflexive&&othIsDefined&&!othIsNull&&(retHighest||!othIsSymbol);}else if(othIsNull||othIsSymbol){setLow=false;}else{setLow=retHighest?computed<=value:computed<value;}if(setLow){low=mid+1;}else{high=mid;}}return nativeMin(high,MAX_ARRAY_INDEX);}/**
	     * The base implementation of `_.sortedUniq` and `_.sortedUniqBy` without
	     * support for iteratee shorthands.
	     *
	     * @private
	     * @param {Array} array The array to inspect.
	     * @param {Function} [iteratee] The iteratee invoked per element.
	     * @returns {Array} Returns the new duplicate free array.
	     */function baseSortedUniq(array,iteratee){var index=-1,length=array.length,resIndex=0,result=[];while(++index<length){var value=array[index],computed=iteratee?iteratee(value):value;if(!index||!eq(computed,seen)){var seen=computed;result[resIndex++]=value===0?0:value;}}return result;}/**
	     * The base implementation of `_.toNumber` which doesn't ensure correct
	     * conversions of binary, hexadecimal, or octal string values.
	     *
	     * @private
	     * @param {*} value The value to process.
	     * @returns {number} Returns the number.
	     */function baseToNumber(value){if(typeof value=='number'){return value;}if(isSymbol(value)){return NAN;}return+value;}/**
	     * The base implementation of `_.toString` which doesn't convert nullish
	     * values to empty strings.
	     *
	     * @private
	     * @param {*} value The value to process.
	     * @returns {string} Returns the string.
	     */function baseToString(value){// Exit early for strings to avoid a performance hit in some environments.
	if(typeof value=='string'){return value;}if(isArray(value)){// Recursively convert values (susceptible to call stack limits).
	return arrayMap(value,baseToString)+'';}if(isSymbol(value)){return symbolToString?symbolToString.call(value):'';}var result=value+'';return result=='0'&&1/value==-INFINITY?'-0':result;}/**
	     * The base implementation of `_.uniqBy` without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Array} array The array to inspect.
	     * @param {Function} [iteratee] The iteratee invoked per element.
	     * @param {Function} [comparator] The comparator invoked per element.
	     * @returns {Array} Returns the new duplicate free array.
	     */function baseUniq(array,iteratee,comparator){var index=-1,includes=arrayIncludes,length=array.length,isCommon=true,result=[],seen=result;if(comparator){isCommon=false;includes=arrayIncludesWith;}else if(length>=LARGE_ARRAY_SIZE){var set=iteratee?null:createSet(array);if(set){return setToArray(set);}isCommon=false;includes=cacheHas;seen=new SetCache();}else{seen=iteratee?[]:result;}outer:while(++index<length){var value=array[index],computed=iteratee?iteratee(value):value;value=comparator||value!==0?value:0;if(isCommon&&computed===computed){var seenIndex=seen.length;while(seenIndex--){if(seen[seenIndex]===computed){continue outer;}}if(iteratee){seen.push(computed);}result.push(value);}else if(!includes(seen,computed,comparator)){if(seen!==result){seen.push(computed);}result.push(value);}}return result;}/**
	     * The base implementation of `_.unset`.
	     *
	     * @private
	     * @param {Object} object The object to modify.
	     * @param {Array|string} path The property path to unset.
	     * @returns {boolean} Returns `true` if the property is deleted, else `false`.
	     */function baseUnset(object,path){path=castPath(path,object);object=parent(object,path);return object==null||delete object[toKey(last(path))];}/**
	     * The base implementation of `_.update`.
	     *
	     * @private
	     * @param {Object} object The object to modify.
	     * @param {Array|string} path The path of the property to update.
	     * @param {Function} updater The function to produce the updated value.
	     * @param {Function} [customizer] The function to customize path creation.
	     * @returns {Object} Returns `object`.
	     */function baseUpdate(object,path,updater,customizer){return baseSet(object,path,updater(baseGet(object,path)),customizer);}/**
	     * The base implementation of methods like `_.dropWhile` and `_.takeWhile`
	     * without support for iteratee shorthands.
	     *
	     * @private
	     * @param {Array} array The array to query.
	     * @param {Function} predicate The function invoked per iteration.
	     * @param {boolean} [isDrop] Specify dropping elements instead of taking them.
	     * @param {boolean} [fromRight] Specify iterating from right to left.
	     * @returns {Array} Returns the slice of `array`.
	     */function baseWhile(array,predicate,isDrop,fromRight){var length=array.length,index=fromRight?length:-1;while((fromRight?index--:++index<length)&&predicate(array[index],index,array)){}return isDrop?baseSlice(array,fromRight?0:index,fromRight?index+1:length):baseSlice(array,fromRight?index+1:0,fromRight?length:index);}/**
	     * The base implementation of `wrapperValue` which returns the result of
	     * performing a sequence of actions on the unwrapped `value`, where each
	     * successive action is supplied the return value of the previous.
	     *
	     * @private
	     * @param {*} value The unwrapped value.
	     * @param {Array} actions Actions to perform to resolve the unwrapped value.
	     * @returns {*} Returns the resolved value.
	     */function baseWrapperValue(value,actions){var result=value;if(result instanceof LazyWrapper){result=result.value();}return arrayReduce(actions,function(result,action){return action.func.apply(action.thisArg,arrayPush([result],action.args));},result);}/**
	     * The base implementation of methods like `_.xor`, without support for
	     * iteratee shorthands, that accepts an array of arrays to inspect.
	     *
	     * @private
	     * @param {Array} arrays The arrays to inspect.
	     * @param {Function} [iteratee] The iteratee invoked per element.
	     * @param {Function} [comparator] The comparator invoked per element.
	     * @returns {Array} Returns the new array of values.
	     */function baseXor(arrays,iteratee,comparator){var length=arrays.length;if(length<2){return length?baseUniq(arrays[0]):[];}var index=-1,result=Array(length);while(++index<length){var array=arrays[index],othIndex=-1;while(++othIndex<length){if(othIndex!=index){result[index]=baseDifference(result[index]||array,arrays[othIndex],iteratee,comparator);}}}return baseUniq(baseFlatten(result,1),iteratee,comparator);}/**
	     * This base implementation of `_.zipObject` which assigns values using `assignFunc`.
	     *
	     * @private
	     * @param {Array} props The property identifiers.
	     * @param {Array} values The property values.
	     * @param {Function} assignFunc The function to assign values.
	     * @returns {Object} Returns the new object.
	     */function baseZipObject(props,values,assignFunc){var index=-1,length=props.length,valsLength=values.length,result={};while(++index<length){var value=index<valsLength?values[index]:undefined;assignFunc(result,props[index],value);}return result;}/**
	     * Casts `value` to an empty array if it's not an array like object.
	     *
	     * @private
	     * @param {*} value The value to inspect.
	     * @returns {Array|Object} Returns the cast array-like object.
	     */function castArrayLikeObject(value){return isArrayLikeObject(value)?value:[];}/**
	     * Casts `value` to `identity` if it's not a function.
	     *
	     * @private
	     * @param {*} value The value to inspect.
	     * @returns {Function} Returns cast function.
	     */function castFunction(value){return typeof value=='function'?value:identity;}/**
	     * Casts `value` to a path array if it's not one.
	     *
	     * @private
	     * @param {*} value The value to inspect.
	     * @param {Object} [object] The object to query keys on.
	     * @returns {Array} Returns the cast property path array.
	     */function castPath(value,object){if(isArray(value)){return value;}return isKey(value,object)?[value]:stringToPath(toString(value));}/**
	     * A `baseRest` alias which can be replaced with `identity` by module
	     * replacement plugins.
	     *
	     * @private
	     * @type {Function}
	     * @param {Function} func The function to apply a rest parameter to.
	     * @returns {Function} Returns the new function.
	     */var castRest=baseRest;/**
	     * Casts `array` to a slice if it's needed.
	     *
	     * @private
	     * @param {Array} array The array to inspect.
	     * @param {number} start The start position.
	     * @param {number} [end=array.length] The end position.
	     * @returns {Array} Returns the cast slice.
	     */function castSlice(array,start,end){var length=array.length;end=end===undefined?length:end;return!start&&end>=length?array:baseSlice(array,start,end);}/**
	     * A simple wrapper around the global [`clearTimeout`](https://mdn.io/clearTimeout).
	     *
	     * @private
	     * @param {number|Object} id The timer id or timeout object of the timer to clear.
	     */var clearTimeout=ctxClearTimeout||function(id){return root.clearTimeout(id);};/**
	     * Creates a clone of  `buffer`.
	     *
	     * @private
	     * @param {Buffer} buffer The buffer to clone.
	     * @param {boolean} [isDeep] Specify a deep clone.
	     * @returns {Buffer} Returns the cloned buffer.
	     */function cloneBuffer(buffer,isDeep){if(isDeep){return buffer.slice();}var length=buffer.length,result=allocUnsafe?allocUnsafe(length):new buffer.constructor(length);buffer.copy(result);return result;}/**
	     * Creates a clone of `arrayBuffer`.
	     *
	     * @private
	     * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
	     * @returns {ArrayBuffer} Returns the cloned array buffer.
	     */function cloneArrayBuffer(arrayBuffer){var result=new arrayBuffer.constructor(arrayBuffer.byteLength);new Uint8Array(result).set(new Uint8Array(arrayBuffer));return result;}/**
	     * Creates a clone of `dataView`.
	     *
	     * @private
	     * @param {Object} dataView The data view to clone.
	     * @param {boolean} [isDeep] Specify a deep clone.
	     * @returns {Object} Returns the cloned data view.
	     */function cloneDataView(dataView,isDeep){var buffer=isDeep?cloneArrayBuffer(dataView.buffer):dataView.buffer;return new dataView.constructor(buffer,dataView.byteOffset,dataView.byteLength);}/**
	     * Creates a clone of `map`.
	     *
	     * @private
	     * @param {Object} map The map to clone.
	     * @param {Function} cloneFunc The function to clone values.
	     * @param {boolean} [isDeep] Specify a deep clone.
	     * @returns {Object} Returns the cloned map.
	     */function cloneMap(map,isDeep,cloneFunc){var array=isDeep?cloneFunc(mapToArray(map),CLONE_DEEP_FLAG):mapToArray(map);return arrayReduce(array,addMapEntry,new map.constructor());}/**
	     * Creates a clone of `regexp`.
	     *
	     * @private
	     * @param {Object} regexp The regexp to clone.
	     * @returns {Object} Returns the cloned regexp.
	     */function cloneRegExp(regexp){var result=new regexp.constructor(regexp.source,reFlags.exec(regexp));result.lastIndex=regexp.lastIndex;return result;}/**
	     * Creates a clone of `set`.
	     *
	     * @private
	     * @param {Object} set The set to clone.
	     * @param {Function} cloneFunc The function to clone values.
	     * @param {boolean} [isDeep] Specify a deep clone.
	     * @returns {Object} Returns the cloned set.
	     */function cloneSet(set,isDeep,cloneFunc){var array=isDeep?cloneFunc(setToArray(set),CLONE_DEEP_FLAG):setToArray(set);return arrayReduce(array,addSetEntry,new set.constructor());}/**
	     * Creates a clone of the `symbol` object.
	     *
	     * @private
	     * @param {Object} symbol The symbol object to clone.
	     * @returns {Object} Returns the cloned symbol object.
	     */function cloneSymbol(symbol){return symbolValueOf?Object(symbolValueOf.call(symbol)):{};}/**
	     * Creates a clone of `typedArray`.
	     *
	     * @private
	     * @param {Object} typedArray The typed array to clone.
	     * @param {boolean} [isDeep] Specify a deep clone.
	     * @returns {Object} Returns the cloned typed array.
	     */function cloneTypedArray(typedArray,isDeep){var buffer=isDeep?cloneArrayBuffer(typedArray.buffer):typedArray.buffer;return new typedArray.constructor(buffer,typedArray.byteOffset,typedArray.length);}/**
	     * Compares values to sort them in ascending order.
	     *
	     * @private
	     * @param {*} value The value to compare.
	     * @param {*} other The other value to compare.
	     * @returns {number} Returns the sort order indicator for `value`.
	     */function compareAscending(value,other){if(value!==other){var valIsDefined=value!==undefined,valIsNull=value===null,valIsReflexive=value===value,valIsSymbol=isSymbol(value);var othIsDefined=other!==undefined,othIsNull=other===null,othIsReflexive=other===other,othIsSymbol=isSymbol(other);if(!othIsNull&&!othIsSymbol&&!valIsSymbol&&value>other||valIsSymbol&&othIsDefined&&othIsReflexive&&!othIsNull&&!othIsSymbol||valIsNull&&othIsDefined&&othIsReflexive||!valIsDefined&&othIsReflexive||!valIsReflexive){return 1;}if(!valIsNull&&!valIsSymbol&&!othIsSymbol&&value<other||othIsSymbol&&valIsDefined&&valIsReflexive&&!valIsNull&&!valIsSymbol||othIsNull&&valIsDefined&&valIsReflexive||!othIsDefined&&valIsReflexive||!othIsReflexive){return-1;}}return 0;}/**
	     * Used by `_.orderBy` to compare multiple properties of a value to another
	     * and stable sort them.
	     *
	     * If `orders` is unspecified, all values are sorted in ascending order. Otherwise,
	     * specify an order of "desc" for descending or "asc" for ascending sort order
	     * of corresponding values.
	     *
	     * @private
	     * @param {Object} object The object to compare.
	     * @param {Object} other The other object to compare.
	     * @param {boolean[]|string[]} orders The order to sort by for each property.
	     * @returns {number} Returns the sort order indicator for `object`.
	     */function compareMultiple(object,other,orders){var index=-1,objCriteria=object.criteria,othCriteria=other.criteria,length=objCriteria.length,ordersLength=orders.length;while(++index<length){var result=compareAscending(objCriteria[index],othCriteria[index]);if(result){if(index>=ordersLength){return result;}var order=orders[index];return result*(order=='desc'?-1:1);}}// Fixes an `Array#sort` bug in the JS engine embedded in Adobe applications
	// that causes it, under certain circumstances, to provide the same value for
	// `object` and `other`. See https://github.com/jashkenas/underscore/pull/1247
	// for more details.
	//
	// This also ensures a stable sort in V8 and other engines.
	// See https://bugs.chromium.org/p/v8/issues/detail?id=90 for more details.
	return object.index-other.index;}/**
	     * Creates an array that is the composition of partially applied arguments,
	     * placeholders, and provided arguments into a single array of arguments.
	     *
	     * @private
	     * @param {Array} args The provided arguments.
	     * @param {Array} partials The arguments to prepend to those provided.
	     * @param {Array} holders The `partials` placeholder indexes.
	     * @params {boolean} [isCurried] Specify composing for a curried function.
	     * @returns {Array} Returns the new array of composed arguments.
	     */function composeArgs(args,partials,holders,isCurried){var argsIndex=-1,argsLength=args.length,holdersLength=holders.length,leftIndex=-1,leftLength=partials.length,rangeLength=nativeMax(argsLength-holdersLength,0),result=Array(leftLength+rangeLength),isUncurried=!isCurried;while(++leftIndex<leftLength){result[leftIndex]=partials[leftIndex];}while(++argsIndex<holdersLength){if(isUncurried||argsIndex<argsLength){result[holders[argsIndex]]=args[argsIndex];}}while(rangeLength--){result[leftIndex++]=args[argsIndex++];}return result;}/**
	     * This function is like `composeArgs` except that the arguments composition
	     * is tailored for `_.partialRight`.
	     *
	     * @private
	     * @param {Array} args The provided arguments.
	     * @param {Array} partials The arguments to append to those provided.
	     * @param {Array} holders The `partials` placeholder indexes.
	     * @params {boolean} [isCurried] Specify composing for a curried function.
	     * @returns {Array} Returns the new array of composed arguments.
	     */function composeArgsRight(args,partials,holders,isCurried){var argsIndex=-1,argsLength=args.length,holdersIndex=-1,holdersLength=holders.length,rightIndex=-1,rightLength=partials.length,rangeLength=nativeMax(argsLength-holdersLength,0),result=Array(rangeLength+rightLength),isUncurried=!isCurried;while(++argsIndex<rangeLength){result[argsIndex]=args[argsIndex];}var offset=argsIndex;while(++rightIndex<rightLength){result[offset+rightIndex]=partials[rightIndex];}while(++holdersIndex<holdersLength){if(isUncurried||argsIndex<argsLength){result[offset+holders[holdersIndex]]=args[argsIndex++];}}return result;}/**
	     * Copies the values of `source` to `array`.
	     *
	     * @private
	     * @param {Array} source The array to copy values from.
	     * @param {Array} [array=[]] The array to copy values to.
	     * @returns {Array} Returns `array`.
	     */function copyArray(source,array){var index=-1,length=source.length;array||(array=Array(length));while(++index<length){array[index]=source[index];}return array;}/**
	     * Copies properties of `source` to `object`.
	     *
	     * @private
	     * @param {Object} source The object to copy properties from.
	     * @param {Array} props The property identifiers to copy.
	     * @param {Object} [object={}] The object to copy properties to.
	     * @param {Function} [customizer] The function to customize copied values.
	     * @returns {Object} Returns `object`.
	     */function copyObject(source,props,object,customizer){var isNew=!object;object||(object={});var index=-1,length=props.length;while(++index<length){var key=props[index];var newValue=customizer?customizer(object[key],source[key],key,object,source):undefined;if(newValue===undefined){newValue=source[key];}if(isNew){baseAssignValue(object,key,newValue);}else{assignValue(object,key,newValue);}}return object;}/**
	     * Copies own symbols of `source` to `object`.
	     *
	     * @private
	     * @param {Object} source The object to copy symbols from.
	     * @param {Object} [object={}] The object to copy symbols to.
	     * @returns {Object} Returns `object`.
	     */function copySymbols(source,object){return copyObject(source,getSymbols(source),object);}/**
	     * Copies own and inherited symbols of `source` to `object`.
	     *
	     * @private
	     * @param {Object} source The object to copy symbols from.
	     * @param {Object} [object={}] The object to copy symbols to.
	     * @returns {Object} Returns `object`.
	     */function copySymbolsIn(source,object){return copyObject(source,getSymbolsIn(source),object);}/**
	     * Creates a function like `_.groupBy`.
	     *
	     * @private
	     * @param {Function} setter The function to set accumulator values.
	     * @param {Function} [initializer] The accumulator object initializer.
	     * @returns {Function} Returns the new aggregator function.
	     */function createAggregator(setter,initializer){return function(collection,iteratee){var func=isArray(collection)?arrayAggregator:baseAggregator,accumulator=initializer?initializer():{};return func(collection,setter,getIteratee(iteratee,2),accumulator);};}/**
	     * Creates a function like `_.assign`.
	     *
	     * @private
	     * @param {Function} assigner The function to assign values.
	     * @returns {Function} Returns the new assigner function.
	     */function createAssigner(assigner){return baseRest(function(object,sources){var index=-1,length=sources.length,customizer=length>1?sources[length-1]:undefined,guard=length>2?sources[2]:undefined;customizer=assigner.length>3&&typeof customizer=='function'?(length--,customizer):undefined;if(guard&&isIterateeCall(sources[0],sources[1],guard)){customizer=length<3?undefined:customizer;length=1;}object=Object(object);while(++index<length){var source=sources[index];if(source){assigner(object,source,index,customizer);}}return object;});}/**
	     * Creates a `baseEach` or `baseEachRight` function.
	     *
	     * @private
	     * @param {Function} eachFunc The function to iterate over a collection.
	     * @param {boolean} [fromRight] Specify iterating from right to left.
	     * @returns {Function} Returns the new base function.
	     */function createBaseEach(eachFunc,fromRight){return function(collection,iteratee){if(collection==null){return collection;}if(!isArrayLike(collection)){return eachFunc(collection,iteratee);}var length=collection.length,index=fromRight?length:-1,iterable=Object(collection);while(fromRight?index--:++index<length){if(iteratee(iterable[index],index,iterable)===false){break;}}return collection;};}/**
	     * Creates a base function for methods like `_.forIn` and `_.forOwn`.
	     *
	     * @private
	     * @param {boolean} [fromRight] Specify iterating from right to left.
	     * @returns {Function} Returns the new base function.
	     */function createBaseFor(fromRight){return function(object,iteratee,keysFunc){var index=-1,iterable=Object(object),props=keysFunc(object),length=props.length;while(length--){var key=props[fromRight?length:++index];if(iteratee(iterable[key],key,iterable)===false){break;}}return object;};}/**
	     * Creates a function that wraps `func` to invoke it with the optional `this`
	     * binding of `thisArg`.
	     *
	     * @private
	     * @param {Function} func The function to wrap.
	     * @param {number} bitmask The bitmask flags. See `createWrap` for more details.
	     * @param {*} [thisArg] The `this` binding of `func`.
	     * @returns {Function} Returns the new wrapped function.
	     */function createBind(func,bitmask,thisArg){var isBind=bitmask&WRAP_BIND_FLAG,Ctor=createCtor(func);function wrapper(){var fn=this&&this!==root&&this instanceof wrapper?Ctor:func;return fn.apply(isBind?thisArg:this,arguments);}return wrapper;}/**
	     * Creates a function like `_.lowerFirst`.
	     *
	     * @private
	     * @param {string} methodName The name of the `String` case method to use.
	     * @returns {Function} Returns the new case function.
	     */function createCaseFirst(methodName){return function(string){string=toString(string);var strSymbols=hasUnicode(string)?stringToArray(string):undefined;var chr=strSymbols?strSymbols[0]:string.charAt(0);var trailing=strSymbols?castSlice(strSymbols,1).join(''):string.slice(1);return chr[methodName]()+trailing;};}/**
	     * Creates a function like `_.camelCase`.
	     *
	     * @private
	     * @param {Function} callback The function to combine each word.
	     * @returns {Function} Returns the new compounder function.
	     */function createCompounder(callback){return function(string){return arrayReduce(words(deburr(string).replace(reApos,'')),callback,'');};}/**
	     * Creates a function that produces an instance of `Ctor` regardless of
	     * whether it was invoked as part of a `new` expression or by `call` or `apply`.
	     *
	     * @private
	     * @param {Function} Ctor The constructor to wrap.
	     * @returns {Function} Returns the new wrapped function.
	     */function createCtor(Ctor){return function(){// Use a `switch` statement to work with class constructors. See
	// http://ecma-international.org/ecma-262/7.0/#sec-ecmascript-function-objects-call-thisargument-argumentslist
	// for more details.
	var args=arguments;switch(args.length){case 0:return new Ctor();case 1:return new Ctor(args[0]);case 2:return new Ctor(args[0],args[1]);case 3:return new Ctor(args[0],args[1],args[2]);case 4:return new Ctor(args[0],args[1],args[2],args[3]);case 5:return new Ctor(args[0],args[1],args[2],args[3],args[4]);case 6:return new Ctor(args[0],args[1],args[2],args[3],args[4],args[5]);case 7:return new Ctor(args[0],args[1],args[2],args[3],args[4],args[5],args[6]);}var thisBinding=baseCreate(Ctor.prototype),result=Ctor.apply(thisBinding,args);// Mimic the constructor's `return` behavior.
	// See https://es5.github.io/#x13.2.2 for more details.
	return isObject(result)?result:thisBinding;};}/**
	     * Creates a function that wraps `func` to enable currying.
	     *
	     * @private
	     * @param {Function} func The function to wrap.
	     * @param {number} bitmask The bitmask flags. See `createWrap` for more details.
	     * @param {number} arity The arity of `func`.
	     * @returns {Function} Returns the new wrapped function.
	     */function createCurry(func,bitmask,arity){var Ctor=createCtor(func);function wrapper(){var length=arguments.length,args=Array(length),index=length,placeholder=getHolder(wrapper);while(index--){args[index]=arguments[index];}var holders=length<3&&args[0]!==placeholder&&args[length-1]!==placeholder?[]:replaceHolders(args,placeholder);length-=holders.length;if(length<arity){return createRecurry(func,bitmask,createHybrid,wrapper.placeholder,undefined,args,holders,undefined,undefined,arity-length);}var fn=this&&this!==root&&this instanceof wrapper?Ctor:func;return apply(fn,this,args);}return wrapper;}/**
	     * Creates a `_.find` or `_.findLast` function.
	     *
	     * @private
	     * @param {Function} findIndexFunc The function to find the collection index.
	     * @returns {Function} Returns the new find function.
	     */function createFind(findIndexFunc){return function(collection,predicate,fromIndex){var iterable=Object(collection);if(!isArrayLike(collection)){var iteratee=getIteratee(predicate,3);collection=keys(collection);predicate=function predicate(key){return iteratee(iterable[key],key,iterable);};}var index=findIndexFunc(collection,predicate,fromIndex);return index>-1?iterable[iteratee?collection[index]:index]:undefined;};}/**
	     * Creates a `_.flow` or `_.flowRight` function.
	     *
	     * @private
	     * @param {boolean} [fromRight] Specify iterating from right to left.
	     * @returns {Function} Returns the new flow function.
	     */function createFlow(fromRight){return flatRest(function(funcs){var length=funcs.length,index=length,prereq=LodashWrapper.prototype.thru;if(fromRight){funcs.reverse();}while(index--){var func=funcs[index];if(typeof func!='function'){throw new TypeError(FUNC_ERROR_TEXT);}if(prereq&&!wrapper&&getFuncName(func)=='wrapper'){var wrapper=new LodashWrapper([],true);}}index=wrapper?index:length;while(++index<length){func=funcs[index];var funcName=getFuncName(func),data=funcName=='wrapper'?getData(func):undefined;if(data&&isLaziable(data[0])&&data[1]==(WRAP_ARY_FLAG|WRAP_CURRY_FLAG|WRAP_PARTIAL_FLAG|WRAP_REARG_FLAG)&&!data[4].length&&data[9]==1){wrapper=wrapper[getFuncName(data[0])].apply(wrapper,data[3]);}else{wrapper=func.length==1&&isLaziable(func)?wrapper[funcName]():wrapper.thru(func);}}return function(){var args=arguments,value=args[0];if(wrapper&&args.length==1&&isArray(value)&&value.length>=LARGE_ARRAY_SIZE){return wrapper.plant(value).value();}var index=0,result=length?funcs[index].apply(this,args):value;while(++index<length){result=funcs[index].call(this,result);}return result;};});}/**
	     * Creates a function that wraps `func` to invoke it with optional `this`
	     * binding of `thisArg`, partial application, and currying.
	     *
	     * @private
	     * @param {Function|string} func The function or method name to wrap.
	     * @param {number} bitmask The bitmask flags. See `createWrap` for more details.
	     * @param {*} [thisArg] The `this` binding of `func`.
	     * @param {Array} [partials] The arguments to prepend to those provided to
	     *  the new function.
	     * @param {Array} [holders] The `partials` placeholder indexes.
	     * @param {Array} [partialsRight] The arguments to append to those provided
	     *  to the new function.
	     * @param {Array} [holdersRight] The `partialsRight` placeholder indexes.
	     * @param {Array} [argPos] The argument positions of the new function.
	     * @param {number} [ary] The arity cap of `func`.
	     * @param {number} [arity] The arity of `func`.
	     * @returns {Function} Returns the new wrapped function.
	     */function createHybrid(func,bitmask,thisArg,partials,holders,partialsRight,holdersRight,argPos,ary,arity){var isAry=bitmask&WRAP_ARY_FLAG,isBind=bitmask&WRAP_BIND_FLAG,isBindKey=bitmask&WRAP_BIND_KEY_FLAG,isCurried=bitmask&(WRAP_CURRY_FLAG|WRAP_CURRY_RIGHT_FLAG),isFlip=bitmask&WRAP_FLIP_FLAG,Ctor=isBindKey?undefined:createCtor(func);function wrapper(){var length=arguments.length,args=Array(length),index=length;while(index--){args[index]=arguments[index];}if(isCurried){var placeholder=getHolder(wrapper),holdersCount=countHolders(args,placeholder);}if(partials){args=composeArgs(args,partials,holders,isCurried);}if(partialsRight){args=composeArgsRight(args,partialsRight,holdersRight,isCurried);}length-=holdersCount;if(isCurried&&length<arity){var newHolders=replaceHolders(args,placeholder);return createRecurry(func,bitmask,createHybrid,wrapper.placeholder,thisArg,args,newHolders,argPos,ary,arity-length);}var thisBinding=isBind?thisArg:this,fn=isBindKey?thisBinding[func]:func;length=args.length;if(argPos){args=reorder(args,argPos);}else if(isFlip&&length>1){args.reverse();}if(isAry&&ary<length){args.length=ary;}if(this&&this!==root&&this instanceof wrapper){fn=Ctor||createCtor(fn);}return fn.apply(thisBinding,args);}return wrapper;}/**
	     * Creates a function like `_.invertBy`.
	     *
	     * @private
	     * @param {Function} setter The function to set accumulator values.
	     * @param {Function} toIteratee The function to resolve iteratees.
	     * @returns {Function} Returns the new inverter function.
	     */function createInverter(setter,toIteratee){return function(object,iteratee){return baseInverter(object,setter,toIteratee(iteratee),{});};}/**
	     * Creates a function that performs a mathematical operation on two values.
	     *
	     * @private
	     * @param {Function} operator The function to perform the operation.
	     * @param {number} [defaultValue] The value used for `undefined` arguments.
	     * @returns {Function} Returns the new mathematical operation function.
	     */function createMathOperation(operator,defaultValue){return function(value,other){var result;if(value===undefined&&other===undefined){return defaultValue;}if(value!==undefined){result=value;}if(other!==undefined){if(result===undefined){return other;}if(typeof value=='string'||typeof other=='string'){value=baseToString(value);other=baseToString(other);}else{value=baseToNumber(value);other=baseToNumber(other);}result=operator(value,other);}return result;};}/**
	     * Creates a function like `_.over`.
	     *
	     * @private
	     * @param {Function} arrayFunc The function to iterate over iteratees.
	     * @returns {Function} Returns the new over function.
	     */function createOver(arrayFunc){return flatRest(function(iteratees){iteratees=arrayMap(iteratees,baseUnary(getIteratee()));return baseRest(function(args){var thisArg=this;return arrayFunc(iteratees,function(iteratee){return apply(iteratee,thisArg,args);});});});}/**
	     * Creates the padding for `string` based on `length`. The `chars` string
	     * is truncated if the number of characters exceeds `length`.
	     *
	     * @private
	     * @param {number} length The padding length.
	     * @param {string} [chars=' '] The string used as padding.
	     * @returns {string} Returns the padding for `string`.
	     */function createPadding(length,chars){chars=chars===undefined?' ':baseToString(chars);var charsLength=chars.length;if(charsLength<2){return charsLength?baseRepeat(chars,length):chars;}var result=baseRepeat(chars,nativeCeil(length/stringSize(chars)));return hasUnicode(chars)?castSlice(stringToArray(result),0,length).join(''):result.slice(0,length);}/**
	     * Creates a function that wraps `func` to invoke it with the `this` binding
	     * of `thisArg` and `partials` prepended to the arguments it receives.
	     *
	     * @private
	     * @param {Function} func The function to wrap.
	     * @param {number} bitmask The bitmask flags. See `createWrap` for more details.
	     * @param {*} thisArg The `this` binding of `func`.
	     * @param {Array} partials The arguments to prepend to those provided to
	     *  the new function.
	     * @returns {Function} Returns the new wrapped function.
	     */function createPartial(func,bitmask,thisArg,partials){var isBind=bitmask&WRAP_BIND_FLAG,Ctor=createCtor(func);function wrapper(){var argsIndex=-1,argsLength=arguments.length,leftIndex=-1,leftLength=partials.length,args=Array(leftLength+argsLength),fn=this&&this!==root&&this instanceof wrapper?Ctor:func;while(++leftIndex<leftLength){args[leftIndex]=partials[leftIndex];}while(argsLength--){args[leftIndex++]=arguments[++argsIndex];}return apply(fn,isBind?thisArg:this,args);}return wrapper;}/**
	     * Creates a `_.range` or `_.rangeRight` function.
	     *
	     * @private
	     * @param {boolean} [fromRight] Specify iterating from right to left.
	     * @returns {Function} Returns the new range function.
	     */function createRange(fromRight){return function(start,end,step){if(step&&typeof step!='number'&&isIterateeCall(start,end,step)){end=step=undefined;}// Ensure the sign of `-0` is preserved.
	start=toFinite(start);if(end===undefined){end=start;start=0;}else{end=toFinite(end);}step=step===undefined?start<end?1:-1:toFinite(step);return baseRange(start,end,step,fromRight);};}/**
	     * Creates a function that performs a relational operation on two values.
	     *
	     * @private
	     * @param {Function} operator The function to perform the operation.
	     * @returns {Function} Returns the new relational operation function.
	     */function createRelationalOperation(operator){return function(value,other){if(!(typeof value=='string'&&typeof other=='string')){value=toNumber(value);other=toNumber(other);}return operator(value,other);};}/**
	     * Creates a function that wraps `func` to continue currying.
	     *
	     * @private
	     * @param {Function} func The function to wrap.
	     * @param {number} bitmask The bitmask flags. See `createWrap` for more details.
	     * @param {Function} wrapFunc The function to create the `func` wrapper.
	     * @param {*} placeholder The placeholder value.
	     * @param {*} [thisArg] The `this` binding of `func`.
	     * @param {Array} [partials] The arguments to prepend to those provided to
	     *  the new function.
	     * @param {Array} [holders] The `partials` placeholder indexes.
	     * @param {Array} [argPos] The argument positions of the new function.
	     * @param {number} [ary] The arity cap of `func`.
	     * @param {number} [arity] The arity of `func`.
	     * @returns {Function} Returns the new wrapped function.
	     */function createRecurry(func,bitmask,wrapFunc,placeholder,thisArg,partials,holders,argPos,ary,arity){var isCurry=bitmask&WRAP_CURRY_FLAG,newHolders=isCurry?holders:undefined,newHoldersRight=isCurry?undefined:holders,newPartials=isCurry?partials:undefined,newPartialsRight=isCurry?undefined:partials;bitmask|=isCurry?WRAP_PARTIAL_FLAG:WRAP_PARTIAL_RIGHT_FLAG;bitmask&=~(isCurry?WRAP_PARTIAL_RIGHT_FLAG:WRAP_PARTIAL_FLAG);if(!(bitmask&WRAP_CURRY_BOUND_FLAG)){bitmask&=~(WRAP_BIND_FLAG|WRAP_BIND_KEY_FLAG);}var newData=[func,bitmask,thisArg,newPartials,newHolders,newPartialsRight,newHoldersRight,argPos,ary,arity];var result=wrapFunc.apply(undefined,newData);if(isLaziable(func)){setData(result,newData);}result.placeholder=placeholder;return setWrapToString(result,func,bitmask);}/**
	     * Creates a function like `_.round`.
	     *
	     * @private
	     * @param {string} methodName The name of the `Math` method to use when rounding.
	     * @returns {Function} Returns the new round function.
	     */function createRound(methodName){var func=Math[methodName];return function(number,precision){number=toNumber(number);precision=nativeMin(toInteger(precision),292);if(precision){// Shift with exponential notation to avoid floating-point issues.
	// See [MDN](https://mdn.io/round#Examples) for more details.
	var pair=(toString(number)+'e').split('e'),value=func(pair[0]+'e'+(+pair[1]+precision));pair=(toString(value)+'e').split('e');return+(pair[0]+'e'+(+pair[1]-precision));}return func(number);};}/**
	     * Creates a set object of `values`.
	     *
	     * @private
	     * @param {Array} values The values to add to the set.
	     * @returns {Object} Returns the new set.
	     */var createSet=!(Set&&1/setToArray(new Set([,-0]))[1]==INFINITY)?noop:function(values){return new Set(values);};/**
	     * Creates a `_.toPairs` or `_.toPairsIn` function.
	     *
	     * @private
	     * @param {Function} keysFunc The function to get the keys of a given object.
	     * @returns {Function} Returns the new pairs function.
	     */function createToPairs(keysFunc){return function(object){var tag=getTag(object);if(tag==mapTag){return mapToArray(object);}if(tag==setTag){return setToPairs(object);}return baseToPairs(object,keysFunc(object));};}/**
	     * Creates a function that either curries or invokes `func` with optional
	     * `this` binding and partially applied arguments.
	     *
	     * @private
	     * @param {Function|string} func The function or method name to wrap.
	     * @param {number} bitmask The bitmask flags.
	     *    1 - `_.bind`
	     *    2 - `_.bindKey`
	     *    4 - `_.curry` or `_.curryRight` of a bound function
	     *    8 - `_.curry`
	     *   16 - `_.curryRight`
	     *   32 - `_.partial`
	     *   64 - `_.partialRight`
	     *  128 - `_.rearg`
	     *  256 - `_.ary`
	     *  512 - `_.flip`
	     * @param {*} [thisArg] The `this` binding of `func`.
	     * @param {Array} [partials] The arguments to be partially applied.
	     * @param {Array} [holders] The `partials` placeholder indexes.
	     * @param {Array} [argPos] The argument positions of the new function.
	     * @param {number} [ary] The arity cap of `func`.
	     * @param {number} [arity] The arity of `func`.
	     * @returns {Function} Returns the new wrapped function.
	     */function createWrap(func,bitmask,thisArg,partials,holders,argPos,ary,arity){var isBindKey=bitmask&WRAP_BIND_KEY_FLAG;if(!isBindKey&&typeof func!='function'){throw new TypeError(FUNC_ERROR_TEXT);}var length=partials?partials.length:0;if(!length){bitmask&=~(WRAP_PARTIAL_FLAG|WRAP_PARTIAL_RIGHT_FLAG);partials=holders=undefined;}ary=ary===undefined?ary:nativeMax(toInteger(ary),0);arity=arity===undefined?arity:toInteger(arity);length-=holders?holders.length:0;if(bitmask&WRAP_PARTIAL_RIGHT_FLAG){var partialsRight=partials,holdersRight=holders;partials=holders=undefined;}var data=isBindKey?undefined:getData(func);var newData=[func,bitmask,thisArg,partials,holders,partialsRight,holdersRight,argPos,ary,arity];if(data){mergeData(newData,data);}func=newData[0];bitmask=newData[1];thisArg=newData[2];partials=newData[3];holders=newData[4];arity=newData[9]=newData[9]==null?isBindKey?0:func.length:nativeMax(newData[9]-length,0);if(!arity&&bitmask&(WRAP_CURRY_FLAG|WRAP_CURRY_RIGHT_FLAG)){bitmask&=~(WRAP_CURRY_FLAG|WRAP_CURRY_RIGHT_FLAG);}if(!bitmask||bitmask==WRAP_BIND_FLAG){var result=createBind(func,bitmask,thisArg);}else if(bitmask==WRAP_CURRY_FLAG||bitmask==WRAP_CURRY_RIGHT_FLAG){result=createCurry(func,bitmask,arity);}else if((bitmask==WRAP_PARTIAL_FLAG||bitmask==(WRAP_BIND_FLAG|WRAP_PARTIAL_FLAG))&&!holders.length){result=createPartial(func,bitmask,thisArg,partials);}else{result=createHybrid.apply(undefined,newData);}var setter=data?baseSetData:setData;return setWrapToString(setter(result,newData),func,bitmask);}/**
	     * A specialized version of `baseIsEqualDeep` for arrays with support for
	     * partial deep comparisons.
	     *
	     * @private
	     * @param {Array} array The array to compare.
	     * @param {Array} other The other array to compare.
	     * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	     * @param {Function} customizer The function to customize comparisons.
	     * @param {Function} equalFunc The function to determine equivalents of values.
	     * @param {Object} stack Tracks traversed `array` and `other` objects.
	     * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
	     */function equalArrays(array,other,bitmask,customizer,equalFunc,stack){var isPartial=bitmask&COMPARE_PARTIAL_FLAG,arrLength=array.length,othLength=other.length;if(arrLength!=othLength&&!(isPartial&&othLength>arrLength)){return false;}// Assume cyclic values are equal.
	var stacked=stack.get(array);if(stacked&&stack.get(other)){return stacked==other;}var index=-1,result=true,seen=bitmask&COMPARE_UNORDERED_FLAG?new SetCache():undefined;stack.set(array,other);stack.set(other,array);// Ignore non-index properties.
	while(++index<arrLength){var arrValue=array[index],othValue=other[index];if(customizer){var compared=isPartial?customizer(othValue,arrValue,index,other,array,stack):customizer(arrValue,othValue,index,array,other,stack);}if(compared!==undefined){if(compared){continue;}result=false;break;}// Recursively compare arrays (susceptible to call stack limits).
	if(seen){if(!arraySome(other,function(othValue,othIndex){if(!cacheHas(seen,othIndex)&&(arrValue===othValue||equalFunc(arrValue,othValue,bitmask,customizer,stack))){return seen.push(othIndex);}})){result=false;break;}}else if(!(arrValue===othValue||equalFunc(arrValue,othValue,bitmask,customizer,stack))){result=false;break;}}stack['delete'](array);stack['delete'](other);return result;}/**
	     * A specialized version of `baseIsEqualDeep` for comparing objects of
	     * the same `toStringTag`.
	     *
	     * **Note:** This function only supports comparing values with tags of
	     * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
	     *
	     * @private
	     * @param {Object} object The object to compare.
	     * @param {Object} other The other object to compare.
	     * @param {string} tag The `toStringTag` of the objects to compare.
	     * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	     * @param {Function} customizer The function to customize comparisons.
	     * @param {Function} equalFunc The function to determine equivalents of values.
	     * @param {Object} stack Tracks traversed `object` and `other` objects.
	     * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	     */function equalByTag(object,other,tag,bitmask,customizer,equalFunc,stack){switch(tag){case dataViewTag:if(object.byteLength!=other.byteLength||object.byteOffset!=other.byteOffset){return false;}object=object.buffer;other=other.buffer;case arrayBufferTag:if(object.byteLength!=other.byteLength||!equalFunc(new Uint8Array(object),new Uint8Array(other))){return false;}return true;case boolTag:case dateTag:case numberTag:// Coerce booleans to `1` or `0` and dates to milliseconds.
	// Invalid dates are coerced to `NaN`.
	return eq(+object,+other);case errorTag:return object.name==other.name&&object.message==other.message;case regexpTag:case stringTag:// Coerce regexes to strings and treat strings, primitives and objects,
	// as equal. See http://www.ecma-international.org/ecma-262/7.0/#sec-regexp.prototype.tostring
	// for more details.
	return object==other+'';case mapTag:var convert=mapToArray;case setTag:var isPartial=bitmask&COMPARE_PARTIAL_FLAG;convert||(convert=setToArray);if(object.size!=other.size&&!isPartial){return false;}// Assume cyclic values are equal.
	var stacked=stack.get(object);if(stacked){return stacked==other;}bitmask|=COMPARE_UNORDERED_FLAG;// Recursively compare objects (susceptible to call stack limits).
	stack.set(object,other);var result=equalArrays(convert(object),convert(other),bitmask,customizer,equalFunc,stack);stack['delete'](object);return result;case symbolTag:if(symbolValueOf){return symbolValueOf.call(object)==symbolValueOf.call(other);}}return false;}/**
	     * A specialized version of `baseIsEqualDeep` for objects with support for
	     * partial deep comparisons.
	     *
	     * @private
	     * @param {Object} object The object to compare.
	     * @param {Object} other The other object to compare.
	     * @param {number} bitmask The bitmask flags. See `baseIsEqual` for more details.
	     * @param {Function} customizer The function to customize comparisons.
	     * @param {Function} equalFunc The function to determine equivalents of values.
	     * @param {Object} stack Tracks traversed `object` and `other` objects.
	     * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
	     */function equalObjects(object,other,bitmask,customizer,equalFunc,stack){var isPartial=bitmask&COMPARE_PARTIAL_FLAG,objProps=keys(object),objLength=objProps.length,othProps=keys(other),othLength=othProps.length;if(objLength!=othLength&&!isPartial){return false;}var index=objLength;while(index--){var key=objProps[index];if(!(isPartial?key in other:hasOwnProperty.call(other,key))){return false;}}// Assume cyclic values are equal.
	var stacked=stack.get(object);if(stacked&&stack.get(other)){return stacked==other;}var result=true;stack.set(object,other);stack.set(other,object);var skipCtor=isPartial;while(++index<objLength){key=objProps[index];var objValue=object[key],othValue=other[key];if(customizer){var compared=isPartial?customizer(othValue,objValue,key,other,object,stack):customizer(objValue,othValue,key,object,other,stack);}// Recursively compare objects (susceptible to call stack limits).
	if(!(compared===undefined?objValue===othValue||equalFunc(objValue,othValue,bitmask,customizer,stack):compared)){result=false;break;}skipCtor||(skipCtor=key=='constructor');}if(result&&!skipCtor){var objCtor=object.constructor,othCtor=other.constructor;// Non `Object` object instances with different constructors are not equal.
	if(objCtor!=othCtor&&'constructor'in object&&'constructor'in other&&!(typeof objCtor=='function'&&objCtor instanceof objCtor&&typeof othCtor=='function'&&othCtor instanceof othCtor)){result=false;}}stack['delete'](object);stack['delete'](other);return result;}/**
	     * A specialized version of `baseRest` which flattens the rest array.
	     *
	     * @private
	     * @param {Function} func The function to apply a rest parameter to.
	     * @returns {Function} Returns the new function.
	     */function flatRest(func){return setToString(overRest(func,undefined,flatten),func+'');}/**
	     * Creates an array of own enumerable property names and symbols of `object`.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the array of property names and symbols.
	     */function getAllKeys(object){return baseGetAllKeys(object,keys,getSymbols);}/**
	     * Creates an array of own and inherited enumerable property names and
	     * symbols of `object`.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the array of property names and symbols.
	     */function getAllKeysIn(object){return baseGetAllKeys(object,keysIn,getSymbolsIn);}/**
	     * Gets metadata for `func`.
	     *
	     * @private
	     * @param {Function} func The function to query.
	     * @returns {*} Returns the metadata for `func`.
	     */var getData=!metaMap?noop:function(func){return metaMap.get(func);};/**
	     * Gets the name of `func`.
	     *
	     * @private
	     * @param {Function} func The function to query.
	     * @returns {string} Returns the function name.
	     */function getFuncName(func){var result=func.name+'',array=realNames[result],length=hasOwnProperty.call(realNames,result)?array.length:0;while(length--){var data=array[length],otherFunc=data.func;if(otherFunc==null||otherFunc==func){return data.name;}}return result;}/**
	     * Gets the argument placeholder value for `func`.
	     *
	     * @private
	     * @param {Function} func The function to inspect.
	     * @returns {*} Returns the placeholder value.
	     */function getHolder(func){var object=hasOwnProperty.call(lodash,'placeholder')?lodash:func;return object.placeholder;}/**
	     * Gets the appropriate "iteratee" function. If `_.iteratee` is customized,
	     * this function returns the custom method, otherwise it returns `baseIteratee`.
	     * If arguments are provided, the chosen function is invoked with them and
	     * its result is returned.
	     *
	     * @private
	     * @param {*} [value] The value to convert to an iteratee.
	     * @param {number} [arity] The arity of the created iteratee.
	     * @returns {Function} Returns the chosen function or its result.
	     */function getIteratee(){var result=lodash.iteratee||iteratee;result=result===iteratee?baseIteratee:result;return arguments.length?result(arguments[0],arguments[1]):result;}/**
	     * Gets the data for `map`.
	     *
	     * @private
	     * @param {Object} map The map to query.
	     * @param {string} key The reference key.
	     * @returns {*} Returns the map data.
	     */function getMapData(map,key){var data=map.__data__;return isKeyable(key)?data[typeof key=='string'?'string':'hash']:data.map;}/**
	     * Gets the property names, values, and compare flags of `object`.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the match data of `object`.
	     */function getMatchData(object){var result=keys(object),length=result.length;while(length--){var key=result[length],value=object[key];result[length]=[key,value,isStrictComparable(value)];}return result;}/**
	     * Gets the native function at `key` of `object`.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @param {string} key The key of the method to get.
	     * @returns {*} Returns the function if it's native, else `undefined`.
	     */function getNative(object,key){var value=getValue(object,key);return baseIsNative(value)?value:undefined;}/**
	     * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
	     *
	     * @private
	     * @param {*} value The value to query.
	     * @returns {string} Returns the raw `toStringTag`.
	     */function getRawTag(value){var isOwn=hasOwnProperty.call(value,symToStringTag),tag=value[symToStringTag];try{value[symToStringTag]=undefined;var unmasked=true;}catch(e){}var result=nativeObjectToString.call(value);if(unmasked){if(isOwn){value[symToStringTag]=tag;}else{delete value[symToStringTag];}}return result;}/**
	     * Creates an array of the own enumerable symbols of `object`.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the array of symbols.
	     */var getSymbols=nativeGetSymbols?overArg(nativeGetSymbols,Object):stubArray;/**
	     * Creates an array of the own and inherited enumerable symbols of `object`.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the array of symbols.
	     */var getSymbolsIn=!nativeGetSymbols?stubArray:function(object){var result=[];while(object){arrayPush(result,getSymbols(object));object=getPrototype(object);}return result;};/**
	     * Gets the `toStringTag` of `value`.
	     *
	     * @private
	     * @param {*} value The value to query.
	     * @returns {string} Returns the `toStringTag`.
	     */var getTag=baseGetTag;// Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
	if(DataView&&getTag(new DataView(new ArrayBuffer(1)))!=dataViewTag||Map&&getTag(new Map())!=mapTag||Promise&&getTag(Promise.resolve())!=promiseTag||Set&&getTag(new Set())!=setTag||WeakMap&&getTag(new WeakMap())!=weakMapTag){getTag=function getTag(value){var result=baseGetTag(value),Ctor=result==objectTag?value.constructor:undefined,ctorString=Ctor?toSource(Ctor):'';if(ctorString){switch(ctorString){case dataViewCtorString:return dataViewTag;case mapCtorString:return mapTag;case promiseCtorString:return promiseTag;case setCtorString:return setTag;case weakMapCtorString:return weakMapTag;}}return result;};}/**
	     * Gets the view, applying any `transforms` to the `start` and `end` positions.
	     *
	     * @private
	     * @param {number} start The start of the view.
	     * @param {number} end The end of the view.
	     * @param {Array} transforms The transformations to apply to the view.
	     * @returns {Object} Returns an object containing the `start` and `end`
	     *  positions of the view.
	     */function getView(start,end,transforms){var index=-1,length=transforms.length;while(++index<length){var data=transforms[index],size=data.size;switch(data.type){case'drop':start+=size;break;case'dropRight':end-=size;break;case'take':end=nativeMin(end,start+size);break;case'takeRight':start=nativeMax(start,end-size);break;}}return{'start':start,'end':end};}/**
	     * Extracts wrapper details from the `source` body comment.
	     *
	     * @private
	     * @param {string} source The source to inspect.
	     * @returns {Array} Returns the wrapper details.
	     */function getWrapDetails(source){var match=source.match(reWrapDetails);return match?match[1].split(reSplitDetails):[];}/**
	     * Checks if `path` exists on `object`.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @param {Array|string} path The path to check.
	     * @param {Function} hasFunc The function to check properties.
	     * @returns {boolean} Returns `true` if `path` exists, else `false`.
	     */function hasPath(object,path,hasFunc){path=castPath(path,object);var index=-1,length=path.length,result=false;while(++index<length){var key=toKey(path[index]);if(!(result=object!=null&&hasFunc(object,key))){break;}object=object[key];}if(result||++index!=length){return result;}length=object==null?0:object.length;return!!length&&isLength(length)&&isIndex(key,length)&&(isArray(object)||isArguments(object));}/**
	     * Initializes an array clone.
	     *
	     * @private
	     * @param {Array} array The array to clone.
	     * @returns {Array} Returns the initialized clone.
	     */function initCloneArray(array){var length=array.length,result=array.constructor(length);// Add properties assigned by `RegExp#exec`.
	if(length&&typeof array[0]=='string'&&hasOwnProperty.call(array,'index')){result.index=array.index;result.input=array.input;}return result;}/**
	     * Initializes an object clone.
	     *
	     * @private
	     * @param {Object} object The object to clone.
	     * @returns {Object} Returns the initialized clone.
	     */function initCloneObject(object){return typeof object.constructor=='function'&&!isPrototype(object)?baseCreate(getPrototype(object)):{};}/**
	     * Initializes an object clone based on its `toStringTag`.
	     *
	     * **Note:** This function only supports cloning values with tags of
	     * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
	     *
	     * @private
	     * @param {Object} object The object to clone.
	     * @param {string} tag The `toStringTag` of the object to clone.
	     * @param {Function} cloneFunc The function to clone values.
	     * @param {boolean} [isDeep] Specify a deep clone.
	     * @returns {Object} Returns the initialized clone.
	     */function initCloneByTag(object,tag,cloneFunc,isDeep){var Ctor=object.constructor;switch(tag){case arrayBufferTag:return cloneArrayBuffer(object);case boolTag:case dateTag:return new Ctor(+object);case dataViewTag:return cloneDataView(object,isDeep);case float32Tag:case float64Tag:case int8Tag:case int16Tag:case int32Tag:case uint8Tag:case uint8ClampedTag:case uint16Tag:case uint32Tag:return cloneTypedArray(object,isDeep);case mapTag:return cloneMap(object,isDeep,cloneFunc);case numberTag:case stringTag:return new Ctor(object);case regexpTag:return cloneRegExp(object);case setTag:return cloneSet(object,isDeep,cloneFunc);case symbolTag:return cloneSymbol(object);}}/**
	     * Inserts wrapper `details` in a comment at the top of the `source` body.
	     *
	     * @private
	     * @param {string} source The source to modify.
	     * @returns {Array} details The details to insert.
	     * @returns {string} Returns the modified source.
	     */function insertWrapDetails(source,details){var length=details.length;if(!length){return source;}var lastIndex=length-1;details[lastIndex]=(length>1?'& ':'')+details[lastIndex];details=details.join(length>2?', ':' ');return source.replace(reWrapComment,'{\n/* [wrapped with '+details+'] */\n');}/**
	     * Checks if `value` is a flattenable `arguments` object or array.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is flattenable, else `false`.
	     */function isFlattenable(value){return isArray(value)||isArguments(value)||!!(spreadableSymbol&&value&&value[spreadableSymbol]);}/**
	     * Checks if `value` is a valid array-like index.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
	     * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
	     */function isIndex(value,length){length=length==null?MAX_SAFE_INTEGER:length;return!!length&&(typeof value=='number'||reIsUint.test(value))&&value>-1&&value%1==0&&value<length;}/**
	     * Checks if the given arguments are from an iteratee call.
	     *
	     * @private
	     * @param {*} value The potential iteratee value argument.
	     * @param {*} index The potential iteratee index or key argument.
	     * @param {*} object The potential iteratee object argument.
	     * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
	     *  else `false`.
	     */function isIterateeCall(value,index,object){if(!isObject(object)){return false;}var type=typeof index==='undefined'?'undefined':_typeof(index);if(type=='number'?isArrayLike(object)&&isIndex(index,object.length):type=='string'&&index in object){return eq(object[index],value);}return false;}/**
	     * Checks if `value` is a property name and not a property path.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @param {Object} [object] The object to query keys on.
	     * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
	     */function isKey(value,object){if(isArray(value)){return false;}var type=typeof value==='undefined'?'undefined':_typeof(value);if(type=='number'||type=='symbol'||type=='boolean'||value==null||isSymbol(value)){return true;}return reIsPlainProp.test(value)||!reIsDeepProp.test(value)||object!=null&&value in Object(object);}/**
	     * Checks if `value` is suitable for use as unique object key.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
	     */function isKeyable(value){var type=typeof value==='undefined'?'undefined':_typeof(value);return type=='string'||type=='number'||type=='symbol'||type=='boolean'?value!=='__proto__':value===null;}/**
	     * Checks if `func` has a lazy counterpart.
	     *
	     * @private
	     * @param {Function} func The function to check.
	     * @returns {boolean} Returns `true` if `func` has a lazy counterpart,
	     *  else `false`.
	     */function isLaziable(func){var funcName=getFuncName(func),other=lodash[funcName];if(typeof other!='function'||!(funcName in LazyWrapper.prototype)){return false;}if(func===other){return true;}var data=getData(other);return!!data&&func===data[0];}/**
	     * Checks if `func` has its source masked.
	     *
	     * @private
	     * @param {Function} func The function to check.
	     * @returns {boolean} Returns `true` if `func` is masked, else `false`.
	     */function isMasked(func){return!!maskSrcKey&&maskSrcKey in func;}/**
	     * Checks if `func` is capable of being masked.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `func` is maskable, else `false`.
	     */var isMaskable=coreJsData?isFunction:stubFalse;/**
	     * Checks if `value` is likely a prototype object.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
	     */function isPrototype(value){var Ctor=value&&value.constructor,proto=typeof Ctor=='function'&&Ctor.prototype||objectProto;return value===proto;}/**
	     * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
	     *
	     * @private
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` if suitable for strict
	     *  equality comparisons, else `false`.
	     */function isStrictComparable(value){return value===value&&!isObject(value);}/**
	     * A specialized version of `matchesProperty` for source values suitable
	     * for strict equality comparisons, i.e. `===`.
	     *
	     * @private
	     * @param {string} key The key of the property to get.
	     * @param {*} srcValue The value to match.
	     * @returns {Function} Returns the new spec function.
	     */function matchesStrictComparable(key,srcValue){return function(object){if(object==null){return false;}return object[key]===srcValue&&(srcValue!==undefined||key in Object(object));};}/**
	     * A specialized version of `_.memoize` which clears the memoized function's
	     * cache when it exceeds `MAX_MEMOIZE_SIZE`.
	     *
	     * @private
	     * @param {Function} func The function to have its output memoized.
	     * @returns {Function} Returns the new memoized function.
	     */function memoizeCapped(func){var result=memoize(func,function(key){if(cache.size===MAX_MEMOIZE_SIZE){cache.clear();}return key;});var cache=result.cache;return result;}/**
	     * Merges the function metadata of `source` into `data`.
	     *
	     * Merging metadata reduces the number of wrappers used to invoke a function.
	     * This is possible because methods like `_.bind`, `_.curry`, and `_.partial`
	     * may be applied regardless of execution order. Methods like `_.ary` and
	     * `_.rearg` modify function arguments, making the order in which they are
	     * executed important, preventing the merging of metadata. However, we make
	     * an exception for a safe combined case where curried functions have `_.ary`
	     * and or `_.rearg` applied.
	     *
	     * @private
	     * @param {Array} data The destination metadata.
	     * @param {Array} source The source metadata.
	     * @returns {Array} Returns `data`.
	     */function mergeData(data,source){var bitmask=data[1],srcBitmask=source[1],newBitmask=bitmask|srcBitmask,isCommon=newBitmask<(WRAP_BIND_FLAG|WRAP_BIND_KEY_FLAG|WRAP_ARY_FLAG);var isCombo=srcBitmask==WRAP_ARY_FLAG&&bitmask==WRAP_CURRY_FLAG||srcBitmask==WRAP_ARY_FLAG&&bitmask==WRAP_REARG_FLAG&&data[7].length<=source[8]||srcBitmask==(WRAP_ARY_FLAG|WRAP_REARG_FLAG)&&source[7].length<=source[8]&&bitmask==WRAP_CURRY_FLAG;// Exit early if metadata can't be merged.
	if(!(isCommon||isCombo)){return data;}// Use source `thisArg` if available.
	if(srcBitmask&WRAP_BIND_FLAG){data[2]=source[2];// Set when currying a bound function.
	newBitmask|=bitmask&WRAP_BIND_FLAG?0:WRAP_CURRY_BOUND_FLAG;}// Compose partial arguments.
	var value=source[3];if(value){var partials=data[3];data[3]=partials?composeArgs(partials,value,source[4]):value;data[4]=partials?replaceHolders(data[3],PLACEHOLDER):source[4];}// Compose partial right arguments.
	value=source[5];if(value){partials=data[5];data[5]=partials?composeArgsRight(partials,value,source[6]):value;data[6]=partials?replaceHolders(data[5],PLACEHOLDER):source[6];}// Use source `argPos` if available.
	value=source[7];if(value){data[7]=value;}// Use source `ary` if it's smaller.
	if(srcBitmask&WRAP_ARY_FLAG){data[8]=data[8]==null?source[8]:nativeMin(data[8],source[8]);}// Use source `arity` if one is not provided.
	if(data[9]==null){data[9]=source[9];}// Use source `func` and merge bitmasks.
	data[0]=source[0];data[1]=newBitmask;return data;}/**
	     * Used by `_.defaultsDeep` to customize its `_.merge` use.
	     *
	     * @private
	     * @param {*} objValue The destination value.
	     * @param {*} srcValue The source value.
	     * @param {string} key The key of the property to merge.
	     * @param {Object} object The parent object of `objValue`.
	     * @param {Object} source The parent object of `srcValue`.
	     * @param {Object} [stack] Tracks traversed source values and their merged
	     *  counterparts.
	     * @returns {*} Returns the value to assign.
	     */function mergeDefaults(objValue,srcValue,key,object,source,stack){if(isObject(objValue)&&isObject(srcValue)){// Recursively merge objects and arrays (susceptible to call stack limits).
	stack.set(srcValue,objValue);baseMerge(objValue,srcValue,undefined,mergeDefaults,stack);stack['delete'](srcValue);}return objValue;}/**
	     * This function is like
	     * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
	     * except that it includes inherited enumerable properties.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the array of property names.
	     */function nativeKeysIn(object){var result=[];if(object!=null){for(var key in Object(object)){result.push(key);}}return result;}/**
	     * Converts `value` to a string using `Object.prototype.toString`.
	     *
	     * @private
	     * @param {*} value The value to convert.
	     * @returns {string} Returns the converted string.
	     */function objectToString(value){return nativeObjectToString.call(value);}/**
	     * A specialized version of `baseRest` which transforms the rest array.
	     *
	     * @private
	     * @param {Function} func The function to apply a rest parameter to.
	     * @param {number} [start=func.length-1] The start position of the rest parameter.
	     * @param {Function} transform The rest array transform.
	     * @returns {Function} Returns the new function.
	     */function overRest(func,start,transform){start=nativeMax(start===undefined?func.length-1:start,0);return function(){var args=arguments,index=-1,length=nativeMax(args.length-start,0),array=Array(length);while(++index<length){array[index]=args[start+index];}index=-1;var otherArgs=Array(start+1);while(++index<start){otherArgs[index]=args[index];}otherArgs[start]=transform(array);return apply(func,this,otherArgs);};}/**
	     * Gets the parent value at `path` of `object`.
	     *
	     * @private
	     * @param {Object} object The object to query.
	     * @param {Array} path The path to get the parent value of.
	     * @returns {*} Returns the parent value.
	     */function parent(object,path){return path.length<2?object:baseGet(object,baseSlice(path,0,-1));}/**
	     * Reorder `array` according to the specified indexes where the element at
	     * the first index is assigned as the first element, the element at
	     * the second index is assigned as the second element, and so on.
	     *
	     * @private
	     * @param {Array} array The array to reorder.
	     * @param {Array} indexes The arranged array indexes.
	     * @returns {Array} Returns `array`.
	     */function reorder(array,indexes){var arrLength=array.length,length=nativeMin(indexes.length,arrLength),oldArray=copyArray(array);while(length--){var index=indexes[length];array[length]=isIndex(index,arrLength)?oldArray[index]:undefined;}return array;}/**
	     * Sets metadata for `func`.
	     *
	     * **Note:** If this function becomes hot, i.e. is invoked a lot in a short
	     * period of time, it will trip its breaker and transition to an identity
	     * function to avoid garbage collection pauses in V8. See
	     * [V8 issue 2070](https://bugs.chromium.org/p/v8/issues/detail?id=2070)
	     * for more details.
	     *
	     * @private
	     * @param {Function} func The function to associate metadata with.
	     * @param {*} data The metadata.
	     * @returns {Function} Returns `func`.
	     */var setData=shortOut(baseSetData);/**
	     * A simple wrapper around the global [`setTimeout`](https://mdn.io/setTimeout).
	     *
	     * @private
	     * @param {Function} func The function to delay.
	     * @param {number} wait The number of milliseconds to delay invocation.
	     * @returns {number|Object} Returns the timer id or timeout object.
	     */var setTimeout=ctxSetTimeout||function(func,wait){return root.setTimeout(func,wait);};/**
	     * Sets the `toString` method of `func` to return `string`.
	     *
	     * @private
	     * @param {Function} func The function to modify.
	     * @param {Function} string The `toString` result.
	     * @returns {Function} Returns `func`.
	     */var setToString=shortOut(baseSetToString);/**
	     * Sets the `toString` method of `wrapper` to mimic the source of `reference`
	     * with wrapper details in a comment at the top of the source body.
	     *
	     * @private
	     * @param {Function} wrapper The function to modify.
	     * @param {Function} reference The reference function.
	     * @param {number} bitmask The bitmask flags. See `createWrap` for more details.
	     * @returns {Function} Returns `wrapper`.
	     */function setWrapToString(wrapper,reference,bitmask){var source=reference+'';return setToString(wrapper,insertWrapDetails(source,updateWrapDetails(getWrapDetails(source),bitmask)));}/**
	     * Creates a function that'll short out and invoke `identity` instead
	     * of `func` when it's called `HOT_COUNT` or more times in `HOT_SPAN`
	     * milliseconds.
	     *
	     * @private
	     * @param {Function} func The function to restrict.
	     * @returns {Function} Returns the new shortable function.
	     */function shortOut(func){var count=0,lastCalled=0;return function(){var stamp=nativeNow(),remaining=HOT_SPAN-(stamp-lastCalled);lastCalled=stamp;if(remaining>0){if(++count>=HOT_COUNT){return arguments[0];}}else{count=0;}return func.apply(undefined,arguments);};}/**
	     * A specialized version of `_.shuffle` which mutates and sets the size of `array`.
	     *
	     * @private
	     * @param {Array} array The array to shuffle.
	     * @param {number} [size=array.length] The size of `array`.
	     * @returns {Array} Returns `array`.
	     */function shuffleSelf(array,size){var index=-1,length=array.length,lastIndex=length-1;size=size===undefined?length:size;while(++index<size){var rand=baseRandom(index,lastIndex),value=array[rand];array[rand]=array[index];array[index]=value;}array.length=size;return array;}/**
	     * Converts `string` to a property path array.
	     *
	     * @private
	     * @param {string} string The string to convert.
	     * @returns {Array} Returns the property path array.
	     */var stringToPath=memoizeCapped(function(string){var result=[];if(reLeadingDot.test(string)){result.push('');}string.replace(rePropName,function(match,number,quote,string){result.push(quote?string.replace(reEscapeChar,'$1'):number||match);});return result;});/**
	     * Converts `value` to a string key if it's not a string or symbol.
	     *
	     * @private
	     * @param {*} value The value to inspect.
	     * @returns {string|symbol} Returns the key.
	     */function toKey(value){if(typeof value=='string'||isSymbol(value)){return value;}var result=value+'';return result=='0'&&1/value==-INFINITY?'-0':result;}/**
	     * Converts `func` to its source code.
	     *
	     * @private
	     * @param {Function} func The function to convert.
	     * @returns {string} Returns the source code.
	     */function toSource(func){if(func!=null){try{return funcToString.call(func);}catch(e){}try{return func+'';}catch(e){}}return'';}/**
	     * Updates wrapper `details` based on `bitmask` flags.
	     *
	     * @private
	     * @returns {Array} details The details to modify.
	     * @param {number} bitmask The bitmask flags. See `createWrap` for more details.
	     * @returns {Array} Returns `details`.
	     */function updateWrapDetails(details,bitmask){arrayEach(wrapFlags,function(pair){var value='_.'+pair[0];if(bitmask&pair[1]&&!arrayIncludes(details,value)){details.push(value);}});return details.sort();}/**
	     * Creates a clone of `wrapper`.
	     *
	     * @private
	     * @param {Object} wrapper The wrapper to clone.
	     * @returns {Object} Returns the cloned wrapper.
	     */function wrapperClone(wrapper){if(wrapper instanceof LazyWrapper){return wrapper.clone();}var result=new LodashWrapper(wrapper.__wrapped__,wrapper.__chain__);result.__actions__=copyArray(wrapper.__actions__);result.__index__=wrapper.__index__;result.__values__=wrapper.__values__;return result;}/*------------------------------------------------------------------------*//**
	     * Creates an array of elements split into groups the length of `size`.
	     * If `array` can't be split evenly, the final chunk will be the remaining
	     * elements.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Array
	     * @param {Array} array The array to process.
	     * @param {number} [size=1] The length of each chunk
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {Array} Returns the new array of chunks.
	     * @example
	     *
	     * _.chunk(['a', 'b', 'c', 'd'], 2);
	     * // => [['a', 'b'], ['c', 'd']]
	     *
	     * _.chunk(['a', 'b', 'c', 'd'], 3);
	     * // => [['a', 'b', 'c'], ['d']]
	     */function chunk(array,size,guard){if(guard?isIterateeCall(array,size,guard):size===undefined){size=1;}else{size=nativeMax(toInteger(size),0);}var length=array==null?0:array.length;if(!length||size<1){return[];}var index=0,resIndex=0,result=Array(nativeCeil(length/size));while(index<length){result[resIndex++]=baseSlice(array,index,index+=size);}return result;}/**
	     * Creates an array with all falsey values removed. The values `false`, `null`,
	     * `0`, `""`, `undefined`, and `NaN` are falsey.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {Array} array The array to compact.
	     * @returns {Array} Returns the new array of filtered values.
	     * @example
	     *
	     * _.compact([0, 1, false, 2, '', 3]);
	     * // => [1, 2, 3]
	     */function compact(array){var index=-1,length=array==null?0:array.length,resIndex=0,result=[];while(++index<length){var value=array[index];if(value){result[resIndex++]=value;}}return result;}/**
	     * Creates a new array concatenating `array` with any additional arrays
	     * and/or values.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to concatenate.
	     * @param {...*} [values] The values to concatenate.
	     * @returns {Array} Returns the new concatenated array.
	     * @example
	     *
	     * var array = [1];
	     * var other = _.concat(array, 2, [3], [[4]]);
	     *
	     * console.log(other);
	     * // => [1, 2, 3, [4]]
	     *
	     * console.log(array);
	     * // => [1]
	     */function concat(){var length=arguments.length;if(!length){return[];}var args=Array(length-1),array=arguments[0],index=length;while(index--){args[index-1]=arguments[index];}return arrayPush(isArray(array)?copyArray(array):[array],baseFlatten(args,1));}/**
	     * Creates an array of `array` values not included in the other given arrays
	     * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	     * for equality comparisons. The order and references of result values are
	     * determined by the first array.
	     *
	     * **Note:** Unlike `_.pullAll`, this method returns a new array.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {...Array} [values] The values to exclude.
	     * @returns {Array} Returns the new array of filtered values.
	     * @see _.without, _.xor
	     * @example
	     *
	     * _.difference([2, 1], [2, 3]);
	     * // => [1]
	     */var difference=baseRest(function(array,values){return isArrayLikeObject(array)?baseDifference(array,baseFlatten(values,1,isArrayLikeObject,true)):[];});/**
	     * This method is like `_.difference` except that it accepts `iteratee` which
	     * is invoked for each element of `array` and `values` to generate the criterion
	     * by which they're compared. The order and references of result values are
	     * determined by the first array. The iteratee is invoked with one argument:
	     * (value).
	     *
	     * **Note:** Unlike `_.pullAllBy`, this method returns a new array.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {...Array} [values] The values to exclude.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {Array} Returns the new array of filtered values.
	     * @example
	     *
	     * _.differenceBy([2.1, 1.2], [2.3, 3.4], Math.floor);
	     * // => [1.2]
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.differenceBy([{ 'x': 2 }, { 'x': 1 }], [{ 'x': 1 }], 'x');
	     * // => [{ 'x': 2 }]
	     */var differenceBy=baseRest(function(array,values){var iteratee=last(values);if(isArrayLikeObject(iteratee)){iteratee=undefined;}return isArrayLikeObject(array)?baseDifference(array,baseFlatten(values,1,isArrayLikeObject,true),getIteratee(iteratee,2)):[];});/**
	     * This method is like `_.difference` except that it accepts `comparator`
	     * which is invoked to compare elements of `array` to `values`. The order and
	     * references of result values are determined by the first array. The comparator
	     * is invoked with two arguments: (arrVal, othVal).
	     *
	     * **Note:** Unlike `_.pullAllWith`, this method returns a new array.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {...Array} [values] The values to exclude.
	     * @param {Function} [comparator] The comparator invoked per element.
	     * @returns {Array} Returns the new array of filtered values.
	     * @example
	     *
	     * var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
	     *
	     * _.differenceWith(objects, [{ 'x': 1, 'y': 2 }], _.isEqual);
	     * // => [{ 'x': 2, 'y': 1 }]
	     */var differenceWith=baseRest(function(array,values){var comparator=last(values);if(isArrayLikeObject(comparator)){comparator=undefined;}return isArrayLikeObject(array)?baseDifference(array,baseFlatten(values,1,isArrayLikeObject,true),undefined,comparator):[];});/**
	     * Creates a slice of `array` with `n` elements dropped from the beginning.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.5.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @param {number} [n=1] The number of elements to drop.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {Array} Returns the slice of `array`.
	     * @example
	     *
	     * _.drop([1, 2, 3]);
	     * // => [2, 3]
	     *
	     * _.drop([1, 2, 3], 2);
	     * // => [3]
	     *
	     * _.drop([1, 2, 3], 5);
	     * // => []
	     *
	     * _.drop([1, 2, 3], 0);
	     * // => [1, 2, 3]
	     */function drop(array,n,guard){var length=array==null?0:array.length;if(!length){return[];}n=guard||n===undefined?1:toInteger(n);return baseSlice(array,n<0?0:n,length);}/**
	     * Creates a slice of `array` with `n` elements dropped from the end.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @param {number} [n=1] The number of elements to drop.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {Array} Returns the slice of `array`.
	     * @example
	     *
	     * _.dropRight([1, 2, 3]);
	     * // => [1, 2]
	     *
	     * _.dropRight([1, 2, 3], 2);
	     * // => [1]
	     *
	     * _.dropRight([1, 2, 3], 5);
	     * // => []
	     *
	     * _.dropRight([1, 2, 3], 0);
	     * // => [1, 2, 3]
	     */function dropRight(array,n,guard){var length=array==null?0:array.length;if(!length){return[];}n=guard||n===undefined?1:toInteger(n);n=length-n;return baseSlice(array,0,n<0?0:n);}/**
	     * Creates a slice of `array` excluding elements dropped from the end.
	     * Elements are dropped until `predicate` returns falsey. The predicate is
	     * invoked with three arguments: (value, index, array).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the slice of `array`.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney',  'active': true },
	     *   { 'user': 'fred',    'active': false },
	     *   { 'user': 'pebbles', 'active': false }
	     * ];
	     *
	     * _.dropRightWhile(users, function(o) { return !o.active; });
	     * // => objects for ['barney']
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.dropRightWhile(users, { 'user': 'pebbles', 'active': false });
	     * // => objects for ['barney', 'fred']
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.dropRightWhile(users, ['active', false]);
	     * // => objects for ['barney']
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.dropRightWhile(users, 'active');
	     * // => objects for ['barney', 'fred', 'pebbles']
	     */function dropRightWhile(array,predicate){return array&&array.length?baseWhile(array,getIteratee(predicate,3),true,true):[];}/**
	     * Creates a slice of `array` excluding elements dropped from the beginning.
	     * Elements are dropped until `predicate` returns falsey. The predicate is
	     * invoked with three arguments: (value, index, array).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the slice of `array`.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney',  'active': false },
	     *   { 'user': 'fred',    'active': false },
	     *   { 'user': 'pebbles', 'active': true }
	     * ];
	     *
	     * _.dropWhile(users, function(o) { return !o.active; });
	     * // => objects for ['pebbles']
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.dropWhile(users, { 'user': 'barney', 'active': false });
	     * // => objects for ['fred', 'pebbles']
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.dropWhile(users, ['active', false]);
	     * // => objects for ['pebbles']
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.dropWhile(users, 'active');
	     * // => objects for ['barney', 'fred', 'pebbles']
	     */function dropWhile(array,predicate){return array&&array.length?baseWhile(array,getIteratee(predicate,3),true):[];}/**
	     * Fills elements of `array` with `value` from `start` up to, but not
	     * including, `end`.
	     *
	     * **Note:** This method mutates `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.2.0
	     * @category Array
	     * @param {Array} array The array to fill.
	     * @param {*} value The value to fill `array` with.
	     * @param {number} [start=0] The start position.
	     * @param {number} [end=array.length] The end position.
	     * @returns {Array} Returns `array`.
	     * @example
	     *
	     * var array = [1, 2, 3];
	     *
	     * _.fill(array, 'a');
	     * console.log(array);
	     * // => ['a', 'a', 'a']
	     *
	     * _.fill(Array(3), 2);
	     * // => [2, 2, 2]
	     *
	     * _.fill([4, 6, 8, 10], '*', 1, 3);
	     * // => [4, '*', '*', 10]
	     */function fill(array,value,start,end){var length=array==null?0:array.length;if(!length){return[];}if(start&&typeof start!='number'&&isIterateeCall(array,value,start)){start=0;end=length;}return baseFill(array,value,start,end);}/**
	     * This method is like `_.find` except that it returns the index of the first
	     * element `predicate` returns truthy for instead of the element itself.
	     *
	     * @static
	     * @memberOf _
	     * @since 1.1.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @param {number} [fromIndex=0] The index to search from.
	     * @returns {number} Returns the index of the found element, else `-1`.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney',  'active': false },
	     *   { 'user': 'fred',    'active': false },
	     *   { 'user': 'pebbles', 'active': true }
	     * ];
	     *
	     * _.findIndex(users, function(o) { return o.user == 'barney'; });
	     * // => 0
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.findIndex(users, { 'user': 'fred', 'active': false });
	     * // => 1
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.findIndex(users, ['active', false]);
	     * // => 0
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.findIndex(users, 'active');
	     * // => 2
	     */function findIndex(array,predicate,fromIndex){var length=array==null?0:array.length;if(!length){return-1;}var index=fromIndex==null?0:toInteger(fromIndex);if(index<0){index=nativeMax(length+index,0);}return baseFindIndex(array,getIteratee(predicate,3),index);}/**
	     * This method is like `_.findIndex` except that it iterates over elements
	     * of `collection` from right to left.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.0.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @param {number} [fromIndex=array.length-1] The index to search from.
	     * @returns {number} Returns the index of the found element, else `-1`.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney',  'active': true },
	     *   { 'user': 'fred',    'active': false },
	     *   { 'user': 'pebbles', 'active': false }
	     * ];
	     *
	     * _.findLastIndex(users, function(o) { return o.user == 'pebbles'; });
	     * // => 2
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.findLastIndex(users, { 'user': 'barney', 'active': true });
	     * // => 0
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.findLastIndex(users, ['active', false]);
	     * // => 2
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.findLastIndex(users, 'active');
	     * // => 0
	     */function findLastIndex(array,predicate,fromIndex){var length=array==null?0:array.length;if(!length){return-1;}var index=length-1;if(fromIndex!==undefined){index=toInteger(fromIndex);index=fromIndex<0?nativeMax(length+index,0):nativeMin(index,length-1);}return baseFindIndex(array,getIteratee(predicate,3),index,true);}/**
	     * Flattens `array` a single level deep.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {Array} array The array to flatten.
	     * @returns {Array} Returns the new flattened array.
	     * @example
	     *
	     * _.flatten([1, [2, [3, [4]], 5]]);
	     * // => [1, 2, [3, [4]], 5]
	     */function flatten(array){var length=array==null?0:array.length;return length?baseFlatten(array,1):[];}/**
	     * Recursively flattens `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Array
	     * @param {Array} array The array to flatten.
	     * @returns {Array} Returns the new flattened array.
	     * @example
	     *
	     * _.flattenDeep([1, [2, [3, [4]], 5]]);
	     * // => [1, 2, 3, 4, 5]
	     */function flattenDeep(array){var length=array==null?0:array.length;return length?baseFlatten(array,INFINITY):[];}/**
	     * Recursively flatten `array` up to `depth` times.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.4.0
	     * @category Array
	     * @param {Array} array The array to flatten.
	     * @param {number} [depth=1] The maximum recursion depth.
	     * @returns {Array} Returns the new flattened array.
	     * @example
	     *
	     * var array = [1, [2, [3, [4]], 5]];
	     *
	     * _.flattenDepth(array, 1);
	     * // => [1, 2, [3, [4]], 5]
	     *
	     * _.flattenDepth(array, 2);
	     * // => [1, 2, 3, [4], 5]
	     */function flattenDepth(array,depth){var length=array==null?0:array.length;if(!length){return[];}depth=depth===undefined?1:toInteger(depth);return baseFlatten(array,depth);}/**
	     * The inverse of `_.toPairs`; this method returns an object composed
	     * from key-value `pairs`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} pairs The key-value pairs.
	     * @returns {Object} Returns the new object.
	     * @example
	     *
	     * _.fromPairs([['a', 1], ['b', 2]]);
	     * // => { 'a': 1, 'b': 2 }
	     */function fromPairs(pairs){var index=-1,length=pairs==null?0:pairs.length,result={};while(++index<length){var pair=pairs[index];result[pair[0]]=pair[1];}return result;}/**
	     * Gets the first element of `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @alias first
	     * @category Array
	     * @param {Array} array The array to query.
	     * @returns {*} Returns the first element of `array`.
	     * @example
	     *
	     * _.head([1, 2, 3]);
	     * // => 1
	     *
	     * _.head([]);
	     * // => undefined
	     */function head(array){return array&&array.length?array[0]:undefined;}/**
	     * Gets the index at which the first occurrence of `value` is found in `array`
	     * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	     * for equality comparisons. If `fromIndex` is negative, it's used as the
	     * offset from the end of `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {*} value The value to search for.
	     * @param {number} [fromIndex=0] The index to search from.
	     * @returns {number} Returns the index of the matched value, else `-1`.
	     * @example
	     *
	     * _.indexOf([1, 2, 1, 2], 2);
	     * // => 1
	     *
	     * // Search from the `fromIndex`.
	     * _.indexOf([1, 2, 1, 2], 2, 2);
	     * // => 3
	     */function indexOf(array,value,fromIndex){var length=array==null?0:array.length;if(!length){return-1;}var index=fromIndex==null?0:toInteger(fromIndex);if(index<0){index=nativeMax(length+index,0);}return baseIndexOf(array,value,index);}/**
	     * Gets all but the last element of `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @returns {Array} Returns the slice of `array`.
	     * @example
	     *
	     * _.initial([1, 2, 3]);
	     * // => [1, 2]
	     */function initial(array){var length=array==null?0:array.length;return length?baseSlice(array,0,-1):[];}/**
	     * Creates an array of unique values that are included in all given arrays
	     * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	     * for equality comparisons. The order and references of result values are
	     * determined by the first array.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {...Array} [arrays] The arrays to inspect.
	     * @returns {Array} Returns the new array of intersecting values.
	     * @example
	     *
	     * _.intersection([2, 1], [2, 3]);
	     * // => [2]
	     */var intersection=baseRest(function(arrays){var mapped=arrayMap(arrays,castArrayLikeObject);return mapped.length&&mapped[0]===arrays[0]?baseIntersection(mapped):[];});/**
	     * This method is like `_.intersection` except that it accepts `iteratee`
	     * which is invoked for each element of each `arrays` to generate the criterion
	     * by which they're compared. The order and references of result values are
	     * determined by the first array. The iteratee is invoked with one argument:
	     * (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {...Array} [arrays] The arrays to inspect.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {Array} Returns the new array of intersecting values.
	     * @example
	     *
	     * _.intersectionBy([2.1, 1.2], [2.3, 3.4], Math.floor);
	     * // => [2.1]
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.intersectionBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
	     * // => [{ 'x': 1 }]
	     */var intersectionBy=baseRest(function(arrays){var iteratee=last(arrays),mapped=arrayMap(arrays,castArrayLikeObject);if(iteratee===last(mapped)){iteratee=undefined;}else{mapped.pop();}return mapped.length&&mapped[0]===arrays[0]?baseIntersection(mapped,getIteratee(iteratee,2)):[];});/**
	     * This method is like `_.intersection` except that it accepts `comparator`
	     * which is invoked to compare elements of `arrays`. The order and references
	     * of result values are determined by the first array. The comparator is
	     * invoked with two arguments: (arrVal, othVal).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {...Array} [arrays] The arrays to inspect.
	     * @param {Function} [comparator] The comparator invoked per element.
	     * @returns {Array} Returns the new array of intersecting values.
	     * @example
	     *
	     * var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
	     * var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
	     *
	     * _.intersectionWith(objects, others, _.isEqual);
	     * // => [{ 'x': 1, 'y': 2 }]
	     */var intersectionWith=baseRest(function(arrays){var comparator=last(arrays),mapped=arrayMap(arrays,castArrayLikeObject);comparator=typeof comparator=='function'?comparator:undefined;if(comparator){mapped.pop();}return mapped.length&&mapped[0]===arrays[0]?baseIntersection(mapped,undefined,comparator):[];});/**
	     * Converts all elements in `array` into a string separated by `separator`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to convert.
	     * @param {string} [separator=','] The element separator.
	     * @returns {string} Returns the joined string.
	     * @example
	     *
	     * _.join(['a', 'b', 'c'], '~');
	     * // => 'a~b~c'
	     */function join(array,separator){return array==null?'':nativeJoin.call(array,separator);}/**
	     * Gets the last element of `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @returns {*} Returns the last element of `array`.
	     * @example
	     *
	     * _.last([1, 2, 3]);
	     * // => 3
	     */function last(array){var length=array==null?0:array.length;return length?array[length-1]:undefined;}/**
	     * This method is like `_.indexOf` except that it iterates over elements of
	     * `array` from right to left.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {*} value The value to search for.
	     * @param {number} [fromIndex=array.length-1] The index to search from.
	     * @returns {number} Returns the index of the matched value, else `-1`.
	     * @example
	     *
	     * _.lastIndexOf([1, 2, 1, 2], 2);
	     * // => 3
	     *
	     * // Search from the `fromIndex`.
	     * _.lastIndexOf([1, 2, 1, 2], 2, 2);
	     * // => 1
	     */function lastIndexOf(array,value,fromIndex){var length=array==null?0:array.length;if(!length){return-1;}var index=length;if(fromIndex!==undefined){index=toInteger(fromIndex);index=index<0?nativeMax(length+index,0):nativeMin(index,length-1);}return value===value?strictLastIndexOf(array,value,index):baseFindIndex(array,baseIsNaN,index,true);}/**
	     * Gets the element at index `n` of `array`. If `n` is negative, the nth
	     * element from the end is returned.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.11.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @param {number} [n=0] The index of the element to return.
	     * @returns {*} Returns the nth element of `array`.
	     * @example
	     *
	     * var array = ['a', 'b', 'c', 'd'];
	     *
	     * _.nth(array, 1);
	     * // => 'b'
	     *
	     * _.nth(array, -2);
	     * // => 'c';
	     */function nth(array,n){return array&&array.length?baseNth(array,toInteger(n)):undefined;}/**
	     * Removes all given values from `array` using
	     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	     * for equality comparisons.
	     *
	     * **Note:** Unlike `_.without`, this method mutates `array`. Use `_.remove`
	     * to remove elements from an array by predicate.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.0.0
	     * @category Array
	     * @param {Array} array The array to modify.
	     * @param {...*} [values] The values to remove.
	     * @returns {Array} Returns `array`.
	     * @example
	     *
	     * var array = ['a', 'b', 'c', 'a', 'b', 'c'];
	     *
	     * _.pull(array, 'a', 'c');
	     * console.log(array);
	     * // => ['b', 'b']
	     */var pull=baseRest(pullAll);/**
	     * This method is like `_.pull` except that it accepts an array of values to remove.
	     *
	     * **Note:** Unlike `_.difference`, this method mutates `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to modify.
	     * @param {Array} values The values to remove.
	     * @returns {Array} Returns `array`.
	     * @example
	     *
	     * var array = ['a', 'b', 'c', 'a', 'b', 'c'];
	     *
	     * _.pullAll(array, ['a', 'c']);
	     * console.log(array);
	     * // => ['b', 'b']
	     */function pullAll(array,values){return array&&array.length&&values&&values.length?basePullAll(array,values):array;}/**
	     * This method is like `_.pullAll` except that it accepts `iteratee` which is
	     * invoked for each element of `array` and `values` to generate the criterion
	     * by which they're compared. The iteratee is invoked with one argument: (value).
	     *
	     * **Note:** Unlike `_.differenceBy`, this method mutates `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to modify.
	     * @param {Array} values The values to remove.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {Array} Returns `array`.
	     * @example
	     *
	     * var array = [{ 'x': 1 }, { 'x': 2 }, { 'x': 3 }, { 'x': 1 }];
	     *
	     * _.pullAllBy(array, [{ 'x': 1 }, { 'x': 3 }], 'x');
	     * console.log(array);
	     * // => [{ 'x': 2 }]
	     */function pullAllBy(array,values,iteratee){return array&&array.length&&values&&values.length?basePullAll(array,values,getIteratee(iteratee,2)):array;}/**
	     * This method is like `_.pullAll` except that it accepts `comparator` which
	     * is invoked to compare elements of `array` to `values`. The comparator is
	     * invoked with two arguments: (arrVal, othVal).
	     *
	     * **Note:** Unlike `_.differenceWith`, this method mutates `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.6.0
	     * @category Array
	     * @param {Array} array The array to modify.
	     * @param {Array} values The values to remove.
	     * @param {Function} [comparator] The comparator invoked per element.
	     * @returns {Array} Returns `array`.
	     * @example
	     *
	     * var array = [{ 'x': 1, 'y': 2 }, { 'x': 3, 'y': 4 }, { 'x': 5, 'y': 6 }];
	     *
	     * _.pullAllWith(array, [{ 'x': 3, 'y': 4 }], _.isEqual);
	     * console.log(array);
	     * // => [{ 'x': 1, 'y': 2 }, { 'x': 5, 'y': 6 }]
	     */function pullAllWith(array,values,comparator){return array&&array.length&&values&&values.length?basePullAll(array,values,undefined,comparator):array;}/**
	     * Removes elements from `array` corresponding to `indexes` and returns an
	     * array of removed elements.
	     *
	     * **Note:** Unlike `_.at`, this method mutates `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Array
	     * @param {Array} array The array to modify.
	     * @param {...(number|number[])} [indexes] The indexes of elements to remove.
	     * @returns {Array} Returns the new array of removed elements.
	     * @example
	     *
	     * var array = ['a', 'b', 'c', 'd'];
	     * var pulled = _.pullAt(array, [1, 3]);
	     *
	     * console.log(array);
	     * // => ['a', 'c']
	     *
	     * console.log(pulled);
	     * // => ['b', 'd']
	     */var pullAt=flatRest(function(array,indexes){var length=array==null?0:array.length,result=baseAt(array,indexes);basePullAt(array,arrayMap(indexes,function(index){return isIndex(index,length)?+index:index;}).sort(compareAscending));return result;});/**
	     * Removes all elements from `array` that `predicate` returns truthy for
	     * and returns an array of the removed elements. The predicate is invoked
	     * with three arguments: (value, index, array).
	     *
	     * **Note:** Unlike `_.filter`, this method mutates `array`. Use `_.pull`
	     * to pull elements from an array by value.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.0.0
	     * @category Array
	     * @param {Array} array The array to modify.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the new array of removed elements.
	     * @example
	     *
	     * var array = [1, 2, 3, 4];
	     * var evens = _.remove(array, function(n) {
	     *   return n % 2 == 0;
	     * });
	     *
	     * console.log(array);
	     * // => [1, 3]
	     *
	     * console.log(evens);
	     * // => [2, 4]
	     */function remove(array,predicate){var result=[];if(!(array&&array.length)){return result;}var index=-1,indexes=[],length=array.length;predicate=getIteratee(predicate,3);while(++index<length){var value=array[index];if(predicate(value,index,array)){result.push(value);indexes.push(index);}}basePullAt(array,indexes);return result;}/**
	     * Reverses `array` so that the first element becomes the last, the second
	     * element becomes the second to last, and so on.
	     *
	     * **Note:** This method mutates `array` and is based on
	     * [`Array#reverse`](https://mdn.io/Array/reverse).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to modify.
	     * @returns {Array} Returns `array`.
	     * @example
	     *
	     * var array = [1, 2, 3];
	     *
	     * _.reverse(array);
	     * // => [3, 2, 1]
	     *
	     * console.log(array);
	     * // => [3, 2, 1]
	     */function reverse(array){return array==null?array:nativeReverse.call(array);}/**
	     * Creates a slice of `array` from `start` up to, but not including, `end`.
	     *
	     * **Note:** This method is used instead of
	     * [`Array#slice`](https://mdn.io/Array/slice) to ensure dense arrays are
	     * returned.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Array
	     * @param {Array} array The array to slice.
	     * @param {number} [start=0] The start position.
	     * @param {number} [end=array.length] The end position.
	     * @returns {Array} Returns the slice of `array`.
	     */function slice(array,start,end){var length=array==null?0:array.length;if(!length){return[];}if(end&&typeof end!='number'&&isIterateeCall(array,start,end)){start=0;end=length;}else{start=start==null?0:toInteger(start);end=end===undefined?length:toInteger(end);}return baseSlice(array,start,end);}/**
	     * Uses a binary search to determine the lowest index at which `value`
	     * should be inserted into `array` in order to maintain its sort order.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {Array} array The sorted array to inspect.
	     * @param {*} value The value to evaluate.
	     * @returns {number} Returns the index at which `value` should be inserted
	     *  into `array`.
	     * @example
	     *
	     * _.sortedIndex([30, 50], 40);
	     * // => 1
	     */function sortedIndex(array,value){return baseSortedIndex(array,value);}/**
	     * This method is like `_.sortedIndex` except that it accepts `iteratee`
	     * which is invoked for `value` and each element of `array` to compute their
	     * sort ranking. The iteratee is invoked with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The sorted array to inspect.
	     * @param {*} value The value to evaluate.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {number} Returns the index at which `value` should be inserted
	     *  into `array`.
	     * @example
	     *
	     * var objects = [{ 'x': 4 }, { 'x': 5 }];
	     *
	     * _.sortedIndexBy(objects, { 'x': 4 }, function(o) { return o.x; });
	     * // => 0
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.sortedIndexBy(objects, { 'x': 4 }, 'x');
	     * // => 0
	     */function sortedIndexBy(array,value,iteratee){return baseSortedIndexBy(array,value,getIteratee(iteratee,2));}/**
	     * This method is like `_.indexOf` except that it performs a binary
	     * search on a sorted `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {*} value The value to search for.
	     * @returns {number} Returns the index of the matched value, else `-1`.
	     * @example
	     *
	     * _.sortedIndexOf([4, 5, 5, 5, 6], 5);
	     * // => 1
	     */function sortedIndexOf(array,value){var length=array==null?0:array.length;if(length){var index=baseSortedIndex(array,value);if(index<length&&eq(array[index],value)){return index;}}return-1;}/**
	     * This method is like `_.sortedIndex` except that it returns the highest
	     * index at which `value` should be inserted into `array` in order to
	     * maintain its sort order.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Array
	     * @param {Array} array The sorted array to inspect.
	     * @param {*} value The value to evaluate.
	     * @returns {number} Returns the index at which `value` should be inserted
	     *  into `array`.
	     * @example
	     *
	     * _.sortedLastIndex([4, 5, 5, 5, 6], 5);
	     * // => 4
	     */function sortedLastIndex(array,value){return baseSortedIndex(array,value,true);}/**
	     * This method is like `_.sortedLastIndex` except that it accepts `iteratee`
	     * which is invoked for `value` and each element of `array` to compute their
	     * sort ranking. The iteratee is invoked with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The sorted array to inspect.
	     * @param {*} value The value to evaluate.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {number} Returns the index at which `value` should be inserted
	     *  into `array`.
	     * @example
	     *
	     * var objects = [{ 'x': 4 }, { 'x': 5 }];
	     *
	     * _.sortedLastIndexBy(objects, { 'x': 4 }, function(o) { return o.x; });
	     * // => 1
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.sortedLastIndexBy(objects, { 'x': 4 }, 'x');
	     * // => 1
	     */function sortedLastIndexBy(array,value,iteratee){return baseSortedIndexBy(array,value,getIteratee(iteratee,2),true);}/**
	     * This method is like `_.lastIndexOf` except that it performs a binary
	     * search on a sorted `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {*} value The value to search for.
	     * @returns {number} Returns the index of the matched value, else `-1`.
	     * @example
	     *
	     * _.sortedLastIndexOf([4, 5, 5, 5, 6], 5);
	     * // => 3
	     */function sortedLastIndexOf(array,value){var length=array==null?0:array.length;if(length){var index=baseSortedIndex(array,value,true)-1;if(eq(array[index],value)){return index;}}return-1;}/**
	     * This method is like `_.uniq` except that it's designed and optimized
	     * for sorted arrays.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @returns {Array} Returns the new duplicate free array.
	     * @example
	     *
	     * _.sortedUniq([1, 1, 2]);
	     * // => [1, 2]
	     */function sortedUniq(array){return array&&array.length?baseSortedUniq(array):[];}/**
	     * This method is like `_.uniqBy` except that it's designed and optimized
	     * for sorted arrays.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {Function} [iteratee] The iteratee invoked per element.
	     * @returns {Array} Returns the new duplicate free array.
	     * @example
	     *
	     * _.sortedUniqBy([1.1, 1.2, 2.3, 2.4], Math.floor);
	     * // => [1.1, 2.3]
	     */function sortedUniqBy(array,iteratee){return array&&array.length?baseSortedUniq(array,getIteratee(iteratee,2)):[];}/**
	     * Gets all but the first element of `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @returns {Array} Returns the slice of `array`.
	     * @example
	     *
	     * _.tail([1, 2, 3]);
	     * // => [2, 3]
	     */function tail(array){var length=array==null?0:array.length;return length?baseSlice(array,1,length):[];}/**
	     * Creates a slice of `array` with `n` elements taken from the beginning.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @param {number} [n=1] The number of elements to take.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {Array} Returns the slice of `array`.
	     * @example
	     *
	     * _.take([1, 2, 3]);
	     * // => [1]
	     *
	     * _.take([1, 2, 3], 2);
	     * // => [1, 2]
	     *
	     * _.take([1, 2, 3], 5);
	     * // => [1, 2, 3]
	     *
	     * _.take([1, 2, 3], 0);
	     * // => []
	     */function take(array,n,guard){if(!(array&&array.length)){return[];}n=guard||n===undefined?1:toInteger(n);return baseSlice(array,0,n<0?0:n);}/**
	     * Creates a slice of `array` with `n` elements taken from the end.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @param {number} [n=1] The number of elements to take.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {Array} Returns the slice of `array`.
	     * @example
	     *
	     * _.takeRight([1, 2, 3]);
	     * // => [3]
	     *
	     * _.takeRight([1, 2, 3], 2);
	     * // => [2, 3]
	     *
	     * _.takeRight([1, 2, 3], 5);
	     * // => [1, 2, 3]
	     *
	     * _.takeRight([1, 2, 3], 0);
	     * // => []
	     */function takeRight(array,n,guard){var length=array==null?0:array.length;if(!length){return[];}n=guard||n===undefined?1:toInteger(n);n=length-n;return baseSlice(array,n<0?0:n,length);}/**
	     * Creates a slice of `array` with elements taken from the end. Elements are
	     * taken until `predicate` returns falsey. The predicate is invoked with
	     * three arguments: (value, index, array).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the slice of `array`.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney',  'active': true },
	     *   { 'user': 'fred',    'active': false },
	     *   { 'user': 'pebbles', 'active': false }
	     * ];
	     *
	     * _.takeRightWhile(users, function(o) { return !o.active; });
	     * // => objects for ['fred', 'pebbles']
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.takeRightWhile(users, { 'user': 'pebbles', 'active': false });
	     * // => objects for ['pebbles']
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.takeRightWhile(users, ['active', false]);
	     * // => objects for ['fred', 'pebbles']
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.takeRightWhile(users, 'active');
	     * // => []
	     */function takeRightWhile(array,predicate){return array&&array.length?baseWhile(array,getIteratee(predicate,3),false,true):[];}/**
	     * Creates a slice of `array` with elements taken from the beginning. Elements
	     * are taken until `predicate` returns falsey. The predicate is invoked with
	     * three arguments: (value, index, array).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Array
	     * @param {Array} array The array to query.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the slice of `array`.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney',  'active': false },
	     *   { 'user': 'fred',    'active': false},
	     *   { 'user': 'pebbles', 'active': true }
	     * ];
	     *
	     * _.takeWhile(users, function(o) { return !o.active; });
	     * // => objects for ['barney', 'fred']
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.takeWhile(users, { 'user': 'barney', 'active': false });
	     * // => objects for ['barney']
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.takeWhile(users, ['active', false]);
	     * // => objects for ['barney', 'fred']
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.takeWhile(users, 'active');
	     * // => []
	     */function takeWhile(array,predicate){return array&&array.length?baseWhile(array,getIteratee(predicate,3)):[];}/**
	     * Creates an array of unique values, in order, from all given arrays using
	     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	     * for equality comparisons.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {...Array} [arrays] The arrays to inspect.
	     * @returns {Array} Returns the new array of combined values.
	     * @example
	     *
	     * _.union([2], [1, 2]);
	     * // => [2, 1]
	     */var union=baseRest(function(arrays){return baseUniq(baseFlatten(arrays,1,isArrayLikeObject,true));});/**
	     * This method is like `_.union` except that it accepts `iteratee` which is
	     * invoked for each element of each `arrays` to generate the criterion by
	     * which uniqueness is computed. Result values are chosen from the first
	     * array in which the value occurs. The iteratee is invoked with one argument:
	     * (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {...Array} [arrays] The arrays to inspect.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {Array} Returns the new array of combined values.
	     * @example
	     *
	     * _.unionBy([2.1], [1.2, 2.3], Math.floor);
	     * // => [2.1, 1.2]
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.unionBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
	     * // => [{ 'x': 1 }, { 'x': 2 }]
	     */var unionBy=baseRest(function(arrays){var iteratee=last(arrays);if(isArrayLikeObject(iteratee)){iteratee=undefined;}return baseUniq(baseFlatten(arrays,1,isArrayLikeObject,true),getIteratee(iteratee,2));});/**
	     * This method is like `_.union` except that it accepts `comparator` which
	     * is invoked to compare elements of `arrays`. Result values are chosen from
	     * the first array in which the value occurs. The comparator is invoked
	     * with two arguments: (arrVal, othVal).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {...Array} [arrays] The arrays to inspect.
	     * @param {Function} [comparator] The comparator invoked per element.
	     * @returns {Array} Returns the new array of combined values.
	     * @example
	     *
	     * var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
	     * var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
	     *
	     * _.unionWith(objects, others, _.isEqual);
	     * // => [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }, { 'x': 1, 'y': 1 }]
	     */var unionWith=baseRest(function(arrays){var comparator=last(arrays);comparator=typeof comparator=='function'?comparator:undefined;return baseUniq(baseFlatten(arrays,1,isArrayLikeObject,true),undefined,comparator);});/**
	     * Creates a duplicate-free version of an array, using
	     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	     * for equality comparisons, in which only the first occurrence of each element
	     * is kept. The order of result values is determined by the order they occur
	     * in the array.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @returns {Array} Returns the new duplicate free array.
	     * @example
	     *
	     * _.uniq([2, 1, 2]);
	     * // => [2, 1]
	     */function uniq(array){return array&&array.length?baseUniq(array):[];}/**
	     * This method is like `_.uniq` except that it accepts `iteratee` which is
	     * invoked for each element in `array` to generate the criterion by which
	     * uniqueness is computed. The order of result values is determined by the
	     * order they occur in the array. The iteratee is invoked with one argument:
	     * (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {Array} Returns the new duplicate free array.
	     * @example
	     *
	     * _.uniqBy([2.1, 1.2, 2.3], Math.floor);
	     * // => [2.1, 1.2]
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.uniqBy([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
	     * // => [{ 'x': 1 }, { 'x': 2 }]
	     */function uniqBy(array,iteratee){return array&&array.length?baseUniq(array,getIteratee(iteratee,2)):[];}/**
	     * This method is like `_.uniq` except that it accepts `comparator` which
	     * is invoked to compare elements of `array`. The order of result values is
	     * determined by the order they occur in the array.The comparator is invoked
	     * with two arguments: (arrVal, othVal).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {Function} [comparator] The comparator invoked per element.
	     * @returns {Array} Returns the new duplicate free array.
	     * @example
	     *
	     * var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }, { 'x': 1, 'y': 2 }];
	     *
	     * _.uniqWith(objects, _.isEqual);
	     * // => [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }]
	     */function uniqWith(array,comparator){comparator=typeof comparator=='function'?comparator:undefined;return array&&array.length?baseUniq(array,undefined,comparator):[];}/**
	     * This method is like `_.zip` except that it accepts an array of grouped
	     * elements and creates an array regrouping the elements to their pre-zip
	     * configuration.
	     *
	     * @static
	     * @memberOf _
	     * @since 1.2.0
	     * @category Array
	     * @param {Array} array The array of grouped elements to process.
	     * @returns {Array} Returns the new array of regrouped elements.
	     * @example
	     *
	     * var zipped = _.zip(['a', 'b'], [1, 2], [true, false]);
	     * // => [['a', 1, true], ['b', 2, false]]
	     *
	     * _.unzip(zipped);
	     * // => [['a', 'b'], [1, 2], [true, false]]
	     */function unzip(array){if(!(array&&array.length)){return[];}var length=0;array=arrayFilter(array,function(group){if(isArrayLikeObject(group)){length=nativeMax(group.length,length);return true;}});return baseTimes(length,function(index){return arrayMap(array,baseProperty(index));});}/**
	     * This method is like `_.unzip` except that it accepts `iteratee` to specify
	     * how regrouped values should be combined. The iteratee is invoked with the
	     * elements of each group: (...group).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.8.0
	     * @category Array
	     * @param {Array} array The array of grouped elements to process.
	     * @param {Function} [iteratee=_.identity] The function to combine
	     *  regrouped values.
	     * @returns {Array} Returns the new array of regrouped elements.
	     * @example
	     *
	     * var zipped = _.zip([1, 2], [10, 20], [100, 200]);
	     * // => [[1, 10, 100], [2, 20, 200]]
	     *
	     * _.unzipWith(zipped, _.add);
	     * // => [3, 30, 300]
	     */function unzipWith(array,iteratee){if(!(array&&array.length)){return[];}var result=unzip(array);if(iteratee==null){return result;}return arrayMap(result,function(group){return apply(iteratee,undefined,group);});}/**
	     * Creates an array excluding all given values using
	     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	     * for equality comparisons.
	     *
	     * **Note:** Unlike `_.pull`, this method returns a new array.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {Array} array The array to inspect.
	     * @param {...*} [values] The values to exclude.
	     * @returns {Array} Returns the new array of filtered values.
	     * @see _.difference, _.xor
	     * @example
	     *
	     * _.without([2, 1, 2, 3], 1, 2);
	     * // => [3]
	     */var without=baseRest(function(array,values){return isArrayLikeObject(array)?baseDifference(array,values):[];});/**
	     * Creates an array of unique values that is the
	     * [symmetric difference](https://en.wikipedia.org/wiki/Symmetric_difference)
	     * of the given arrays. The order of result values is determined by the order
	     * they occur in the arrays.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.4.0
	     * @category Array
	     * @param {...Array} [arrays] The arrays to inspect.
	     * @returns {Array} Returns the new array of filtered values.
	     * @see _.difference, _.without
	     * @example
	     *
	     * _.xor([2, 1], [2, 3]);
	     * // => [1, 3]
	     */var xor=baseRest(function(arrays){return baseXor(arrayFilter(arrays,isArrayLikeObject));});/**
	     * This method is like `_.xor` except that it accepts `iteratee` which is
	     * invoked for each element of each `arrays` to generate the criterion by
	     * which by which they're compared. The order of result values is determined
	     * by the order they occur in the arrays. The iteratee is invoked with one
	     * argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {...Array} [arrays] The arrays to inspect.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {Array} Returns the new array of filtered values.
	     * @example
	     *
	     * _.xorBy([2.1, 1.2], [2.3, 3.4], Math.floor);
	     * // => [1.2, 3.4]
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.xorBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
	     * // => [{ 'x': 2 }]
	     */var xorBy=baseRest(function(arrays){var iteratee=last(arrays);if(isArrayLikeObject(iteratee)){iteratee=undefined;}return baseXor(arrayFilter(arrays,isArrayLikeObject),getIteratee(iteratee,2));});/**
	     * This method is like `_.xor` except that it accepts `comparator` which is
	     * invoked to compare elements of `arrays`. The order of result values is
	     * determined by the order they occur in the arrays. The comparator is invoked
	     * with two arguments: (arrVal, othVal).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Array
	     * @param {...Array} [arrays] The arrays to inspect.
	     * @param {Function} [comparator] The comparator invoked per element.
	     * @returns {Array} Returns the new array of filtered values.
	     * @example
	     *
	     * var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }];
	     * var others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }];
	     *
	     * _.xorWith(objects, others, _.isEqual);
	     * // => [{ 'x': 2, 'y': 1 }, { 'x': 1, 'y': 1 }]
	     */var xorWith=baseRest(function(arrays){var comparator=last(arrays);comparator=typeof comparator=='function'?comparator:undefined;return baseXor(arrayFilter(arrays,isArrayLikeObject),undefined,comparator);});/**
	     * Creates an array of grouped elements, the first of which contains the
	     * first elements of the given arrays, the second of which contains the
	     * second elements of the given arrays, and so on.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Array
	     * @param {...Array} [arrays] The arrays to process.
	     * @returns {Array} Returns the new array of grouped elements.
	     * @example
	     *
	     * _.zip(['a', 'b'], [1, 2], [true, false]);
	     * // => [['a', 1, true], ['b', 2, false]]
	     */var zip=baseRest(unzip);/**
	     * This method is like `_.fromPairs` except that it accepts two arrays,
	     * one of property identifiers and one of corresponding values.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.4.0
	     * @category Array
	     * @param {Array} [props=[]] The property identifiers.
	     * @param {Array} [values=[]] The property values.
	     * @returns {Object} Returns the new object.
	     * @example
	     *
	     * _.zipObject(['a', 'b'], [1, 2]);
	     * // => { 'a': 1, 'b': 2 }
	     */function zipObject(props,values){return baseZipObject(props||[],values||[],assignValue);}/**
	     * This method is like `_.zipObject` except that it supports property paths.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.1.0
	     * @category Array
	     * @param {Array} [props=[]] The property identifiers.
	     * @param {Array} [values=[]] The property values.
	     * @returns {Object} Returns the new object.
	     * @example
	     *
	     * _.zipObjectDeep(['a.b[0].c', 'a.b[1].d'], [1, 2]);
	     * // => { 'a': { 'b': [{ 'c': 1 }, { 'd': 2 }] } }
	     */function zipObjectDeep(props,values){return baseZipObject(props||[],values||[],baseSet);}/**
	     * This method is like `_.zip` except that it accepts `iteratee` to specify
	     * how grouped values should be combined. The iteratee is invoked with the
	     * elements of each group: (...group).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.8.0
	     * @category Array
	     * @param {...Array} [arrays] The arrays to process.
	     * @param {Function} [iteratee=_.identity] The function to combine
	     *  grouped values.
	     * @returns {Array} Returns the new array of grouped elements.
	     * @example
	     *
	     * _.zipWith([1, 2], [10, 20], [100, 200], function(a, b, c) {
	     *   return a + b + c;
	     * });
	     * // => [111, 222]
	     */var zipWith=baseRest(function(arrays){var length=arrays.length,iteratee=length>1?arrays[length-1]:undefined;iteratee=typeof iteratee=='function'?(arrays.pop(),iteratee):undefined;return unzipWith(arrays,iteratee);});/*------------------------------------------------------------------------*//**
	     * Creates a `lodash` wrapper instance that wraps `value` with explicit method
	     * chain sequences enabled. The result of such sequences must be unwrapped
	     * with `_#value`.
	     *
	     * @static
	     * @memberOf _
	     * @since 1.3.0
	     * @category Seq
	     * @param {*} value The value to wrap.
	     * @returns {Object} Returns the new `lodash` wrapper instance.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney',  'age': 36 },
	     *   { 'user': 'fred',    'age': 40 },
	     *   { 'user': 'pebbles', 'age': 1 }
	     * ];
	     *
	     * var youngest = _
	     *   .chain(users)
	     *   .sortBy('age')
	     *   .map(function(o) {
	     *     return o.user + ' is ' + o.age;
	     *   })
	     *   .head()
	     *   .value();
	     * // => 'pebbles is 1'
	     */function chain(value){var result=lodash(value);result.__chain__=true;return result;}/**
	     * This method invokes `interceptor` and returns `value`. The interceptor
	     * is invoked with one argument; (value). The purpose of this method is to
	     * "tap into" a method chain sequence in order to modify intermediate results.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Seq
	     * @param {*} value The value to provide to `interceptor`.
	     * @param {Function} interceptor The function to invoke.
	     * @returns {*} Returns `value`.
	     * @example
	     *
	     * _([1, 2, 3])
	     *  .tap(function(array) {
	     *    // Mutate input array.
	     *    array.pop();
	     *  })
	     *  .reverse()
	     *  .value();
	     * // => [2, 1]
	     */function tap(value,interceptor){interceptor(value);return value;}/**
	     * This method is like `_.tap` except that it returns the result of `interceptor`.
	     * The purpose of this method is to "pass thru" values replacing intermediate
	     * results in a method chain sequence.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Seq
	     * @param {*} value The value to provide to `interceptor`.
	     * @param {Function} interceptor The function to invoke.
	     * @returns {*} Returns the result of `interceptor`.
	     * @example
	     *
	     * _('  abc  ')
	     *  .chain()
	     *  .trim()
	     *  .thru(function(value) {
	     *    return [value];
	     *  })
	     *  .value();
	     * // => ['abc']
	     */function thru(value,interceptor){return interceptor(value);}/**
	     * This method is the wrapper version of `_.at`.
	     *
	     * @name at
	     * @memberOf _
	     * @since 1.0.0
	     * @category Seq
	     * @param {...(string|string[])} [paths] The property paths to pick.
	     * @returns {Object} Returns the new `lodash` wrapper instance.
	     * @example
	     *
	     * var object = { 'a': [{ 'b': { 'c': 3 } }, 4] };
	     *
	     * _(object).at(['a[0].b.c', 'a[1]']).value();
	     * // => [3, 4]
	     */var wrapperAt=flatRest(function(paths){var length=paths.length,start=length?paths[0]:0,value=this.__wrapped__,interceptor=function interceptor(object){return baseAt(object,paths);};if(length>1||this.__actions__.length||!(value instanceof LazyWrapper)||!isIndex(start)){return this.thru(interceptor);}value=value.slice(start,+start+(length?1:0));value.__actions__.push({'func':thru,'args':[interceptor],'thisArg':undefined});return new LodashWrapper(value,this.__chain__).thru(function(array){if(length&&!array.length){array.push(undefined);}return array;});});/**
	     * Creates a `lodash` wrapper instance with explicit method chain sequences enabled.
	     *
	     * @name chain
	     * @memberOf _
	     * @since 0.1.0
	     * @category Seq
	     * @returns {Object} Returns the new `lodash` wrapper instance.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney', 'age': 36 },
	     *   { 'user': 'fred',   'age': 40 }
	     * ];
	     *
	     * // A sequence without explicit chaining.
	     * _(users).head();
	     * // => { 'user': 'barney', 'age': 36 }
	     *
	     * // A sequence with explicit chaining.
	     * _(users)
	     *   .chain()
	     *   .head()
	     *   .pick('user')
	     *   .value();
	     * // => { 'user': 'barney' }
	     */function wrapperChain(){return chain(this);}/**
	     * Executes the chain sequence and returns the wrapped result.
	     *
	     * @name commit
	     * @memberOf _
	     * @since 3.2.0
	     * @category Seq
	     * @returns {Object} Returns the new `lodash` wrapper instance.
	     * @example
	     *
	     * var array = [1, 2];
	     * var wrapped = _(array).push(3);
	     *
	     * console.log(array);
	     * // => [1, 2]
	     *
	     * wrapped = wrapped.commit();
	     * console.log(array);
	     * // => [1, 2, 3]
	     *
	     * wrapped.last();
	     * // => 3
	     *
	     * console.log(array);
	     * // => [1, 2, 3]
	     */function wrapperCommit(){return new LodashWrapper(this.value(),this.__chain__);}/**
	     * Gets the next value on a wrapped object following the
	     * [iterator protocol](https://mdn.io/iteration_protocols#iterator).
	     *
	     * @name next
	     * @memberOf _
	     * @since 4.0.0
	     * @category Seq
	     * @returns {Object} Returns the next iterator value.
	     * @example
	     *
	     * var wrapped = _([1, 2]);
	     *
	     * wrapped.next();
	     * // => { 'done': false, 'value': 1 }
	     *
	     * wrapped.next();
	     * // => { 'done': false, 'value': 2 }
	     *
	     * wrapped.next();
	     * // => { 'done': true, 'value': undefined }
	     */function wrapperNext(){if(this.__values__===undefined){this.__values__=toArray(this.value());}var done=this.__index__>=this.__values__.length,value=done?undefined:this.__values__[this.__index__++];return{'done':done,'value':value};}/**
	     * Enables the wrapper to be iterable.
	     *
	     * @name Symbol.iterator
	     * @memberOf _
	     * @since 4.0.0
	     * @category Seq
	     * @returns {Object} Returns the wrapper object.
	     * @example
	     *
	     * var wrapped = _([1, 2]);
	     *
	     * wrapped[Symbol.iterator]() === wrapped;
	     * // => true
	     *
	     * Array.from(wrapped);
	     * // => [1, 2]
	     */function wrapperToIterator(){return this;}/**
	     * Creates a clone of the chain sequence planting `value` as the wrapped value.
	     *
	     * @name plant
	     * @memberOf _
	     * @since 3.2.0
	     * @category Seq
	     * @param {*} value The value to plant.
	     * @returns {Object} Returns the new `lodash` wrapper instance.
	     * @example
	     *
	     * function square(n) {
	     *   return n * n;
	     * }
	     *
	     * var wrapped = _([1, 2]).map(square);
	     * var other = wrapped.plant([3, 4]);
	     *
	     * other.value();
	     * // => [9, 16]
	     *
	     * wrapped.value();
	     * // => [1, 4]
	     */function wrapperPlant(value){var result,parent=this;while(parent instanceof baseLodash){var clone=wrapperClone(parent);clone.__index__=0;clone.__values__=undefined;if(result){previous.__wrapped__=clone;}else{result=clone;}var previous=clone;parent=parent.__wrapped__;}previous.__wrapped__=value;return result;}/**
	     * This method is the wrapper version of `_.reverse`.
	     *
	     * **Note:** This method mutates the wrapped array.
	     *
	     * @name reverse
	     * @memberOf _
	     * @since 0.1.0
	     * @category Seq
	     * @returns {Object} Returns the new `lodash` wrapper instance.
	     * @example
	     *
	     * var array = [1, 2, 3];
	     *
	     * _(array).reverse().value()
	     * // => [3, 2, 1]
	     *
	     * console.log(array);
	     * // => [3, 2, 1]
	     */function wrapperReverse(){var value=this.__wrapped__;if(value instanceof LazyWrapper){var wrapped=value;if(this.__actions__.length){wrapped=new LazyWrapper(this);}wrapped=wrapped.reverse();wrapped.__actions__.push({'func':thru,'args':[reverse],'thisArg':undefined});return new LodashWrapper(wrapped,this.__chain__);}return this.thru(reverse);}/**
	     * Executes the chain sequence to resolve the unwrapped value.
	     *
	     * @name value
	     * @memberOf _
	     * @since 0.1.0
	     * @alias toJSON, valueOf
	     * @category Seq
	     * @returns {*} Returns the resolved unwrapped value.
	     * @example
	     *
	     * _([1, 2, 3]).value();
	     * // => [1, 2, 3]
	     */function wrapperValue(){return baseWrapperValue(this.__wrapped__,this.__actions__);}/*------------------------------------------------------------------------*//**
	     * Creates an object composed of keys generated from the results of running
	     * each element of `collection` thru `iteratee`. The corresponding value of
	     * each key is the number of times the key was returned by `iteratee`. The
	     * iteratee is invoked with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 0.5.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [iteratee=_.identity] The iteratee to transform keys.
	     * @returns {Object} Returns the composed aggregate object.
	     * @example
	     *
	     * _.countBy([6.1, 4.2, 6.3], Math.floor);
	     * // => { '4': 1, '6': 2 }
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.countBy(['one', 'two', 'three'], 'length');
	     * // => { '3': 2, '5': 1 }
	     */var countBy=createAggregator(function(result,value,key){if(hasOwnProperty.call(result,key)){++result[key];}else{baseAssignValue(result,key,1);}});/**
	     * Checks if `predicate` returns truthy for **all** elements of `collection`.
	     * Iteration is stopped once `predicate` returns falsey. The predicate is
	     * invoked with three arguments: (value, index|key, collection).
	     *
	     * **Note:** This method returns `true` for
	     * [empty collections](https://en.wikipedia.org/wiki/Empty_set) because
	     * [everything is true](https://en.wikipedia.org/wiki/Vacuous_truth) of
	     * elements of empty collections.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {boolean} Returns `true` if all elements pass the predicate check,
	     *  else `false`.
	     * @example
	     *
	     * _.every([true, 1, null, 'yes'], Boolean);
	     * // => false
	     *
	     * var users = [
	     *   { 'user': 'barney', 'age': 36, 'active': false },
	     *   { 'user': 'fred',   'age': 40, 'active': false }
	     * ];
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.every(users, { 'user': 'barney', 'active': false });
	     * // => false
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.every(users, ['active', false]);
	     * // => true
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.every(users, 'active');
	     * // => false
	     */function every(collection,predicate,guard){var func=isArray(collection)?arrayEvery:baseEvery;if(guard&&isIterateeCall(collection,predicate,guard)){predicate=undefined;}return func(collection,getIteratee(predicate,3));}/**
	     * Iterates over elements of `collection`, returning an array of all elements
	     * `predicate` returns truthy for. The predicate is invoked with three
	     * arguments: (value, index|key, collection).
	     *
	     * **Note:** Unlike `_.remove`, this method returns a new array.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the new filtered array.
	     * @see _.reject
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney', 'age': 36, 'active': true },
	     *   { 'user': 'fred',   'age': 40, 'active': false }
	     * ];
	     *
	     * _.filter(users, function(o) { return !o.active; });
	     * // => objects for ['fred']
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.filter(users, { 'age': 36, 'active': true });
	     * // => objects for ['barney']
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.filter(users, ['active', false]);
	     * // => objects for ['fred']
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.filter(users, 'active');
	     * // => objects for ['barney']
	     */function filter(collection,predicate){var func=isArray(collection)?arrayFilter:baseFilter;return func(collection,getIteratee(predicate,3));}/**
	     * Iterates over elements of `collection`, returning the first element
	     * `predicate` returns truthy for. The predicate is invoked with three
	     * arguments: (value, index|key, collection).
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to inspect.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @param {number} [fromIndex=0] The index to search from.
	     * @returns {*} Returns the matched element, else `undefined`.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney',  'age': 36, 'active': true },
	     *   { 'user': 'fred',    'age': 40, 'active': false },
	     *   { 'user': 'pebbles', 'age': 1,  'active': true }
	     * ];
	     *
	     * _.find(users, function(o) { return o.age < 40; });
	     * // => object for 'barney'
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.find(users, { 'age': 1, 'active': true });
	     * // => object for 'pebbles'
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.find(users, ['active', false]);
	     * // => object for 'fred'
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.find(users, 'active');
	     * // => object for 'barney'
	     */var find=createFind(findIndex);/**
	     * This method is like `_.find` except that it iterates over elements of
	     * `collection` from right to left.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.0.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to inspect.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @param {number} [fromIndex=collection.length-1] The index to search from.
	     * @returns {*} Returns the matched element, else `undefined`.
	     * @example
	     *
	     * _.findLast([1, 2, 3, 4], function(n) {
	     *   return n % 2 == 1;
	     * });
	     * // => 3
	     */var findLast=createFind(findLastIndex);/**
	     * Creates a flattened array of values by running each element in `collection`
	     * thru `iteratee` and flattening the mapped results. The iteratee is invoked
	     * with three arguments: (value, index|key, collection).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the new flattened array.
	     * @example
	     *
	     * function duplicate(n) {
	     *   return [n, n];
	     * }
	     *
	     * _.flatMap([1, 2], duplicate);
	     * // => [1, 1, 2, 2]
	     */function flatMap(collection,iteratee){return baseFlatten(map(collection,iteratee),1);}/**
	     * This method is like `_.flatMap` except that it recursively flattens the
	     * mapped results.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.7.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the new flattened array.
	     * @example
	     *
	     * function duplicate(n) {
	     *   return [[[n, n]]];
	     * }
	     *
	     * _.flatMapDeep([1, 2], duplicate);
	     * // => [1, 1, 2, 2]
	     */function flatMapDeep(collection,iteratee){return baseFlatten(map(collection,iteratee),INFINITY);}/**
	     * This method is like `_.flatMap` except that it recursively flattens the
	     * mapped results up to `depth` times.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.7.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @param {number} [depth=1] The maximum recursion depth.
	     * @returns {Array} Returns the new flattened array.
	     * @example
	     *
	     * function duplicate(n) {
	     *   return [[[n, n]]];
	     * }
	     *
	     * _.flatMapDepth([1, 2], duplicate, 2);
	     * // => [[1, 1], [2, 2]]
	     */function flatMapDepth(collection,iteratee,depth){depth=depth===undefined?1:toInteger(depth);return baseFlatten(map(collection,iteratee),depth);}/**
	     * Iterates over elements of `collection` and invokes `iteratee` for each element.
	     * The iteratee is invoked with three arguments: (value, index|key, collection).
	     * Iteratee functions may exit iteration early by explicitly returning `false`.
	     *
	     * **Note:** As with other "Collections" methods, objects with a "length"
	     * property are iterated like arrays. To avoid this behavior use `_.forIn`
	     * or `_.forOwn` for object iteration.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @alias each
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Array|Object} Returns `collection`.
	     * @see _.forEachRight
	     * @example
	     *
	     * _.forEach([1, 2], function(value) {
	     *   console.log(value);
	     * });
	     * // => Logs `1` then `2`.
	     *
	     * _.forEach({ 'a': 1, 'b': 2 }, function(value, key) {
	     *   console.log(key);
	     * });
	     * // => Logs 'a' then 'b' (iteration order is not guaranteed).
	     */function forEach(collection,iteratee){var func=isArray(collection)?arrayEach:baseEach;return func(collection,getIteratee(iteratee,3));}/**
	     * This method is like `_.forEach` except that it iterates over elements of
	     * `collection` from right to left.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.0.0
	     * @alias eachRight
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Array|Object} Returns `collection`.
	     * @see _.forEach
	     * @example
	     *
	     * _.forEachRight([1, 2], function(value) {
	     *   console.log(value);
	     * });
	     * // => Logs `2` then `1`.
	     */function forEachRight(collection,iteratee){var func=isArray(collection)?arrayEachRight:baseEachRight;return func(collection,getIteratee(iteratee,3));}/**
	     * Creates an object composed of keys generated from the results of running
	     * each element of `collection` thru `iteratee`. The order of grouped values
	     * is determined by the order they occur in `collection`. The corresponding
	     * value of each key is an array of elements responsible for generating the
	     * key. The iteratee is invoked with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [iteratee=_.identity] The iteratee to transform keys.
	     * @returns {Object} Returns the composed aggregate object.
	     * @example
	     *
	     * _.groupBy([6.1, 4.2, 6.3], Math.floor);
	     * // => { '4': [4.2], '6': [6.1, 6.3] }
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.groupBy(['one', 'two', 'three'], 'length');
	     * // => { '3': ['one', 'two'], '5': ['three'] }
	     */var groupBy=createAggregator(function(result,value,key){if(hasOwnProperty.call(result,key)){result[key].push(value);}else{baseAssignValue(result,key,[value]);}});/**
	     * Checks if `value` is in `collection`. If `collection` is a string, it's
	     * checked for a substring of `value`, otherwise
	     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	     * is used for equality comparisons. If `fromIndex` is negative, it's used as
	     * the offset from the end of `collection`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object|string} collection The collection to inspect.
	     * @param {*} value The value to search for.
	     * @param {number} [fromIndex=0] The index to search from.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
	     * @returns {boolean} Returns `true` if `value` is found, else `false`.
	     * @example
	     *
	     * _.includes([1, 2, 3], 1);
	     * // => true
	     *
	     * _.includes([1, 2, 3], 1, 2);
	     * // => false
	     *
	     * _.includes({ 'a': 1, 'b': 2 }, 1);
	     * // => true
	     *
	     * _.includes('abcd', 'bc');
	     * // => true
	     */function includes(collection,value,fromIndex,guard){collection=isArrayLike(collection)?collection:values(collection);fromIndex=fromIndex&&!guard?toInteger(fromIndex):0;var length=collection.length;if(fromIndex<0){fromIndex=nativeMax(length+fromIndex,0);}return isString(collection)?fromIndex<=length&&collection.indexOf(value,fromIndex)>-1:!!length&&baseIndexOf(collection,value,fromIndex)>-1;}/**
	     * Invokes the method at `path` of each element in `collection`, returning
	     * an array of the results of each invoked method. Any additional arguments
	     * are provided to each invoked method. If `path` is a function, it's invoked
	     * for, and `this` bound to, each element in `collection`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Array|Function|string} path The path of the method to invoke or
	     *  the function invoked per iteration.
	     * @param {...*} [args] The arguments to invoke each method with.
	     * @returns {Array} Returns the array of results.
	     * @example
	     *
	     * _.invokeMap([[5, 1, 7], [3, 2, 1]], 'sort');
	     * // => [[1, 5, 7], [1, 2, 3]]
	     *
	     * _.invokeMap([123, 456], String.prototype.split, '');
	     * // => [['1', '2', '3'], ['4', '5', '6']]
	     */var invokeMap=baseRest(function(collection,path,args){var index=-1,isFunc=typeof path=='function',result=isArrayLike(collection)?Array(collection.length):[];baseEach(collection,function(value){result[++index]=isFunc?apply(path,value,args):baseInvoke(value,path,args);});return result;});/**
	     * Creates an object composed of keys generated from the results of running
	     * each element of `collection` thru `iteratee`. The corresponding value of
	     * each key is the last element responsible for generating the key. The
	     * iteratee is invoked with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [iteratee=_.identity] The iteratee to transform keys.
	     * @returns {Object} Returns the composed aggregate object.
	     * @example
	     *
	     * var array = [
	     *   { 'dir': 'left', 'code': 97 },
	     *   { 'dir': 'right', 'code': 100 }
	     * ];
	     *
	     * _.keyBy(array, function(o) {
	     *   return String.fromCharCode(o.code);
	     * });
	     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
	     *
	     * _.keyBy(array, 'dir');
	     * // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
	     */var keyBy=createAggregator(function(result,value,key){baseAssignValue(result,key,value);});/**
	     * Creates an array of values by running each element in `collection` thru
	     * `iteratee`. The iteratee is invoked with three arguments:
	     * (value, index|key, collection).
	     *
	     * Many lodash methods are guarded to work as iteratees for methods like
	     * `_.every`, `_.filter`, `_.map`, `_.mapValues`, `_.reject`, and `_.some`.
	     *
	     * The guarded methods are:
	     * `ary`, `chunk`, `curry`, `curryRight`, `drop`, `dropRight`, `every`,
	     * `fill`, `invert`, `parseInt`, `random`, `range`, `rangeRight`, `repeat`,
	     * `sampleSize`, `slice`, `some`, `sortBy`, `split`, `take`, `takeRight`,
	     * `template`, `trim`, `trimEnd`, `trimStart`, and `words`
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the new mapped array.
	     * @example
	     *
	     * function square(n) {
	     *   return n * n;
	     * }
	     *
	     * _.map([4, 8], square);
	     * // => [16, 64]
	     *
	     * _.map({ 'a': 4, 'b': 8 }, square);
	     * // => [16, 64] (iteration order is not guaranteed)
	     *
	     * var users = [
	     *   { 'user': 'barney' },
	     *   { 'user': 'fred' }
	     * ];
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.map(users, 'user');
	     * // => ['barney', 'fred']
	     */function map(collection,iteratee){var func=isArray(collection)?arrayMap:baseMap;return func(collection,getIteratee(iteratee,3));}/**
	     * This method is like `_.sortBy` except that it allows specifying the sort
	     * orders of the iteratees to sort by. If `orders` is unspecified, all values
	     * are sorted in ascending order. Otherwise, specify an order of "desc" for
	     * descending or "asc" for ascending sort order of corresponding values.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Array[]|Function[]|Object[]|string[]} [iteratees=[_.identity]]
	     *  The iteratees to sort by.
	     * @param {string[]} [orders] The sort orders of `iteratees`.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.reduce`.
	     * @returns {Array} Returns the new sorted array.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'fred',   'age': 48 },
	     *   { 'user': 'barney', 'age': 34 },
	     *   { 'user': 'fred',   'age': 40 },
	     *   { 'user': 'barney', 'age': 36 }
	     * ];
	     *
	     * // Sort by `user` in ascending order and by `age` in descending order.
	     * _.orderBy(users, ['user', 'age'], ['asc', 'desc']);
	     * // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 40]]
	     */function orderBy(collection,iteratees,orders,guard){if(collection==null){return[];}if(!isArray(iteratees)){iteratees=iteratees==null?[]:[iteratees];}orders=guard?undefined:orders;if(!isArray(orders)){orders=orders==null?[]:[orders];}return baseOrderBy(collection,iteratees,orders);}/**
	     * Creates an array of elements split into two groups, the first of which
	     * contains elements `predicate` returns truthy for, the second of which
	     * contains elements `predicate` returns falsey for. The predicate is
	     * invoked with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the array of grouped elements.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney',  'age': 36, 'active': false },
	     *   { 'user': 'fred',    'age': 40, 'active': true },
	     *   { 'user': 'pebbles', 'age': 1,  'active': false }
	     * ];
	     *
	     * _.partition(users, function(o) { return o.active; });
	     * // => objects for [['fred'], ['barney', 'pebbles']]
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.partition(users, { 'age': 1, 'active': false });
	     * // => objects for [['pebbles'], ['barney', 'fred']]
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.partition(users, ['active', false]);
	     * // => objects for [['barney', 'pebbles'], ['fred']]
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.partition(users, 'active');
	     * // => objects for [['fred'], ['barney', 'pebbles']]
	     */var partition=createAggregator(function(result,value,key){result[key?0:1].push(value);},function(){return[[],[]];});/**
	     * Reduces `collection` to a value which is the accumulated result of running
	     * each element in `collection` thru `iteratee`, where each successive
	     * invocation is supplied the return value of the previous. If `accumulator`
	     * is not given, the first element of `collection` is used as the initial
	     * value. The iteratee is invoked with four arguments:
	     * (accumulator, value, index|key, collection).
	     *
	     * Many lodash methods are guarded to work as iteratees for methods like
	     * `_.reduce`, `_.reduceRight`, and `_.transform`.
	     *
	     * The guarded methods are:
	     * `assign`, `defaults`, `defaultsDeep`, `includes`, `merge`, `orderBy`,
	     * and `sortBy`
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @param {*} [accumulator] The initial value.
	     * @returns {*} Returns the accumulated value.
	     * @see _.reduceRight
	     * @example
	     *
	     * _.reduce([1, 2], function(sum, n) {
	     *   return sum + n;
	     * }, 0);
	     * // => 3
	     *
	     * _.reduce({ 'a': 1, 'b': 2, 'c': 1 }, function(result, value, key) {
	     *   (result[value] || (result[value] = [])).push(key);
	     *   return result;
	     * }, {});
	     * // => { '1': ['a', 'c'], '2': ['b'] } (iteration order is not guaranteed)
	     */function reduce(collection,iteratee,accumulator){var func=isArray(collection)?arrayReduce:baseReduce,initAccum=arguments.length<3;return func(collection,getIteratee(iteratee,4),accumulator,initAccum,baseEach);}/**
	     * This method is like `_.reduce` except that it iterates over elements of
	     * `collection` from right to left.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @param {*} [accumulator] The initial value.
	     * @returns {*} Returns the accumulated value.
	     * @see _.reduce
	     * @example
	     *
	     * var array = [[0, 1], [2, 3], [4, 5]];
	     *
	     * _.reduceRight(array, function(flattened, other) {
	     *   return flattened.concat(other);
	     * }, []);
	     * // => [4, 5, 2, 3, 0, 1]
	     */function reduceRight(collection,iteratee,accumulator){var func=isArray(collection)?arrayReduceRight:baseReduce,initAccum=arguments.length<3;return func(collection,getIteratee(iteratee,4),accumulator,initAccum,baseEachRight);}/**
	     * The opposite of `_.filter`; this method returns the elements of `collection`
	     * that `predicate` does **not** return truthy for.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the new filtered array.
	     * @see _.filter
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney', 'age': 36, 'active': false },
	     *   { 'user': 'fred',   'age': 40, 'active': true }
	     * ];
	     *
	     * _.reject(users, function(o) { return !o.active; });
	     * // => objects for ['fred']
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.reject(users, { 'age': 40, 'active': true });
	     * // => objects for ['barney']
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.reject(users, ['active', false]);
	     * // => objects for ['fred']
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.reject(users, 'active');
	     * // => objects for ['barney']
	     */function reject(collection,predicate){var func=isArray(collection)?arrayFilter:baseFilter;return func(collection,negate(getIteratee(predicate,3)));}/**
	     * Gets a random element from `collection`.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.0.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to sample.
	     * @returns {*} Returns the random element.
	     * @example
	     *
	     * _.sample([1, 2, 3, 4]);
	     * // => 2
	     */function sample(collection){var func=isArray(collection)?arraySample:baseSample;return func(collection);}/**
	     * Gets `n` random elements at unique keys from `collection` up to the
	     * size of `collection`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to sample.
	     * @param {number} [n=1] The number of elements to sample.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {Array} Returns the random elements.
	     * @example
	     *
	     * _.sampleSize([1, 2, 3], 2);
	     * // => [3, 1]
	     *
	     * _.sampleSize([1, 2, 3], 4);
	     * // => [2, 3, 1]
	     */function sampleSize(collection,n,guard){if(guard?isIterateeCall(collection,n,guard):n===undefined){n=1;}else{n=toInteger(n);}var func=isArray(collection)?arraySampleSize:baseSampleSize;return func(collection,n);}/**
	     * Creates an array of shuffled values, using a version of the
	     * [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher-Yates_shuffle).
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to shuffle.
	     * @returns {Array} Returns the new shuffled array.
	     * @example
	     *
	     * _.shuffle([1, 2, 3, 4]);
	     * // => [4, 1, 3, 2]
	     */function shuffle(collection){var func=isArray(collection)?arrayShuffle:baseShuffle;return func(collection);}/**
	     * Gets the size of `collection` by returning its length for array-like
	     * values or the number of own enumerable string keyed properties for objects.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object|string} collection The collection to inspect.
	     * @returns {number} Returns the collection size.
	     * @example
	     *
	     * _.size([1, 2, 3]);
	     * // => 3
	     *
	     * _.size({ 'a': 1, 'b': 2 });
	     * // => 2
	     *
	     * _.size('pebbles');
	     * // => 7
	     */function size(collection){if(collection==null){return 0;}if(isArrayLike(collection)){return isString(collection)?stringSize(collection):collection.length;}var tag=getTag(collection);if(tag==mapTag||tag==setTag){return collection.size;}return baseKeys(collection).length;}/**
	     * Checks if `predicate` returns truthy for **any** element of `collection`.
	     * Iteration is stopped once `predicate` returns truthy. The predicate is
	     * invoked with three arguments: (value, index|key, collection).
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {boolean} Returns `true` if any element passes the predicate check,
	     *  else `false`.
	     * @example
	     *
	     * _.some([null, 0, 'yes', false], Boolean);
	     * // => true
	     *
	     * var users = [
	     *   { 'user': 'barney', 'active': true },
	     *   { 'user': 'fred',   'active': false }
	     * ];
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.some(users, { 'user': 'barney', 'active': false });
	     * // => false
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.some(users, ['active', false]);
	     * // => true
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.some(users, 'active');
	     * // => true
	     */function some(collection,predicate,guard){var func=isArray(collection)?arraySome:baseSome;if(guard&&isIterateeCall(collection,predicate,guard)){predicate=undefined;}return func(collection,getIteratee(predicate,3));}/**
	     * Creates an array of elements, sorted in ascending order by the results of
	     * running each element in a collection thru each iteratee. This method
	     * performs a stable sort, that is, it preserves the original sort order of
	     * equal elements. The iteratees are invoked with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Collection
	     * @param {Array|Object} collection The collection to iterate over.
	     * @param {...(Function|Function[])} [iteratees=[_.identity]]
	     *  The iteratees to sort by.
	     * @returns {Array} Returns the new sorted array.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'fred',   'age': 48 },
	     *   { 'user': 'barney', 'age': 36 },
	     *   { 'user': 'fred',   'age': 40 },
	     *   { 'user': 'barney', 'age': 34 }
	     * ];
	     *
	     * _.sortBy(users, [function(o) { return o.user; }]);
	     * // => objects for [['barney', 36], ['barney', 34], ['fred', 48], ['fred', 40]]
	     *
	     * _.sortBy(users, ['user', 'age']);
	     * // => objects for [['barney', 34], ['barney', 36], ['fred', 40], ['fred', 48]]
	     */var sortBy=baseRest(function(collection,iteratees){if(collection==null){return[];}var length=iteratees.length;if(length>1&&isIterateeCall(collection,iteratees[0],iteratees[1])){iteratees=[];}else if(length>2&&isIterateeCall(iteratees[0],iteratees[1],iteratees[2])){iteratees=[iteratees[0]];}return baseOrderBy(collection,baseFlatten(iteratees,1),[]);});/*------------------------------------------------------------------------*//**
	     * Gets the timestamp of the number of milliseconds that have elapsed since
	     * the Unix epoch (1 January 1970 00:00:00 UTC).
	     *
	     * @static
	     * @memberOf _
	     * @since 2.4.0
	     * @category Date
	     * @returns {number} Returns the timestamp.
	     * @example
	     *
	     * _.defer(function(stamp) {
	     *   console.log(_.now() - stamp);
	     * }, _.now());
	     * // => Logs the number of milliseconds it took for the deferred invocation.
	     */var now=ctxNow||function(){return root.Date.now();};/*------------------------------------------------------------------------*//**
	     * The opposite of `_.before`; this method creates a function that invokes
	     * `func` once it's called `n` or more times.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Function
	     * @param {number} n The number of calls before `func` is invoked.
	     * @param {Function} func The function to restrict.
	     * @returns {Function} Returns the new restricted function.
	     * @example
	     *
	     * var saves = ['profile', 'settings'];
	     *
	     * var done = _.after(saves.length, function() {
	     *   console.log('done saving!');
	     * });
	     *
	     * _.forEach(saves, function(type) {
	     *   asyncSave({ 'type': type, 'complete': done });
	     * });
	     * // => Logs 'done saving!' after the two async saves have completed.
	     */function after(n,func){if(typeof func!='function'){throw new TypeError(FUNC_ERROR_TEXT);}n=toInteger(n);return function(){if(--n<1){return func.apply(this,arguments);}};}/**
	     * Creates a function that invokes `func`, with up to `n` arguments,
	     * ignoring any additional arguments.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Function
	     * @param {Function} func The function to cap arguments for.
	     * @param {number} [n=func.length] The arity cap.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {Function} Returns the new capped function.
	     * @example
	     *
	     * _.map(['6', '8', '10'], _.ary(parseInt, 1));
	     * // => [6, 8, 10]
	     */function ary(func,n,guard){n=guard?undefined:n;n=func&&n==null?func.length:n;return createWrap(func,WRAP_ARY_FLAG,undefined,undefined,undefined,undefined,n);}/**
	     * Creates a function that invokes `func`, with the `this` binding and arguments
	     * of the created function, while it's called less than `n` times. Subsequent
	     * calls to the created function return the result of the last `func` invocation.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Function
	     * @param {number} n The number of calls at which `func` is no longer invoked.
	     * @param {Function} func The function to restrict.
	     * @returns {Function} Returns the new restricted function.
	     * @example
	     *
	     * jQuery(element).on('click', _.before(5, addContactToList));
	     * // => Allows adding up to 4 contacts to the list.
	     */function before(n,func){var result;if(typeof func!='function'){throw new TypeError(FUNC_ERROR_TEXT);}n=toInteger(n);return function(){if(--n>0){result=func.apply(this,arguments);}if(n<=1){func=undefined;}return result;};}/**
	     * Creates a function that invokes `func` with the `this` binding of `thisArg`
	     * and `partials` prepended to the arguments it receives.
	     *
	     * The `_.bind.placeholder` value, which defaults to `_` in monolithic builds,
	     * may be used as a placeholder for partially applied arguments.
	     *
	     * **Note:** Unlike native `Function#bind`, this method doesn't set the "length"
	     * property of bound functions.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Function
	     * @param {Function} func The function to bind.
	     * @param {*} thisArg The `this` binding of `func`.
	     * @param {...*} [partials] The arguments to be partially applied.
	     * @returns {Function} Returns the new bound function.
	     * @example
	     *
	     * function greet(greeting, punctuation) {
	     *   return greeting + ' ' + this.user + punctuation;
	     * }
	     *
	     * var object = { 'user': 'fred' };
	     *
	     * var bound = _.bind(greet, object, 'hi');
	     * bound('!');
	     * // => 'hi fred!'
	     *
	     * // Bound with placeholders.
	     * var bound = _.bind(greet, object, _, '!');
	     * bound('hi');
	     * // => 'hi fred!'
	     */var bind=baseRest(function(func,thisArg,partials){var bitmask=WRAP_BIND_FLAG;if(partials.length){var holders=replaceHolders(partials,getHolder(bind));bitmask|=WRAP_PARTIAL_FLAG;}return createWrap(func,bitmask,thisArg,partials,holders);});/**
	     * Creates a function that invokes the method at `object[key]` with `partials`
	     * prepended to the arguments it receives.
	     *
	     * This method differs from `_.bind` by allowing bound functions to reference
	     * methods that may be redefined or don't yet exist. See
	     * [Peter Michaux's article](http://peter.michaux.ca/articles/lazy-function-definition-pattern)
	     * for more details.
	     *
	     * The `_.bindKey.placeholder` value, which defaults to `_` in monolithic
	     * builds, may be used as a placeholder for partially applied arguments.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.10.0
	     * @category Function
	     * @param {Object} object The object to invoke the method on.
	     * @param {string} key The key of the method.
	     * @param {...*} [partials] The arguments to be partially applied.
	     * @returns {Function} Returns the new bound function.
	     * @example
	     *
	     * var object = {
	     *   'user': 'fred',
	     *   'greet': function(greeting, punctuation) {
	     *     return greeting + ' ' + this.user + punctuation;
	     *   }
	     * };
	     *
	     * var bound = _.bindKey(object, 'greet', 'hi');
	     * bound('!');
	     * // => 'hi fred!'
	     *
	     * object.greet = function(greeting, punctuation) {
	     *   return greeting + 'ya ' + this.user + punctuation;
	     * };
	     *
	     * bound('!');
	     * // => 'hiya fred!'
	     *
	     * // Bound with placeholders.
	     * var bound = _.bindKey(object, 'greet', _, '!');
	     * bound('hi');
	     * // => 'hiya fred!'
	     */var bindKey=baseRest(function(object,key,partials){var bitmask=WRAP_BIND_FLAG|WRAP_BIND_KEY_FLAG;if(partials.length){var holders=replaceHolders(partials,getHolder(bindKey));bitmask|=WRAP_PARTIAL_FLAG;}return createWrap(key,bitmask,object,partials,holders);});/**
	     * Creates a function that accepts arguments of `func` and either invokes
	     * `func` returning its result, if at least `arity` number of arguments have
	     * been provided, or returns a function that accepts the remaining `func`
	     * arguments, and so on. The arity of `func` may be specified if `func.length`
	     * is not sufficient.
	     *
	     * The `_.curry.placeholder` value, which defaults to `_` in monolithic builds,
	     * may be used as a placeholder for provided arguments.
	     *
	     * **Note:** This method doesn't set the "length" property of curried functions.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.0.0
	     * @category Function
	     * @param {Function} func The function to curry.
	     * @param {number} [arity=func.length] The arity of `func`.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {Function} Returns the new curried function.
	     * @example
	     *
	     * var abc = function(a, b, c) {
	     *   return [a, b, c];
	     * };
	     *
	     * var curried = _.curry(abc);
	     *
	     * curried(1)(2)(3);
	     * // => [1, 2, 3]
	     *
	     * curried(1, 2)(3);
	     * // => [1, 2, 3]
	     *
	     * curried(1, 2, 3);
	     * // => [1, 2, 3]
	     *
	     * // Curried with placeholders.
	     * curried(1)(_, 3)(2);
	     * // => [1, 2, 3]
	     */function curry(func,arity,guard){arity=guard?undefined:arity;var result=createWrap(func,WRAP_CURRY_FLAG,undefined,undefined,undefined,undefined,undefined,arity);result.placeholder=curry.placeholder;return result;}/**
	     * This method is like `_.curry` except that arguments are applied to `func`
	     * in the manner of `_.partialRight` instead of `_.partial`.
	     *
	     * The `_.curryRight.placeholder` value, which defaults to `_` in monolithic
	     * builds, may be used as a placeholder for provided arguments.
	     *
	     * **Note:** This method doesn't set the "length" property of curried functions.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Function
	     * @param {Function} func The function to curry.
	     * @param {number} [arity=func.length] The arity of `func`.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {Function} Returns the new curried function.
	     * @example
	     *
	     * var abc = function(a, b, c) {
	     *   return [a, b, c];
	     * };
	     *
	     * var curried = _.curryRight(abc);
	     *
	     * curried(3)(2)(1);
	     * // => [1, 2, 3]
	     *
	     * curried(2, 3)(1);
	     * // => [1, 2, 3]
	     *
	     * curried(1, 2, 3);
	     * // => [1, 2, 3]
	     *
	     * // Curried with placeholders.
	     * curried(3)(1, _)(2);
	     * // => [1, 2, 3]
	     */function curryRight(func,arity,guard){arity=guard?undefined:arity;var result=createWrap(func,WRAP_CURRY_RIGHT_FLAG,undefined,undefined,undefined,undefined,undefined,arity);result.placeholder=curryRight.placeholder;return result;}/**
	     * Creates a debounced function that delays invoking `func` until after `wait`
	     * milliseconds have elapsed since the last time the debounced function was
	     * invoked. The debounced function comes with a `cancel` method to cancel
	     * delayed `func` invocations and a `flush` method to immediately invoke them.
	     * Provide `options` to indicate whether `func` should be invoked on the
	     * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
	     * with the last arguments provided to the debounced function. Subsequent
	     * calls to the debounced function return the result of the last `func`
	     * invocation.
	     *
	     * **Note:** If `leading` and `trailing` options are `true`, `func` is
	     * invoked on the trailing edge of the timeout only if the debounced function
	     * is invoked more than once during the `wait` timeout.
	     *
	     * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
	     * until to the next tick, similar to `setTimeout` with a timeout of `0`.
	     *
	     * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
	     * for details over the differences between `_.debounce` and `_.throttle`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Function
	     * @param {Function} func The function to debounce.
	     * @param {number} [wait=0] The number of milliseconds to delay.
	     * @param {Object} [options={}] The options object.
	     * @param {boolean} [options.leading=false]
	     *  Specify invoking on the leading edge of the timeout.
	     * @param {number} [options.maxWait]
	     *  The maximum time `func` is allowed to be delayed before it's invoked.
	     * @param {boolean} [options.trailing=true]
	     *  Specify invoking on the trailing edge of the timeout.
	     * @returns {Function} Returns the new debounced function.
	     * @example
	     *
	     * // Avoid costly calculations while the window size is in flux.
	     * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
	     *
	     * // Invoke `sendMail` when clicked, debouncing subsequent calls.
	     * jQuery(element).on('click', _.debounce(sendMail, 300, {
	     *   'leading': true,
	     *   'trailing': false
	     * }));
	     *
	     * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
	     * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
	     * var source = new EventSource('/stream');
	     * jQuery(source).on('message', debounced);
	     *
	     * // Cancel the trailing debounced invocation.
	     * jQuery(window).on('popstate', debounced.cancel);
	     */function debounce(func,wait,options){var lastArgs,lastThis,maxWait,result,timerId,lastCallTime,lastInvokeTime=0,leading=false,maxing=false,trailing=true;if(typeof func!='function'){throw new TypeError(FUNC_ERROR_TEXT);}wait=toNumber(wait)||0;if(isObject(options)){leading=!!options.leading;maxing='maxWait'in options;maxWait=maxing?nativeMax(toNumber(options.maxWait)||0,wait):maxWait;trailing='trailing'in options?!!options.trailing:trailing;}function invokeFunc(time){var args=lastArgs,thisArg=lastThis;lastArgs=lastThis=undefined;lastInvokeTime=time;result=func.apply(thisArg,args);return result;}function leadingEdge(time){// Reset any `maxWait` timer.
	lastInvokeTime=time;// Start the timer for the trailing edge.
	timerId=setTimeout(timerExpired,wait);// Invoke the leading edge.
	return leading?invokeFunc(time):result;}function remainingWait(time){var timeSinceLastCall=time-lastCallTime,timeSinceLastInvoke=time-lastInvokeTime,result=wait-timeSinceLastCall;return maxing?nativeMin(result,maxWait-timeSinceLastInvoke):result;}function shouldInvoke(time){var timeSinceLastCall=time-lastCallTime,timeSinceLastInvoke=time-lastInvokeTime;// Either this is the first call, activity has stopped and we're at the
	// trailing edge, the system time has gone backwards and we're treating
	// it as the trailing edge, or we've hit the `maxWait` limit.
	return lastCallTime===undefined||timeSinceLastCall>=wait||timeSinceLastCall<0||maxing&&timeSinceLastInvoke>=maxWait;}function timerExpired(){var time=now();if(shouldInvoke(time)){return trailingEdge(time);}// Restart the timer.
	timerId=setTimeout(timerExpired,remainingWait(time));}function trailingEdge(time){timerId=undefined;// Only invoke if we have `lastArgs` which means `func` has been
	// debounced at least once.
	if(trailing&&lastArgs){return invokeFunc(time);}lastArgs=lastThis=undefined;return result;}function cancel(){if(timerId!==undefined){clearTimeout(timerId);}lastInvokeTime=0;lastArgs=lastCallTime=lastThis=timerId=undefined;}function flush(){return timerId===undefined?result:trailingEdge(now());}function debounced(){var time=now(),isInvoking=shouldInvoke(time);lastArgs=arguments;lastThis=this;lastCallTime=time;if(isInvoking){if(timerId===undefined){return leadingEdge(lastCallTime);}if(maxing){// Handle invocations in a tight loop.
	timerId=setTimeout(timerExpired,wait);return invokeFunc(lastCallTime);}}if(timerId===undefined){timerId=setTimeout(timerExpired,wait);}return result;}debounced.cancel=cancel;debounced.flush=flush;return debounced;}/**
	     * Defers invoking the `func` until the current call stack has cleared. Any
	     * additional arguments are provided to `func` when it's invoked.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Function
	     * @param {Function} func The function to defer.
	     * @param {...*} [args] The arguments to invoke `func` with.
	     * @returns {number} Returns the timer id.
	     * @example
	     *
	     * _.defer(function(text) {
	     *   console.log(text);
	     * }, 'deferred');
	     * // => Logs 'deferred' after one millisecond.
	     */var defer=baseRest(function(func,args){return baseDelay(func,1,args);});/**
	     * Invokes `func` after `wait` milliseconds. Any additional arguments are
	     * provided to `func` when it's invoked.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Function
	     * @param {Function} func The function to delay.
	     * @param {number} wait The number of milliseconds to delay invocation.
	     * @param {...*} [args] The arguments to invoke `func` with.
	     * @returns {number} Returns the timer id.
	     * @example
	     *
	     * _.delay(function(text) {
	     *   console.log(text);
	     * }, 1000, 'later');
	     * // => Logs 'later' after one second.
	     */var delay=baseRest(function(func,wait,args){return baseDelay(func,toNumber(wait)||0,args);});/**
	     * Creates a function that invokes `func` with arguments reversed.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Function
	     * @param {Function} func The function to flip arguments for.
	     * @returns {Function} Returns the new flipped function.
	     * @example
	     *
	     * var flipped = _.flip(function() {
	     *   return _.toArray(arguments);
	     * });
	     *
	     * flipped('a', 'b', 'c', 'd');
	     * // => ['d', 'c', 'b', 'a']
	     */function flip(func){return createWrap(func,WRAP_FLIP_FLAG);}/**
	     * Creates a function that memoizes the result of `func`. If `resolver` is
	     * provided, it determines the cache key for storing the result based on the
	     * arguments provided to the memoized function. By default, the first argument
	     * provided to the memoized function is used as the map cache key. The `func`
	     * is invoked with the `this` binding of the memoized function.
	     *
	     * **Note:** The cache is exposed as the `cache` property on the memoized
	     * function. Its creation may be customized by replacing the `_.memoize.Cache`
	     * constructor with one whose instances implement the
	     * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
	     * method interface of `clear`, `delete`, `get`, `has`, and `set`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Function
	     * @param {Function} func The function to have its output memoized.
	     * @param {Function} [resolver] The function to resolve the cache key.
	     * @returns {Function} Returns the new memoized function.
	     * @example
	     *
	     * var object = { 'a': 1, 'b': 2 };
	     * var other = { 'c': 3, 'd': 4 };
	     *
	     * var values = _.memoize(_.values);
	     * values(object);
	     * // => [1, 2]
	     *
	     * values(other);
	     * // => [3, 4]
	     *
	     * object.a = 2;
	     * values(object);
	     * // => [1, 2]
	     *
	     * // Modify the result cache.
	     * values.cache.set(object, ['a', 'b']);
	     * values(object);
	     * // => ['a', 'b']
	     *
	     * // Replace `_.memoize.Cache`.
	     * _.memoize.Cache = WeakMap;
	     */function memoize(func,resolver){if(typeof func!='function'||resolver!=null&&typeof resolver!='function'){throw new TypeError(FUNC_ERROR_TEXT);}var memoized=function memoized(){var args=arguments,key=resolver?resolver.apply(this,args):args[0],cache=memoized.cache;if(cache.has(key)){return cache.get(key);}var result=func.apply(this,args);memoized.cache=cache.set(key,result)||cache;return result;};memoized.cache=new(memoize.Cache||MapCache)();return memoized;}// Expose `MapCache`.
	memoize.Cache=MapCache;/**
	     * Creates a function that negates the result of the predicate `func`. The
	     * `func` predicate is invoked with the `this` binding and arguments of the
	     * created function.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Function
	     * @param {Function} predicate The predicate to negate.
	     * @returns {Function} Returns the new negated function.
	     * @example
	     *
	     * function isEven(n) {
	     *   return n % 2 == 0;
	     * }
	     *
	     * _.filter([1, 2, 3, 4, 5, 6], _.negate(isEven));
	     * // => [1, 3, 5]
	     */function negate(predicate){if(typeof predicate!='function'){throw new TypeError(FUNC_ERROR_TEXT);}return function(){var args=arguments;switch(args.length){case 0:return!predicate.call(this);case 1:return!predicate.call(this,args[0]);case 2:return!predicate.call(this,args[0],args[1]);case 3:return!predicate.call(this,args[0],args[1],args[2]);}return!predicate.apply(this,args);};}/**
	     * Creates a function that is restricted to invoking `func` once. Repeat calls
	     * to the function return the value of the first invocation. The `func` is
	     * invoked with the `this` binding and arguments of the created function.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Function
	     * @param {Function} func The function to restrict.
	     * @returns {Function} Returns the new restricted function.
	     * @example
	     *
	     * var initialize = _.once(createApplication);
	     * initialize();
	     * initialize();
	     * // => `createApplication` is invoked once
	     */function once(func){return before(2,func);}/**
	     * Creates a function that invokes `func` with its arguments transformed.
	     *
	     * @static
	     * @since 4.0.0
	     * @memberOf _
	     * @category Function
	     * @param {Function} func The function to wrap.
	     * @param {...(Function|Function[])} [transforms=[_.identity]]
	     *  The argument transforms.
	     * @returns {Function} Returns the new function.
	     * @example
	     *
	     * function doubled(n) {
	     *   return n * 2;
	     * }
	     *
	     * function square(n) {
	     *   return n * n;
	     * }
	     *
	     * var func = _.overArgs(function(x, y) {
	     *   return [x, y];
	     * }, [square, doubled]);
	     *
	     * func(9, 3);
	     * // => [81, 6]
	     *
	     * func(10, 5);
	     * // => [100, 10]
	     */var overArgs=castRest(function(func,transforms){transforms=transforms.length==1&&isArray(transforms[0])?arrayMap(transforms[0],baseUnary(getIteratee())):arrayMap(baseFlatten(transforms,1),baseUnary(getIteratee()));var funcsLength=transforms.length;return baseRest(function(args){var index=-1,length=nativeMin(args.length,funcsLength);while(++index<length){args[index]=transforms[index].call(this,args[index]);}return apply(func,this,args);});});/**
	     * Creates a function that invokes `func` with `partials` prepended to the
	     * arguments it receives. This method is like `_.bind` except it does **not**
	     * alter the `this` binding.
	     *
	     * The `_.partial.placeholder` value, which defaults to `_` in monolithic
	     * builds, may be used as a placeholder for partially applied arguments.
	     *
	     * **Note:** This method doesn't set the "length" property of partially
	     * applied functions.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.2.0
	     * @category Function
	     * @param {Function} func The function to partially apply arguments to.
	     * @param {...*} [partials] The arguments to be partially applied.
	     * @returns {Function} Returns the new partially applied function.
	     * @example
	     *
	     * function greet(greeting, name) {
	     *   return greeting + ' ' + name;
	     * }
	     *
	     * var sayHelloTo = _.partial(greet, 'hello');
	     * sayHelloTo('fred');
	     * // => 'hello fred'
	     *
	     * // Partially applied with placeholders.
	     * var greetFred = _.partial(greet, _, 'fred');
	     * greetFred('hi');
	     * // => 'hi fred'
	     */var partial=baseRest(function(func,partials){var holders=replaceHolders(partials,getHolder(partial));return createWrap(func,WRAP_PARTIAL_FLAG,undefined,partials,holders);});/**
	     * This method is like `_.partial` except that partially applied arguments
	     * are appended to the arguments it receives.
	     *
	     * The `_.partialRight.placeholder` value, which defaults to `_` in monolithic
	     * builds, may be used as a placeholder for partially applied arguments.
	     *
	     * **Note:** This method doesn't set the "length" property of partially
	     * applied functions.
	     *
	     * @static
	     * @memberOf _
	     * @since 1.0.0
	     * @category Function
	     * @param {Function} func The function to partially apply arguments to.
	     * @param {...*} [partials] The arguments to be partially applied.
	     * @returns {Function} Returns the new partially applied function.
	     * @example
	     *
	     * function greet(greeting, name) {
	     *   return greeting + ' ' + name;
	     * }
	     *
	     * var greetFred = _.partialRight(greet, 'fred');
	     * greetFred('hi');
	     * // => 'hi fred'
	     *
	     * // Partially applied with placeholders.
	     * var sayHelloTo = _.partialRight(greet, 'hello', _);
	     * sayHelloTo('fred');
	     * // => 'hello fred'
	     */var partialRight=baseRest(function(func,partials){var holders=replaceHolders(partials,getHolder(partialRight));return createWrap(func,WRAP_PARTIAL_RIGHT_FLAG,undefined,partials,holders);});/**
	     * Creates a function that invokes `func` with arguments arranged according
	     * to the specified `indexes` where the argument value at the first index is
	     * provided as the first argument, the argument value at the second index is
	     * provided as the second argument, and so on.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Function
	     * @param {Function} func The function to rearrange arguments for.
	     * @param {...(number|number[])} indexes The arranged argument indexes.
	     * @returns {Function} Returns the new function.
	     * @example
	     *
	     * var rearged = _.rearg(function(a, b, c) {
	     *   return [a, b, c];
	     * }, [2, 0, 1]);
	     *
	     * rearged('b', 'c', 'a')
	     * // => ['a', 'b', 'c']
	     */var rearg=flatRest(function(func,indexes){return createWrap(func,WRAP_REARG_FLAG,undefined,undefined,undefined,indexes);});/**
	     * Creates a function that invokes `func` with the `this` binding of the
	     * created function and arguments from `start` and beyond provided as
	     * an array.
	     *
	     * **Note:** This method is based on the
	     * [rest parameter](https://mdn.io/rest_parameters).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Function
	     * @param {Function} func The function to apply a rest parameter to.
	     * @param {number} [start=func.length-1] The start position of the rest parameter.
	     * @returns {Function} Returns the new function.
	     * @example
	     *
	     * var say = _.rest(function(what, names) {
	     *   return what + ' ' + _.initial(names).join(', ') +
	     *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
	     * });
	     *
	     * say('hello', 'fred', 'barney', 'pebbles');
	     * // => 'hello fred, barney, & pebbles'
	     */function rest(func,start){if(typeof func!='function'){throw new TypeError(FUNC_ERROR_TEXT);}start=start===undefined?start:toInteger(start);return baseRest(func,start);}/**
	     * Creates a function that invokes `func` with the `this` binding of the
	     * create function and an array of arguments much like
	     * [`Function#apply`](http://www.ecma-international.org/ecma-262/7.0/#sec-function.prototype.apply).
	     *
	     * **Note:** This method is based on the
	     * [spread operator](https://mdn.io/spread_operator).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.2.0
	     * @category Function
	     * @param {Function} func The function to spread arguments over.
	     * @param {number} [start=0] The start position of the spread.
	     * @returns {Function} Returns the new function.
	     * @example
	     *
	     * var say = _.spread(function(who, what) {
	     *   return who + ' says ' + what;
	     * });
	     *
	     * say(['fred', 'hello']);
	     * // => 'fred says hello'
	     *
	     * var numbers = Promise.all([
	     *   Promise.resolve(40),
	     *   Promise.resolve(36)
	     * ]);
	     *
	     * numbers.then(_.spread(function(x, y) {
	     *   return x + y;
	     * }));
	     * // => a Promise of 76
	     */function spread(func,start){if(typeof func!='function'){throw new TypeError(FUNC_ERROR_TEXT);}start=start===undefined?0:nativeMax(toInteger(start),0);return baseRest(function(args){var array=args[start],otherArgs=castSlice(args,0,start);if(array){arrayPush(otherArgs,array);}return apply(func,this,otherArgs);});}/**
	     * Creates a throttled function that only invokes `func` at most once per
	     * every `wait` milliseconds. The throttled function comes with a `cancel`
	     * method to cancel delayed `func` invocations and a `flush` method to
	     * immediately invoke them. Provide `options` to indicate whether `func`
	     * should be invoked on the leading and/or trailing edge of the `wait`
	     * timeout. The `func` is invoked with the last arguments provided to the
	     * throttled function. Subsequent calls to the throttled function return the
	     * result of the last `func` invocation.
	     *
	     * **Note:** If `leading` and `trailing` options are `true`, `func` is
	     * invoked on the trailing edge of the timeout only if the throttled function
	     * is invoked more than once during the `wait` timeout.
	     *
	     * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
	     * until to the next tick, similar to `setTimeout` with a timeout of `0`.
	     *
	     * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
	     * for details over the differences between `_.throttle` and `_.debounce`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Function
	     * @param {Function} func The function to throttle.
	     * @param {number} [wait=0] The number of milliseconds to throttle invocations to.
	     * @param {Object} [options={}] The options object.
	     * @param {boolean} [options.leading=true]
	     *  Specify invoking on the leading edge of the timeout.
	     * @param {boolean} [options.trailing=true]
	     *  Specify invoking on the trailing edge of the timeout.
	     * @returns {Function} Returns the new throttled function.
	     * @example
	     *
	     * // Avoid excessively updating the position while scrolling.
	     * jQuery(window).on('scroll', _.throttle(updatePosition, 100));
	     *
	     * // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
	     * var throttled = _.throttle(renewToken, 300000, { 'trailing': false });
	     * jQuery(element).on('click', throttled);
	     *
	     * // Cancel the trailing throttled invocation.
	     * jQuery(window).on('popstate', throttled.cancel);
	     */function throttle(func,wait,options){var leading=true,trailing=true;if(typeof func!='function'){throw new TypeError(FUNC_ERROR_TEXT);}if(isObject(options)){leading='leading'in options?!!options.leading:leading;trailing='trailing'in options?!!options.trailing:trailing;}return debounce(func,wait,{'leading':leading,'maxWait':wait,'trailing':trailing});}/**
	     * Creates a function that accepts up to one argument, ignoring any
	     * additional arguments.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Function
	     * @param {Function} func The function to cap arguments for.
	     * @returns {Function} Returns the new capped function.
	     * @example
	     *
	     * _.map(['6', '8', '10'], _.unary(parseInt));
	     * // => [6, 8, 10]
	     */function unary(func){return ary(func,1);}/**
	     * Creates a function that provides `value` to `wrapper` as its first
	     * argument. Any additional arguments provided to the function are appended
	     * to those provided to the `wrapper`. The wrapper is invoked with the `this`
	     * binding of the created function.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Function
	     * @param {*} value The value to wrap.
	     * @param {Function} [wrapper=identity] The wrapper function.
	     * @returns {Function} Returns the new function.
	     * @example
	     *
	     * var p = _.wrap(_.escape, function(func, text) {
	     *   return '<p>' + func(text) + '</p>';
	     * });
	     *
	     * p('fred, barney, & pebbles');
	     * // => '<p>fred, barney, &amp; pebbles</p>'
	     */function wrap(value,wrapper){return partial(castFunction(wrapper),value);}/*------------------------------------------------------------------------*//**
	     * Casts `value` as an array if it's not one.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.4.0
	     * @category Lang
	     * @param {*} value The value to inspect.
	     * @returns {Array} Returns the cast array.
	     * @example
	     *
	     * _.castArray(1);
	     * // => [1]
	     *
	     * _.castArray({ 'a': 1 });
	     * // => [{ 'a': 1 }]
	     *
	     * _.castArray('abc');
	     * // => ['abc']
	     *
	     * _.castArray(null);
	     * // => [null]
	     *
	     * _.castArray(undefined);
	     * // => [undefined]
	     *
	     * _.castArray();
	     * // => []
	     *
	     * var array = [1, 2, 3];
	     * console.log(_.castArray(array) === array);
	     * // => true
	     */function castArray(){if(!arguments.length){return[];}var value=arguments[0];return isArray(value)?value:[value];}/**
	     * Creates a shallow clone of `value`.
	     *
	     * **Note:** This method is loosely based on the
	     * [structured clone algorithm](https://mdn.io/Structured_clone_algorithm)
	     * and supports cloning arrays, array buffers, booleans, date objects, maps,
	     * numbers, `Object` objects, regexes, sets, strings, symbols, and typed
	     * arrays. The own enumerable properties of `arguments` objects are cloned
	     * as plain objects. An empty object is returned for uncloneable values such
	     * as error objects, functions, DOM nodes, and WeakMaps.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to clone.
	     * @returns {*} Returns the cloned value.
	     * @see _.cloneDeep
	     * @example
	     *
	     * var objects = [{ 'a': 1 }, { 'b': 2 }];
	     *
	     * var shallow = _.clone(objects);
	     * console.log(shallow[0] === objects[0]);
	     * // => true
	     */function clone(value){return baseClone(value,CLONE_SYMBOLS_FLAG);}/**
	     * This method is like `_.clone` except that it accepts `customizer` which
	     * is invoked to produce the cloned value. If `customizer` returns `undefined`,
	     * cloning is handled by the method instead. The `customizer` is invoked with
	     * up to four arguments; (value [, index|key, object, stack]).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to clone.
	     * @param {Function} [customizer] The function to customize cloning.
	     * @returns {*} Returns the cloned value.
	     * @see _.cloneDeepWith
	     * @example
	     *
	     * function customizer(value) {
	     *   if (_.isElement(value)) {
	     *     return value.cloneNode(false);
	     *   }
	     * }
	     *
	     * var el = _.cloneWith(document.body, customizer);
	     *
	     * console.log(el === document.body);
	     * // => false
	     * console.log(el.nodeName);
	     * // => 'BODY'
	     * console.log(el.childNodes.length);
	     * // => 0
	     */function cloneWith(value,customizer){customizer=typeof customizer=='function'?customizer:undefined;return baseClone(value,CLONE_SYMBOLS_FLAG,customizer);}/**
	     * This method is like `_.clone` except that it recursively clones `value`.
	     *
	     * @static
	     * @memberOf _
	     * @since 1.0.0
	     * @category Lang
	     * @param {*} value The value to recursively clone.
	     * @returns {*} Returns the deep cloned value.
	     * @see _.clone
	     * @example
	     *
	     * var objects = [{ 'a': 1 }, { 'b': 2 }];
	     *
	     * var deep = _.cloneDeep(objects);
	     * console.log(deep[0] === objects[0]);
	     * // => false
	     */function cloneDeep(value){return baseClone(value,CLONE_DEEP_FLAG|CLONE_SYMBOLS_FLAG);}/**
	     * This method is like `_.cloneWith` except that it recursively clones `value`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to recursively clone.
	     * @param {Function} [customizer] The function to customize cloning.
	     * @returns {*} Returns the deep cloned value.
	     * @see _.cloneWith
	     * @example
	     *
	     * function customizer(value) {
	     *   if (_.isElement(value)) {
	     *     return value.cloneNode(true);
	     *   }
	     * }
	     *
	     * var el = _.cloneDeepWith(document.body, customizer);
	     *
	     * console.log(el === document.body);
	     * // => false
	     * console.log(el.nodeName);
	     * // => 'BODY'
	     * console.log(el.childNodes.length);
	     * // => 20
	     */function cloneDeepWith(value,customizer){customizer=typeof customizer=='function'?customizer:undefined;return baseClone(value,CLONE_DEEP_FLAG|CLONE_SYMBOLS_FLAG,customizer);}/**
	     * Checks if `object` conforms to `source` by invoking the predicate
	     * properties of `source` with the corresponding property values of `object`.
	     *
	     * **Note:** This method is equivalent to `_.conforms` when `source` is
	     * partially applied.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.14.0
	     * @category Lang
	     * @param {Object} object The object to inspect.
	     * @param {Object} source The object of property predicates to conform to.
	     * @returns {boolean} Returns `true` if `object` conforms, else `false`.
	     * @example
	     *
	     * var object = { 'a': 1, 'b': 2 };
	     *
	     * _.conformsTo(object, { 'b': function(n) { return n > 1; } });
	     * // => true
	     *
	     * _.conformsTo(object, { 'b': function(n) { return n > 2; } });
	     * // => false
	     */function conformsTo(object,source){return source==null||baseConformsTo(object,source,keys(source));}/**
	     * Performs a
	     * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
	     * comparison between two values to determine if they are equivalent.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to compare.
	     * @param {*} other The other value to compare.
	     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	     * @example
	     *
	     * var object = { 'a': 1 };
	     * var other = { 'a': 1 };
	     *
	     * _.eq(object, object);
	     * // => true
	     *
	     * _.eq(object, other);
	     * // => false
	     *
	     * _.eq('a', 'a');
	     * // => true
	     *
	     * _.eq('a', Object('a'));
	     * // => false
	     *
	     * _.eq(NaN, NaN);
	     * // => true
	     */function eq(value,other){return value===other||value!==value&&other!==other;}/**
	     * Checks if `value` is greater than `other`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.9.0
	     * @category Lang
	     * @param {*} value The value to compare.
	     * @param {*} other The other value to compare.
	     * @returns {boolean} Returns `true` if `value` is greater than `other`,
	     *  else `false`.
	     * @see _.lt
	     * @example
	     *
	     * _.gt(3, 1);
	     * // => true
	     *
	     * _.gt(3, 3);
	     * // => false
	     *
	     * _.gt(1, 3);
	     * // => false
	     */var gt=createRelationalOperation(baseGt);/**
	     * Checks if `value` is greater than or equal to `other`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.9.0
	     * @category Lang
	     * @param {*} value The value to compare.
	     * @param {*} other The other value to compare.
	     * @returns {boolean} Returns `true` if `value` is greater than or equal to
	     *  `other`, else `false`.
	     * @see _.lte
	     * @example
	     *
	     * _.gte(3, 1);
	     * // => true
	     *
	     * _.gte(3, 3);
	     * // => true
	     *
	     * _.gte(1, 3);
	     * // => false
	     */var gte=createRelationalOperation(function(value,other){return value>=other;});/**
	     * Checks if `value` is likely an `arguments` object.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is an `arguments` object,
	     *  else `false`.
	     * @example
	     *
	     * _.isArguments(function() { return arguments; }());
	     * // => true
	     *
	     * _.isArguments([1, 2, 3]);
	     * // => false
	     */var isArguments=baseIsArguments(function(){return arguments;}())?baseIsArguments:function(value){return isObjectLike(value)&&hasOwnProperty.call(value,'callee')&&!propertyIsEnumerable.call(value,'callee');};/**
	     * Checks if `value` is classified as an `Array` object.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is an array, else `false`.
	     * @example
	     *
	     * _.isArray([1, 2, 3]);
	     * // => true
	     *
	     * _.isArray(document.body.children);
	     * // => false
	     *
	     * _.isArray('abc');
	     * // => false
	     *
	     * _.isArray(_.noop);
	     * // => false
	     */var isArray=Array.isArray;/**
	     * Checks if `value` is classified as an `ArrayBuffer` object.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.3.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is an array buffer, else `false`.
	     * @example
	     *
	     * _.isArrayBuffer(new ArrayBuffer(2));
	     * // => true
	     *
	     * _.isArrayBuffer(new Array(2));
	     * // => false
	     */var isArrayBuffer=nodeIsArrayBuffer?baseUnary(nodeIsArrayBuffer):baseIsArrayBuffer;/**
	     * Checks if `value` is array-like. A value is considered array-like if it's
	     * not a function and has a `value.length` that's an integer greater than or
	     * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
	     * @example
	     *
	     * _.isArrayLike([1, 2, 3]);
	     * // => true
	     *
	     * _.isArrayLike(document.body.children);
	     * // => true
	     *
	     * _.isArrayLike('abc');
	     * // => true
	     *
	     * _.isArrayLike(_.noop);
	     * // => false
	     */function isArrayLike(value){return value!=null&&isLength(value.length)&&!isFunction(value);}/**
	     * This method is like `_.isArrayLike` except that it also checks if `value`
	     * is an object.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is an array-like object,
	     *  else `false`.
	     * @example
	     *
	     * _.isArrayLikeObject([1, 2, 3]);
	     * // => true
	     *
	     * _.isArrayLikeObject(document.body.children);
	     * // => true
	     *
	     * _.isArrayLikeObject('abc');
	     * // => false
	     *
	     * _.isArrayLikeObject(_.noop);
	     * // => false
	     */function isArrayLikeObject(value){return isObjectLike(value)&&isArrayLike(value);}/**
	     * Checks if `value` is classified as a boolean primitive or object.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a boolean, else `false`.
	     * @example
	     *
	     * _.isBoolean(false);
	     * // => true
	     *
	     * _.isBoolean(null);
	     * // => false
	     */function isBoolean(value){return value===true||value===false||isObjectLike(value)&&baseGetTag(value)==boolTag;}/**
	     * Checks if `value` is a buffer.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.3.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
	     * @example
	     *
	     * _.isBuffer(new Buffer(2));
	     * // => true
	     *
	     * _.isBuffer(new Uint8Array(2));
	     * // => false
	     */var isBuffer=nativeIsBuffer||stubFalse;/**
	     * Checks if `value` is classified as a `Date` object.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a date object, else `false`.
	     * @example
	     *
	     * _.isDate(new Date);
	     * // => true
	     *
	     * _.isDate('Mon April 23 2012');
	     * // => false
	     */var isDate=nodeIsDate?baseUnary(nodeIsDate):baseIsDate;/**
	     * Checks if `value` is likely a DOM element.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a DOM element, else `false`.
	     * @example
	     *
	     * _.isElement(document.body);
	     * // => true
	     *
	     * _.isElement('<body>');
	     * // => false
	     */function isElement(value){return isObjectLike(value)&&value.nodeType===1&&!isPlainObject(value);}/**
	     * Checks if `value` is an empty object, collection, map, or set.
	     *
	     * Objects are considered empty if they have no own enumerable string keyed
	     * properties.
	     *
	     * Array-like values such as `arguments` objects, arrays, buffers, strings, or
	     * jQuery-like collections are considered empty if they have a `length` of `0`.
	     * Similarly, maps and sets are considered empty if they have a `size` of `0`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is empty, else `false`.
	     * @example
	     *
	     * _.isEmpty(null);
	     * // => true
	     *
	     * _.isEmpty(true);
	     * // => true
	     *
	     * _.isEmpty(1);
	     * // => true
	     *
	     * _.isEmpty([1, 2, 3]);
	     * // => false
	     *
	     * _.isEmpty({ 'a': 1 });
	     * // => false
	     */function isEmpty(value){if(value==null){return true;}if(isArrayLike(value)&&(isArray(value)||typeof value=='string'||typeof value.splice=='function'||isBuffer(value)||isTypedArray(value)||isArguments(value))){return!value.length;}var tag=getTag(value);if(tag==mapTag||tag==setTag){return!value.size;}if(isPrototype(value)){return!baseKeys(value).length;}for(var key in value){if(hasOwnProperty.call(value,key)){return false;}}return true;}/**
	     * Performs a deep comparison between two values to determine if they are
	     * equivalent.
	     *
	     * **Note:** This method supports comparing arrays, array buffers, booleans,
	     * date objects, error objects, maps, numbers, `Object` objects, regexes,
	     * sets, strings, symbols, and typed arrays. `Object` objects are compared
	     * by their own, not inherited, enumerable properties. Functions and DOM
	     * nodes are **not** supported.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to compare.
	     * @param {*} other The other value to compare.
	     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	     * @example
	     *
	     * var object = { 'a': 1 };
	     * var other = { 'a': 1 };
	     *
	     * _.isEqual(object, other);
	     * // => true
	     *
	     * object === other;
	     * // => false
	     */function isEqual(value,other){return baseIsEqual(value,other);}/**
	     * This method is like `_.isEqual` except that it accepts `customizer` which
	     * is invoked to compare values. If `customizer` returns `undefined`, comparisons
	     * are handled by the method instead. The `customizer` is invoked with up to
	     * six arguments: (objValue, othValue [, index|key, object, other, stack]).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to compare.
	     * @param {*} other The other value to compare.
	     * @param {Function} [customizer] The function to customize comparisons.
	     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
	     * @example
	     *
	     * function isGreeting(value) {
	     *   return /^h(?:i|ello)$/.test(value);
	     * }
	     *
	     * function customizer(objValue, othValue) {
	     *   if (isGreeting(objValue) && isGreeting(othValue)) {
	     *     return true;
	     *   }
	     * }
	     *
	     * var array = ['hello', 'goodbye'];
	     * var other = ['hi', 'goodbye'];
	     *
	     * _.isEqualWith(array, other, customizer);
	     * // => true
	     */function isEqualWith(value,other,customizer){customizer=typeof customizer=='function'?customizer:undefined;var result=customizer?customizer(value,other):undefined;return result===undefined?baseIsEqual(value,other,undefined,customizer):!!result;}/**
	     * Checks if `value` is an `Error`, `EvalError`, `RangeError`, `ReferenceError`,
	     * `SyntaxError`, `TypeError`, or `URIError` object.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is an error object, else `false`.
	     * @example
	     *
	     * _.isError(new Error);
	     * // => true
	     *
	     * _.isError(Error);
	     * // => false
	     */function isError(value){if(!isObjectLike(value)){return false;}var tag=baseGetTag(value);return tag==errorTag||tag==domExcTag||typeof value.message=='string'&&typeof value.name=='string'&&!isPlainObject(value);}/**
	     * Checks if `value` is a finite primitive number.
	     *
	     * **Note:** This method is based on
	     * [`Number.isFinite`](https://mdn.io/Number/isFinite).
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a finite number, else `false`.
	     * @example
	     *
	     * _.isFinite(3);
	     * // => true
	     *
	     * _.isFinite(Number.MIN_VALUE);
	     * // => true
	     *
	     * _.isFinite(Infinity);
	     * // => false
	     *
	     * _.isFinite('3');
	     * // => false
	     */function isFinite(value){return typeof value=='number'&&nativeIsFinite(value);}/**
	     * Checks if `value` is classified as a `Function` object.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a function, else `false`.
	     * @example
	     *
	     * _.isFunction(_);
	     * // => true
	     *
	     * _.isFunction(/abc/);
	     * // => false
	     */function isFunction(value){if(!isObject(value)){return false;}// The use of `Object#toString` avoids issues with the `typeof` operator
	// in Safari 9 which returns 'object' for typed arrays and other constructors.
	var tag=baseGetTag(value);return tag==funcTag||tag==genTag||tag==asyncTag||tag==proxyTag;}/**
	     * Checks if `value` is an integer.
	     *
	     * **Note:** This method is based on
	     * [`Number.isInteger`](https://mdn.io/Number/isInteger).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is an integer, else `false`.
	     * @example
	     *
	     * _.isInteger(3);
	     * // => true
	     *
	     * _.isInteger(Number.MIN_VALUE);
	     * // => false
	     *
	     * _.isInteger(Infinity);
	     * // => false
	     *
	     * _.isInteger('3');
	     * // => false
	     */function isInteger(value){return typeof value=='number'&&value==toInteger(value);}/**
	     * Checks if `value` is a valid array-like length.
	     *
	     * **Note:** This method is loosely based on
	     * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
	     * @example
	     *
	     * _.isLength(3);
	     * // => true
	     *
	     * _.isLength(Number.MIN_VALUE);
	     * // => false
	     *
	     * _.isLength(Infinity);
	     * // => false
	     *
	     * _.isLength('3');
	     * // => false
	     */function isLength(value){return typeof value=='number'&&value>-1&&value%1==0&&value<=MAX_SAFE_INTEGER;}/**
	     * Checks if `value` is the
	     * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	     * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	     * @example
	     *
	     * _.isObject({});
	     * // => true
	     *
	     * _.isObject([1, 2, 3]);
	     * // => true
	     *
	     * _.isObject(_.noop);
	     * // => true
	     *
	     * _.isObject(null);
	     * // => false
	     */function isObject(value){var type=typeof value==='undefined'?'undefined':_typeof(value);return value!=null&&(type=='object'||type=='function');}/**
	     * Checks if `value` is object-like. A value is object-like if it's not `null`
	     * and has a `typeof` result of "object".
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	     * @example
	     *
	     * _.isObjectLike({});
	     * // => true
	     *
	     * _.isObjectLike([1, 2, 3]);
	     * // => true
	     *
	     * _.isObjectLike(_.noop);
	     * // => false
	     *
	     * _.isObjectLike(null);
	     * // => false
	     */function isObjectLike(value){return value!=null&&(typeof value==='undefined'?'undefined':_typeof(value))=='object';}/**
	     * Checks if `value` is classified as a `Map` object.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.3.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a map, else `false`.
	     * @example
	     *
	     * _.isMap(new Map);
	     * // => true
	     *
	     * _.isMap(new WeakMap);
	     * // => false
	     */var isMap=nodeIsMap?baseUnary(nodeIsMap):baseIsMap;/**
	     * Performs a partial deep comparison between `object` and `source` to
	     * determine if `object` contains equivalent property values.
	     *
	     * **Note:** This method is equivalent to `_.matches` when `source` is
	     * partially applied.
	     *
	     * Partial comparisons will match empty array and empty object `source`
	     * values against any array or object value, respectively. See `_.isEqual`
	     * for a list of supported value comparisons.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Lang
	     * @param {Object} object The object to inspect.
	     * @param {Object} source The object of property values to match.
	     * @returns {boolean} Returns `true` if `object` is a match, else `false`.
	     * @example
	     *
	     * var object = { 'a': 1, 'b': 2 };
	     *
	     * _.isMatch(object, { 'b': 2 });
	     * // => true
	     *
	     * _.isMatch(object, { 'b': 1 });
	     * // => false
	     */function isMatch(object,source){return object===source||baseIsMatch(object,source,getMatchData(source));}/**
	     * This method is like `_.isMatch` except that it accepts `customizer` which
	     * is invoked to compare values. If `customizer` returns `undefined`, comparisons
	     * are handled by the method instead. The `customizer` is invoked with five
	     * arguments: (objValue, srcValue, index|key, object, source).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {Object} object The object to inspect.
	     * @param {Object} source The object of property values to match.
	     * @param {Function} [customizer] The function to customize comparisons.
	     * @returns {boolean} Returns `true` if `object` is a match, else `false`.
	     * @example
	     *
	     * function isGreeting(value) {
	     *   return /^h(?:i|ello)$/.test(value);
	     * }
	     *
	     * function customizer(objValue, srcValue) {
	     *   if (isGreeting(objValue) && isGreeting(srcValue)) {
	     *     return true;
	     *   }
	     * }
	     *
	     * var object = { 'greeting': 'hello' };
	     * var source = { 'greeting': 'hi' };
	     *
	     * _.isMatchWith(object, source, customizer);
	     * // => true
	     */function isMatchWith(object,source,customizer){customizer=typeof customizer=='function'?customizer:undefined;return baseIsMatch(object,source,getMatchData(source),customizer);}/**
	     * Checks if `value` is `NaN`.
	     *
	     * **Note:** This method is based on
	     * [`Number.isNaN`](https://mdn.io/Number/isNaN) and is not the same as
	     * global [`isNaN`](https://mdn.io/isNaN) which returns `true` for
	     * `undefined` and other non-number values.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
	     * @example
	     *
	     * _.isNaN(NaN);
	     * // => true
	     *
	     * _.isNaN(new Number(NaN));
	     * // => true
	     *
	     * isNaN(undefined);
	     * // => true
	     *
	     * _.isNaN(undefined);
	     * // => false
	     */function isNaN(value){// An `NaN` primitive is the only value that is not equal to itself.
	// Perform the `toStringTag` check first to avoid errors with some
	// ActiveX objects in IE.
	return isNumber(value)&&value!=+value;}/**
	     * Checks if `value` is a pristine native function.
	     *
	     * **Note:** This method can't reliably detect native functions in the presence
	     * of the core-js package because core-js circumvents this kind of detection.
	     * Despite multiple requests, the core-js maintainer has made it clear: any
	     * attempt to fix the detection will be obstructed. As a result, we're left
	     * with little choice but to throw an error. Unfortunately, this also affects
	     * packages, like [babel-polyfill](https://www.npmjs.com/package/babel-polyfill),
	     * which rely on core-js.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a native function,
	     *  else `false`.
	     * @example
	     *
	     * _.isNative(Array.prototype.push);
	     * // => true
	     *
	     * _.isNative(_);
	     * // => false
	     */function isNative(value){if(isMaskable(value)){throw new Error(CORE_ERROR_TEXT);}return baseIsNative(value);}/**
	     * Checks if `value` is `null`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is `null`, else `false`.
	     * @example
	     *
	     * _.isNull(null);
	     * // => true
	     *
	     * _.isNull(void 0);
	     * // => false
	     */function isNull(value){return value===null;}/**
	     * Checks if `value` is `null` or `undefined`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is nullish, else `false`.
	     * @example
	     *
	     * _.isNil(null);
	     * // => true
	     *
	     * _.isNil(void 0);
	     * // => true
	     *
	     * _.isNil(NaN);
	     * // => false
	     */function isNil(value){return value==null;}/**
	     * Checks if `value` is classified as a `Number` primitive or object.
	     *
	     * **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are
	     * classified as numbers, use the `_.isFinite` method.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a number, else `false`.
	     * @example
	     *
	     * _.isNumber(3);
	     * // => true
	     *
	     * _.isNumber(Number.MIN_VALUE);
	     * // => true
	     *
	     * _.isNumber(Infinity);
	     * // => true
	     *
	     * _.isNumber('3');
	     * // => false
	     */function isNumber(value){return typeof value=='number'||isObjectLike(value)&&baseGetTag(value)==numberTag;}/**
	     * Checks if `value` is a plain object, that is, an object created by the
	     * `Object` constructor or one with a `[[Prototype]]` of `null`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.8.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     * }
	     *
	     * _.isPlainObject(new Foo);
	     * // => false
	     *
	     * _.isPlainObject([1, 2, 3]);
	     * // => false
	     *
	     * _.isPlainObject({ 'x': 0, 'y': 0 });
	     * // => true
	     *
	     * _.isPlainObject(Object.create(null));
	     * // => true
	     */function isPlainObject(value){if(!isObjectLike(value)||baseGetTag(value)!=objectTag){return false;}var proto=getPrototype(value);if(proto===null){return true;}var Ctor=hasOwnProperty.call(proto,'constructor')&&proto.constructor;return typeof Ctor=='function'&&Ctor instanceof Ctor&&funcToString.call(Ctor)==objectCtorString;}/**
	     * Checks if `value` is classified as a `RegExp` object.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.1.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a regexp, else `false`.
	     * @example
	     *
	     * _.isRegExp(/abc/);
	     * // => true
	     *
	     * _.isRegExp('/abc/');
	     * // => false
	     */var isRegExp=nodeIsRegExp?baseUnary(nodeIsRegExp):baseIsRegExp;/**
	     * Checks if `value` is a safe integer. An integer is safe if it's an IEEE-754
	     * double precision number which isn't the result of a rounded unsafe integer.
	     *
	     * **Note:** This method is based on
	     * [`Number.isSafeInteger`](https://mdn.io/Number/isSafeInteger).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a safe integer, else `false`.
	     * @example
	     *
	     * _.isSafeInteger(3);
	     * // => true
	     *
	     * _.isSafeInteger(Number.MIN_VALUE);
	     * // => false
	     *
	     * _.isSafeInteger(Infinity);
	     * // => false
	     *
	     * _.isSafeInteger('3');
	     * // => false
	     */function isSafeInteger(value){return isInteger(value)&&value>=-MAX_SAFE_INTEGER&&value<=MAX_SAFE_INTEGER;}/**
	     * Checks if `value` is classified as a `Set` object.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.3.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a set, else `false`.
	     * @example
	     *
	     * _.isSet(new Set);
	     * // => true
	     *
	     * _.isSet(new WeakSet);
	     * // => false
	     */var isSet=nodeIsSet?baseUnary(nodeIsSet):baseIsSet;/**
	     * Checks if `value` is classified as a `String` primitive or object.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a string, else `false`.
	     * @example
	     *
	     * _.isString('abc');
	     * // => true
	     *
	     * _.isString(1);
	     * // => false
	     */function isString(value){return typeof value=='string'||!isArray(value)&&isObjectLike(value)&&baseGetTag(value)==stringTag;}/**
	     * Checks if `value` is classified as a `Symbol` primitive or object.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
	     * @example
	     *
	     * _.isSymbol(Symbol.iterator);
	     * // => true
	     *
	     * _.isSymbol('abc');
	     * // => false
	     */function isSymbol(value){return(typeof value==='undefined'?'undefined':_typeof(value))=='symbol'||isObjectLike(value)&&baseGetTag(value)==symbolTag;}/**
	     * Checks if `value` is classified as a typed array.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
	     * @example
	     *
	     * _.isTypedArray(new Uint8Array);
	     * // => true
	     *
	     * _.isTypedArray([]);
	     * // => false
	     */var isTypedArray=nodeIsTypedArray?baseUnary(nodeIsTypedArray):baseIsTypedArray;/**
	     * Checks if `value` is `undefined`.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
	     * @example
	     *
	     * _.isUndefined(void 0);
	     * // => true
	     *
	     * _.isUndefined(null);
	     * // => false
	     */function isUndefined(value){return value===undefined;}/**
	     * Checks if `value` is classified as a `WeakMap` object.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.3.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a weak map, else `false`.
	     * @example
	     *
	     * _.isWeakMap(new WeakMap);
	     * // => true
	     *
	     * _.isWeakMap(new Map);
	     * // => false
	     */function isWeakMap(value){return isObjectLike(value)&&getTag(value)==weakMapTag;}/**
	     * Checks if `value` is classified as a `WeakSet` object.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.3.0
	     * @category Lang
	     * @param {*} value The value to check.
	     * @returns {boolean} Returns `true` if `value` is a weak set, else `false`.
	     * @example
	     *
	     * _.isWeakSet(new WeakSet);
	     * // => true
	     *
	     * _.isWeakSet(new Set);
	     * // => false
	     */function isWeakSet(value){return isObjectLike(value)&&baseGetTag(value)==weakSetTag;}/**
	     * Checks if `value` is less than `other`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.9.0
	     * @category Lang
	     * @param {*} value The value to compare.
	     * @param {*} other The other value to compare.
	     * @returns {boolean} Returns `true` if `value` is less than `other`,
	     *  else `false`.
	     * @see _.gt
	     * @example
	     *
	     * _.lt(1, 3);
	     * // => true
	     *
	     * _.lt(3, 3);
	     * // => false
	     *
	     * _.lt(3, 1);
	     * // => false
	     */var lt=createRelationalOperation(baseLt);/**
	     * Checks if `value` is less than or equal to `other`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.9.0
	     * @category Lang
	     * @param {*} value The value to compare.
	     * @param {*} other The other value to compare.
	     * @returns {boolean} Returns `true` if `value` is less than or equal to
	     *  `other`, else `false`.
	     * @see _.gte
	     * @example
	     *
	     * _.lte(1, 3);
	     * // => true
	     *
	     * _.lte(3, 3);
	     * // => true
	     *
	     * _.lte(3, 1);
	     * // => false
	     */var lte=createRelationalOperation(function(value,other){return value<=other;});/**
	     * Converts `value` to an array.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Lang
	     * @param {*} value The value to convert.
	     * @returns {Array} Returns the converted array.
	     * @example
	     *
	     * _.toArray({ 'a': 1, 'b': 2 });
	     * // => [1, 2]
	     *
	     * _.toArray('abc');
	     * // => ['a', 'b', 'c']
	     *
	     * _.toArray(1);
	     * // => []
	     *
	     * _.toArray(null);
	     * // => []
	     */function toArray(value){if(!value){return[];}if(isArrayLike(value)){return isString(value)?stringToArray(value):copyArray(value);}if(symIterator&&value[symIterator]){return iteratorToArray(value[symIterator]());}var tag=getTag(value),func=tag==mapTag?mapToArray:tag==setTag?setToArray:values;return func(value);}/**
	     * Converts `value` to a finite number.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.12.0
	     * @category Lang
	     * @param {*} value The value to convert.
	     * @returns {number} Returns the converted number.
	     * @example
	     *
	     * _.toFinite(3.2);
	     * // => 3.2
	     *
	     * _.toFinite(Number.MIN_VALUE);
	     * // => 5e-324
	     *
	     * _.toFinite(Infinity);
	     * // => 1.7976931348623157e+308
	     *
	     * _.toFinite('3.2');
	     * // => 3.2
	     */function toFinite(value){if(!value){return value===0?value:0;}value=toNumber(value);if(value===INFINITY||value===-INFINITY){var sign=value<0?-1:1;return sign*MAX_INTEGER;}return value===value?value:0;}/**
	     * Converts `value` to an integer.
	     *
	     * **Note:** This method is loosely based on
	     * [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to convert.
	     * @returns {number} Returns the converted integer.
	     * @example
	     *
	     * _.toInteger(3.2);
	     * // => 3
	     *
	     * _.toInteger(Number.MIN_VALUE);
	     * // => 0
	     *
	     * _.toInteger(Infinity);
	     * // => 1.7976931348623157e+308
	     *
	     * _.toInteger('3.2');
	     * // => 3
	     */function toInteger(value){var result=toFinite(value),remainder=result%1;return result===result?remainder?result-remainder:result:0;}/**
	     * Converts `value` to an integer suitable for use as the length of an
	     * array-like object.
	     *
	     * **Note:** This method is based on
	     * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to convert.
	     * @returns {number} Returns the converted integer.
	     * @example
	     *
	     * _.toLength(3.2);
	     * // => 3
	     *
	     * _.toLength(Number.MIN_VALUE);
	     * // => 0
	     *
	     * _.toLength(Infinity);
	     * // => 4294967295
	     *
	     * _.toLength('3.2');
	     * // => 3
	     */function toLength(value){return value?baseClamp(toInteger(value),0,MAX_ARRAY_LENGTH):0;}/**
	     * Converts `value` to a number.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to process.
	     * @returns {number} Returns the number.
	     * @example
	     *
	     * _.toNumber(3.2);
	     * // => 3.2
	     *
	     * _.toNumber(Number.MIN_VALUE);
	     * // => 5e-324
	     *
	     * _.toNumber(Infinity);
	     * // => Infinity
	     *
	     * _.toNumber('3.2');
	     * // => 3.2
	     */function toNumber(value){if(typeof value=='number'){return value;}if(isSymbol(value)){return NAN;}if(isObject(value)){var other=typeof value.valueOf=='function'?value.valueOf():value;value=isObject(other)?other+'':other;}if(typeof value!='string'){return value===0?value:+value;}value=value.replace(reTrim,'');var isBinary=reIsBinary.test(value);return isBinary||reIsOctal.test(value)?freeParseInt(value.slice(2),isBinary?2:8):reIsBadHex.test(value)?NAN:+value;}/**
	     * Converts `value` to a plain object flattening inherited enumerable string
	     * keyed properties of `value` to own properties of the plain object.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Lang
	     * @param {*} value The value to convert.
	     * @returns {Object} Returns the converted plain object.
	     * @example
	     *
	     * function Foo() {
	     *   this.b = 2;
	     * }
	     *
	     * Foo.prototype.c = 3;
	     *
	     * _.assign({ 'a': 1 }, new Foo);
	     * // => { 'a': 1, 'b': 2 }
	     *
	     * _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
	     * // => { 'a': 1, 'b': 2, 'c': 3 }
	     */function toPlainObject(value){return copyObject(value,keysIn(value));}/**
	     * Converts `value` to a safe integer. A safe integer can be compared and
	     * represented correctly.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to convert.
	     * @returns {number} Returns the converted integer.
	     * @example
	     *
	     * _.toSafeInteger(3.2);
	     * // => 3
	     *
	     * _.toSafeInteger(Number.MIN_VALUE);
	     * // => 0
	     *
	     * _.toSafeInteger(Infinity);
	     * // => 9007199254740991
	     *
	     * _.toSafeInteger('3.2');
	     * // => 3
	     */function toSafeInteger(value){return baseClamp(toInteger(value),-MAX_SAFE_INTEGER,MAX_SAFE_INTEGER);}/**
	     * Converts `value` to a string. An empty string is returned for `null`
	     * and `undefined` values. The sign of `-0` is preserved.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Lang
	     * @param {*} value The value to convert.
	     * @returns {string} Returns the converted string.
	     * @example
	     *
	     * _.toString(null);
	     * // => ''
	     *
	     * _.toString(-0);
	     * // => '-0'
	     *
	     * _.toString([1, 2, 3]);
	     * // => '1,2,3'
	     */function toString(value){return value==null?'':baseToString(value);}/*------------------------------------------------------------------------*//**
	     * Assigns own enumerable string keyed properties of source objects to the
	     * destination object. Source objects are applied from left to right.
	     * Subsequent sources overwrite property assignments of previous sources.
	     *
	     * **Note:** This method mutates `object` and is loosely based on
	     * [`Object.assign`](https://mdn.io/Object/assign).
	     *
	     * @static
	     * @memberOf _
	     * @since 0.10.0
	     * @category Object
	     * @param {Object} object The destination object.
	     * @param {...Object} [sources] The source objects.
	     * @returns {Object} Returns `object`.
	     * @see _.assignIn
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     * }
	     *
	     * function Bar() {
	     *   this.c = 3;
	     * }
	     *
	     * Foo.prototype.b = 2;
	     * Bar.prototype.d = 4;
	     *
	     * _.assign({ 'a': 0 }, new Foo, new Bar);
	     * // => { 'a': 1, 'c': 3 }
	     */var assign=createAssigner(function(object,source){if(isPrototype(source)||isArrayLike(source)){copyObject(source,keys(source),object);return;}for(var key in source){if(hasOwnProperty.call(source,key)){assignValue(object,key,source[key]);}}});/**
	     * This method is like `_.assign` except that it iterates over own and
	     * inherited source properties.
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @alias extend
	     * @category Object
	     * @param {Object} object The destination object.
	     * @param {...Object} [sources] The source objects.
	     * @returns {Object} Returns `object`.
	     * @see _.assign
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     * }
	     *
	     * function Bar() {
	     *   this.c = 3;
	     * }
	     *
	     * Foo.prototype.b = 2;
	     * Bar.prototype.d = 4;
	     *
	     * _.assignIn({ 'a': 0 }, new Foo, new Bar);
	     * // => { 'a': 1, 'b': 2, 'c': 3, 'd': 4 }
	     */var assignIn=createAssigner(function(object,source){copyObject(source,keysIn(source),object);});/**
	     * This method is like `_.assignIn` except that it accepts `customizer`
	     * which is invoked to produce the assigned values. If `customizer` returns
	     * `undefined`, assignment is handled by the method instead. The `customizer`
	     * is invoked with five arguments: (objValue, srcValue, key, object, source).
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @alias extendWith
	     * @category Object
	     * @param {Object} object The destination object.
	     * @param {...Object} sources The source objects.
	     * @param {Function} [customizer] The function to customize assigned values.
	     * @returns {Object} Returns `object`.
	     * @see _.assignWith
	     * @example
	     *
	     * function customizer(objValue, srcValue) {
	     *   return _.isUndefined(objValue) ? srcValue : objValue;
	     * }
	     *
	     * var defaults = _.partialRight(_.assignInWith, customizer);
	     *
	     * defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
	     * // => { 'a': 1, 'b': 2 }
	     */var assignInWith=createAssigner(function(object,source,srcIndex,customizer){copyObject(source,keysIn(source),object,customizer);});/**
	     * This method is like `_.assign` except that it accepts `customizer`
	     * which is invoked to produce the assigned values. If `customizer` returns
	     * `undefined`, assignment is handled by the method instead. The `customizer`
	     * is invoked with five arguments: (objValue, srcValue, key, object, source).
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Object
	     * @param {Object} object The destination object.
	     * @param {...Object} sources The source objects.
	     * @param {Function} [customizer] The function to customize assigned values.
	     * @returns {Object} Returns `object`.
	     * @see _.assignInWith
	     * @example
	     *
	     * function customizer(objValue, srcValue) {
	     *   return _.isUndefined(objValue) ? srcValue : objValue;
	     * }
	     *
	     * var defaults = _.partialRight(_.assignWith, customizer);
	     *
	     * defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
	     * // => { 'a': 1, 'b': 2 }
	     */var assignWith=createAssigner(function(object,source,srcIndex,customizer){copyObject(source,keys(source),object,customizer);});/**
	     * Creates an array of values corresponding to `paths` of `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 1.0.0
	     * @category Object
	     * @param {Object} object The object to iterate over.
	     * @param {...(string|string[])} [paths] The property paths to pick.
	     * @returns {Array} Returns the picked values.
	     * @example
	     *
	     * var object = { 'a': [{ 'b': { 'c': 3 } }, 4] };
	     *
	     * _.at(object, ['a[0].b.c', 'a[1]']);
	     * // => [3, 4]
	     */var at=flatRest(baseAt);/**
	     * Creates an object that inherits from the `prototype` object. If a
	     * `properties` object is given, its own enumerable string keyed properties
	     * are assigned to the created object.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.3.0
	     * @category Object
	     * @param {Object} prototype The object to inherit from.
	     * @param {Object} [properties] The properties to assign to the object.
	     * @returns {Object} Returns the new object.
	     * @example
	     *
	     * function Shape() {
	     *   this.x = 0;
	     *   this.y = 0;
	     * }
	     *
	     * function Circle() {
	     *   Shape.call(this);
	     * }
	     *
	     * Circle.prototype = _.create(Shape.prototype, {
	     *   'constructor': Circle
	     * });
	     *
	     * var circle = new Circle;
	     * circle instanceof Circle;
	     * // => true
	     *
	     * circle instanceof Shape;
	     * // => true
	     */function create(prototype,properties){var result=baseCreate(prototype);return properties==null?result:baseAssign(result,properties);}/**
	     * Assigns own and inherited enumerable string keyed properties of source
	     * objects to the destination object for all destination properties that
	     * resolve to `undefined`. Source objects are applied from left to right.
	     * Once a property is set, additional values of the same property are ignored.
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Object
	     * @param {Object} object The destination object.
	     * @param {...Object} [sources] The source objects.
	     * @returns {Object} Returns `object`.
	     * @see _.defaultsDeep
	     * @example
	     *
	     * _.defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
	     * // => { 'a': 1, 'b': 2 }
	     */var defaults=baseRest(function(args){args.push(undefined,assignInDefaults);return apply(assignInWith,undefined,args);});/**
	     * This method is like `_.defaults` except that it recursively assigns
	     * default properties.
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.10.0
	     * @category Object
	     * @param {Object} object The destination object.
	     * @param {...Object} [sources] The source objects.
	     * @returns {Object} Returns `object`.
	     * @see _.defaults
	     * @example
	     *
	     * _.defaultsDeep({ 'a': { 'b': 2 } }, { 'a': { 'b': 1, 'c': 3 } });
	     * // => { 'a': { 'b': 2, 'c': 3 } }
	     */var defaultsDeep=baseRest(function(args){args.push(undefined,mergeDefaults);return apply(mergeWith,undefined,args);});/**
	     * This method is like `_.find` except that it returns the key of the first
	     * element `predicate` returns truthy for instead of the element itself.
	     *
	     * @static
	     * @memberOf _
	     * @since 1.1.0
	     * @category Object
	     * @param {Object} object The object to inspect.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @returns {string|undefined} Returns the key of the matched element,
	     *  else `undefined`.
	     * @example
	     *
	     * var users = {
	     *   'barney':  { 'age': 36, 'active': true },
	     *   'fred':    { 'age': 40, 'active': false },
	     *   'pebbles': { 'age': 1,  'active': true }
	     * };
	     *
	     * _.findKey(users, function(o) { return o.age < 40; });
	     * // => 'barney' (iteration order is not guaranteed)
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.findKey(users, { 'age': 1, 'active': true });
	     * // => 'pebbles'
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.findKey(users, ['active', false]);
	     * // => 'fred'
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.findKey(users, 'active');
	     * // => 'barney'
	     */function findKey(object,predicate){return baseFindKey(object,getIteratee(predicate,3),baseForOwn);}/**
	     * This method is like `_.findKey` except that it iterates over elements of
	     * a collection in the opposite order.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.0.0
	     * @category Object
	     * @param {Object} object The object to inspect.
	     * @param {Function} [predicate=_.identity] The function invoked per iteration.
	     * @returns {string|undefined} Returns the key of the matched element,
	     *  else `undefined`.
	     * @example
	     *
	     * var users = {
	     *   'barney':  { 'age': 36, 'active': true },
	     *   'fred':    { 'age': 40, 'active': false },
	     *   'pebbles': { 'age': 1,  'active': true }
	     * };
	     *
	     * _.findLastKey(users, function(o) { return o.age < 40; });
	     * // => returns 'pebbles' assuming `_.findKey` returns 'barney'
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.findLastKey(users, { 'age': 36, 'active': true });
	     * // => 'barney'
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.findLastKey(users, ['active', false]);
	     * // => 'fred'
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.findLastKey(users, 'active');
	     * // => 'pebbles'
	     */function findLastKey(object,predicate){return baseFindKey(object,getIteratee(predicate,3),baseForOwnRight);}/**
	     * Iterates over own and inherited enumerable string keyed properties of an
	     * object and invokes `iteratee` for each property. The iteratee is invoked
	     * with three arguments: (value, key, object). Iteratee functions may exit
	     * iteration early by explicitly returning `false`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.3.0
	     * @category Object
	     * @param {Object} object The object to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Object} Returns `object`.
	     * @see _.forInRight
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     *   this.b = 2;
	     * }
	     *
	     * Foo.prototype.c = 3;
	     *
	     * _.forIn(new Foo, function(value, key) {
	     *   console.log(key);
	     * });
	     * // => Logs 'a', 'b', then 'c' (iteration order is not guaranteed).
	     */function forIn(object,iteratee){return object==null?object:baseFor(object,getIteratee(iteratee,3),keysIn);}/**
	     * This method is like `_.forIn` except that it iterates over properties of
	     * `object` in the opposite order.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.0.0
	     * @category Object
	     * @param {Object} object The object to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Object} Returns `object`.
	     * @see _.forIn
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     *   this.b = 2;
	     * }
	     *
	     * Foo.prototype.c = 3;
	     *
	     * _.forInRight(new Foo, function(value, key) {
	     *   console.log(key);
	     * });
	     * // => Logs 'c', 'b', then 'a' assuming `_.forIn` logs 'a', 'b', then 'c'.
	     */function forInRight(object,iteratee){return object==null?object:baseForRight(object,getIteratee(iteratee,3),keysIn);}/**
	     * Iterates over own enumerable string keyed properties of an object and
	     * invokes `iteratee` for each property. The iteratee is invoked with three
	     * arguments: (value, key, object). Iteratee functions may exit iteration
	     * early by explicitly returning `false`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.3.0
	     * @category Object
	     * @param {Object} object The object to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Object} Returns `object`.
	     * @see _.forOwnRight
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     *   this.b = 2;
	     * }
	     *
	     * Foo.prototype.c = 3;
	     *
	     * _.forOwn(new Foo, function(value, key) {
	     *   console.log(key);
	     * });
	     * // => Logs 'a' then 'b' (iteration order is not guaranteed).
	     */function forOwn(object,iteratee){return object&&baseForOwn(object,getIteratee(iteratee,3));}/**
	     * This method is like `_.forOwn` except that it iterates over properties of
	     * `object` in the opposite order.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.0.0
	     * @category Object
	     * @param {Object} object The object to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Object} Returns `object`.
	     * @see _.forOwn
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     *   this.b = 2;
	     * }
	     *
	     * Foo.prototype.c = 3;
	     *
	     * _.forOwnRight(new Foo, function(value, key) {
	     *   console.log(key);
	     * });
	     * // => Logs 'b' then 'a' assuming `_.forOwn` logs 'a' then 'b'.
	     */function forOwnRight(object,iteratee){return object&&baseForOwnRight(object,getIteratee(iteratee,3));}/**
	     * Creates an array of function property names from own enumerable properties
	     * of `object`.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Object
	     * @param {Object} object The object to inspect.
	     * @returns {Array} Returns the function names.
	     * @see _.functionsIn
	     * @example
	     *
	     * function Foo() {
	     *   this.a = _.constant('a');
	     *   this.b = _.constant('b');
	     * }
	     *
	     * Foo.prototype.c = _.constant('c');
	     *
	     * _.functions(new Foo);
	     * // => ['a', 'b']
	     */function functions(object){return object==null?[]:baseFunctions(object,keys(object));}/**
	     * Creates an array of function property names from own and inherited
	     * enumerable properties of `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Object
	     * @param {Object} object The object to inspect.
	     * @returns {Array} Returns the function names.
	     * @see _.functions
	     * @example
	     *
	     * function Foo() {
	     *   this.a = _.constant('a');
	     *   this.b = _.constant('b');
	     * }
	     *
	     * Foo.prototype.c = _.constant('c');
	     *
	     * _.functionsIn(new Foo);
	     * // => ['a', 'b', 'c']
	     */function functionsIn(object){return object==null?[]:baseFunctions(object,keysIn(object));}/**
	     * Gets the value at `path` of `object`. If the resolved value is
	     * `undefined`, the `defaultValue` is returned in its place.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.7.0
	     * @category Object
	     * @param {Object} object The object to query.
	     * @param {Array|string} path The path of the property to get.
	     * @param {*} [defaultValue] The value returned for `undefined` resolved values.
	     * @returns {*} Returns the resolved value.
	     * @example
	     *
	     * var object = { 'a': [{ 'b': { 'c': 3 } }] };
	     *
	     * _.get(object, 'a[0].b.c');
	     * // => 3
	     *
	     * _.get(object, ['a', '0', 'b', 'c']);
	     * // => 3
	     *
	     * _.get(object, 'a.b.c', 'default');
	     * // => 'default'
	     */function get(object,path,defaultValue){var result=object==null?undefined:baseGet(object,path);return result===undefined?defaultValue:result;}/**
	     * Checks if `path` is a direct property of `object`.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Object
	     * @param {Object} object The object to query.
	     * @param {Array|string} path The path to check.
	     * @returns {boolean} Returns `true` if `path` exists, else `false`.
	     * @example
	     *
	     * var object = { 'a': { 'b': 2 } };
	     * var other = _.create({ 'a': _.create({ 'b': 2 }) });
	     *
	     * _.has(object, 'a');
	     * // => true
	     *
	     * _.has(object, 'a.b');
	     * // => true
	     *
	     * _.has(object, ['a', 'b']);
	     * // => true
	     *
	     * _.has(other, 'a');
	     * // => false
	     */function has(object,path){return object!=null&&hasPath(object,path,baseHas);}/**
	     * Checks if `path` is a direct or inherited property of `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Object
	     * @param {Object} object The object to query.
	     * @param {Array|string} path The path to check.
	     * @returns {boolean} Returns `true` if `path` exists, else `false`.
	     * @example
	     *
	     * var object = _.create({ 'a': _.create({ 'b': 2 }) });
	     *
	     * _.hasIn(object, 'a');
	     * // => true
	     *
	     * _.hasIn(object, 'a.b');
	     * // => true
	     *
	     * _.hasIn(object, ['a', 'b']);
	     * // => true
	     *
	     * _.hasIn(object, 'b');
	     * // => false
	     */function hasIn(object,path){return object!=null&&hasPath(object,path,baseHasIn);}/**
	     * Creates an object composed of the inverted keys and values of `object`.
	     * If `object` contains duplicate values, subsequent values overwrite
	     * property assignments of previous values.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.7.0
	     * @category Object
	     * @param {Object} object The object to invert.
	     * @returns {Object} Returns the new inverted object.
	     * @example
	     *
	     * var object = { 'a': 1, 'b': 2, 'c': 1 };
	     *
	     * _.invert(object);
	     * // => { '1': 'c', '2': 'b' }
	     */var invert=createInverter(function(result,value,key){result[value]=key;},constant(identity));/**
	     * This method is like `_.invert` except that the inverted object is generated
	     * from the results of running each element of `object` thru `iteratee`. The
	     * corresponding inverted value of each inverted key is an array of keys
	     * responsible for generating the inverted value. The iteratee is invoked
	     * with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.1.0
	     * @category Object
	     * @param {Object} object The object to invert.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {Object} Returns the new inverted object.
	     * @example
	     *
	     * var object = { 'a': 1, 'b': 2, 'c': 1 };
	     *
	     * _.invertBy(object);
	     * // => { '1': ['a', 'c'], '2': ['b'] }
	     *
	     * _.invertBy(object, function(value) {
	     *   return 'group' + value;
	     * });
	     * // => { 'group1': ['a', 'c'], 'group2': ['b'] }
	     */var invertBy=createInverter(function(result,value,key){if(hasOwnProperty.call(result,value)){result[value].push(key);}else{result[value]=[key];}},getIteratee);/**
	     * Invokes the method at `path` of `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Object
	     * @param {Object} object The object to query.
	     * @param {Array|string} path The path of the method to invoke.
	     * @param {...*} [args] The arguments to invoke the method with.
	     * @returns {*} Returns the result of the invoked method.
	     * @example
	     *
	     * var object = { 'a': [{ 'b': { 'c': [1, 2, 3, 4] } }] };
	     *
	     * _.invoke(object, 'a[0].b.c.slice', 1, 3);
	     * // => [2, 3]
	     */var invoke=baseRest(baseInvoke);/**
	     * Creates an array of the own enumerable property names of `object`.
	     *
	     * **Note:** Non-object values are coerced to objects. See the
	     * [ES spec](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
	     * for more details.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Object
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the array of property names.
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     *   this.b = 2;
	     * }
	     *
	     * Foo.prototype.c = 3;
	     *
	     * _.keys(new Foo);
	     * // => ['a', 'b'] (iteration order is not guaranteed)
	     *
	     * _.keys('hi');
	     * // => ['0', '1']
	     */function keys(object){return isArrayLike(object)?arrayLikeKeys(object):baseKeys(object);}/**
	     * Creates an array of the own and inherited enumerable property names of `object`.
	     *
	     * **Note:** Non-object values are coerced to objects.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Object
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the array of property names.
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     *   this.b = 2;
	     * }
	     *
	     * Foo.prototype.c = 3;
	     *
	     * _.keysIn(new Foo);
	     * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
	     */function keysIn(object){return isArrayLike(object)?arrayLikeKeys(object,true):baseKeysIn(object);}/**
	     * The opposite of `_.mapValues`; this method creates an object with the
	     * same values as `object` and keys generated by running each own enumerable
	     * string keyed property of `object` thru `iteratee`. The iteratee is invoked
	     * with three arguments: (value, key, object).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.8.0
	     * @category Object
	     * @param {Object} object The object to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Object} Returns the new mapped object.
	     * @see _.mapValues
	     * @example
	     *
	     * _.mapKeys({ 'a': 1, 'b': 2 }, function(value, key) {
	     *   return key + value;
	     * });
	     * // => { 'a1': 1, 'b2': 2 }
	     */function mapKeys(object,iteratee){var result={};iteratee=getIteratee(iteratee,3);baseForOwn(object,function(value,key,object){baseAssignValue(result,iteratee(value,key,object),value);});return result;}/**
	     * Creates an object with the same keys as `object` and values generated
	     * by running each own enumerable string keyed property of `object` thru
	     * `iteratee`. The iteratee is invoked with three arguments:
	     * (value, key, object).
	     *
	     * @static
	     * @memberOf _
	     * @since 2.4.0
	     * @category Object
	     * @param {Object} object The object to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Object} Returns the new mapped object.
	     * @see _.mapKeys
	     * @example
	     *
	     * var users = {
	     *   'fred':    { 'user': 'fred',    'age': 40 },
	     *   'pebbles': { 'user': 'pebbles', 'age': 1 }
	     * };
	     *
	     * _.mapValues(users, function(o) { return o.age; });
	     * // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.mapValues(users, 'age');
	     * // => { 'fred': 40, 'pebbles': 1 } (iteration order is not guaranteed)
	     */function mapValues(object,iteratee){var result={};iteratee=getIteratee(iteratee,3);baseForOwn(object,function(value,key,object){baseAssignValue(result,key,iteratee(value,key,object));});return result;}/**
	     * This method is like `_.assign` except that it recursively merges own and
	     * inherited enumerable string keyed properties of source objects into the
	     * destination object. Source properties that resolve to `undefined` are
	     * skipped if a destination value exists. Array and plain object properties
	     * are merged recursively. Other objects and value types are overridden by
	     * assignment. Source objects are applied from left to right. Subsequent
	     * sources overwrite property assignments of previous sources.
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.5.0
	     * @category Object
	     * @param {Object} object The destination object.
	     * @param {...Object} [sources] The source objects.
	     * @returns {Object} Returns `object`.
	     * @example
	     *
	     * var object = {
	     *   'a': [{ 'b': 2 }, { 'd': 4 }]
	     * };
	     *
	     * var other = {
	     *   'a': [{ 'c': 3 }, { 'e': 5 }]
	     * };
	     *
	     * _.merge(object, other);
	     * // => { 'a': [{ 'b': 2, 'c': 3 }, { 'd': 4, 'e': 5 }] }
	     */var merge=createAssigner(function(object,source,srcIndex){baseMerge(object,source,srcIndex);});/**
	     * This method is like `_.merge` except that it accepts `customizer` which
	     * is invoked to produce the merged values of the destination and source
	     * properties. If `customizer` returns `undefined`, merging is handled by the
	     * method instead. The `customizer` is invoked with six arguments:
	     * (objValue, srcValue, key, object, source, stack).
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Object
	     * @param {Object} object The destination object.
	     * @param {...Object} sources The source objects.
	     * @param {Function} customizer The function to customize assigned values.
	     * @returns {Object} Returns `object`.
	     * @example
	     *
	     * function customizer(objValue, srcValue) {
	     *   if (_.isArray(objValue)) {
	     *     return objValue.concat(srcValue);
	     *   }
	     * }
	     *
	     * var object = { 'a': [1], 'b': [2] };
	     * var other = { 'a': [3], 'b': [4] };
	     *
	     * _.mergeWith(object, other, customizer);
	     * // => { 'a': [1, 3], 'b': [2, 4] }
	     */var mergeWith=createAssigner(function(object,source,srcIndex,customizer){baseMerge(object,source,srcIndex,customizer);});/**
	     * The opposite of `_.pick`; this method creates an object composed of the
	     * own and inherited enumerable property paths of `object` that are not omitted.
	     *
	     * **Note:** This method is considerably slower than `_.pick`.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Object
	     * @param {Object} object The source object.
	     * @param {...(string|string[])} [paths] The property paths to omit.
	     * @returns {Object} Returns the new object.
	     * @example
	     *
	     * var object = { 'a': 1, 'b': '2', 'c': 3 };
	     *
	     * _.omit(object, ['a', 'c']);
	     * // => { 'b': '2' }
	     */var omit=flatRest(function(object,paths){var result={};if(object==null){return result;}var isDeep=false;paths=arrayMap(paths,function(path){path=castPath(path,object);isDeep||(isDeep=path.length>1);return path;});copyObject(object,getAllKeysIn(object),result);if(isDeep){result=baseClone(result,CLONE_DEEP_FLAG|CLONE_FLAT_FLAG|CLONE_SYMBOLS_FLAG);}var length=paths.length;while(length--){baseUnset(result,paths[length]);}return result;});/**
	     * The opposite of `_.pickBy`; this method creates an object composed of
	     * the own and inherited enumerable string keyed properties of `object` that
	     * `predicate` doesn't return truthy for. The predicate is invoked with two
	     * arguments: (value, key).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Object
	     * @param {Object} object The source object.
	     * @param {Function} [predicate=_.identity] The function invoked per property.
	     * @returns {Object} Returns the new object.
	     * @example
	     *
	     * var object = { 'a': 1, 'b': '2', 'c': 3 };
	     *
	     * _.omitBy(object, _.isNumber);
	     * // => { 'b': '2' }
	     */function omitBy(object,predicate){return pickBy(object,negate(getIteratee(predicate)));}/**
	     * Creates an object composed of the picked `object` properties.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Object
	     * @param {Object} object The source object.
	     * @param {...(string|string[])} [paths] The property paths to pick.
	     * @returns {Object} Returns the new object.
	     * @example
	     *
	     * var object = { 'a': 1, 'b': '2', 'c': 3 };
	     *
	     * _.pick(object, ['a', 'c']);
	     * // => { 'a': 1, 'c': 3 }
	     */var pick=flatRest(function(object,paths){return object==null?{}:basePick(object,paths);});/**
	     * Creates an object composed of the `object` properties `predicate` returns
	     * truthy for. The predicate is invoked with two arguments: (value, key).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Object
	     * @param {Object} object The source object.
	     * @param {Function} [predicate=_.identity] The function invoked per property.
	     * @returns {Object} Returns the new object.
	     * @example
	     *
	     * var object = { 'a': 1, 'b': '2', 'c': 3 };
	     *
	     * _.pickBy(object, _.isNumber);
	     * // => { 'a': 1, 'c': 3 }
	     */function pickBy(object,predicate){if(object==null){return{};}var props=arrayMap(getAllKeysIn(object),function(prop){return[prop];});predicate=getIteratee(predicate);return basePickBy(object,props,function(value,path){return predicate(value,path[0]);});}/**
	     * This method is like `_.get` except that if the resolved value is a
	     * function it's invoked with the `this` binding of its parent object and
	     * its result is returned.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Object
	     * @param {Object} object The object to query.
	     * @param {Array|string} path The path of the property to resolve.
	     * @param {*} [defaultValue] The value returned for `undefined` resolved values.
	     * @returns {*} Returns the resolved value.
	     * @example
	     *
	     * var object = { 'a': [{ 'b': { 'c1': 3, 'c2': _.constant(4) } }] };
	     *
	     * _.result(object, 'a[0].b.c1');
	     * // => 3
	     *
	     * _.result(object, 'a[0].b.c2');
	     * // => 4
	     *
	     * _.result(object, 'a[0].b.c3', 'default');
	     * // => 'default'
	     *
	     * _.result(object, 'a[0].b.c3', _.constant('default'));
	     * // => 'default'
	     */function result(object,path,defaultValue){path=castPath(path,object);var index=-1,length=path.length;// Ensure the loop is entered when path is empty.
	if(!length){length=1;object=undefined;}while(++index<length){var value=object==null?undefined:object[toKey(path[index])];if(value===undefined){index=length;value=defaultValue;}object=isFunction(value)?value.call(object):value;}return object;}/**
	     * Sets the value at `path` of `object`. If a portion of `path` doesn't exist,
	     * it's created. Arrays are created for missing index properties while objects
	     * are created for all other missing properties. Use `_.setWith` to customize
	     * `path` creation.
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.7.0
	     * @category Object
	     * @param {Object} object The object to modify.
	     * @param {Array|string} path The path of the property to set.
	     * @param {*} value The value to set.
	     * @returns {Object} Returns `object`.
	     * @example
	     *
	     * var object = { 'a': [{ 'b': { 'c': 3 } }] };
	     *
	     * _.set(object, 'a[0].b.c', 4);
	     * console.log(object.a[0].b.c);
	     * // => 4
	     *
	     * _.set(object, ['x', '0', 'y', 'z'], 5);
	     * console.log(object.x[0].y.z);
	     * // => 5
	     */function set(object,path,value){return object==null?object:baseSet(object,path,value);}/**
	     * This method is like `_.set` except that it accepts `customizer` which is
	     * invoked to produce the objects of `path`.  If `customizer` returns `undefined`
	     * path creation is handled by the method instead. The `customizer` is invoked
	     * with three arguments: (nsValue, key, nsObject).
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Object
	     * @param {Object} object The object to modify.
	     * @param {Array|string} path The path of the property to set.
	     * @param {*} value The value to set.
	     * @param {Function} [customizer] The function to customize assigned values.
	     * @returns {Object} Returns `object`.
	     * @example
	     *
	     * var object = {};
	     *
	     * _.setWith(object, '[0][1]', 'a', Object);
	     * // => { '0': { '1': 'a' } }
	     */function setWith(object,path,value,customizer){customizer=typeof customizer=='function'?customizer:undefined;return object==null?object:baseSet(object,path,value,customizer);}/**
	     * Creates an array of own enumerable string keyed-value pairs for `object`
	     * which can be consumed by `_.fromPairs`. If `object` is a map or set, its
	     * entries are returned.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @alias entries
	     * @category Object
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the key-value pairs.
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     *   this.b = 2;
	     * }
	     *
	     * Foo.prototype.c = 3;
	     *
	     * _.toPairs(new Foo);
	     * // => [['a', 1], ['b', 2]] (iteration order is not guaranteed)
	     */var toPairs=createToPairs(keys);/**
	     * Creates an array of own and inherited enumerable string keyed-value pairs
	     * for `object` which can be consumed by `_.fromPairs`. If `object` is a map
	     * or set, its entries are returned.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @alias entriesIn
	     * @category Object
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the key-value pairs.
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     *   this.b = 2;
	     * }
	     *
	     * Foo.prototype.c = 3;
	     *
	     * _.toPairsIn(new Foo);
	     * // => [['a', 1], ['b', 2], ['c', 3]] (iteration order is not guaranteed)
	     */var toPairsIn=createToPairs(keysIn);/**
	     * An alternative to `_.reduce`; this method transforms `object` to a new
	     * `accumulator` object which is the result of running each of its own
	     * enumerable string keyed properties thru `iteratee`, with each invocation
	     * potentially mutating the `accumulator` object. If `accumulator` is not
	     * provided, a new object with the same `[[Prototype]]` will be used. The
	     * iteratee is invoked with four arguments: (accumulator, value, key, object).
	     * Iteratee functions may exit iteration early by explicitly returning `false`.
	     *
	     * @static
	     * @memberOf _
	     * @since 1.3.0
	     * @category Object
	     * @param {Object} object The object to iterate over.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @param {*} [accumulator] The custom accumulator value.
	     * @returns {*} Returns the accumulated value.
	     * @example
	     *
	     * _.transform([2, 3, 4], function(result, n) {
	     *   result.push(n *= n);
	     *   return n % 2 == 0;
	     * }, []);
	     * // => [4, 9]
	     *
	     * _.transform({ 'a': 1, 'b': 2, 'c': 1 }, function(result, value, key) {
	     *   (result[value] || (result[value] = [])).push(key);
	     * }, {});
	     * // => { '1': ['a', 'c'], '2': ['b'] }
	     */function transform(object,iteratee,accumulator){var isArr=isArray(object),isArrLike=isArr||isBuffer(object)||isTypedArray(object);iteratee=getIteratee(iteratee,4);if(accumulator==null){var Ctor=object&&object.constructor;if(isArrLike){accumulator=isArr?new Ctor():[];}else if(isObject(object)){accumulator=isFunction(Ctor)?baseCreate(getPrototype(object)):{};}else{accumulator={};}}(isArrLike?arrayEach:baseForOwn)(object,function(value,index,object){return iteratee(accumulator,value,index,object);});return accumulator;}/**
	     * Removes the property at `path` of `object`.
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Object
	     * @param {Object} object The object to modify.
	     * @param {Array|string} path The path of the property to unset.
	     * @returns {boolean} Returns `true` if the property is deleted, else `false`.
	     * @example
	     *
	     * var object = { 'a': [{ 'b': { 'c': 7 } }] };
	     * _.unset(object, 'a[0].b.c');
	     * // => true
	     *
	     * console.log(object);
	     * // => { 'a': [{ 'b': {} }] };
	     *
	     * _.unset(object, ['a', '0', 'b', 'c']);
	     * // => true
	     *
	     * console.log(object);
	     * // => { 'a': [{ 'b': {} }] };
	     */function unset(object,path){return object==null?true:baseUnset(object,path);}/**
	     * This method is like `_.set` except that accepts `updater` to produce the
	     * value to set. Use `_.updateWith` to customize `path` creation. The `updater`
	     * is invoked with one argument: (value).
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.6.0
	     * @category Object
	     * @param {Object} object The object to modify.
	     * @param {Array|string} path The path of the property to set.
	     * @param {Function} updater The function to produce the updated value.
	     * @returns {Object} Returns `object`.
	     * @example
	     *
	     * var object = { 'a': [{ 'b': { 'c': 3 } }] };
	     *
	     * _.update(object, 'a[0].b.c', function(n) { return n * n; });
	     * console.log(object.a[0].b.c);
	     * // => 9
	     *
	     * _.update(object, 'x[0].y.z', function(n) { return n ? n + 1 : 0; });
	     * console.log(object.x[0].y.z);
	     * // => 0
	     */function update(object,path,updater){return object==null?object:baseUpdate(object,path,castFunction(updater));}/**
	     * This method is like `_.update` except that it accepts `customizer` which is
	     * invoked to produce the objects of `path`.  If `customizer` returns `undefined`
	     * path creation is handled by the method instead. The `customizer` is invoked
	     * with three arguments: (nsValue, key, nsObject).
	     *
	     * **Note:** This method mutates `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.6.0
	     * @category Object
	     * @param {Object} object The object to modify.
	     * @param {Array|string} path The path of the property to set.
	     * @param {Function} updater The function to produce the updated value.
	     * @param {Function} [customizer] The function to customize assigned values.
	     * @returns {Object} Returns `object`.
	     * @example
	     *
	     * var object = {};
	     *
	     * _.updateWith(object, '[0][1]', _.constant('a'), Object);
	     * // => { '0': { '1': 'a' } }
	     */function updateWith(object,path,updater,customizer){customizer=typeof customizer=='function'?customizer:undefined;return object==null?object:baseUpdate(object,path,castFunction(updater),customizer);}/**
	     * Creates an array of the own enumerable string keyed property values of `object`.
	     *
	     * **Note:** Non-object values are coerced to objects.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Object
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the array of property values.
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     *   this.b = 2;
	     * }
	     *
	     * Foo.prototype.c = 3;
	     *
	     * _.values(new Foo);
	     * // => [1, 2] (iteration order is not guaranteed)
	     *
	     * _.values('hi');
	     * // => ['h', 'i']
	     */function values(object){return object==null?[]:baseValues(object,keys(object));}/**
	     * Creates an array of the own and inherited enumerable string keyed property
	     * values of `object`.
	     *
	     * **Note:** Non-object values are coerced to objects.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Object
	     * @param {Object} object The object to query.
	     * @returns {Array} Returns the array of property values.
	     * @example
	     *
	     * function Foo() {
	     *   this.a = 1;
	     *   this.b = 2;
	     * }
	     *
	     * Foo.prototype.c = 3;
	     *
	     * _.valuesIn(new Foo);
	     * // => [1, 2, 3] (iteration order is not guaranteed)
	     */function valuesIn(object){return object==null?[]:baseValues(object,keysIn(object));}/*------------------------------------------------------------------------*//**
	     * Clamps `number` within the inclusive `lower` and `upper` bounds.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Number
	     * @param {number} number The number to clamp.
	     * @param {number} [lower] The lower bound.
	     * @param {number} upper The upper bound.
	     * @returns {number} Returns the clamped number.
	     * @example
	     *
	     * _.clamp(-10, -5, 5);
	     * // => -5
	     *
	     * _.clamp(10, -5, 5);
	     * // => 5
	     */function clamp(number,lower,upper){if(upper===undefined){upper=lower;lower=undefined;}if(upper!==undefined){upper=toNumber(upper);upper=upper===upper?upper:0;}if(lower!==undefined){lower=toNumber(lower);lower=lower===lower?lower:0;}return baseClamp(toNumber(number),lower,upper);}/**
	     * Checks if `n` is between `start` and up to, but not including, `end`. If
	     * `end` is not specified, it's set to `start` with `start` then set to `0`.
	     * If `start` is greater than `end` the params are swapped to support
	     * negative ranges.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.3.0
	     * @category Number
	     * @param {number} number The number to check.
	     * @param {number} [start=0] The start of the range.
	     * @param {number} end The end of the range.
	     * @returns {boolean} Returns `true` if `number` is in the range, else `false`.
	     * @see _.range, _.rangeRight
	     * @example
	     *
	     * _.inRange(3, 2, 4);
	     * // => true
	     *
	     * _.inRange(4, 8);
	     * // => true
	     *
	     * _.inRange(4, 2);
	     * // => false
	     *
	     * _.inRange(2, 2);
	     * // => false
	     *
	     * _.inRange(1.2, 2);
	     * // => true
	     *
	     * _.inRange(5.2, 4);
	     * // => false
	     *
	     * _.inRange(-3, -2, -6);
	     * // => true
	     */function inRange(number,start,end){start=toFinite(start);if(end===undefined){end=start;start=0;}else{end=toFinite(end);}number=toNumber(number);return baseInRange(number,start,end);}/**
	     * Produces a random number between the inclusive `lower` and `upper` bounds.
	     * If only one argument is provided a number between `0` and the given number
	     * is returned. If `floating` is `true`, or either `lower` or `upper` are
	     * floats, a floating-point number is returned instead of an integer.
	     *
	     * **Note:** JavaScript follows the IEEE-754 standard for resolving
	     * floating-point values which can produce unexpected results.
	     *
	     * @static
	     * @memberOf _
	     * @since 0.7.0
	     * @category Number
	     * @param {number} [lower=0] The lower bound.
	     * @param {number} [upper=1] The upper bound.
	     * @param {boolean} [floating] Specify returning a floating-point number.
	     * @returns {number} Returns the random number.
	     * @example
	     *
	     * _.random(0, 5);
	     * // => an integer between 0 and 5
	     *
	     * _.random(5);
	     * // => also an integer between 0 and 5
	     *
	     * _.random(5, true);
	     * // => a floating-point number between 0 and 5
	     *
	     * _.random(1.2, 5.2);
	     * // => a floating-point number between 1.2 and 5.2
	     */function random(lower,upper,floating){if(floating&&typeof floating!='boolean'&&isIterateeCall(lower,upper,floating)){upper=floating=undefined;}if(floating===undefined){if(typeof upper=='boolean'){floating=upper;upper=undefined;}else if(typeof lower=='boolean'){floating=lower;lower=undefined;}}if(lower===undefined&&upper===undefined){lower=0;upper=1;}else{lower=toFinite(lower);if(upper===undefined){upper=lower;lower=0;}else{upper=toFinite(upper);}}if(lower>upper){var temp=lower;lower=upper;upper=temp;}if(floating||lower%1||upper%1){var rand=nativeRandom();return nativeMin(lower+rand*(upper-lower+freeParseFloat('1e-'+((rand+'').length-1))),upper);}return baseRandom(lower,upper);}/*------------------------------------------------------------------------*//**
	     * Converts `string` to [camel case](https://en.wikipedia.org/wiki/CamelCase).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to convert.
	     * @returns {string} Returns the camel cased string.
	     * @example
	     *
	     * _.camelCase('Foo Bar');
	     * // => 'fooBar'
	     *
	     * _.camelCase('--foo-bar--');
	     * // => 'fooBar'
	     *
	     * _.camelCase('__FOO_BAR__');
	     * // => 'fooBar'
	     */var camelCase=createCompounder(function(result,word,index){word=word.toLowerCase();return result+(index?capitalize(word):word);});/**
	     * Converts the first character of `string` to upper case and the remaining
	     * to lower case.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to capitalize.
	     * @returns {string} Returns the capitalized string.
	     * @example
	     *
	     * _.capitalize('FRED');
	     * // => 'Fred'
	     */function capitalize(string){return upperFirst(toString(string).toLowerCase());}/**
	     * Deburrs `string` by converting
	     * [Latin-1 Supplement](https://en.wikipedia.org/wiki/Latin-1_Supplement_(Unicode_block)#Character_table)
	     * and [Latin Extended-A](https://en.wikipedia.org/wiki/Latin_Extended-A)
	     * letters to basic Latin letters and removing
	     * [combining diacritical marks](https://en.wikipedia.org/wiki/Combining_Diacritical_Marks).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to deburr.
	     * @returns {string} Returns the deburred string.
	     * @example
	     *
	     * _.deburr('déjà vu');
	     * // => 'deja vu'
	     */function deburr(string){string=toString(string);return string&&string.replace(reLatin,deburrLetter).replace(reComboMark,'');}/**
	     * Checks if `string` ends with the given target string.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to inspect.
	     * @param {string} [target] The string to search for.
	     * @param {number} [position=string.length] The position to search up to.
	     * @returns {boolean} Returns `true` if `string` ends with `target`,
	     *  else `false`.
	     * @example
	     *
	     * _.endsWith('abc', 'c');
	     * // => true
	     *
	     * _.endsWith('abc', 'b');
	     * // => false
	     *
	     * _.endsWith('abc', 'b', 2);
	     * // => true
	     */function endsWith(string,target,position){string=toString(string);target=baseToString(target);var length=string.length;position=position===undefined?length:baseClamp(toInteger(position),0,length);var end=position;position-=target.length;return position>=0&&string.slice(position,end)==target;}/**
	     * Converts the characters "&", "<", ">", '"', and "'" in `string` to their
	     * corresponding HTML entities.
	     *
	     * **Note:** No other characters are escaped. To escape additional
	     * characters use a third-party library like [_he_](https://mths.be/he).
	     *
	     * Though the ">" character is escaped for symmetry, characters like
	     * ">" and "/" don't need escaping in HTML and have no special meaning
	     * unless they're part of a tag or unquoted attribute value. See
	     * [Mathias Bynens's article](https://mathiasbynens.be/notes/ambiguous-ampersands)
	     * (under "semi-related fun fact") for more details.
	     *
	     * When working with HTML you should always
	     * [quote attribute values](http://wonko.com/post/html-escaping) to reduce
	     * XSS vectors.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category String
	     * @param {string} [string=''] The string to escape.
	     * @returns {string} Returns the escaped string.
	     * @example
	     *
	     * _.escape('fred, barney, & pebbles');
	     * // => 'fred, barney, &amp; pebbles'
	     */function escape(string){string=toString(string);return string&&reHasUnescapedHtml.test(string)?string.replace(reUnescapedHtml,escapeHtmlChar):string;}/**
	     * Escapes the `RegExp` special characters "^", "$", "\", ".", "*", "+",
	     * "?", "(", ")", "[", "]", "{", "}", and "|" in `string`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to escape.
	     * @returns {string} Returns the escaped string.
	     * @example
	     *
	     * _.escapeRegExp('[lodash](https://lodash.com/)');
	     * // => '\[lodash\]\(https://lodash\.com/\)'
	     */function escapeRegExp(string){string=toString(string);return string&&reHasRegExpChar.test(string)?string.replace(reRegExpChar,'\\$&'):string;}/**
	     * Converts `string` to
	     * [kebab case](https://en.wikipedia.org/wiki/Letter_case#Special_case_styles).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to convert.
	     * @returns {string} Returns the kebab cased string.
	     * @example
	     *
	     * _.kebabCase('Foo Bar');
	     * // => 'foo-bar'
	     *
	     * _.kebabCase('fooBar');
	     * // => 'foo-bar'
	     *
	     * _.kebabCase('__FOO_BAR__');
	     * // => 'foo-bar'
	     */var kebabCase=createCompounder(function(result,word,index){return result+(index?'-':'')+word.toLowerCase();});/**
	     * Converts `string`, as space separated words, to lower case.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to convert.
	     * @returns {string} Returns the lower cased string.
	     * @example
	     *
	     * _.lowerCase('--Foo-Bar--');
	     * // => 'foo bar'
	     *
	     * _.lowerCase('fooBar');
	     * // => 'foo bar'
	     *
	     * _.lowerCase('__FOO_BAR__');
	     * // => 'foo bar'
	     */var lowerCase=createCompounder(function(result,word,index){return result+(index?' ':'')+word.toLowerCase();});/**
	     * Converts the first character of `string` to lower case.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to convert.
	     * @returns {string} Returns the converted string.
	     * @example
	     *
	     * _.lowerFirst('Fred');
	     * // => 'fred'
	     *
	     * _.lowerFirst('FRED');
	     * // => 'fRED'
	     */var lowerFirst=createCaseFirst('toLowerCase');/**
	     * Pads `string` on the left and right sides if it's shorter than `length`.
	     * Padding characters are truncated if they can't be evenly divided by `length`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to pad.
	     * @param {number} [length=0] The padding length.
	     * @param {string} [chars=' '] The string used as padding.
	     * @returns {string} Returns the padded string.
	     * @example
	     *
	     * _.pad('abc', 8);
	     * // => '  abc   '
	     *
	     * _.pad('abc', 8, '_-');
	     * // => '_-abc_-_'
	     *
	     * _.pad('abc', 3);
	     * // => 'abc'
	     */function pad(string,length,chars){string=toString(string);length=toInteger(length);var strLength=length?stringSize(string):0;if(!length||strLength>=length){return string;}var mid=(length-strLength)/2;return createPadding(nativeFloor(mid),chars)+string+createPadding(nativeCeil(mid),chars);}/**
	     * Pads `string` on the right side if it's shorter than `length`. Padding
	     * characters are truncated if they exceed `length`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to pad.
	     * @param {number} [length=0] The padding length.
	     * @param {string} [chars=' '] The string used as padding.
	     * @returns {string} Returns the padded string.
	     * @example
	     *
	     * _.padEnd('abc', 6);
	     * // => 'abc   '
	     *
	     * _.padEnd('abc', 6, '_-');
	     * // => 'abc_-_'
	     *
	     * _.padEnd('abc', 3);
	     * // => 'abc'
	     */function padEnd(string,length,chars){string=toString(string);length=toInteger(length);var strLength=length?stringSize(string):0;return length&&strLength<length?string+createPadding(length-strLength,chars):string;}/**
	     * Pads `string` on the left side if it's shorter than `length`. Padding
	     * characters are truncated if they exceed `length`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to pad.
	     * @param {number} [length=0] The padding length.
	     * @param {string} [chars=' '] The string used as padding.
	     * @returns {string} Returns the padded string.
	     * @example
	     *
	     * _.padStart('abc', 6);
	     * // => '   abc'
	     *
	     * _.padStart('abc', 6, '_-');
	     * // => '_-_abc'
	     *
	     * _.padStart('abc', 3);
	     * // => 'abc'
	     */function padStart(string,length,chars){string=toString(string);length=toInteger(length);var strLength=length?stringSize(string):0;return length&&strLength<length?createPadding(length-strLength,chars)+string:string;}/**
	     * Converts `string` to an integer of the specified radix. If `radix` is
	     * `undefined` or `0`, a `radix` of `10` is used unless `value` is a
	     * hexadecimal, in which case a `radix` of `16` is used.
	     *
	     * **Note:** This method aligns with the
	     * [ES5 implementation](https://es5.github.io/#x15.1.2.2) of `parseInt`.
	     *
	     * @static
	     * @memberOf _
	     * @since 1.1.0
	     * @category String
	     * @param {string} string The string to convert.
	     * @param {number} [radix=10] The radix to interpret `value` by.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {number} Returns the converted integer.
	     * @example
	     *
	     * _.parseInt('08');
	     * // => 8
	     *
	     * _.map(['6', '08', '10'], _.parseInt);
	     * // => [6, 8, 10]
	     */function parseInt(string,radix,guard){if(guard||radix==null){radix=0;}else if(radix){radix=+radix;}return nativeParseInt(toString(string).replace(reTrimStart,''),radix||0);}/**
	     * Repeats the given string `n` times.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to repeat.
	     * @param {number} [n=1] The number of times to repeat the string.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {string} Returns the repeated string.
	     * @example
	     *
	     * _.repeat('*', 3);
	     * // => '***'
	     *
	     * _.repeat('abc', 2);
	     * // => 'abcabc'
	     *
	     * _.repeat('abc', 0);
	     * // => ''
	     */function repeat(string,n,guard){if(guard?isIterateeCall(string,n,guard):n===undefined){n=1;}else{n=toInteger(n);}return baseRepeat(toString(string),n);}/**
	     * Replaces matches for `pattern` in `string` with `replacement`.
	     *
	     * **Note:** This method is based on
	     * [`String#replace`](https://mdn.io/String/replace).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to modify.
	     * @param {RegExp|string} pattern The pattern to replace.
	     * @param {Function|string} replacement The match replacement.
	     * @returns {string} Returns the modified string.
	     * @example
	     *
	     * _.replace('Hi Fred', 'Fred', 'Barney');
	     * // => 'Hi Barney'
	     */function replace(){var args=arguments,string=toString(args[0]);return args.length<3?string:string.replace(args[1],args[2]);}/**
	     * Converts `string` to
	     * [snake case](https://en.wikipedia.org/wiki/Snake_case).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to convert.
	     * @returns {string} Returns the snake cased string.
	     * @example
	     *
	     * _.snakeCase('Foo Bar');
	     * // => 'foo_bar'
	     *
	     * _.snakeCase('fooBar');
	     * // => 'foo_bar'
	     *
	     * _.snakeCase('--FOO-BAR--');
	     * // => 'foo_bar'
	     */var snakeCase=createCompounder(function(result,word,index){return result+(index?'_':'')+word.toLowerCase();});/**
	     * Splits `string` by `separator`.
	     *
	     * **Note:** This method is based on
	     * [`String#split`](https://mdn.io/String/split).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to split.
	     * @param {RegExp|string} separator The separator pattern to split by.
	     * @param {number} [limit] The length to truncate results to.
	     * @returns {Array} Returns the string segments.
	     * @example
	     *
	     * _.split('a-b-c', '-', 2);
	     * // => ['a', 'b']
	     */function split(string,separator,limit){if(limit&&typeof limit!='number'&&isIterateeCall(string,separator,limit)){separator=limit=undefined;}limit=limit===undefined?MAX_ARRAY_LENGTH:limit>>>0;if(!limit){return[];}string=toString(string);if(string&&(typeof separator=='string'||separator!=null&&!isRegExp(separator))){separator=baseToString(separator);if(!separator&&hasUnicode(string)){return castSlice(stringToArray(string),0,limit);}}return string.split(separator,limit);}/**
	     * Converts `string` to
	     * [start case](https://en.wikipedia.org/wiki/Letter_case#Stylistic_or_specialised_usage).
	     *
	     * @static
	     * @memberOf _
	     * @since 3.1.0
	     * @category String
	     * @param {string} [string=''] The string to convert.
	     * @returns {string} Returns the start cased string.
	     * @example
	     *
	     * _.startCase('--foo-bar--');
	     * // => 'Foo Bar'
	     *
	     * _.startCase('fooBar');
	     * // => 'Foo Bar'
	     *
	     * _.startCase('__FOO_BAR__');
	     * // => 'FOO BAR'
	     */var startCase=createCompounder(function(result,word,index){return result+(index?' ':'')+upperFirst(word);});/**
	     * Checks if `string` starts with the given target string.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to inspect.
	     * @param {string} [target] The string to search for.
	     * @param {number} [position=0] The position to search from.
	     * @returns {boolean} Returns `true` if `string` starts with `target`,
	     *  else `false`.
	     * @example
	     *
	     * _.startsWith('abc', 'a');
	     * // => true
	     *
	     * _.startsWith('abc', 'b');
	     * // => false
	     *
	     * _.startsWith('abc', 'b', 1);
	     * // => true
	     */function startsWith(string,target,position){string=toString(string);position=baseClamp(toInteger(position),0,string.length);target=baseToString(target);return string.slice(position,position+target.length)==target;}/**
	     * Creates a compiled template function that can interpolate data properties
	     * in "interpolate" delimiters, HTML-escape interpolated data properties in
	     * "escape" delimiters, and execute JavaScript in "evaluate" delimiters. Data
	     * properties may be accessed as free variables in the template. If a setting
	     * object is given, it takes precedence over `_.templateSettings` values.
	     *
	     * **Note:** In the development build `_.template` utilizes
	     * [sourceURLs](http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl)
	     * for easier debugging.
	     *
	     * For more information on precompiling templates see
	     * [lodash's custom builds documentation](https://lodash.com/custom-builds).
	     *
	     * For more information on Chrome extension sandboxes see
	     * [Chrome's extensions documentation](https://developer.chrome.com/extensions/sandboxingEval).
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category String
	     * @param {string} [string=''] The template string.
	     * @param {Object} [options={}] The options object.
	     * @param {RegExp} [options.escape=_.templateSettings.escape]
	     *  The HTML "escape" delimiter.
	     * @param {RegExp} [options.evaluate=_.templateSettings.evaluate]
	     *  The "evaluate" delimiter.
	     * @param {Object} [options.imports=_.templateSettings.imports]
	     *  An object to import into the template as free variables.
	     * @param {RegExp} [options.interpolate=_.templateSettings.interpolate]
	     *  The "interpolate" delimiter.
	     * @param {string} [options.sourceURL='lodash.templateSources[n]']
	     *  The sourceURL of the compiled template.
	     * @param {string} [options.variable='obj']
	     *  The data object variable name.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {Function} Returns the compiled template function.
	     * @example
	     *
	     * // Use the "interpolate" delimiter to create a compiled template.
	     * var compiled = _.template('hello <%= user %>!');
	     * compiled({ 'user': 'fred' });
	     * // => 'hello fred!'
	     *
	     * // Use the HTML "escape" delimiter to escape data property values.
	     * var compiled = _.template('<b><%- value %></b>');
	     * compiled({ 'value': '<script>' });
	     * // => '<b>&lt;script&gt;</b>'
	     *
	     * // Use the "evaluate" delimiter to execute JavaScript and generate HTML.
	     * var compiled = _.template('<% _.forEach(users, function(user) { %><li><%- user %></li><% }); %>');
	     * compiled({ 'users': ['fred', 'barney'] });
	     * // => '<li>fred</li><li>barney</li>'
	     *
	     * // Use the internal `print` function in "evaluate" delimiters.
	     * var compiled = _.template('<% print("hello " + user); %>!');
	     * compiled({ 'user': 'barney' });
	     * // => 'hello barney!'
	     *
	     * // Use the ES template literal delimiter as an "interpolate" delimiter.
	     * // Disable support by replacing the "interpolate" delimiter.
	     * var compiled = _.template('hello ${ user }!');
	     * compiled({ 'user': 'pebbles' });
	     * // => 'hello pebbles!'
	     *
	     * // Use backslashes to treat delimiters as plain text.
	     * var compiled = _.template('<%= "\\<%- value %\\>" %>');
	     * compiled({ 'value': 'ignored' });
	     * // => '<%- value %>'
	     *
	     * // Use the `imports` option to import `jQuery` as `jq`.
	     * var text = '<% jq.each(users, function(user) { %><li><%- user %></li><% }); %>';
	     * var compiled = _.template(text, { 'imports': { 'jq': jQuery } });
	     * compiled({ 'users': ['fred', 'barney'] });
	     * // => '<li>fred</li><li>barney</li>'
	     *
	     * // Use the `sourceURL` option to specify a custom sourceURL for the template.
	     * var compiled = _.template('hello <%= user %>!', { 'sourceURL': '/basic/greeting.jst' });
	     * compiled(data);
	     * // => Find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector.
	     *
	     * // Use the `variable` option to ensure a with-statement isn't used in the compiled template.
	     * var compiled = _.template('hi <%= data.user %>!', { 'variable': 'data' });
	     * compiled.source;
	     * // => function(data) {
	     * //   var __t, __p = '';
	     * //   __p += 'hi ' + ((__t = ( data.user )) == null ? '' : __t) + '!';
	     * //   return __p;
	     * // }
	     *
	     * // Use custom template delimiters.
	     * _.templateSettings.interpolate = /{{([\s\S]+?)}}/g;
	     * var compiled = _.template('hello {{ user }}!');
	     * compiled({ 'user': 'mustache' });
	     * // => 'hello mustache!'
	     *
	     * // Use the `source` property to inline compiled templates for meaningful
	     * // line numbers in error messages and stack traces.
	     * fs.writeFileSync(path.join(process.cwd(), 'jst.js'), '\
	     *   var JST = {\
	     *     "main": ' + _.template(mainText).source + '\
	     *   };\
	     * ');
	     */function template(string,options,guard){// Based on John Resig's `tmpl` implementation
	// (http://ejohn.org/blog/javascript-micro-templating/)
	// and Laura Doktorova's doT.js (https://github.com/olado/doT).
	var settings=lodash.templateSettings;if(guard&&isIterateeCall(string,options,guard)){options=undefined;}string=toString(string);options=assignInWith({},options,settings,assignInDefaults);var imports=assignInWith({},options.imports,settings.imports,assignInDefaults),importsKeys=keys(imports),importsValues=baseValues(imports,importsKeys);var isEscaping,isEvaluating,index=0,interpolate=options.interpolate||reNoMatch,source="__p += '";// Compile the regexp to match each delimiter.
	var reDelimiters=RegExp((options.escape||reNoMatch).source+'|'+interpolate.source+'|'+(interpolate===reInterpolate?reEsTemplate:reNoMatch).source+'|'+(options.evaluate||reNoMatch).source+'|$','g');// Use a sourceURL for easier debugging.
	var sourceURL='//# sourceURL='+('sourceURL'in options?options.sourceURL:'lodash.templateSources['+ ++templateCounter+']')+'\n';string.replace(reDelimiters,function(match,escapeValue,interpolateValue,esTemplateValue,evaluateValue,offset){interpolateValue||(interpolateValue=esTemplateValue);// Escape characters that can't be included in string literals.
	source+=string.slice(index,offset).replace(reUnescapedString,escapeStringChar);// Replace delimiters with snippets.
	if(escapeValue){isEscaping=true;source+="' +\n__e("+escapeValue+") +\n'";}if(evaluateValue){isEvaluating=true;source+="';\n"+evaluateValue+";\n__p += '";}if(interpolateValue){source+="' +\n((__t = ("+interpolateValue+")) == null ? '' : __t) +\n'";}index=offset+match.length;// The JS engine embedded in Adobe products needs `match` returned in
	// order to produce the correct `offset` value.
	return match;});source+="';\n";// If `variable` is not specified wrap a with-statement around the generated
	// code to add the data object to the top of the scope chain.
	var variable=options.variable;if(!variable){source='with (obj) {\n'+source+'\n}\n';}// Cleanup code by stripping empty strings.
	source=(isEvaluating?source.replace(reEmptyStringLeading,''):source).replace(reEmptyStringMiddle,'$1').replace(reEmptyStringTrailing,'$1;');// Frame code as the function body.
	source='function('+(variable||'obj')+') {\n'+(variable?'':'obj || (obj = {});\n')+"var __t, __p = ''"+(isEscaping?', __e = _.escape':'')+(isEvaluating?', __j = Array.prototype.join;\n'+"function print() { __p += __j.call(arguments, '') }\n":';\n')+source+'return __p\n}';var result=attempt(function(){return Function(importsKeys,sourceURL+'return '+source).apply(undefined,importsValues);});// Provide the compiled function's source by its `toString` method or
	// the `source` property as a convenience for inlining compiled templates.
	result.source=source;if(isError(result)){throw result;}return result;}/**
	     * Converts `string`, as a whole, to lower case just like
	     * [String#toLowerCase](https://mdn.io/toLowerCase).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to convert.
	     * @returns {string} Returns the lower cased string.
	     * @example
	     *
	     * _.toLower('--Foo-Bar--');
	     * // => '--foo-bar--'
	     *
	     * _.toLower('fooBar');
	     * // => 'foobar'
	     *
	     * _.toLower('__FOO_BAR__');
	     * // => '__foo_bar__'
	     */function toLower(value){return toString(value).toLowerCase();}/**
	     * Converts `string`, as a whole, to upper case just like
	     * [String#toUpperCase](https://mdn.io/toUpperCase).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to convert.
	     * @returns {string} Returns the upper cased string.
	     * @example
	     *
	     * _.toUpper('--foo-bar--');
	     * // => '--FOO-BAR--'
	     *
	     * _.toUpper('fooBar');
	     * // => 'FOOBAR'
	     *
	     * _.toUpper('__foo_bar__');
	     * // => '__FOO_BAR__'
	     */function toUpper(value){return toString(value).toUpperCase();}/**
	     * Removes leading and trailing whitespace or specified characters from `string`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to trim.
	     * @param {string} [chars=whitespace] The characters to trim.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {string} Returns the trimmed string.
	     * @example
	     *
	     * _.trim('  abc  ');
	     * // => 'abc'
	     *
	     * _.trim('-_-abc-_-', '_-');
	     * // => 'abc'
	     *
	     * _.map(['  foo  ', '  bar  '], _.trim);
	     * // => ['foo', 'bar']
	     */function trim(string,chars,guard){string=toString(string);if(string&&(guard||chars===undefined)){return string.replace(reTrim,'');}if(!string||!(chars=baseToString(chars))){return string;}var strSymbols=stringToArray(string),chrSymbols=stringToArray(chars),start=charsStartIndex(strSymbols,chrSymbols),end=charsEndIndex(strSymbols,chrSymbols)+1;return castSlice(strSymbols,start,end).join('');}/**
	     * Removes trailing whitespace or specified characters from `string`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to trim.
	     * @param {string} [chars=whitespace] The characters to trim.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {string} Returns the trimmed string.
	     * @example
	     *
	     * _.trimEnd('  abc  ');
	     * // => '  abc'
	     *
	     * _.trimEnd('-_-abc-_-', '_-');
	     * // => '-_-abc'
	     */function trimEnd(string,chars,guard){string=toString(string);if(string&&(guard||chars===undefined)){return string.replace(reTrimEnd,'');}if(!string||!(chars=baseToString(chars))){return string;}var strSymbols=stringToArray(string),end=charsEndIndex(strSymbols,stringToArray(chars))+1;return castSlice(strSymbols,0,end).join('');}/**
	     * Removes leading whitespace or specified characters from `string`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to trim.
	     * @param {string} [chars=whitespace] The characters to trim.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {string} Returns the trimmed string.
	     * @example
	     *
	     * _.trimStart('  abc  ');
	     * // => 'abc  '
	     *
	     * _.trimStart('-_-abc-_-', '_-');
	     * // => 'abc-_-'
	     */function trimStart(string,chars,guard){string=toString(string);if(string&&(guard||chars===undefined)){return string.replace(reTrimStart,'');}if(!string||!(chars=baseToString(chars))){return string;}var strSymbols=stringToArray(string),start=charsStartIndex(strSymbols,stringToArray(chars));return castSlice(strSymbols,start).join('');}/**
	     * Truncates `string` if it's longer than the given maximum string length.
	     * The last characters of the truncated string are replaced with the omission
	     * string which defaults to "...".
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to truncate.
	     * @param {Object} [options={}] The options object.
	     * @param {number} [options.length=30] The maximum string length.
	     * @param {string} [options.omission='...'] The string to indicate text is omitted.
	     * @param {RegExp|string} [options.separator] The separator pattern to truncate to.
	     * @returns {string} Returns the truncated string.
	     * @example
	     *
	     * _.truncate('hi-diddly-ho there, neighborino');
	     * // => 'hi-diddly-ho there, neighbo...'
	     *
	     * _.truncate('hi-diddly-ho there, neighborino', {
	     *   'length': 24,
	     *   'separator': ' '
	     * });
	     * // => 'hi-diddly-ho there,...'
	     *
	     * _.truncate('hi-diddly-ho there, neighborino', {
	     *   'length': 24,
	     *   'separator': /,? +/
	     * });
	     * // => 'hi-diddly-ho there...'
	     *
	     * _.truncate('hi-diddly-ho there, neighborino', {
	     *   'omission': ' [...]'
	     * });
	     * // => 'hi-diddly-ho there, neig [...]'
	     */function truncate(string,options){var length=DEFAULT_TRUNC_LENGTH,omission=DEFAULT_TRUNC_OMISSION;if(isObject(options)){var separator='separator'in options?options.separator:separator;length='length'in options?toInteger(options.length):length;omission='omission'in options?baseToString(options.omission):omission;}string=toString(string);var strLength=string.length;if(hasUnicode(string)){var strSymbols=stringToArray(string);strLength=strSymbols.length;}if(length>=strLength){return string;}var end=length-stringSize(omission);if(end<1){return omission;}var result=strSymbols?castSlice(strSymbols,0,end).join(''):string.slice(0,end);if(separator===undefined){return result+omission;}if(strSymbols){end+=result.length-end;}if(isRegExp(separator)){if(string.slice(end).search(separator)){var match,substring=result;if(!separator.global){separator=RegExp(separator.source,toString(reFlags.exec(separator))+'g');}separator.lastIndex=0;while(match=separator.exec(substring)){var newEnd=match.index;}result=result.slice(0,newEnd===undefined?end:newEnd);}}else if(string.indexOf(baseToString(separator),end)!=end){var index=result.lastIndexOf(separator);if(index>-1){result=result.slice(0,index);}}return result+omission;}/**
	     * The inverse of `_.escape`; this method converts the HTML entities
	     * `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `string` to
	     * their corresponding characters.
	     *
	     * **Note:** No other HTML entities are unescaped. To unescape additional
	     * HTML entities use a third-party library like [_he_](https://mths.be/he).
	     *
	     * @static
	     * @memberOf _
	     * @since 0.6.0
	     * @category String
	     * @param {string} [string=''] The string to unescape.
	     * @returns {string} Returns the unescaped string.
	     * @example
	     *
	     * _.unescape('fred, barney, &amp; pebbles');
	     * // => 'fred, barney, & pebbles'
	     */function unescape(string){string=toString(string);return string&&reHasEscapedHtml.test(string)?string.replace(reEscapedHtml,unescapeHtmlChar):string;}/**
	     * Converts `string`, as space separated words, to upper case.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to convert.
	     * @returns {string} Returns the upper cased string.
	     * @example
	     *
	     * _.upperCase('--foo-bar');
	     * // => 'FOO BAR'
	     *
	     * _.upperCase('fooBar');
	     * // => 'FOO BAR'
	     *
	     * _.upperCase('__foo_bar__');
	     * // => 'FOO BAR'
	     */var upperCase=createCompounder(function(result,word,index){return result+(index?' ':'')+word.toUpperCase();});/**
	     * Converts the first character of `string` to upper case.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category String
	     * @param {string} [string=''] The string to convert.
	     * @returns {string} Returns the converted string.
	     * @example
	     *
	     * _.upperFirst('fred');
	     * // => 'Fred'
	     *
	     * _.upperFirst('FRED');
	     * // => 'FRED'
	     */var upperFirst=createCaseFirst('toUpperCase');/**
	     * Splits `string` into an array of its words.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category String
	     * @param {string} [string=''] The string to inspect.
	     * @param {RegExp|string} [pattern] The pattern to match words.
	     * @param- {Object} [guard] Enables use as an iteratee for methods like `_.map`.
	     * @returns {Array} Returns the words of `string`.
	     * @example
	     *
	     * _.words('fred, barney, & pebbles');
	     * // => ['fred', 'barney', 'pebbles']
	     *
	     * _.words('fred, barney, & pebbles', /[^, ]+/g);
	     * // => ['fred', 'barney', '&', 'pebbles']
	     */function words(string,pattern,guard){string=toString(string);pattern=guard?undefined:pattern;if(pattern===undefined){return hasUnicodeWord(string)?unicodeWords(string):asciiWords(string);}return string.match(pattern)||[];}/*------------------------------------------------------------------------*//**
	     * Attempts to invoke `func`, returning either the result or the caught error
	     * object. Any additional arguments are provided to `func` when it's invoked.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Util
	     * @param {Function} func The function to attempt.
	     * @param {...*} [args] The arguments to invoke `func` with.
	     * @returns {*} Returns the `func` result or error object.
	     * @example
	     *
	     * // Avoid throwing errors for invalid selectors.
	     * var elements = _.attempt(function(selector) {
	     *   return document.querySelectorAll(selector);
	     * }, '>_>');
	     *
	     * if (_.isError(elements)) {
	     *   elements = [];
	     * }
	     */var attempt=baseRest(function(func,args){try{return apply(func,undefined,args);}catch(e){return isError(e)?e:new Error(e);}});/**
	     * Binds methods of an object to the object itself, overwriting the existing
	     * method.
	     *
	     * **Note:** This method doesn't set the "length" property of bound functions.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Util
	     * @param {Object} object The object to bind and assign the bound methods to.
	     * @param {...(string|string[])} methodNames The object method names to bind.
	     * @returns {Object} Returns `object`.
	     * @example
	     *
	     * var view = {
	     *   'label': 'docs',
	     *   'click': function() {
	     *     console.log('clicked ' + this.label);
	     *   }
	     * };
	     *
	     * _.bindAll(view, ['click']);
	     * jQuery(element).on('click', view.click);
	     * // => Logs 'clicked docs' when clicked.
	     */var bindAll=flatRest(function(object,methodNames){arrayEach(methodNames,function(key){key=toKey(key);baseAssignValue(object,key,bind(object[key],object));});return object;});/**
	     * Creates a function that iterates over `pairs` and invokes the corresponding
	     * function of the first predicate to return truthy. The predicate-function
	     * pairs are invoked with the `this` binding and arguments of the created
	     * function.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Util
	     * @param {Array} pairs The predicate-function pairs.
	     * @returns {Function} Returns the new composite function.
	     * @example
	     *
	     * var func = _.cond([
	     *   [_.matches({ 'a': 1 }),           _.constant('matches A')],
	     *   [_.conforms({ 'b': _.isNumber }), _.constant('matches B')],
	     *   [_.stubTrue,                      _.constant('no match')]
	     * ]);
	     *
	     * func({ 'a': 1, 'b': 2 });
	     * // => 'matches A'
	     *
	     * func({ 'a': 0, 'b': 1 });
	     * // => 'matches B'
	     *
	     * func({ 'a': '1', 'b': '2' });
	     * // => 'no match'
	     */function cond(pairs){var length=pairs==null?0:pairs.length,toIteratee=getIteratee();pairs=!length?[]:arrayMap(pairs,function(pair){if(typeof pair[1]!='function'){throw new TypeError(FUNC_ERROR_TEXT);}return[toIteratee(pair[0]),pair[1]];});return baseRest(function(args){var index=-1;while(++index<length){var pair=pairs[index];if(apply(pair[0],this,args)){return apply(pair[1],this,args);}}});}/**
	     * Creates a function that invokes the predicate properties of `source` with
	     * the corresponding property values of a given object, returning `true` if
	     * all predicates return truthy, else `false`.
	     *
	     * **Note:** The created function is equivalent to `_.conformsTo` with
	     * `source` partially applied.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Util
	     * @param {Object} source The object of property predicates to conform to.
	     * @returns {Function} Returns the new spec function.
	     * @example
	     *
	     * var objects = [
	     *   { 'a': 2, 'b': 1 },
	     *   { 'a': 1, 'b': 2 }
	     * ];
	     *
	     * _.filter(objects, _.conforms({ 'b': function(n) { return n > 1; } }));
	     * // => [{ 'a': 1, 'b': 2 }]
	     */function conforms(source){return baseConforms(baseClone(source,CLONE_DEEP_FLAG));}/**
	     * Creates a function that returns `value`.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.4.0
	     * @category Util
	     * @param {*} value The value to return from the new function.
	     * @returns {Function} Returns the new constant function.
	     * @example
	     *
	     * var objects = _.times(2, _.constant({ 'a': 1 }));
	     *
	     * console.log(objects);
	     * // => [{ 'a': 1 }, { 'a': 1 }]
	     *
	     * console.log(objects[0] === objects[1]);
	     * // => true
	     */function constant(value){return function(){return value;};}/**
	     * Checks `value` to determine whether a default value should be returned in
	     * its place. The `defaultValue` is returned if `value` is `NaN`, `null`,
	     * or `undefined`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.14.0
	     * @category Util
	     * @param {*} value The value to check.
	     * @param {*} defaultValue The default value.
	     * @returns {*} Returns the resolved value.
	     * @example
	     *
	     * _.defaultTo(1, 10);
	     * // => 1
	     *
	     * _.defaultTo(undefined, 10);
	     * // => 10
	     */function defaultTo(value,defaultValue){return value==null||value!==value?defaultValue:value;}/**
	     * Creates a function that returns the result of invoking the given functions
	     * with the `this` binding of the created function, where each successive
	     * invocation is supplied the return value of the previous.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Util
	     * @param {...(Function|Function[])} [funcs] The functions to invoke.
	     * @returns {Function} Returns the new composite function.
	     * @see _.flowRight
	     * @example
	     *
	     * function square(n) {
	     *   return n * n;
	     * }
	     *
	     * var addSquare = _.flow([_.add, square]);
	     * addSquare(1, 2);
	     * // => 9
	     */var flow=createFlow();/**
	     * This method is like `_.flow` except that it creates a function that
	     * invokes the given functions from right to left.
	     *
	     * @static
	     * @since 3.0.0
	     * @memberOf _
	     * @category Util
	     * @param {...(Function|Function[])} [funcs] The functions to invoke.
	     * @returns {Function} Returns the new composite function.
	     * @see _.flow
	     * @example
	     *
	     * function square(n) {
	     *   return n * n;
	     * }
	     *
	     * var addSquare = _.flowRight([square, _.add]);
	     * addSquare(1, 2);
	     * // => 9
	     */var flowRight=createFlow(true);/**
	     * This method returns the first argument it receives.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Util
	     * @param {*} value Any value.
	     * @returns {*} Returns `value`.
	     * @example
	     *
	     * var object = { 'a': 1 };
	     *
	     * console.log(_.identity(object) === object);
	     * // => true
	     */function identity(value){return value;}/**
	     * Creates a function that invokes `func` with the arguments of the created
	     * function. If `func` is a property name, the created function returns the
	     * property value for a given element. If `func` is an array or object, the
	     * created function returns `true` for elements that contain the equivalent
	     * source properties, otherwise it returns `false`.
	     *
	     * @static
	     * @since 4.0.0
	     * @memberOf _
	     * @category Util
	     * @param {*} [func=_.identity] The value to convert to a callback.
	     * @returns {Function} Returns the callback.
	     * @example
	     *
	     * var users = [
	     *   { 'user': 'barney', 'age': 36, 'active': true },
	     *   { 'user': 'fred',   'age': 40, 'active': false }
	     * ];
	     *
	     * // The `_.matches` iteratee shorthand.
	     * _.filter(users, _.iteratee({ 'user': 'barney', 'active': true }));
	     * // => [{ 'user': 'barney', 'age': 36, 'active': true }]
	     *
	     * // The `_.matchesProperty` iteratee shorthand.
	     * _.filter(users, _.iteratee(['user', 'fred']));
	     * // => [{ 'user': 'fred', 'age': 40 }]
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.map(users, _.iteratee('user'));
	     * // => ['barney', 'fred']
	     *
	     * // Create custom iteratee shorthands.
	     * _.iteratee = _.wrap(_.iteratee, function(iteratee, func) {
	     *   return !_.isRegExp(func) ? iteratee(func) : function(string) {
	     *     return func.test(string);
	     *   };
	     * });
	     *
	     * _.filter(['abc', 'def'], /ef/);
	     * // => ['def']
	     */function iteratee(func){return baseIteratee(typeof func=='function'?func:baseClone(func,CLONE_DEEP_FLAG));}/**
	     * Creates a function that performs a partial deep comparison between a given
	     * object and `source`, returning `true` if the given object has equivalent
	     * property values, else `false`.
	     *
	     * **Note:** The created function is equivalent to `_.isMatch` with `source`
	     * partially applied.
	     *
	     * Partial comparisons will match empty array and empty object `source`
	     * values against any array or object value, respectively. See `_.isEqual`
	     * for a list of supported value comparisons.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Util
	     * @param {Object} source The object of property values to match.
	     * @returns {Function} Returns the new spec function.
	     * @example
	     *
	     * var objects = [
	     *   { 'a': 1, 'b': 2, 'c': 3 },
	     *   { 'a': 4, 'b': 5, 'c': 6 }
	     * ];
	     *
	     * _.filter(objects, _.matches({ 'a': 4, 'c': 6 }));
	     * // => [{ 'a': 4, 'b': 5, 'c': 6 }]
	     */function matches(source){return baseMatches(baseClone(source,CLONE_DEEP_FLAG));}/**
	     * Creates a function that performs a partial deep comparison between the
	     * value at `path` of a given object to `srcValue`, returning `true` if the
	     * object value is equivalent, else `false`.
	     *
	     * **Note:** Partial comparisons will match empty array and empty object
	     * `srcValue` values against any array or object value, respectively. See
	     * `_.isEqual` for a list of supported value comparisons.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.2.0
	     * @category Util
	     * @param {Array|string} path The path of the property to get.
	     * @param {*} srcValue The value to match.
	     * @returns {Function} Returns the new spec function.
	     * @example
	     *
	     * var objects = [
	     *   { 'a': 1, 'b': 2, 'c': 3 },
	     *   { 'a': 4, 'b': 5, 'c': 6 }
	     * ];
	     *
	     * _.find(objects, _.matchesProperty('a', 4));
	     * // => { 'a': 4, 'b': 5, 'c': 6 }
	     */function matchesProperty(path,srcValue){return baseMatchesProperty(path,baseClone(srcValue,CLONE_DEEP_FLAG));}/**
	     * Creates a function that invokes the method at `path` of a given object.
	     * Any additional arguments are provided to the invoked method.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.7.0
	     * @category Util
	     * @param {Array|string} path The path of the method to invoke.
	     * @param {...*} [args] The arguments to invoke the method with.
	     * @returns {Function} Returns the new invoker function.
	     * @example
	     *
	     * var objects = [
	     *   { 'a': { 'b': _.constant(2) } },
	     *   { 'a': { 'b': _.constant(1) } }
	     * ];
	     *
	     * _.map(objects, _.method('a.b'));
	     * // => [2, 1]
	     *
	     * _.map(objects, _.method(['a', 'b']));
	     * // => [2, 1]
	     */var method=baseRest(function(path,args){return function(object){return baseInvoke(object,path,args);};});/**
	     * The opposite of `_.method`; this method creates a function that invokes
	     * the method at a given path of `object`. Any additional arguments are
	     * provided to the invoked method.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.7.0
	     * @category Util
	     * @param {Object} object The object to query.
	     * @param {...*} [args] The arguments to invoke the method with.
	     * @returns {Function} Returns the new invoker function.
	     * @example
	     *
	     * var array = _.times(3, _.constant),
	     *     object = { 'a': array, 'b': array, 'c': array };
	     *
	     * _.map(['a[2]', 'c[0]'], _.methodOf(object));
	     * // => [2, 0]
	     *
	     * _.map([['a', '2'], ['c', '0']], _.methodOf(object));
	     * // => [2, 0]
	     */var methodOf=baseRest(function(object,args){return function(path){return baseInvoke(object,path,args);};});/**
	     * Adds all own enumerable string keyed function properties of a source
	     * object to the destination object. If `object` is a function, then methods
	     * are added to its prototype as well.
	     *
	     * **Note:** Use `_.runInContext` to create a pristine `lodash` function to
	     * avoid conflicts caused by modifying the original.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Util
	     * @param {Function|Object} [object=lodash] The destination object.
	     * @param {Object} source The object of functions to add.
	     * @param {Object} [options={}] The options object.
	     * @param {boolean} [options.chain=true] Specify whether mixins are chainable.
	     * @returns {Function|Object} Returns `object`.
	     * @example
	     *
	     * function vowels(string) {
	     *   return _.filter(string, function(v) {
	     *     return /[aeiou]/i.test(v);
	     *   });
	     * }
	     *
	     * _.mixin({ 'vowels': vowels });
	     * _.vowels('fred');
	     * // => ['e']
	     *
	     * _('fred').vowels().value();
	     * // => ['e']
	     *
	     * _.mixin({ 'vowels': vowels }, { 'chain': false });
	     * _('fred').vowels();
	     * // => ['e']
	     */function mixin(object,source,options){var props=keys(source),methodNames=baseFunctions(source,props);if(options==null&&!(isObject(source)&&(methodNames.length||!props.length))){options=source;source=object;object=this;methodNames=baseFunctions(source,keys(source));}var chain=!(isObject(options)&&'chain'in options)||!!options.chain,isFunc=isFunction(object);arrayEach(methodNames,function(methodName){var func=source[methodName];object[methodName]=func;if(isFunc){object.prototype[methodName]=function(){var chainAll=this.__chain__;if(chain||chainAll){var result=object(this.__wrapped__),actions=result.__actions__=copyArray(this.__actions__);actions.push({'func':func,'args':arguments,'thisArg':object});result.__chain__=chainAll;return result;}return func.apply(object,arrayPush([this.value()],arguments));};}});return object;}/**
	     * Reverts the `_` variable to its previous value and returns a reference to
	     * the `lodash` function.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Util
	     * @returns {Function} Returns the `lodash` function.
	     * @example
	     *
	     * var lodash = _.noConflict();
	     */function noConflict(){if(root._===this){root._=oldDash;}return this;}/**
	     * This method returns `undefined`.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.3.0
	     * @category Util
	     * @example
	     *
	     * _.times(2, _.noop);
	     * // => [undefined, undefined]
	     */function noop(){}// No operation performed.
	/**
	     * Creates a function that gets the argument at index `n`. If `n` is negative,
	     * the nth argument from the end is returned.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Util
	     * @param {number} [n=0] The index of the argument to return.
	     * @returns {Function} Returns the new pass-thru function.
	     * @example
	     *
	     * var func = _.nthArg(1);
	     * func('a', 'b', 'c', 'd');
	     * // => 'b'
	     *
	     * var func = _.nthArg(-2);
	     * func('a', 'b', 'c', 'd');
	     * // => 'c'
	     */function nthArg(n){n=toInteger(n);return baseRest(function(args){return baseNth(args,n);});}/**
	     * Creates a function that invokes `iteratees` with the arguments it receives
	     * and returns their results.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Util
	     * @param {...(Function|Function[])} [iteratees=[_.identity]]
	     *  The iteratees to invoke.
	     * @returns {Function} Returns the new function.
	     * @example
	     *
	     * var func = _.over([Math.max, Math.min]);
	     *
	     * func(1, 2, 3, 4);
	     * // => [4, 1]
	     */var over=createOver(arrayMap);/**
	     * Creates a function that checks if **all** of the `predicates` return
	     * truthy when invoked with the arguments it receives.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Util
	     * @param {...(Function|Function[])} [predicates=[_.identity]]
	     *  The predicates to check.
	     * @returns {Function} Returns the new function.
	     * @example
	     *
	     * var func = _.overEvery([Boolean, isFinite]);
	     *
	     * func('1');
	     * // => true
	     *
	     * func(null);
	     * // => false
	     *
	     * func(NaN);
	     * // => false
	     */var overEvery=createOver(arrayEvery);/**
	     * Creates a function that checks if **any** of the `predicates` return
	     * truthy when invoked with the arguments it receives.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Util
	     * @param {...(Function|Function[])} [predicates=[_.identity]]
	     *  The predicates to check.
	     * @returns {Function} Returns the new function.
	     * @example
	     *
	     * var func = _.overSome([Boolean, isFinite]);
	     *
	     * func('1');
	     * // => true
	     *
	     * func(null);
	     * // => true
	     *
	     * func(NaN);
	     * // => false
	     */var overSome=createOver(arraySome);/**
	     * Creates a function that returns the value at `path` of a given object.
	     *
	     * @static
	     * @memberOf _
	     * @since 2.4.0
	     * @category Util
	     * @param {Array|string} path The path of the property to get.
	     * @returns {Function} Returns the new accessor function.
	     * @example
	     *
	     * var objects = [
	     *   { 'a': { 'b': 2 } },
	     *   { 'a': { 'b': 1 } }
	     * ];
	     *
	     * _.map(objects, _.property('a.b'));
	     * // => [2, 1]
	     *
	     * _.map(_.sortBy(objects, _.property(['a', 'b'])), 'a.b');
	     * // => [1, 2]
	     */function property(path){return isKey(path)?baseProperty(toKey(path)):basePropertyDeep(path);}/**
	     * The opposite of `_.property`; this method creates a function that returns
	     * the value at a given path of `object`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.0.0
	     * @category Util
	     * @param {Object} object The object to query.
	     * @returns {Function} Returns the new accessor function.
	     * @example
	     *
	     * var array = [0, 1, 2],
	     *     object = { 'a': array, 'b': array, 'c': array };
	     *
	     * _.map(['a[2]', 'c[0]'], _.propertyOf(object));
	     * // => [2, 0]
	     *
	     * _.map([['a', '2'], ['c', '0']], _.propertyOf(object));
	     * // => [2, 0]
	     */function propertyOf(object){return function(path){return object==null?undefined:baseGet(object,path);};}/**
	     * Creates an array of numbers (positive and/or negative) progressing from
	     * `start` up to, but not including, `end`. A step of `-1` is used if a negative
	     * `start` is specified without an `end` or `step`. If `end` is not specified,
	     * it's set to `start` with `start` then set to `0`.
	     *
	     * **Note:** JavaScript follows the IEEE-754 standard for resolving
	     * floating-point values which can produce unexpected results.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Util
	     * @param {number} [start=0] The start of the range.
	     * @param {number} end The end of the range.
	     * @param {number} [step=1] The value to increment or decrement by.
	     * @returns {Array} Returns the range of numbers.
	     * @see _.inRange, _.rangeRight
	     * @example
	     *
	     * _.range(4);
	     * // => [0, 1, 2, 3]
	     *
	     * _.range(-4);
	     * // => [0, -1, -2, -3]
	     *
	     * _.range(1, 5);
	     * // => [1, 2, 3, 4]
	     *
	     * _.range(0, 20, 5);
	     * // => [0, 5, 10, 15]
	     *
	     * _.range(0, -4, -1);
	     * // => [0, -1, -2, -3]
	     *
	     * _.range(1, 4, 0);
	     * // => [1, 1, 1]
	     *
	     * _.range(0);
	     * // => []
	     */var range=createRange();/**
	     * This method is like `_.range` except that it populates values in
	     * descending order.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Util
	     * @param {number} [start=0] The start of the range.
	     * @param {number} end The end of the range.
	     * @param {number} [step=1] The value to increment or decrement by.
	     * @returns {Array} Returns the range of numbers.
	     * @see _.inRange, _.range
	     * @example
	     *
	     * _.rangeRight(4);
	     * // => [3, 2, 1, 0]
	     *
	     * _.rangeRight(-4);
	     * // => [-3, -2, -1, 0]
	     *
	     * _.rangeRight(1, 5);
	     * // => [4, 3, 2, 1]
	     *
	     * _.rangeRight(0, 20, 5);
	     * // => [15, 10, 5, 0]
	     *
	     * _.rangeRight(0, -4, -1);
	     * // => [-3, -2, -1, 0]
	     *
	     * _.rangeRight(1, 4, 0);
	     * // => [1, 1, 1]
	     *
	     * _.rangeRight(0);
	     * // => []
	     */var rangeRight=createRange(true);/**
	     * This method returns a new empty array.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.13.0
	     * @category Util
	     * @returns {Array} Returns the new empty array.
	     * @example
	     *
	     * var arrays = _.times(2, _.stubArray);
	     *
	     * console.log(arrays);
	     * // => [[], []]
	     *
	     * console.log(arrays[0] === arrays[1]);
	     * // => false
	     */function stubArray(){return[];}/**
	     * This method returns `false`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.13.0
	     * @category Util
	     * @returns {boolean} Returns `false`.
	     * @example
	     *
	     * _.times(2, _.stubFalse);
	     * // => [false, false]
	     */function stubFalse(){return false;}/**
	     * This method returns a new empty object.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.13.0
	     * @category Util
	     * @returns {Object} Returns the new empty object.
	     * @example
	     *
	     * var objects = _.times(2, _.stubObject);
	     *
	     * console.log(objects);
	     * // => [{}, {}]
	     *
	     * console.log(objects[0] === objects[1]);
	     * // => false
	     */function stubObject(){return{};}/**
	     * This method returns an empty string.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.13.0
	     * @category Util
	     * @returns {string} Returns the empty string.
	     * @example
	     *
	     * _.times(2, _.stubString);
	     * // => ['', '']
	     */function stubString(){return'';}/**
	     * This method returns `true`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.13.0
	     * @category Util
	     * @returns {boolean} Returns `true`.
	     * @example
	     *
	     * _.times(2, _.stubTrue);
	     * // => [true, true]
	     */function stubTrue(){return true;}/**
	     * Invokes the iteratee `n` times, returning an array of the results of
	     * each invocation. The iteratee is invoked with one argument; (index).
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Util
	     * @param {number} n The number of times to invoke `iteratee`.
	     * @param {Function} [iteratee=_.identity] The function invoked per iteration.
	     * @returns {Array} Returns the array of results.
	     * @example
	     *
	     * _.times(3, String);
	     * // => ['0', '1', '2']
	     *
	     *  _.times(4, _.constant(0));
	     * // => [0, 0, 0, 0]
	     */function times(n,iteratee){n=toInteger(n);if(n<1||n>MAX_SAFE_INTEGER){return[];}var index=MAX_ARRAY_LENGTH,length=nativeMin(n,MAX_ARRAY_LENGTH);iteratee=getIteratee(iteratee);n-=MAX_ARRAY_LENGTH;var result=baseTimes(length,iteratee);while(++index<n){iteratee(index);}return result;}/**
	     * Converts `value` to a property path array.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Util
	     * @param {*} value The value to convert.
	     * @returns {Array} Returns the new property path array.
	     * @example
	     *
	     * _.toPath('a.b.c');
	     * // => ['a', 'b', 'c']
	     *
	     * _.toPath('a[0].b.c');
	     * // => ['a', '0', 'b', 'c']
	     */function toPath(value){if(isArray(value)){return arrayMap(value,toKey);}return isSymbol(value)?[value]:copyArray(stringToPath(toString(value)));}/**
	     * Generates a unique ID. If `prefix` is given, the ID is appended to it.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Util
	     * @param {string} [prefix=''] The value to prefix the ID with.
	     * @returns {string} Returns the unique ID.
	     * @example
	     *
	     * _.uniqueId('contact_');
	     * // => 'contact_104'
	     *
	     * _.uniqueId();
	     * // => '105'
	     */function uniqueId(prefix){var id=++idCounter;return toString(prefix)+id;}/*------------------------------------------------------------------------*//**
	     * Adds two numbers.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.4.0
	     * @category Math
	     * @param {number} augend The first number in an addition.
	     * @param {number} addend The second number in an addition.
	     * @returns {number} Returns the total.
	     * @example
	     *
	     * _.add(6, 4);
	     * // => 10
	     */var add=createMathOperation(function(augend,addend){return augend+addend;},0);/**
	     * Computes `number` rounded up to `precision`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.10.0
	     * @category Math
	     * @param {number} number The number to round up.
	     * @param {number} [precision=0] The precision to round up to.
	     * @returns {number} Returns the rounded up number.
	     * @example
	     *
	     * _.ceil(4.006);
	     * // => 5
	     *
	     * _.ceil(6.004, 2);
	     * // => 6.01
	     *
	     * _.ceil(6040, -2);
	     * // => 6100
	     */var ceil=createRound('ceil');/**
	     * Divide two numbers.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.7.0
	     * @category Math
	     * @param {number} dividend The first number in a division.
	     * @param {number} divisor The second number in a division.
	     * @returns {number} Returns the quotient.
	     * @example
	     *
	     * _.divide(6, 4);
	     * // => 1.5
	     */var divide=createMathOperation(function(dividend,divisor){return dividend/divisor;},1);/**
	     * Computes `number` rounded down to `precision`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.10.0
	     * @category Math
	     * @param {number} number The number to round down.
	     * @param {number} [precision=0] The precision to round down to.
	     * @returns {number} Returns the rounded down number.
	     * @example
	     *
	     * _.floor(4.006);
	     * // => 4
	     *
	     * _.floor(0.046, 2);
	     * // => 0.04
	     *
	     * _.floor(4060, -2);
	     * // => 4000
	     */var floor=createRound('floor');/**
	     * Computes the maximum value of `array`. If `array` is empty or falsey,
	     * `undefined` is returned.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Math
	     * @param {Array} array The array to iterate over.
	     * @returns {*} Returns the maximum value.
	     * @example
	     *
	     * _.max([4, 2, 8, 6]);
	     * // => 8
	     *
	     * _.max([]);
	     * // => undefined
	     */function max(array){return array&&array.length?baseExtremum(array,identity,baseGt):undefined;}/**
	     * This method is like `_.max` except that it accepts `iteratee` which is
	     * invoked for each element in `array` to generate the criterion by which
	     * the value is ranked. The iteratee is invoked with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Math
	     * @param {Array} array The array to iterate over.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {*} Returns the maximum value.
	     * @example
	     *
	     * var objects = [{ 'n': 1 }, { 'n': 2 }];
	     *
	     * _.maxBy(objects, function(o) { return o.n; });
	     * // => { 'n': 2 }
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.maxBy(objects, 'n');
	     * // => { 'n': 2 }
	     */function maxBy(array,iteratee){return array&&array.length?baseExtremum(array,getIteratee(iteratee,2),baseGt):undefined;}/**
	     * Computes the mean of the values in `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Math
	     * @param {Array} array The array to iterate over.
	     * @returns {number} Returns the mean.
	     * @example
	     *
	     * _.mean([4, 2, 8, 6]);
	     * // => 5
	     */function mean(array){return baseMean(array,identity);}/**
	     * This method is like `_.mean` except that it accepts `iteratee` which is
	     * invoked for each element in `array` to generate the value to be averaged.
	     * The iteratee is invoked with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.7.0
	     * @category Math
	     * @param {Array} array The array to iterate over.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {number} Returns the mean.
	     * @example
	     *
	     * var objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }];
	     *
	     * _.meanBy(objects, function(o) { return o.n; });
	     * // => 5
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.meanBy(objects, 'n');
	     * // => 5
	     */function meanBy(array,iteratee){return baseMean(array,getIteratee(iteratee,2));}/**
	     * Computes the minimum value of `array`. If `array` is empty or falsey,
	     * `undefined` is returned.
	     *
	     * @static
	     * @since 0.1.0
	     * @memberOf _
	     * @category Math
	     * @param {Array} array The array to iterate over.
	     * @returns {*} Returns the minimum value.
	     * @example
	     *
	     * _.min([4, 2, 8, 6]);
	     * // => 2
	     *
	     * _.min([]);
	     * // => undefined
	     */function min(array){return array&&array.length?baseExtremum(array,identity,baseLt):undefined;}/**
	     * This method is like `_.min` except that it accepts `iteratee` which is
	     * invoked for each element in `array` to generate the criterion by which
	     * the value is ranked. The iteratee is invoked with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Math
	     * @param {Array} array The array to iterate over.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {*} Returns the minimum value.
	     * @example
	     *
	     * var objects = [{ 'n': 1 }, { 'n': 2 }];
	     *
	     * _.minBy(objects, function(o) { return o.n; });
	     * // => { 'n': 1 }
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.minBy(objects, 'n');
	     * // => { 'n': 1 }
	     */function minBy(array,iteratee){return array&&array.length?baseExtremum(array,getIteratee(iteratee,2),baseLt):undefined;}/**
	     * Multiply two numbers.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.7.0
	     * @category Math
	     * @param {number} multiplier The first number in a multiplication.
	     * @param {number} multiplicand The second number in a multiplication.
	     * @returns {number} Returns the product.
	     * @example
	     *
	     * _.multiply(6, 4);
	     * // => 24
	     */var multiply=createMathOperation(function(multiplier,multiplicand){return multiplier*multiplicand;},1);/**
	     * Computes `number` rounded to `precision`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.10.0
	     * @category Math
	     * @param {number} number The number to round.
	     * @param {number} [precision=0] The precision to round to.
	     * @returns {number} Returns the rounded number.
	     * @example
	     *
	     * _.round(4.006);
	     * // => 4
	     *
	     * _.round(4.006, 2);
	     * // => 4.01
	     *
	     * _.round(4060, -2);
	     * // => 4100
	     */var round=createRound('round');/**
	     * Subtract two numbers.
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Math
	     * @param {number} minuend The first number in a subtraction.
	     * @param {number} subtrahend The second number in a subtraction.
	     * @returns {number} Returns the difference.
	     * @example
	     *
	     * _.subtract(6, 4);
	     * // => 2
	     */var subtract=createMathOperation(function(minuend,subtrahend){return minuend-subtrahend;},0);/**
	     * Computes the sum of the values in `array`.
	     *
	     * @static
	     * @memberOf _
	     * @since 3.4.0
	     * @category Math
	     * @param {Array} array The array to iterate over.
	     * @returns {number} Returns the sum.
	     * @example
	     *
	     * _.sum([4, 2, 8, 6]);
	     * // => 20
	     */function sum(array){return array&&array.length?baseSum(array,identity):0;}/**
	     * This method is like `_.sum` except that it accepts `iteratee` which is
	     * invoked for each element in `array` to generate the value to be summed.
	     * The iteratee is invoked with one argument: (value).
	     *
	     * @static
	     * @memberOf _
	     * @since 4.0.0
	     * @category Math
	     * @param {Array} array The array to iterate over.
	     * @param {Function} [iteratee=_.identity] The iteratee invoked per element.
	     * @returns {number} Returns the sum.
	     * @example
	     *
	     * var objects = [{ 'n': 4 }, { 'n': 2 }, { 'n': 8 }, { 'n': 6 }];
	     *
	     * _.sumBy(objects, function(o) { return o.n; });
	     * // => 20
	     *
	     * // The `_.property` iteratee shorthand.
	     * _.sumBy(objects, 'n');
	     * // => 20
	     */function sumBy(array,iteratee){return array&&array.length?baseSum(array,getIteratee(iteratee,2)):0;}/*------------------------------------------------------------------------*/// Add methods that return wrapped values in chain sequences.
	lodash.after=after;lodash.ary=ary;lodash.assign=assign;lodash.assignIn=assignIn;lodash.assignInWith=assignInWith;lodash.assignWith=assignWith;lodash.at=at;lodash.before=before;lodash.bind=bind;lodash.bindAll=bindAll;lodash.bindKey=bindKey;lodash.castArray=castArray;lodash.chain=chain;lodash.chunk=chunk;lodash.compact=compact;lodash.concat=concat;lodash.cond=cond;lodash.conforms=conforms;lodash.constant=constant;lodash.countBy=countBy;lodash.create=create;lodash.curry=curry;lodash.curryRight=curryRight;lodash.debounce=debounce;lodash.defaults=defaults;lodash.defaultsDeep=defaultsDeep;lodash.defer=defer;lodash.delay=delay;lodash.difference=difference;lodash.differenceBy=differenceBy;lodash.differenceWith=differenceWith;lodash.drop=drop;lodash.dropRight=dropRight;lodash.dropRightWhile=dropRightWhile;lodash.dropWhile=dropWhile;lodash.fill=fill;lodash.filter=filter;lodash.flatMap=flatMap;lodash.flatMapDeep=flatMapDeep;lodash.flatMapDepth=flatMapDepth;lodash.flatten=flatten;lodash.flattenDeep=flattenDeep;lodash.flattenDepth=flattenDepth;lodash.flip=flip;lodash.flow=flow;lodash.flowRight=flowRight;lodash.fromPairs=fromPairs;lodash.functions=functions;lodash.functionsIn=functionsIn;lodash.groupBy=groupBy;lodash.initial=initial;lodash.intersection=intersection;lodash.intersectionBy=intersectionBy;lodash.intersectionWith=intersectionWith;lodash.invert=invert;lodash.invertBy=invertBy;lodash.invokeMap=invokeMap;lodash.iteratee=iteratee;lodash.keyBy=keyBy;lodash.keys=keys;lodash.keysIn=keysIn;lodash.map=map;lodash.mapKeys=mapKeys;lodash.mapValues=mapValues;lodash.matches=matches;lodash.matchesProperty=matchesProperty;lodash.memoize=memoize;lodash.merge=merge;lodash.mergeWith=mergeWith;lodash.method=method;lodash.methodOf=methodOf;lodash.mixin=mixin;lodash.negate=negate;lodash.nthArg=nthArg;lodash.omit=omit;lodash.omitBy=omitBy;lodash.once=once;lodash.orderBy=orderBy;lodash.over=over;lodash.overArgs=overArgs;lodash.overEvery=overEvery;lodash.overSome=overSome;lodash.partial=partial;lodash.partialRight=partialRight;lodash.partition=partition;lodash.pick=pick;lodash.pickBy=pickBy;lodash.property=property;lodash.propertyOf=propertyOf;lodash.pull=pull;lodash.pullAll=pullAll;lodash.pullAllBy=pullAllBy;lodash.pullAllWith=pullAllWith;lodash.pullAt=pullAt;lodash.range=range;lodash.rangeRight=rangeRight;lodash.rearg=rearg;lodash.reject=reject;lodash.remove=remove;lodash.rest=rest;lodash.reverse=reverse;lodash.sampleSize=sampleSize;lodash.set=set;lodash.setWith=setWith;lodash.shuffle=shuffle;lodash.slice=slice;lodash.sortBy=sortBy;lodash.sortedUniq=sortedUniq;lodash.sortedUniqBy=sortedUniqBy;lodash.split=split;lodash.spread=spread;lodash.tail=tail;lodash.take=take;lodash.takeRight=takeRight;lodash.takeRightWhile=takeRightWhile;lodash.takeWhile=takeWhile;lodash.tap=tap;lodash.throttle=throttle;lodash.thru=thru;lodash.toArray=toArray;lodash.toPairs=toPairs;lodash.toPairsIn=toPairsIn;lodash.toPath=toPath;lodash.toPlainObject=toPlainObject;lodash.transform=transform;lodash.unary=unary;lodash.union=union;lodash.unionBy=unionBy;lodash.unionWith=unionWith;lodash.uniq=uniq;lodash.uniqBy=uniqBy;lodash.uniqWith=uniqWith;lodash.unset=unset;lodash.unzip=unzip;lodash.unzipWith=unzipWith;lodash.update=update;lodash.updateWith=updateWith;lodash.values=values;lodash.valuesIn=valuesIn;lodash.without=without;lodash.words=words;lodash.wrap=wrap;lodash.xor=xor;lodash.xorBy=xorBy;lodash.xorWith=xorWith;lodash.zip=zip;lodash.zipObject=zipObject;lodash.zipObjectDeep=zipObjectDeep;lodash.zipWith=zipWith;// Add aliases.
	lodash.entries=toPairs;lodash.entriesIn=toPairsIn;lodash.extend=assignIn;lodash.extendWith=assignInWith;// Add methods to `lodash.prototype`.
	mixin(lodash,lodash);/*------------------------------------------------------------------------*/// Add methods that return unwrapped values in chain sequences.
	lodash.add=add;lodash.attempt=attempt;lodash.camelCase=camelCase;lodash.capitalize=capitalize;lodash.ceil=ceil;lodash.clamp=clamp;lodash.clone=clone;lodash.cloneDeep=cloneDeep;lodash.cloneDeepWith=cloneDeepWith;lodash.cloneWith=cloneWith;lodash.conformsTo=conformsTo;lodash.deburr=deburr;lodash.defaultTo=defaultTo;lodash.divide=divide;lodash.endsWith=endsWith;lodash.eq=eq;lodash.escape=escape;lodash.escapeRegExp=escapeRegExp;lodash.every=every;lodash.find=find;lodash.findIndex=findIndex;lodash.findKey=findKey;lodash.findLast=findLast;lodash.findLastIndex=findLastIndex;lodash.findLastKey=findLastKey;lodash.floor=floor;lodash.forEach=forEach;lodash.forEachRight=forEachRight;lodash.forIn=forIn;lodash.forInRight=forInRight;lodash.forOwn=forOwn;lodash.forOwnRight=forOwnRight;lodash.get=get;lodash.gt=gt;lodash.gte=gte;lodash.has=has;lodash.hasIn=hasIn;lodash.head=head;lodash.identity=identity;lodash.includes=includes;lodash.indexOf=indexOf;lodash.inRange=inRange;lodash.invoke=invoke;lodash.isArguments=isArguments;lodash.isArray=isArray;lodash.isArrayBuffer=isArrayBuffer;lodash.isArrayLike=isArrayLike;lodash.isArrayLikeObject=isArrayLikeObject;lodash.isBoolean=isBoolean;lodash.isBuffer=isBuffer;lodash.isDate=isDate;lodash.isElement=isElement;lodash.isEmpty=isEmpty;lodash.isEqual=isEqual;lodash.isEqualWith=isEqualWith;lodash.isError=isError;lodash.isFinite=isFinite;lodash.isFunction=isFunction;lodash.isInteger=isInteger;lodash.isLength=isLength;lodash.isMap=isMap;lodash.isMatch=isMatch;lodash.isMatchWith=isMatchWith;lodash.isNaN=isNaN;lodash.isNative=isNative;lodash.isNil=isNil;lodash.isNull=isNull;lodash.isNumber=isNumber;lodash.isObject=isObject;lodash.isObjectLike=isObjectLike;lodash.isPlainObject=isPlainObject;lodash.isRegExp=isRegExp;lodash.isSafeInteger=isSafeInteger;lodash.isSet=isSet;lodash.isString=isString;lodash.isSymbol=isSymbol;lodash.isTypedArray=isTypedArray;lodash.isUndefined=isUndefined;lodash.isWeakMap=isWeakMap;lodash.isWeakSet=isWeakSet;lodash.join=join;lodash.kebabCase=kebabCase;lodash.last=last;lodash.lastIndexOf=lastIndexOf;lodash.lowerCase=lowerCase;lodash.lowerFirst=lowerFirst;lodash.lt=lt;lodash.lte=lte;lodash.max=max;lodash.maxBy=maxBy;lodash.mean=mean;lodash.meanBy=meanBy;lodash.min=min;lodash.minBy=minBy;lodash.stubArray=stubArray;lodash.stubFalse=stubFalse;lodash.stubObject=stubObject;lodash.stubString=stubString;lodash.stubTrue=stubTrue;lodash.multiply=multiply;lodash.nth=nth;lodash.noConflict=noConflict;lodash.noop=noop;lodash.now=now;lodash.pad=pad;lodash.padEnd=padEnd;lodash.padStart=padStart;lodash.parseInt=parseInt;lodash.random=random;lodash.reduce=reduce;lodash.reduceRight=reduceRight;lodash.repeat=repeat;lodash.replace=replace;lodash.result=result;lodash.round=round;lodash.runInContext=runInContext;lodash.sample=sample;lodash.size=size;lodash.snakeCase=snakeCase;lodash.some=some;lodash.sortedIndex=sortedIndex;lodash.sortedIndexBy=sortedIndexBy;lodash.sortedIndexOf=sortedIndexOf;lodash.sortedLastIndex=sortedLastIndex;lodash.sortedLastIndexBy=sortedLastIndexBy;lodash.sortedLastIndexOf=sortedLastIndexOf;lodash.startCase=startCase;lodash.startsWith=startsWith;lodash.subtract=subtract;lodash.sum=sum;lodash.sumBy=sumBy;lodash.template=template;lodash.times=times;lodash.toFinite=toFinite;lodash.toInteger=toInteger;lodash.toLength=toLength;lodash.toLower=toLower;lodash.toNumber=toNumber;lodash.toSafeInteger=toSafeInteger;lodash.toString=toString;lodash.toUpper=toUpper;lodash.trim=trim;lodash.trimEnd=trimEnd;lodash.trimStart=trimStart;lodash.truncate=truncate;lodash.unescape=unescape;lodash.uniqueId=uniqueId;lodash.upperCase=upperCase;lodash.upperFirst=upperFirst;// Add aliases.
	lodash.each=forEach;lodash.eachRight=forEachRight;lodash.first=head;mixin(lodash,function(){var source={};baseForOwn(lodash,function(func,methodName){if(!hasOwnProperty.call(lodash.prototype,methodName)){source[methodName]=func;}});return source;}(),{'chain':false});/*------------------------------------------------------------------------*//**
	     * The semantic version number.
	     *
	     * @static
	     * @memberOf _
	     * @type {string}
	     */lodash.VERSION=VERSION;// Assign default placeholders.
	arrayEach(['bind','bindKey','curry','curryRight','partial','partialRight'],function(methodName){lodash[methodName].placeholder=lodash;});// Add `LazyWrapper` methods for `_.drop` and `_.take` variants.
	arrayEach(['drop','take'],function(methodName,index){LazyWrapper.prototype[methodName]=function(n){var filtered=this.__filtered__;if(filtered&&!index){return new LazyWrapper(this);}n=n===undefined?1:nativeMax(toInteger(n),0);var result=this.clone();if(filtered){result.__takeCount__=nativeMin(n,result.__takeCount__);}else{result.__views__.push({'size':nativeMin(n,MAX_ARRAY_LENGTH),'type':methodName+(result.__dir__<0?'Right':'')});}return result;};LazyWrapper.prototype[methodName+'Right']=function(n){return this.reverse()[methodName](n).reverse();};});// Add `LazyWrapper` methods that accept an `iteratee` value.
	arrayEach(['filter','map','takeWhile'],function(methodName,index){var type=index+1,isFilter=type==LAZY_FILTER_FLAG||type==LAZY_WHILE_FLAG;LazyWrapper.prototype[methodName]=function(iteratee){var result=this.clone();result.__iteratees__.push({'iteratee':getIteratee(iteratee,3),'type':type});result.__filtered__=result.__filtered__||isFilter;return result;};});// Add `LazyWrapper` methods for `_.head` and `_.last`.
	arrayEach(['head','last'],function(methodName,index){var takeName='take'+(index?'Right':'');LazyWrapper.prototype[methodName]=function(){return this[takeName](1).value()[0];};});// Add `LazyWrapper` methods for `_.initial` and `_.tail`.
	arrayEach(['initial','tail'],function(methodName,index){var dropName='drop'+(index?'':'Right');LazyWrapper.prototype[methodName]=function(){return this.__filtered__?new LazyWrapper(this):this[dropName](1);};});LazyWrapper.prototype.compact=function(){return this.filter(identity);};LazyWrapper.prototype.find=function(predicate){return this.filter(predicate).head();};LazyWrapper.prototype.findLast=function(predicate){return this.reverse().find(predicate);};LazyWrapper.prototype.invokeMap=baseRest(function(path,args){if(typeof path=='function'){return new LazyWrapper(this);}return this.map(function(value){return baseInvoke(value,path,args);});});LazyWrapper.prototype.reject=function(predicate){return this.filter(negate(getIteratee(predicate)));};LazyWrapper.prototype.slice=function(start,end){start=toInteger(start);var result=this;if(result.__filtered__&&(start>0||end<0)){return new LazyWrapper(result);}if(start<0){result=result.takeRight(-start);}else if(start){result=result.drop(start);}if(end!==undefined){end=toInteger(end);result=end<0?result.dropRight(-end):result.take(end-start);}return result;};LazyWrapper.prototype.takeRightWhile=function(predicate){return this.reverse().takeWhile(predicate).reverse();};LazyWrapper.prototype.toArray=function(){return this.take(MAX_ARRAY_LENGTH);};// Add `LazyWrapper` methods to `lodash.prototype`.
	baseForOwn(LazyWrapper.prototype,function(func,methodName){var checkIteratee=/^(?:filter|find|map|reject)|While$/.test(methodName),isTaker=/^(?:head|last)$/.test(methodName),lodashFunc=lodash[isTaker?'take'+(methodName=='last'?'Right':''):methodName],retUnwrapped=isTaker||/^find/.test(methodName);if(!lodashFunc){return;}lodash.prototype[methodName]=function(){var value=this.__wrapped__,args=isTaker?[1]:arguments,isLazy=value instanceof LazyWrapper,iteratee=args[0],useLazy=isLazy||isArray(value);var interceptor=function interceptor(value){var result=lodashFunc.apply(lodash,arrayPush([value],args));return isTaker&&chainAll?result[0]:result;};if(useLazy&&checkIteratee&&typeof iteratee=='function'&&iteratee.length!=1){// Avoid lazy use if the iteratee has a "length" value other than `1`.
	isLazy=useLazy=false;}var chainAll=this.__chain__,isHybrid=!!this.__actions__.length,isUnwrapped=retUnwrapped&&!chainAll,onlyLazy=isLazy&&!isHybrid;if(!retUnwrapped&&useLazy){value=onlyLazy?value:new LazyWrapper(this);var result=func.apply(value,args);result.__actions__.push({'func':thru,'args':[interceptor],'thisArg':undefined});return new LodashWrapper(result,chainAll);}if(isUnwrapped&&onlyLazy){return func.apply(this,args);}result=this.thru(interceptor);return isUnwrapped?isTaker?result.value()[0]:result.value():result;};});// Add `Array` methods to `lodash.prototype`.
	arrayEach(['pop','push','shift','sort','splice','unshift'],function(methodName){var func=arrayProto[methodName],chainName=/^(?:push|sort|unshift)$/.test(methodName)?'tap':'thru',retUnwrapped=/^(?:pop|shift)$/.test(methodName);lodash.prototype[methodName]=function(){var args=arguments;if(retUnwrapped&&!this.__chain__){var value=this.value();return func.apply(isArray(value)?value:[],args);}return this[chainName](function(value){return func.apply(isArray(value)?value:[],args);});};});// Map minified method names to their real names.
	baseForOwn(LazyWrapper.prototype,function(func,methodName){var lodashFunc=lodash[methodName];if(lodashFunc){var key=lodashFunc.name+'',names=realNames[key]||(realNames[key]=[]);names.push({'name':methodName,'func':lodashFunc});}});realNames[createHybrid(undefined,WRAP_BIND_KEY_FLAG).name]=[{'name':'wrapper','func':undefined}];// Add methods to `LazyWrapper`.
	LazyWrapper.prototype.clone=lazyClone;LazyWrapper.prototype.reverse=lazyReverse;LazyWrapper.prototype.value=lazyValue;// Add chain sequence methods to the `lodash` wrapper.
	lodash.prototype.at=wrapperAt;lodash.prototype.chain=wrapperChain;lodash.prototype.commit=wrapperCommit;lodash.prototype.next=wrapperNext;lodash.prototype.plant=wrapperPlant;lodash.prototype.reverse=wrapperReverse;lodash.prototype.toJSON=lodash.prototype.valueOf=lodash.prototype.value=wrapperValue;// Add lazy aliases.
	lodash.prototype.first=lodash.prototype.head;if(symIterator){lodash.prototype[symIterator]=wrapperToIterator;}return lodash;};/*--------------------------------------------------------------------------*/// Export lodash.
	var _=runInContext();// Some AMD build optimizers, like r.js, check for condition patterns like:
	if("function"=='function'&&_typeof(__webpack_require__(5))=='object'&&__webpack_require__(5)){// Expose Lodash on the global object to prevent errors when Lodash is
	// loaded by a script tag in the presence of an AMD loader.
	// See http://requirejs.org/docs/errors.html#mismatch for more details.
	// Use `_.noConflict` to remove Lodash from the global object.
	root._=_;// Define as an anonymous module so, through path mapping, it can be
	// referenced as the "underscore" module.
	!(__WEBPACK_AMD_DEFINE_RESULT__ = function(){return _;}.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));}// Check for `exports` after `define` in case a build optimizer adds it.
	else if(freeModule){// Export for Node.js.
	(freeModule.exports=_)._=_;// Export for CommonJS support.
	freeExports._=_;}else{// Export to the global object.
	root._=_;}}).call(undefined);
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(4)(module)))

/***/ },
/* 4 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = function (module) {
		if (!module.webpackPolyfill) {
			module.deprecate = function () {};
			module.paths = [];
			// module.parent = undefined by default
			module.children = [];
			module.webpackPolyfill = 1;
		}
		return module;
	};

/***/ },
/* 5 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(__webpack_amd_options__) {module.exports = __webpack_amd_options__;
	
	/* WEBPACK VAR INJECTION */}.call(exports, {}))

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	module.exports.Model = __webpack_require__(7);
	module.exports.Collection = __webpack_require__(12);
	module.exports.Events = __webpack_require__(8);
	module.exports.extend = __webpack_require__(10);

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	//     Backbone.js 1.1.2
	
	//     (c) 2010-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	//     Backbone may be freely distributed under the MIT license.
	//     For all details and documentation:
	//     http://backbonejs.org
	
	var Events = __webpack_require__(8);
	var extend = __webpack_require__(10);
	var _ = __webpack_require__(11);
	
	// Backbone.Model
	// --------------
	
	// Backbone **Models** are the basic data object in the framework --
	// frequently representing a row in a table in a database on your server.
	// A discrete chunk of data and a bunch of useful, related methods for
	// performing computations and transformations on that data.
	
	// Create a new model with the specified attributes. A client id (`cid`)
	// is automatically generated and assigned for you.
	var Model = function Model(attributes, options) {
	  var attrs = attributes || {};
	  options || (options = {});
	  this.cid = _.uniqueId('c');
	  this.attributes = {};
	  if (options.collection) this.collection = options.collection;
	  if (options.parse) attrs = this.parse(attrs, options) || {};
	  attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
	  this.set(attrs, options);
	  this.changed = {};
	  this.initialize.apply(this, arguments);
	};
	
	// Attach all inheritable methods to the Model prototype.
	_.extend(Model.prototype, Events, {
	
	  // A hash of attributes whose current and previous value differ.
	  changed: null,
	
	  // The value returned during the last failed validation.
	  validationError: null,
	
	  // The default name for the JSON `id` attribute is `"id"`. MongoDB and
	  // CouchDB users may want to set this to `"_id"`.
	  idAttribute: 'id',
	
	  // Initialize is an empty function by default. Override it with your own
	  // initialization logic.
	  initialize: function initialize() {},
	
	  // Return a copy of the model's `attributes` object.
	  toJSON: function toJSON(options) {
	    return _.clone(this.attributes);
	  },
	
	  // Proxy `Backbone.sync` by default -- but override this if you need
	  // custom syncing semantics for *this* particular model.
	  sync: function sync() {
	    return Backbone.sync.apply(this, arguments);
	  },
	
	  // Get the value of an attribute.
	  get: function get(attr) {
	    return this.attributes[attr];
	  },
	
	  // Get the HTML-escaped value of an attribute.
	  escape: function escape(attr) {
	    return _.escape(this.get(attr));
	  },
	
	  // Returns `true` if the attribute contains a value that is not null
	  // or undefined.
	  has: function has(attr) {
	    return this.get(attr) != null;
	  },
	
	  // Set a hash of model attributes on the object, firing `"change"`. This is
	  // the core primitive operation of a model, updating the data and notifying
	  // anyone who needs to know about the change in state. The heart of the beast.
	  set: function set(key, val, options) {
	    var attr, attrs, unset, changes, silent, changing, prev, current;
	    if (key == null) return this;
	
	    // Handle both `"key", value` and `{key: value}` -style arguments.
	    if ((typeof key === "undefined" ? "undefined" : _typeof(key)) === 'object') {
	      attrs = key;
	      options = val;
	    } else {
	      (attrs = {})[key] = val;
	    }
	
	    options || (options = {});
	
	    // Run validation.
	    if (!this._validate(attrs, options)) return false;
	
	    // Extract attributes and options.
	    unset = options.unset;
	    silent = options.silent;
	    changes = [];
	    changing = this._changing;
	    this._changing = true;
	
	    if (!changing) {
	      this._previousAttributes = _.clone(this.attributes);
	      this.changed = {};
	    }
	    current = this.attributes, prev = this._previousAttributes;
	
	    // Check for changes of `id`.
	    if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];
	
	    // For each `set` attribute, update or delete the current value.
	    for (attr in attrs) {
	      val = attrs[attr];
	      if (!_.isEqual(current[attr], val)) changes.push(attr);
	      if (!_.isEqual(prev[attr], val)) {
	        this.changed[attr] = val;
	      } else {
	        delete this.changed[attr];
	      }
	      unset ? delete current[attr] : current[attr] = val;
	    }
	
	    // Trigger all relevant attribute changes.
	    if (!silent) {
	      if (changes.length) this._pending = options;
	      for (var i = 0, length = changes.length; i < length; i++) {
	        this.trigger('change:' + changes[i], this, current[changes[i]], options);
	      }
	    }
	
	    // You might be wondering why there's a `while` loop here. Changes can
	    // be recursively nested within `"change"` events.
	    if (changing) return this;
	    if (!silent) {
	      while (this._pending) {
	        options = this._pending;
	        this._pending = false;
	        this.trigger('change', this, options);
	      }
	    }
	    this._pending = false;
	    this._changing = false;
	    return this;
	  },
	
	  // Remove an attribute from the model, firing `"change"`. `unset` is a noop
	  // if the attribute doesn't exist.
	  unset: function unset(attr, options) {
	    return this.set(attr, void 0, _.extend({}, options, { unset: true }));
	  },
	
	  // Clear all attributes on the model, firing `"change"`.
	  clear: function clear(options) {
	    var attrs = {};
	    for (var key in this.attributes) {
	      attrs[key] = void 0;
	    }return this.set(attrs, _.extend({}, options, { unset: true }));
	  },
	
	  // Determine if the model has changed since the last `"change"` event.
	  // If you specify an attribute name, determine if that attribute has changed.
	  hasChanged: function hasChanged(attr) {
	    if (attr == null) return !_.isEmpty(this.changed);
	    return _.has(this.changed, attr);
	  },
	
	  // Return an object containing all the attributes that have changed, or
	  // false if there are no changed attributes. Useful for determining what
	  // parts of a view need to be updated and/or what attributes need to be
	  // persisted to the server. Unset attributes will be set to undefined.
	  // You can also pass an attributes object to diff against the model,
	  // determining if there *would be* a change.
	  changedAttributes: function changedAttributes(diff) {
	    if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
	    var val,
	        changed = false;
	    var old = this._changing ? this._previousAttributes : this.attributes;
	    for (var attr in diff) {
	      if (_.isEqual(old[attr], val = diff[attr])) continue;
	      (changed || (changed = {}))[attr] = val;
	    }
	    return changed;
	  },
	
	  // Get the previous value of an attribute, recorded at the time the last
	  // `"change"` event was fired.
	  previous: function previous(attr) {
	    if (attr == null || !this._previousAttributes) return null;
	    return this._previousAttributes[attr];
	  },
	
	  // Get all of the attributes of the model at the time of the previous
	  // `"change"` event.
	  previousAttributes: function previousAttributes() {
	    return _.clone(this._previousAttributes);
	  },
	
	  // Fetch the model from the server. If the server's representation of the
	  // model differs from its current attributes, they will be overridden,
	  // triggering a `"change"` event.
	  fetch: function fetch(options) {
	    options = options ? _.clone(options) : {};
	    if (options.parse === void 0) options.parse = true;
	    var model = this;
	    var success = options.success;
	    options.success = function (resp) {
	      if (!model.set(model.parse(resp, options), options)) return false;
	      if (success) success(model, resp, options);
	      model.trigger('sync', model, resp, options);
	    };
	    wrapError(this, options);
	    return this.sync('read', this, options);
	  },
	
	  // Set a hash of model attributes, and sync the model to the server.
	  // If the server returns an attributes hash that differs, the model's
	  // state will be `set` again.
	  save: function save(key, val, options) {
	    var attrs,
	        method,
	        xhr,
	        attributes = this.attributes;
	
	    // Handle both `"key", value` and `{key: value}` -style arguments.
	    if (key == null || (typeof key === "undefined" ? "undefined" : _typeof(key)) === 'object') {
	      attrs = key;
	      options = val;
	    } else {
	      (attrs = {})[key] = val;
	    }
	
	    options = _.extend({ validate: true }, options);
	
	    // If we're not waiting and attributes exist, save acts as
	    // `set(attr).save(null, opts)` with validation. Otherwise, check if
	    // the model will be valid when the attributes, if any, are set.
	    if (attrs && !options.wait) {
	      if (!this.set(attrs, options)) return false;
	    } else {
	      if (!this._validate(attrs, options)) return false;
	    }
	
	    // Set temporary attributes if `{wait: true}`.
	    if (attrs && options.wait) {
	      this.attributes = _.extend({}, attributes, attrs);
	    }
	
	    // After a successful server-side save, the client is (optionally)
	    // updated with the server-side state.
	    if (options.parse === void 0) options.parse = true;
	    var model = this;
	    var success = options.success;
	    options.success = function (resp) {
	      // Ensure attributes are restored during synchronous saves.
	      model.attributes = attributes;
	      var serverAttrs = model.parse(resp, options);
	      if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
	      if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
	        return false;
	      }
	      if (success) success(model, resp, options);
	      model.trigger('sync', model, resp, options);
	    };
	    wrapError(this, options);
	
	    method = this.isNew() ? 'create' : options.patch ? 'patch' : 'update';
	    if (method === 'patch' && !options.attrs) options.attrs = attrs;
	    xhr = this.sync(method, this, options);
	
	    // Restore attributes.
	    if (attrs && options.wait) this.attributes = attributes;
	
	    return xhr;
	  },
	
	  // Destroy this model on the server if it was already persisted.
	  // Optimistically removes the model from its collection, if it has one.
	  // If `wait: true` is passed, waits for the server to respond before removal.
	  destroy: function destroy(options) {
	    options = options ? _.clone(options) : {};
	    var model = this;
	    var success = options.success;
	
	    var destroy = function destroy() {
	      model.stopListening();
	      model.trigger('destroy', model, model.collection, options);
	    };
	
	    options.success = function (resp) {
	      if (options.wait || model.isNew()) destroy();
	      if (success) success(model, resp, options);
	      if (!model.isNew()) model.trigger('sync', model, resp, options);
	    };
	
	    if (this.isNew()) {
	      options.success();
	      return false;
	    }
	    wrapError(this, options);
	
	    var xhr = this.sync('delete', this, options);
	    if (!options.wait) destroy();
	    return xhr;
	  },
	
	  // Default URL for the model's representation on the server -- if you're
	  // using Backbone's restful methods, override this to change the endpoint
	  // that will be called.
	  url: function url() {
	    var base = _.result(this, 'urlRoot') || _.result(this.collection, 'url') || urlError();
	    if (this.isNew()) return base;
	    return base.replace(/([^\/])$/, '$1/') + encodeURIComponent(this.id);
	  },
	
	  // **parse** converts a response into the hash of attributes to be `set` on
	  // the model. The default implementation is just to pass the response along.
	  parse: function parse(resp, options) {
	    return resp;
	  },
	
	  // Create a new model with identical attributes to this one.
	  clone: function clone() {
	    return new this.constructor(this.attributes);
	  },
	
	  // A model is new if it has never been saved to the server, and lacks an id.
	  isNew: function isNew() {
	    return !this.has(this.idAttribute);
	  },
	
	  // Check if the model is currently in a valid state.
	  isValid: function isValid(options) {
	    return this._validate({}, _.extend(options || {}, { validate: true }));
	  },
	
	  // Run validation against the next complete set of model attributes,
	  // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
	  _validate: function _validate(attrs, options) {
	    if (!options.validate || !this.validate) return true;
	    attrs = _.extend({}, this.attributes, attrs);
	    var error = this.validationError = this.validate(attrs, options) || null;
	    if (!error) return true;
	    this.trigger('invalid', this, error, _.extend(options, { validationError: error }));
	    return false;
	  }
	
	});
	
	// Underscore methods that we want to implement on the Model.
	var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit', 'chain', 'isEmpty'];
	
	// Mix in each Underscore method as a proxy to `Model#attributes`.
	_.each(modelMethods, function (method) {
	  if (!_[method]) return;
	  Model.prototype[method] = function () {
	    var args = slice.call(arguments);
	    args.unshift(this.attributes);
	    return _[method].apply(_, args);
	  };
	});
	
	// setup inheritance
	Model.extend = extend;
	module.exports = Model;

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	module.exports = __webpack_require__(9);

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	/**
	 * Standalone extraction of Backbone.Events, no external dependency required.
	 * Degrades nicely when Backone/underscore are already available in the current
	 * global context.
	 *
	 * Note that docs suggest to use underscore's `_.extend()` method to add Events
	 * support to some given object. A `mixin()` method has been added to the Events
	 * prototype to avoid using underscore for that sole purpose:
	 *
	 *     var myEventEmitter = BackboneEvents.mixin({});
	 *
	 * Or for a function constructor:
	 *
	 *     function MyConstructor(){}
	 *     MyConstructor.prototype.foo = function(){}
	 *     BackboneEvents.mixin(MyConstructor.prototype);
	 *
	 * (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
	 * (c) 2013 Nicolas Perriault
	 */
	/* global exports:true, define, module */
	(function () {
	  var root = this,
	      nativeForEach = Array.prototype.forEach,
	      hasOwnProperty = Object.prototype.hasOwnProperty,
	      slice = Array.prototype.slice,
	      idCounter = 0;
	
	  // Returns a partial implementation matching the minimal API subset required
	  // by Backbone.Events
	  function miniscore() {
	    return {
	      keys: Object.keys || function (obj) {
	        if ((typeof obj === "undefined" ? "undefined" : _typeof(obj)) !== "object" && typeof obj !== "function" || obj === null) {
	          throw new TypeError("keys() called on a non-object");
	        }
	        var key,
	            keys = [];
	        for (key in obj) {
	          if (obj.hasOwnProperty(key)) {
	            keys[keys.length] = key;
	          }
	        }
	        return keys;
	      },
	
	      uniqueId: function uniqueId(prefix) {
	        var id = ++idCounter + '';
	        return prefix ? prefix + id : id;
	      },
	
	      has: function has(obj, key) {
	        return hasOwnProperty.call(obj, key);
	      },
	
	      each: function each(obj, iterator, context) {
	        if (obj == null) return;
	        if (nativeForEach && obj.forEach === nativeForEach) {
	          obj.forEach(iterator, context);
	        } else if (obj.length === +obj.length) {
	          for (var i = 0, l = obj.length; i < l; i++) {
	            iterator.call(context, obj[i], i, obj);
	          }
	        } else {
	          for (var key in obj) {
	            if (this.has(obj, key)) {
	              iterator.call(context, obj[key], key, obj);
	            }
	          }
	        }
	      },
	
	      once: function once(func) {
	        var ran = false,
	            memo;
	        return function () {
	          if (ran) return memo;
	          ran = true;
	          memo = func.apply(this, arguments);
	          func = null;
	          return memo;
	        };
	      }
	    };
	  }
	
	  var _ = miniscore(),
	      Events;
	
	  // Backbone.Events
	  // ---------------
	
	  // A module that can be mixed in to *any object* in order to provide it with
	  // custom events. You may bind with `on` or remove with `off` callback
	  // functions to an event; `trigger`-ing an event fires all callbacks in
	  // succession.
	  //
	  //     var object = {};
	  //     _.extend(object, Backbone.Events);
	  //     object.on('expand', function(){ alert('expanded'); });
	  //     object.trigger('expand');
	  //
	  Events = {
	
	    // Bind an event to a `callback` function. Passing `"all"` will bind
	    // the callback to all events fired.
	    on: function on(name, callback, context) {
	      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
	      this._events || (this._events = {});
	      var events = this._events[name] || (this._events[name] = []);
	      events.push({ callback: callback, context: context, ctx: context || this });
	      return this;
	    },
	
	    // Bind an event to only be triggered a single time. After the first time
	    // the callback is invoked, it will be removed.
	    once: function once(name, callback, context) {
	      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
	      var self = this;
	      var once = _.once(function () {
	        self.off(name, once);
	        callback.apply(this, arguments);
	      });
	      once._callback = callback;
	      return this.on(name, once, context);
	    },
	
	    // Remove one or many callbacks. If `context` is null, removes all
	    // callbacks with that function. If `callback` is null, removes all
	    // callbacks for the event. If `name` is null, removes all bound
	    // callbacks for all events.
	    off: function off(name, callback, context) {
	      var retain, ev, events, names, i, l, j, k;
	      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
	      if (!name && !callback && !context) {
	        this._events = {};
	        return this;
	      }
	
	      names = name ? [name] : _.keys(this._events);
	      for (i = 0, l = names.length; i < l; i++) {
	        name = names[i];
	        if (events = this._events[name]) {
	          this._events[name] = retain = [];
	          if (callback || context) {
	            for (j = 0, k = events.length; j < k; j++) {
	              ev = events[j];
	              if (callback && callback !== ev.callback && callback !== ev.callback._callback || context && context !== ev.context) {
	                retain.push(ev);
	              }
	            }
	          }
	          if (!retain.length) delete this._events[name];
	        }
	      }
	
	      return this;
	    },
	
	    // Trigger one or many events, firing all bound callbacks. Callbacks are
	    // passed the same arguments as `trigger` is, apart from the event name
	    // (unless you're listening on `"all"`, which will cause your callback to
	    // receive the true name of the event as the first argument).
	    trigger: function trigger(name) {
	      if (!this._events) return this;
	      var args = slice.call(arguments, 1);
	      if (!eventsApi(this, 'trigger', name, args)) return this;
	      var events = this._events[name];
	      var allEvents = this._events.all;
	      if (events) triggerEvents(events, args);
	      if (allEvents) triggerEvents(allEvents, arguments);
	      return this;
	    },
	
	    // Tell this object to stop listening to either specific events ... or
	    // to every object it's currently listening to.
	    stopListening: function stopListening(obj, name, callback) {
	      var listeners = this._listeners;
	      if (!listeners) return this;
	      var deleteListener = !name && !callback;
	      if ((typeof name === "undefined" ? "undefined" : _typeof(name)) === 'object') callback = this;
	      if (obj) (listeners = {})[obj._listenerId] = obj;
	      for (var id in listeners) {
	        listeners[id].off(name, callback, this);
	        if (deleteListener) delete this._listeners[id];
	      }
	      return this;
	    }
	
	  };
	
	  // Regular expression used to split event strings.
	  var eventSplitter = /\s+/;
	
	  // Implement fancy features of the Events API such as multiple event
	  // names `"change blur"` and jQuery-style event maps `{change: action}`
	  // in terms of the existing API.
	  var eventsApi = function eventsApi(obj, action, name, rest) {
	    if (!name) return true;
	
	    // Handle event maps.
	    if ((typeof name === "undefined" ? "undefined" : _typeof(name)) === 'object') {
	      for (var key in name) {
	        obj[action].apply(obj, [key, name[key]].concat(rest));
	      }
	      return false;
	    }
	
	    // Handle space separated event names.
	    if (eventSplitter.test(name)) {
	      var names = name.split(eventSplitter);
	      for (var i = 0, l = names.length; i < l; i++) {
	        obj[action].apply(obj, [names[i]].concat(rest));
	      }
	      return false;
	    }
	
	    return true;
	  };
	
	  // A difficult-to-believe, but optimized internal dispatch function for
	  // triggering events. Tries to keep the usual cases speedy (most internal
	  // Backbone events have 3 arguments).
	  var triggerEvents = function triggerEvents(events, args) {
	    var ev,
	        i = -1,
	        l = events.length,
	        a1 = args[0],
	        a2 = args[1],
	        a3 = args[2];
	    switch (args.length) {
	      case 0:
	        while (++i < l) {
	          (ev = events[i]).callback.call(ev.ctx);
	        }return;
	      case 1:
	        while (++i < l) {
	          (ev = events[i]).callback.call(ev.ctx, a1);
	        }return;
	      case 2:
	        while (++i < l) {
	          (ev = events[i]).callback.call(ev.ctx, a1, a2);
	        }return;
	      case 3:
	        while (++i < l) {
	          (ev = events[i]).callback.call(ev.ctx, a1, a2, a3);
	        }return;
	      default:
	        while (++i < l) {
	          (ev = events[i]).callback.apply(ev.ctx, args);
	        }}
	  };
	
	  var listenMethods = { listenTo: 'on', listenToOnce: 'once' };
	
	  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
	  // listen to an event in another object ... keeping track of what it's
	  // listening to.
	  _.each(listenMethods, function (implementation, method) {
	    Events[method] = function (obj, name, callback) {
	      var listeners = this._listeners || (this._listeners = {});
	      var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
	      listeners[id] = obj;
	      if ((typeof name === "undefined" ? "undefined" : _typeof(name)) === 'object') callback = this;
	      obj[implementation](name, callback, this);
	      return this;
	    };
	  });
	
	  // Aliases for backwards compatibility.
	  Events.bind = Events.on;
	  Events.unbind = Events.off;
	
	  // Mixin utility
	  Events.mixin = function (proto) {
	    var exports = ['on', 'once', 'off', 'trigger', 'stopListening', 'listenTo', 'listenToOnce', 'bind', 'unbind'];
	    _.each(exports, function (name) {
	      proto[name] = this[name];
	    }, this);
	    return proto;
	  };
	
	  // Export Events as BackboneEvents depending on current context
	  if (true) {
	    if (typeof module !== 'undefined' && module.exports) {
	      exports = module.exports = Events;
	    }
	    exports.BackboneEvents = Events;
	  } else if (typeof define === "function" && _typeof(define.amd) == "object") {
	    define(function () {
	      return Events;
	    });
	  } else {
	    root.BackboneEvents = Events;
	  }
	})(undefined);

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_RESULT__;"use strict";
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	(function (definition) {
	  if (( false ? "undefined" : _typeof(exports)) === "object") {
	    module.exports = definition();
	  } else if (true) {
	    !(__WEBPACK_AMD_DEFINE_FACTORY__ = (definition), __WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ? (__WEBPACK_AMD_DEFINE_FACTORY__.call(exports, __webpack_require__, exports, module)) : __WEBPACK_AMD_DEFINE_FACTORY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	  } else {
	    window.BackboneExtend = definition();
	  }
	})(function () {
	  "use strict";
	
	  // mini-underscore
	
	  var _ = {
	    has: function has(obj, key) {
	      return Object.prototype.hasOwnProperty.call(obj, key);
	    },
	
	    extend: function extend(obj) {
	      for (var i = 1; i < arguments.length; ++i) {
	        var source = arguments[i];
	        if (source) {
	          for (var prop in source) {
	            obj[prop] = source[prop];
	          }
	        }
	      }
	      return obj;
	    }
	  };
	
	  /// Following code is pasted from Backbone.js ///
	
	  // Helper function to correctly set up the prototype chain, for subclasses.
	  // Similar to `goog.inherits`, but uses a hash of prototype properties and
	  // class properties to be extended.
	  var extend = function extend(protoProps, staticProps) {
	    var parent = this;
	    var child;
	
	    // The constructor function for the new subclass is either defined by you
	    // (the "constructor" property in your `extend` definition), or defaulted
	    // by us to simply call the parent's constructor.
	    if (protoProps && _.has(protoProps, 'constructor')) {
	      child = protoProps.constructor;
	    } else {
	      child = function child() {
	        return parent.apply(this, arguments);
	      };
	    }
	
	    // Add static properties to the constructor function, if supplied.
	    _.extend(child, parent, staticProps);
	
	    // Set the prototype chain to inherit from `parent`, without calling
	    // `parent`'s constructor function.
	    var Surrogate = function Surrogate() {
	      this.constructor = child;
	    };
	    Surrogate.prototype = parent.prototype;
	    child.prototype = new Surrogate();
	
	    // Add prototype properties (instance properties) to the subclass,
	    // if supplied.
	    if (protoProps) _.extend(child.prototype, protoProps);
	
	    // Set a convenience property in case the parent's prototype is needed
	    // later.
	    child.__super__ = parent.prototype;
	
	    return child;
	  };
	
	  // Expose the extend function
	  return extend;
	});

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;'use strict';
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	//     Underscore.js 1.8.3
	//     http://underscorejs.org
	//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	//     Underscore may be freely distributed under the MIT license.
	
	(function () {
	
	  // Baseline setup
	  // --------------
	
	  // Establish the root object, `window` in the browser, or `exports` on the server.
	  var root = this;
	
	  // Save the previous value of the `_` variable.
	  var previousUnderscore = root._;
	
	  // Save bytes in the minified (but not gzipped) version:
	  var ArrayProto = Array.prototype,
	      ObjProto = Object.prototype,
	      FuncProto = Function.prototype;
	
	  // Create quick reference variables for speed access to core prototypes.
	  var push = ArrayProto.push,
	      slice = ArrayProto.slice,
	      toString = ObjProto.toString,
	      hasOwnProperty = ObjProto.hasOwnProperty;
	
	  // All **ECMAScript 5** native function implementations that we hope to use
	  // are declared here.
	  var nativeIsArray = Array.isArray,
	      nativeKeys = Object.keys,
	      nativeBind = FuncProto.bind,
	      nativeCreate = Object.create;
	
	  // Naked function reference for surrogate-prototype-swapping.
	  var Ctor = function Ctor() {};
	
	  // Create a safe reference to the Underscore object for use below.
	  var _ = function _(obj) {
	    if (obj instanceof _) return obj;
	    if (!(this instanceof _)) return new _(obj);
	    this._wrapped = obj;
	  };
	
	  // Export the Underscore object for **Node.js**, with
	  // backwards-compatibility for the old `require()` API. If we're in
	  // the browser, add `_` as a global object.
	  if (true) {
	    if (typeof module !== 'undefined' && module.exports) {
	      exports = module.exports = _;
	    }
	    exports._ = _;
	  } else {
	    root._ = _;
	  }
	
	  // Current version.
	  _.VERSION = '1.8.3';
	
	  // Internal function that returns an efficient (for current engines) version
	  // of the passed-in callback, to be repeatedly applied in other Underscore
	  // functions.
	  var optimizeCb = function optimizeCb(func, context, argCount) {
	    if (context === void 0) return func;
	    switch (argCount == null ? 3 : argCount) {
	      case 1:
	        return function (value) {
	          return func.call(context, value);
	        };
	      case 2:
	        return function (value, other) {
	          return func.call(context, value, other);
	        };
	      case 3:
	        return function (value, index, collection) {
	          return func.call(context, value, index, collection);
	        };
	      case 4:
	        return function (accumulator, value, index, collection) {
	          return func.call(context, accumulator, value, index, collection);
	        };
	    }
	    return function () {
	      return func.apply(context, arguments);
	    };
	  };
	
	  // A mostly-internal function to generate callbacks that can be applied
	  // to each element in a collection, returning the desired result — either
	  // identity, an arbitrary callback, a property matcher, or a property accessor.
	  var cb = function cb(value, context, argCount) {
	    if (value == null) return _.identity;
	    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
	    if (_.isObject(value)) return _.matcher(value);
	    return _.property(value);
	  };
	  _.iteratee = function (value, context) {
	    return cb(value, context, Infinity);
	  };
	
	  // An internal function for creating assigner functions.
	  var createAssigner = function createAssigner(keysFunc, undefinedOnly) {
	    return function (obj) {
	      var length = arguments.length;
	      if (length < 2 || obj == null) return obj;
	      for (var index = 1; index < length; index++) {
	        var source = arguments[index],
	            keys = keysFunc(source),
	            l = keys.length;
	        for (var i = 0; i < l; i++) {
	          var key = keys[i];
	          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
	        }
	      }
	      return obj;
	    };
	  };
	
	  // An internal function for creating a new object that inherits from another.
	  var baseCreate = function baseCreate(prototype) {
	    if (!_.isObject(prototype)) return {};
	    if (nativeCreate) return nativeCreate(prototype);
	    Ctor.prototype = prototype;
	    var result = new Ctor();
	    Ctor.prototype = null;
	    return result;
	  };
	
	  var property = function property(key) {
	    return function (obj) {
	      return obj == null ? void 0 : obj[key];
	    };
	  };
	
	  // Helper for collection methods to determine whether a collection
	  // should be iterated as an array or as an object
	  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
	  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
	  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
	  var getLength = property('length');
	  var isArrayLike = function isArrayLike(collection) {
	    var length = getLength(collection);
	    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
	  };
	
	  // Collection Functions
	  // --------------------
	
	  // The cornerstone, an `each` implementation, aka `forEach`.
	  // Handles raw objects in addition to array-likes. Treats all
	  // sparse array-likes as if they were dense.
	  _.each = _.forEach = function (obj, iteratee, context) {
	    iteratee = optimizeCb(iteratee, context);
	    var i, length;
	    if (isArrayLike(obj)) {
	      for (i = 0, length = obj.length; i < length; i++) {
	        iteratee(obj[i], i, obj);
	      }
	    } else {
	      var keys = _.keys(obj);
	      for (i = 0, length = keys.length; i < length; i++) {
	        iteratee(obj[keys[i]], keys[i], obj);
	      }
	    }
	    return obj;
	  };
	
	  // Return the results of applying the iteratee to each element.
	  _.map = _.collect = function (obj, iteratee, context) {
	    iteratee = cb(iteratee, context);
	    var keys = !isArrayLike(obj) && _.keys(obj),
	        length = (keys || obj).length,
	        results = Array(length);
	    for (var index = 0; index < length; index++) {
	      var currentKey = keys ? keys[index] : index;
	      results[index] = iteratee(obj[currentKey], currentKey, obj);
	    }
	    return results;
	  };
	
	  // Create a reducing function iterating left or right.
	  function createReduce(dir) {
	    // Optimized iterator function as using arguments.length
	    // in the main function will deoptimize the, see #1991.
	    function iterator(obj, iteratee, memo, keys, index, length) {
	      for (; index >= 0 && index < length; index += dir) {
	        var currentKey = keys ? keys[index] : index;
	        memo = iteratee(memo, obj[currentKey], currentKey, obj);
	      }
	      return memo;
	    }
	
	    return function (obj, iteratee, memo, context) {
	      iteratee = optimizeCb(iteratee, context, 4);
	      var keys = !isArrayLike(obj) && _.keys(obj),
	          length = (keys || obj).length,
	          index = dir > 0 ? 0 : length - 1;
	      // Determine the initial value if none is provided.
	      if (arguments.length < 3) {
	        memo = obj[keys ? keys[index] : index];
	        index += dir;
	      }
	      return iterator(obj, iteratee, memo, keys, index, length);
	    };
	  }
	
	  // **Reduce** builds up a single result from a list of values, aka `inject`,
	  // or `foldl`.
	  _.reduce = _.foldl = _.inject = createReduce(1);
	
	  // The right-associative version of reduce, also known as `foldr`.
	  _.reduceRight = _.foldr = createReduce(-1);
	
	  // Return the first value which passes a truth test. Aliased as `detect`.
	  _.find = _.detect = function (obj, predicate, context) {
	    var key;
	    if (isArrayLike(obj)) {
	      key = _.findIndex(obj, predicate, context);
	    } else {
	      key = _.findKey(obj, predicate, context);
	    }
	    if (key !== void 0 && key !== -1) return obj[key];
	  };
	
	  // Return all the elements that pass a truth test.
	  // Aliased as `select`.
	  _.filter = _.select = function (obj, predicate, context) {
	    var results = [];
	    predicate = cb(predicate, context);
	    _.each(obj, function (value, index, list) {
	      if (predicate(value, index, list)) results.push(value);
	    });
	    return results;
	  };
	
	  // Return all the elements for which a truth test fails.
	  _.reject = function (obj, predicate, context) {
	    return _.filter(obj, _.negate(cb(predicate)), context);
	  };
	
	  // Determine whether all of the elements match a truth test.
	  // Aliased as `all`.
	  _.every = _.all = function (obj, predicate, context) {
	    predicate = cb(predicate, context);
	    var keys = !isArrayLike(obj) && _.keys(obj),
	        length = (keys || obj).length;
	    for (var index = 0; index < length; index++) {
	      var currentKey = keys ? keys[index] : index;
	      if (!predicate(obj[currentKey], currentKey, obj)) return false;
	    }
	    return true;
	  };
	
	  // Determine if at least one element in the object matches a truth test.
	  // Aliased as `any`.
	  _.some = _.any = function (obj, predicate, context) {
	    predicate = cb(predicate, context);
	    var keys = !isArrayLike(obj) && _.keys(obj),
	        length = (keys || obj).length;
	    for (var index = 0; index < length; index++) {
	      var currentKey = keys ? keys[index] : index;
	      if (predicate(obj[currentKey], currentKey, obj)) return true;
	    }
	    return false;
	  };
	
	  // Determine if the array or object contains a given item (using `===`).
	  // Aliased as `includes` and `include`.
	  _.contains = _.includes = _.include = function (obj, item, fromIndex, guard) {
	    if (!isArrayLike(obj)) obj = _.values(obj);
	    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
	    return _.indexOf(obj, item, fromIndex) >= 0;
	  };
	
	  // Invoke a method (with arguments) on every item in a collection.
	  _.invoke = function (obj, method) {
	    var args = slice.call(arguments, 2);
	    var isFunc = _.isFunction(method);
	    return _.map(obj, function (value) {
	      var func = isFunc ? method : value[method];
	      return func == null ? func : func.apply(value, args);
	    });
	  };
	
	  // Convenience version of a common use case of `map`: fetching a property.
	  _.pluck = function (obj, key) {
	    return _.map(obj, _.property(key));
	  };
	
	  // Convenience version of a common use case of `filter`: selecting only objects
	  // containing specific `key:value` pairs.
	  _.where = function (obj, attrs) {
	    return _.filter(obj, _.matcher(attrs));
	  };
	
	  // Convenience version of a common use case of `find`: getting the first object
	  // containing specific `key:value` pairs.
	  _.findWhere = function (obj, attrs) {
	    return _.find(obj, _.matcher(attrs));
	  };
	
	  // Return the maximum element (or element-based computation).
	  _.max = function (obj, iteratee, context) {
	    var result = -Infinity,
	        lastComputed = -Infinity,
	        value,
	        computed;
	    if (iteratee == null && obj != null) {
	      obj = isArrayLike(obj) ? obj : _.values(obj);
	      for (var i = 0, length = obj.length; i < length; i++) {
	        value = obj[i];
	        if (value > result) {
	          result = value;
	        }
	      }
	    } else {
	      iteratee = cb(iteratee, context);
	      _.each(obj, function (value, index, list) {
	        computed = iteratee(value, index, list);
	        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
	          result = value;
	          lastComputed = computed;
	        }
	      });
	    }
	    return result;
	  };
	
	  // Return the minimum element (or element-based computation).
	  _.min = function (obj, iteratee, context) {
	    var result = Infinity,
	        lastComputed = Infinity,
	        value,
	        computed;
	    if (iteratee == null && obj != null) {
	      obj = isArrayLike(obj) ? obj : _.values(obj);
	      for (var i = 0, length = obj.length; i < length; i++) {
	        value = obj[i];
	        if (value < result) {
	          result = value;
	        }
	      }
	    } else {
	      iteratee = cb(iteratee, context);
	      _.each(obj, function (value, index, list) {
	        computed = iteratee(value, index, list);
	        if (computed < lastComputed || computed === Infinity && result === Infinity) {
	          result = value;
	          lastComputed = computed;
	        }
	      });
	    }
	    return result;
	  };
	
	  // Shuffle a collection, using the modern version of the
	  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
	  _.shuffle = function (obj) {
	    var set = isArrayLike(obj) ? obj : _.values(obj);
	    var length = set.length;
	    var shuffled = Array(length);
	    for (var index = 0, rand; index < length; index++) {
	      rand = _.random(0, index);
	      if (rand !== index) shuffled[index] = shuffled[rand];
	      shuffled[rand] = set[index];
	    }
	    return shuffled;
	  };
	
	  // Sample **n** random values from a collection.
	  // If **n** is not specified, returns a single random element.
	  // The internal `guard` argument allows it to work with `map`.
	  _.sample = function (obj, n, guard) {
	    if (n == null || guard) {
	      if (!isArrayLike(obj)) obj = _.values(obj);
	      return obj[_.random(obj.length - 1)];
	    }
	    return _.shuffle(obj).slice(0, Math.max(0, n));
	  };
	
	  // Sort the object's values by a criterion produced by an iteratee.
	  _.sortBy = function (obj, iteratee, context) {
	    iteratee = cb(iteratee, context);
	    return _.pluck(_.map(obj, function (value, index, list) {
	      return {
	        value: value,
	        index: index,
	        criteria: iteratee(value, index, list)
	      };
	    }).sort(function (left, right) {
	      var a = left.criteria;
	      var b = right.criteria;
	      if (a !== b) {
	        if (a > b || a === void 0) return 1;
	        if (a < b || b === void 0) return -1;
	      }
	      return left.index - right.index;
	    }), 'value');
	  };
	
	  // An internal function used for aggregate "group by" operations.
	  var group = function group(behavior) {
	    return function (obj, iteratee, context) {
	      var result = {};
	      iteratee = cb(iteratee, context);
	      _.each(obj, function (value, index) {
	        var key = iteratee(value, index, obj);
	        behavior(result, value, key);
	      });
	      return result;
	    };
	  };
	
	  // Groups the object's values by a criterion. Pass either a string attribute
	  // to group by, or a function that returns the criterion.
	  _.groupBy = group(function (result, value, key) {
	    if (_.has(result, key)) result[key].push(value);else result[key] = [value];
	  });
	
	  // Indexes the object's values by a criterion, similar to `groupBy`, but for
	  // when you know that your index values will be unique.
	  _.indexBy = group(function (result, value, key) {
	    result[key] = value;
	  });
	
	  // Counts instances of an object that group by a certain criterion. Pass
	  // either a string attribute to count by, or a function that returns the
	  // criterion.
	  _.countBy = group(function (result, value, key) {
	    if (_.has(result, key)) result[key]++;else result[key] = 1;
	  });
	
	  // Safely create a real, live array from anything iterable.
	  _.toArray = function (obj) {
	    if (!obj) return [];
	    if (_.isArray(obj)) return slice.call(obj);
	    if (isArrayLike(obj)) return _.map(obj, _.identity);
	    return _.values(obj);
	  };
	
	  // Return the number of elements in an object.
	  _.size = function (obj) {
	    if (obj == null) return 0;
	    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
	  };
	
	  // Split a collection into two arrays: one whose elements all satisfy the given
	  // predicate, and one whose elements all do not satisfy the predicate.
	  _.partition = function (obj, predicate, context) {
	    predicate = cb(predicate, context);
	    var pass = [],
	        fail = [];
	    _.each(obj, function (value, key, obj) {
	      (predicate(value, key, obj) ? pass : fail).push(value);
	    });
	    return [pass, fail];
	  };
	
	  // Array Functions
	  // ---------------
	
	  // Get the first element of an array. Passing **n** will return the first N
	  // values in the array. Aliased as `head` and `take`. The **guard** check
	  // allows it to work with `_.map`.
	  _.first = _.head = _.take = function (array, n, guard) {
	    if (array == null) return void 0;
	    if (n == null || guard) return array[0];
	    return _.initial(array, array.length - n);
	  };
	
	  // Returns everything but the last entry of the array. Especially useful on
	  // the arguments object. Passing **n** will return all the values in
	  // the array, excluding the last N.
	  _.initial = function (array, n, guard) {
	    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
	  };
	
	  // Get the last element of an array. Passing **n** will return the last N
	  // values in the array.
	  _.last = function (array, n, guard) {
	    if (array == null) return void 0;
	    if (n == null || guard) return array[array.length - 1];
	    return _.rest(array, Math.max(0, array.length - n));
	  };
	
	  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
	  // Especially useful on the arguments object. Passing an **n** will return
	  // the rest N values in the array.
	  _.rest = _.tail = _.drop = function (array, n, guard) {
	    return slice.call(array, n == null || guard ? 1 : n);
	  };
	
	  // Trim out all falsy values from an array.
	  _.compact = function (array) {
	    return _.filter(array, _.identity);
	  };
	
	  // Internal implementation of a recursive `flatten` function.
	  var flatten = function flatten(input, shallow, strict, startIndex) {
	    var output = [],
	        idx = 0;
	    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
	      var value = input[i];
	      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
	        //flatten current level of array or arguments object
	        if (!shallow) value = flatten(value, shallow, strict);
	        var j = 0,
	            len = value.length;
	        output.length += len;
	        while (j < len) {
	          output[idx++] = value[j++];
	        }
	      } else if (!strict) {
	        output[idx++] = value;
	      }
	    }
	    return output;
	  };
	
	  // Flatten out an array, either recursively (by default), or just one level.
	  _.flatten = function (array, shallow) {
	    return flatten(array, shallow, false);
	  };
	
	  // Return a version of the array that does not contain the specified value(s).
	  _.without = function (array) {
	    return _.difference(array, slice.call(arguments, 1));
	  };
	
	  // Produce a duplicate-free version of the array. If the array has already
	  // been sorted, you have the option of using a faster algorithm.
	  // Aliased as `unique`.
	  _.uniq = _.unique = function (array, isSorted, iteratee, context) {
	    if (!_.isBoolean(isSorted)) {
	      context = iteratee;
	      iteratee = isSorted;
	      isSorted = false;
	    }
	    if (iteratee != null) iteratee = cb(iteratee, context);
	    var result = [];
	    var seen = [];
	    for (var i = 0, length = getLength(array); i < length; i++) {
	      var value = array[i],
	          computed = iteratee ? iteratee(value, i, array) : value;
	      if (isSorted) {
	        if (!i || seen !== computed) result.push(value);
	        seen = computed;
	      } else if (iteratee) {
	        if (!_.contains(seen, computed)) {
	          seen.push(computed);
	          result.push(value);
	        }
	      } else if (!_.contains(result, value)) {
	        result.push(value);
	      }
	    }
	    return result;
	  };
	
	  // Produce an array that contains the union: each distinct element from all of
	  // the passed-in arrays.
	  _.union = function () {
	    return _.uniq(flatten(arguments, true, true));
	  };
	
	  // Produce an array that contains every item shared between all the
	  // passed-in arrays.
	  _.intersection = function (array) {
	    var result = [];
	    var argsLength = arguments.length;
	    for (var i = 0, length = getLength(array); i < length; i++) {
	      var item = array[i];
	      if (_.contains(result, item)) continue;
	      for (var j = 1; j < argsLength; j++) {
	        if (!_.contains(arguments[j], item)) break;
	      }
	      if (j === argsLength) result.push(item);
	    }
	    return result;
	  };
	
	  // Take the difference between one array and a number of other arrays.
	  // Only the elements present in just the first array will remain.
	  _.difference = function (array) {
	    var rest = flatten(arguments, true, true, 1);
	    return _.filter(array, function (value) {
	      return !_.contains(rest, value);
	    });
	  };
	
	  // Zip together multiple lists into a single array -- elements that share
	  // an index go together.
	  _.zip = function () {
	    return _.unzip(arguments);
	  };
	
	  // Complement of _.zip. Unzip accepts an array of arrays and groups
	  // each array's elements on shared indices
	  _.unzip = function (array) {
	    var length = array && _.max(array, getLength).length || 0;
	    var result = Array(length);
	
	    for (var index = 0; index < length; index++) {
	      result[index] = _.pluck(array, index);
	    }
	    return result;
	  };
	
	  // Converts lists into objects. Pass either a single array of `[key, value]`
	  // pairs, or two parallel arrays of the same length -- one of keys, and one of
	  // the corresponding values.
	  _.object = function (list, values) {
	    var result = {};
	    for (var i = 0, length = getLength(list); i < length; i++) {
	      if (values) {
	        result[list[i]] = values[i];
	      } else {
	        result[list[i][0]] = list[i][1];
	      }
	    }
	    return result;
	  };
	
	  // Generator function to create the findIndex and findLastIndex functions
	  function createPredicateIndexFinder(dir) {
	    return function (array, predicate, context) {
	      predicate = cb(predicate, context);
	      var length = getLength(array);
	      var index = dir > 0 ? 0 : length - 1;
	      for (; index >= 0 && index < length; index += dir) {
	        if (predicate(array[index], index, array)) return index;
	      }
	      return -1;
	    };
	  }
	
	  // Returns the first index on an array-like that passes a predicate test
	  _.findIndex = createPredicateIndexFinder(1);
	  _.findLastIndex = createPredicateIndexFinder(-1);
	
	  // Use a comparator function to figure out the smallest index at which
	  // an object should be inserted so as to maintain order. Uses binary search.
	  _.sortedIndex = function (array, obj, iteratee, context) {
	    iteratee = cb(iteratee, context, 1);
	    var value = iteratee(obj);
	    var low = 0,
	        high = getLength(array);
	    while (low < high) {
	      var mid = Math.floor((low + high) / 2);
	      if (iteratee(array[mid]) < value) low = mid + 1;else high = mid;
	    }
	    return low;
	  };
	
	  // Generator function to create the indexOf and lastIndexOf functions
	  function createIndexFinder(dir, predicateFind, sortedIndex) {
	    return function (array, item, idx) {
	      var i = 0,
	          length = getLength(array);
	      if (typeof idx == 'number') {
	        if (dir > 0) {
	          i = idx >= 0 ? idx : Math.max(idx + length, i);
	        } else {
	          length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
	        }
	      } else if (sortedIndex && idx && length) {
	        idx = sortedIndex(array, item);
	        return array[idx] === item ? idx : -1;
	      }
	      if (item !== item) {
	        idx = predicateFind(slice.call(array, i, length), _.isNaN);
	        return idx >= 0 ? idx + i : -1;
	      }
	      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
	        if (array[idx] === item) return idx;
	      }
	      return -1;
	    };
	  }
	
	  // Return the position of the first occurrence of an item in an array,
	  // or -1 if the item is not included in the array.
	  // If the array is large and already in sort order, pass `true`
	  // for **isSorted** to use binary search.
	  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
	  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);
	
	  // Generate an integer Array containing an arithmetic progression. A port of
	  // the native Python `range()` function. See
	  // [the Python documentation](http://docs.python.org/library/functions.html#range).
	  _.range = function (start, stop, step) {
	    if (stop == null) {
	      stop = start || 0;
	      start = 0;
	    }
	    step = step || 1;
	
	    var length = Math.max(Math.ceil((stop - start) / step), 0);
	    var range = Array(length);
	
	    for (var idx = 0; idx < length; idx++, start += step) {
	      range[idx] = start;
	    }
	
	    return range;
	  };
	
	  // Function (ahem) Functions
	  // ------------------
	
	  // Determines whether to execute a function as a constructor
	  // or a normal function with the provided arguments
	  var executeBound = function executeBound(sourceFunc, boundFunc, context, callingContext, args) {
	    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
	    var self = baseCreate(sourceFunc.prototype);
	    var result = sourceFunc.apply(self, args);
	    if (_.isObject(result)) return result;
	    return self;
	  };
	
	  // Create a function bound to a given object (assigning `this`, and arguments,
	  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
	  // available.
	  _.bind = function (func, context) {
	    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
	    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
	    var args = slice.call(arguments, 2);
	    var bound = function bound() {
	      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
	    };
	    return bound;
	  };
	
	  // Partially apply a function by creating a version that has had some of its
	  // arguments pre-filled, without changing its dynamic `this` context. _ acts
	  // as a placeholder, allowing any combination of arguments to be pre-filled.
	  _.partial = function (func) {
	    var boundArgs = slice.call(arguments, 1);
	    var bound = function bound() {
	      var position = 0,
	          length = boundArgs.length;
	      var args = Array(length);
	      for (var i = 0; i < length; i++) {
	        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
	      }
	      while (position < arguments.length) {
	        args.push(arguments[position++]);
	      }return executeBound(func, bound, this, this, args);
	    };
	    return bound;
	  };
	
	  // Bind a number of an object's methods to that object. Remaining arguments
	  // are the method names to be bound. Useful for ensuring that all callbacks
	  // defined on an object belong to it.
	  _.bindAll = function (obj) {
	    var i,
	        length = arguments.length,
	        key;
	    if (length <= 1) throw new Error('bindAll must be passed function names');
	    for (i = 1; i < length; i++) {
	      key = arguments[i];
	      obj[key] = _.bind(obj[key], obj);
	    }
	    return obj;
	  };
	
	  // Memoize an expensive function by storing its results.
	  _.memoize = function (func, hasher) {
	    var memoize = function memoize(key) {
	      var cache = memoize.cache;
	      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
	      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
	      return cache[address];
	    };
	    memoize.cache = {};
	    return memoize;
	  };
	
	  // Delays a function for the given number of milliseconds, and then calls
	  // it with the arguments supplied.
	  _.delay = function (func, wait) {
	    var args = slice.call(arguments, 2);
	    return setTimeout(function () {
	      return func.apply(null, args);
	    }, wait);
	  };
	
	  // Defers a function, scheduling it to run after the current call stack has
	  // cleared.
	  _.defer = _.partial(_.delay, _, 1);
	
	  // Returns a function, that, when invoked, will only be triggered at most once
	  // during a given window of time. Normally, the throttled function will run
	  // as much as it can, without ever going more than once per `wait` duration;
	  // but if you'd like to disable the execution on the leading edge, pass
	  // `{leading: false}`. To disable execution on the trailing edge, ditto.
	  _.throttle = function (func, wait, options) {
	    var context, args, result;
	    var timeout = null;
	    var previous = 0;
	    if (!options) options = {};
	    var later = function later() {
	      previous = options.leading === false ? 0 : _.now();
	      timeout = null;
	      result = func.apply(context, args);
	      if (!timeout) context = args = null;
	    };
	    return function () {
	      var now = _.now();
	      if (!previous && options.leading === false) previous = now;
	      var remaining = wait - (now - previous);
	      context = this;
	      args = arguments;
	      if (remaining <= 0 || remaining > wait) {
	        if (timeout) {
	          clearTimeout(timeout);
	          timeout = null;
	        }
	        previous = now;
	        result = func.apply(context, args);
	        if (!timeout) context = args = null;
	      } else if (!timeout && options.trailing !== false) {
	        timeout = setTimeout(later, remaining);
	      }
	      return result;
	    };
	  };
	
	  // Returns a function, that, as long as it continues to be invoked, will not
	  // be triggered. The function will be called after it stops being called for
	  // N milliseconds. If `immediate` is passed, trigger the function on the
	  // leading edge, instead of the trailing.
	  _.debounce = function (func, wait, immediate) {
	    var timeout, args, context, timestamp, result;
	
	    var later = function later() {
	      var last = _.now() - timestamp;
	
	      if (last < wait && last >= 0) {
	        timeout = setTimeout(later, wait - last);
	      } else {
	        timeout = null;
	        if (!immediate) {
	          result = func.apply(context, args);
	          if (!timeout) context = args = null;
	        }
	      }
	    };
	
	    return function () {
	      context = this;
	      args = arguments;
	      timestamp = _.now();
	      var callNow = immediate && !timeout;
	      if (!timeout) timeout = setTimeout(later, wait);
	      if (callNow) {
	        result = func.apply(context, args);
	        context = args = null;
	      }
	
	      return result;
	    };
	  };
	
	  // Returns the first function passed as an argument to the second,
	  // allowing you to adjust arguments, run code before and after, and
	  // conditionally execute the original function.
	  _.wrap = function (func, wrapper) {
	    return _.partial(wrapper, func);
	  };
	
	  // Returns a negated version of the passed-in predicate.
	  _.negate = function (predicate) {
	    return function () {
	      return !predicate.apply(this, arguments);
	    };
	  };
	
	  // Returns a function that is the composition of a list of functions, each
	  // consuming the return value of the function that follows.
	  _.compose = function () {
	    var args = arguments;
	    var start = args.length - 1;
	    return function () {
	      var i = start;
	      var result = args[start].apply(this, arguments);
	      while (i--) {
	        result = args[i].call(this, result);
	      }return result;
	    };
	  };
	
	  // Returns a function that will only be executed on and after the Nth call.
	  _.after = function (times, func) {
	    return function () {
	      if (--times < 1) {
	        return func.apply(this, arguments);
	      }
	    };
	  };
	
	  // Returns a function that will only be executed up to (but not including) the Nth call.
	  _.before = function (times, func) {
	    var memo;
	    return function () {
	      if (--times > 0) {
	        memo = func.apply(this, arguments);
	      }
	      if (times <= 1) func = null;
	      return memo;
	    };
	  };
	
	  // Returns a function that will be executed at most one time, no matter how
	  // often you call it. Useful for lazy initialization.
	  _.once = _.partial(_.before, 2);
	
	  // Object Functions
	  // ----------------
	
	  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
	  var hasEnumBug = !{ toString: null }.propertyIsEnumerable('toString');
	  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString', 'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];
	
	  function collectNonEnumProps(obj, keys) {
	    var nonEnumIdx = nonEnumerableProps.length;
	    var constructor = obj.constructor;
	    var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;
	
	    // Constructor is a special case.
	    var prop = 'constructor';
	    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);
	
	    while (nonEnumIdx--) {
	      prop = nonEnumerableProps[nonEnumIdx];
	      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
	        keys.push(prop);
	      }
	    }
	  }
	
	  // Retrieve the names of an object's own properties.
	  // Delegates to **ECMAScript 5**'s native `Object.keys`
	  _.keys = function (obj) {
	    if (!_.isObject(obj)) return [];
	    if (nativeKeys) return nativeKeys(obj);
	    var keys = [];
	    for (var key in obj) {
	      if (_.has(obj, key)) keys.push(key);
	    } // Ahem, IE < 9.
	    if (hasEnumBug) collectNonEnumProps(obj, keys);
	    return keys;
	  };
	
	  // Retrieve all the property names of an object.
	  _.allKeys = function (obj) {
	    if (!_.isObject(obj)) return [];
	    var keys = [];
	    for (var key in obj) {
	      keys.push(key);
	    } // Ahem, IE < 9.
	    if (hasEnumBug) collectNonEnumProps(obj, keys);
	    return keys;
	  };
	
	  // Retrieve the values of an object's properties.
	  _.values = function (obj) {
	    var keys = _.keys(obj);
	    var length = keys.length;
	    var values = Array(length);
	    for (var i = 0; i < length; i++) {
	      values[i] = obj[keys[i]];
	    }
	    return values;
	  };
	
	  // Returns the results of applying the iteratee to each element of the object
	  // In contrast to _.map it returns an object
	  _.mapObject = function (obj, iteratee, context) {
	    iteratee = cb(iteratee, context);
	    var keys = _.keys(obj),
	        length = keys.length,
	        results = {},
	        currentKey;
	    for (var index = 0; index < length; index++) {
	      currentKey = keys[index];
	      results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
	    }
	    return results;
	  };
	
	  // Convert an object into a list of `[key, value]` pairs.
	  _.pairs = function (obj) {
	    var keys = _.keys(obj);
	    var length = keys.length;
	    var pairs = Array(length);
	    for (var i = 0; i < length; i++) {
	      pairs[i] = [keys[i], obj[keys[i]]];
	    }
	    return pairs;
	  };
	
	  // Invert the keys and values of an object. The values must be serializable.
	  _.invert = function (obj) {
	    var result = {};
	    var keys = _.keys(obj);
	    for (var i = 0, length = keys.length; i < length; i++) {
	      result[obj[keys[i]]] = keys[i];
	    }
	    return result;
	  };
	
	  // Return a sorted list of the function names available on the object.
	  // Aliased as `methods`
	  _.functions = _.methods = function (obj) {
	    var names = [];
	    for (var key in obj) {
	      if (_.isFunction(obj[key])) names.push(key);
	    }
	    return names.sort();
	  };
	
	  // Extend a given object with all the properties in passed-in object(s).
	  _.extend = createAssigner(_.allKeys);
	
	  // Assigns a given object with all the own properties in the passed-in object(s)
	  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
	  _.extendOwn = _.assign = createAssigner(_.keys);
	
	  // Returns the first key on an object that passes a predicate test
	  _.findKey = function (obj, predicate, context) {
	    predicate = cb(predicate, context);
	    var keys = _.keys(obj),
	        key;
	    for (var i = 0, length = keys.length; i < length; i++) {
	      key = keys[i];
	      if (predicate(obj[key], key, obj)) return key;
	    }
	  };
	
	  // Return a copy of the object only containing the whitelisted properties.
	  _.pick = function (object, oiteratee, context) {
	    var result = {},
	        obj = object,
	        iteratee,
	        keys;
	    if (obj == null) return result;
	    if (_.isFunction(oiteratee)) {
	      keys = _.allKeys(obj);
	      iteratee = optimizeCb(oiteratee, context);
	    } else {
	      keys = flatten(arguments, false, false, 1);
	      iteratee = function iteratee(value, key, obj) {
	        return key in obj;
	      };
	      obj = Object(obj);
	    }
	    for (var i = 0, length = keys.length; i < length; i++) {
	      var key = keys[i];
	      var value = obj[key];
	      if (iteratee(value, key, obj)) result[key] = value;
	    }
	    return result;
	  };
	
	  // Return a copy of the object without the blacklisted properties.
	  _.omit = function (obj, iteratee, context) {
	    if (_.isFunction(iteratee)) {
	      iteratee = _.negate(iteratee);
	    } else {
	      var keys = _.map(flatten(arguments, false, false, 1), String);
	      iteratee = function iteratee(value, key) {
	        return !_.contains(keys, key);
	      };
	    }
	    return _.pick(obj, iteratee, context);
	  };
	
	  // Fill in a given object with default properties.
	  _.defaults = createAssigner(_.allKeys, true);
	
	  // Creates an object that inherits from the given prototype object.
	  // If additional properties are provided then they will be added to the
	  // created object.
	  _.create = function (prototype, props) {
	    var result = baseCreate(prototype);
	    if (props) _.extendOwn(result, props);
	    return result;
	  };
	
	  // Create a (shallow-cloned) duplicate of an object.
	  _.clone = function (obj) {
	    if (!_.isObject(obj)) return obj;
	    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
	  };
	
	  // Invokes interceptor with the obj, and then returns obj.
	  // The primary purpose of this method is to "tap into" a method chain, in
	  // order to perform operations on intermediate results within the chain.
	  _.tap = function (obj, interceptor) {
	    interceptor(obj);
	    return obj;
	  };
	
	  // Returns whether an object has a given set of `key:value` pairs.
	  _.isMatch = function (object, attrs) {
	    var keys = _.keys(attrs),
	        length = keys.length;
	    if (object == null) return !length;
	    var obj = Object(object);
	    for (var i = 0; i < length; i++) {
	      var key = keys[i];
	      if (attrs[key] !== obj[key] || !(key in obj)) return false;
	    }
	    return true;
	  };
	
	  // Internal recursive comparison function for `isEqual`.
	  var eq = function eq(a, b, aStack, bStack) {
	    // Identical objects are equal. `0 === -0`, but they aren't identical.
	    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
	    if (a === b) return a !== 0 || 1 / a === 1 / b;
	    // A strict comparison is necessary because `null == undefined`.
	    if (a == null || b == null) return a === b;
	    // Unwrap any wrapped objects.
	    if (a instanceof _) a = a._wrapped;
	    if (b instanceof _) b = b._wrapped;
	    // Compare `[[Class]]` names.
	    var className = toString.call(a);
	    if (className !== toString.call(b)) return false;
	    switch (className) {
	      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
	      case '[object RegExp]':
	      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
	      case '[object String]':
	        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
	        // equivalent to `new String("5")`.
	        return '' + a === '' + b;
	      case '[object Number]':
	        // `NaN`s are equivalent, but non-reflexive.
	        // Object(NaN) is equivalent to NaN
	        if (+a !== +a) return +b !== +b;
	        // An `egal` comparison is performed for other numeric values.
	        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
	      case '[object Date]':
	      case '[object Boolean]':
	        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
	        // millisecond representations. Note that invalid dates with millisecond representations
	        // of `NaN` are not equivalent.
	        return +a === +b;
	    }
	
	    var areArrays = className === '[object Array]';
	    if (!areArrays) {
	      if ((typeof a === 'undefined' ? 'undefined' : _typeof(a)) != 'object' || (typeof b === 'undefined' ? 'undefined' : _typeof(b)) != 'object') return false;
	
	      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
	      // from different frames are.
	      var aCtor = a.constructor,
	          bCtor = b.constructor;
	      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor && _.isFunction(bCtor) && bCtor instanceof bCtor) && 'constructor' in a && 'constructor' in b) {
	        return false;
	      }
	    }
	    // Assume equality for cyclic structures. The algorithm for detecting cyclic
	    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
	
	    // Initializing stack of traversed objects.
	    // It's done here since we only need them for objects and arrays comparison.
	    aStack = aStack || [];
	    bStack = bStack || [];
	    var length = aStack.length;
	    while (length--) {
	      // Linear search. Performance is inversely proportional to the number of
	      // unique nested structures.
	      if (aStack[length] === a) return bStack[length] === b;
	    }
	
	    // Add the first object to the stack of traversed objects.
	    aStack.push(a);
	    bStack.push(b);
	
	    // Recursively compare objects and arrays.
	    if (areArrays) {
	      // Compare array lengths to determine if a deep comparison is necessary.
	      length = a.length;
	      if (length !== b.length) return false;
	      // Deep compare the contents, ignoring non-numeric properties.
	      while (length--) {
	        if (!eq(a[length], b[length], aStack, bStack)) return false;
	      }
	    } else {
	      // Deep compare objects.
	      var keys = _.keys(a),
	          key;
	      length = keys.length;
	      // Ensure that both objects contain the same number of properties before comparing deep equality.
	      if (_.keys(b).length !== length) return false;
	      while (length--) {
	        // Deep compare each member
	        key = keys[length];
	        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
	      }
	    }
	    // Remove the first object from the stack of traversed objects.
	    aStack.pop();
	    bStack.pop();
	    return true;
	  };
	
	  // Perform a deep comparison to check if two objects are equal.
	  _.isEqual = function (a, b) {
	    return eq(a, b);
	  };
	
	  // Is a given array, string, or object empty?
	  // An "empty" object has no enumerable own-properties.
	  _.isEmpty = function (obj) {
	    if (obj == null) return true;
	    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
	    return _.keys(obj).length === 0;
	  };
	
	  // Is a given value a DOM element?
	  _.isElement = function (obj) {
	    return !!(obj && obj.nodeType === 1);
	  };
	
	  // Is a given value an array?
	  // Delegates to ECMA5's native Array.isArray
	  _.isArray = nativeIsArray || function (obj) {
	    return toString.call(obj) === '[object Array]';
	  };
	
	  // Is a given variable an object?
	  _.isObject = function (obj) {
	    var type = typeof obj === 'undefined' ? 'undefined' : _typeof(obj);
	    return type === 'function' || type === 'object' && !!obj;
	  };
	
	  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
	  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function (name) {
	    _['is' + name] = function (obj) {
	      return toString.call(obj) === '[object ' + name + ']';
	    };
	  });
	
	  // Define a fallback version of the method in browsers (ahem, IE < 9), where
	  // there isn't any inspectable "Arguments" type.
	  if (!_.isArguments(arguments)) {
	    _.isArguments = function (obj) {
	      return _.has(obj, 'callee');
	    };
	  }
	
	  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
	  // IE 11 (#1621), and in Safari 8 (#1929).
	  if (typeof /./ != 'function' && (typeof Int8Array === 'undefined' ? 'undefined' : _typeof(Int8Array)) != 'object') {
	    _.isFunction = function (obj) {
	      return typeof obj == 'function' || false;
	    };
	  }
	
	  // Is a given object a finite number?
	  _.isFinite = function (obj) {
	    return isFinite(obj) && !isNaN(parseFloat(obj));
	  };
	
	  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
	  _.isNaN = function (obj) {
	    return _.isNumber(obj) && obj !== +obj;
	  };
	
	  // Is a given value a boolean?
	  _.isBoolean = function (obj) {
	    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
	  };
	
	  // Is a given value equal to null?
	  _.isNull = function (obj) {
	    return obj === null;
	  };
	
	  // Is a given variable undefined?
	  _.isUndefined = function (obj) {
	    return obj === void 0;
	  };
	
	  // Shortcut function for checking if an object has a given property directly
	  // on itself (in other words, not on a prototype).
	  _.has = function (obj, key) {
	    return obj != null && hasOwnProperty.call(obj, key);
	  };
	
	  // Utility Functions
	  // -----------------
	
	  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
	  // previous owner. Returns a reference to the Underscore object.
	  _.noConflict = function () {
	    root._ = previousUnderscore;
	    return this;
	  };
	
	  // Keep the identity function around for default iteratees.
	  _.identity = function (value) {
	    return value;
	  };
	
	  // Predicate-generating functions. Often useful outside of Underscore.
	  _.constant = function (value) {
	    return function () {
	      return value;
	    };
	  };
	
	  _.noop = function () {};
	
	  _.property = property;
	
	  // Generates a function for a given object that returns a given property.
	  _.propertyOf = function (obj) {
	    return obj == null ? function () {} : function (key) {
	      return obj[key];
	    };
	  };
	
	  // Returns a predicate for checking whether an object has a given set of
	  // `key:value` pairs.
	  _.matcher = _.matches = function (attrs) {
	    attrs = _.extendOwn({}, attrs);
	    return function (obj) {
	      return _.isMatch(obj, attrs);
	    };
	  };
	
	  // Run a function **n** times.
	  _.times = function (n, iteratee, context) {
	    var accum = Array(Math.max(0, n));
	    iteratee = optimizeCb(iteratee, context, 1);
	    for (var i = 0; i < n; i++) {
	      accum[i] = iteratee(i);
	    }return accum;
	  };
	
	  // Return a random integer between min and max (inclusive).
	  _.random = function (min, max) {
	    if (max == null) {
	      max = min;
	      min = 0;
	    }
	    return min + Math.floor(Math.random() * (max - min + 1));
	  };
	
	  // A (possibly faster) way to get the current timestamp as an integer.
	  _.now = Date.now || function () {
	    return new Date().getTime();
	  };
	
	  // List of HTML entities for escaping.
	  var escapeMap = {
	    '&': '&amp;',
	    '<': '&lt;',
	    '>': '&gt;',
	    '"': '&quot;',
	    "'": '&#x27;',
	    '`': '&#x60;'
	  };
	  var unescapeMap = _.invert(escapeMap);
	
	  // Functions for escaping and unescaping strings to/from HTML interpolation.
	  var createEscaper = function createEscaper(map) {
	    var escaper = function escaper(match) {
	      return map[match];
	    };
	    // Regexes for identifying a key that needs to be escaped
	    var source = '(?:' + _.keys(map).join('|') + ')';
	    var testRegexp = RegExp(source);
	    var replaceRegexp = RegExp(source, 'g');
	    return function (string) {
	      string = string == null ? '' : '' + string;
	      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
	    };
	  };
	  _.escape = createEscaper(escapeMap);
	  _.unescape = createEscaper(unescapeMap);
	
	  // If the value of the named `property` is a function then invoke it with the
	  // `object` as context; otherwise, return it.
	  _.result = function (object, property, fallback) {
	    var value = object == null ? void 0 : object[property];
	    if (value === void 0) {
	      value = fallback;
	    }
	    return _.isFunction(value) ? value.call(object) : value;
	  };
	
	  // Generate a unique integer id (unique within the entire client session).
	  // Useful for temporary DOM ids.
	  var idCounter = 0;
	  _.uniqueId = function (prefix) {
	    var id = ++idCounter + '';
	    return prefix ? prefix + id : id;
	  };
	
	  // By default, Underscore uses ERB-style template delimiters, change the
	  // following template settings to use alternative delimiters.
	  _.templateSettings = {
	    evaluate: /<%([\s\S]+?)%>/g,
	    interpolate: /<%=([\s\S]+?)%>/g,
	    escape: /<%-([\s\S]+?)%>/g
	  };
	
	  // When customizing `templateSettings`, if you don't want to define an
	  // interpolation, evaluation or escaping regex, we need one that is
	  // guaranteed not to match.
	  var noMatch = /(.)^/;
	
	  // Certain characters need to be escaped so that they can be put into a
	  // string literal.
	  var escapes = {
	    "'": "'",
	    '\\': '\\',
	    '\r': 'r',
	    '\n': 'n',
	    '\u2028': 'u2028',
	    '\u2029': 'u2029'
	  };
	
	  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;
	
	  var escapeChar = function escapeChar(match) {
	    return '\\' + escapes[match];
	  };
	
	  // JavaScript micro-templating, similar to John Resig's implementation.
	  // Underscore templating handles arbitrary delimiters, preserves whitespace,
	  // and correctly escapes quotes within interpolated code.
	  // NB: `oldSettings` only exists for backwards compatibility.
	  _.template = function (text, settings, oldSettings) {
	    if (!settings && oldSettings) settings = oldSettings;
	    settings = _.defaults({}, settings, _.templateSettings);
	
	    // Combine delimiters into one regular expression via alternation.
	    var matcher = RegExp([(settings.escape || noMatch).source, (settings.interpolate || noMatch).source, (settings.evaluate || noMatch).source].join('|') + '|$', 'g');
	
	    // Compile the template source, escaping string literals appropriately.
	    var index = 0;
	    var source = "__p+='";
	    text.replace(matcher, function (match, escape, interpolate, evaluate, offset) {
	      source += text.slice(index, offset).replace(escaper, escapeChar);
	      index = offset + match.length;
	
	      if (escape) {
	        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
	      } else if (interpolate) {
	        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
	      } else if (evaluate) {
	        source += "';\n" + evaluate + "\n__p+='";
	      }
	
	      // Adobe VMs need the match returned to produce the correct offest.
	      return match;
	    });
	    source += "';\n";
	
	    // If a variable is not specified, place data values in local scope.
	    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';
	
	    source = "var __t,__p='',__j=Array.prototype.join," + "print=function(){__p+=__j.call(arguments,'');};\n" + source + 'return __p;\n';
	
	    try {
	      var render = new Function(settings.variable || 'obj', '_', source);
	    } catch (e) {
	      e.source = source;
	      throw e;
	    }
	
	    var template = function template(data) {
	      return render.call(this, data, _);
	    };
	
	    // Provide the compiled source as a convenience for precompilation.
	    var argument = settings.variable || 'obj';
	    template.source = 'function(' + argument + '){\n' + source + '}';
	
	    return template;
	  };
	
	  // Add a "chain" function. Start chaining a wrapped Underscore object.
	  _.chain = function (obj) {
	    var instance = _(obj);
	    instance._chain = true;
	    return instance;
	  };
	
	  // OOP
	  // ---------------
	  // If Underscore is called as a function, it returns a wrapped object that
	  // can be used OO-style. This wrapper holds altered versions of all the
	  // underscore functions. Wrapped objects may be chained.
	
	  // Helper function to continue chaining intermediate results.
	  var result = function result(instance, obj) {
	    return instance._chain ? _(obj).chain() : obj;
	  };
	
	  // Add your own custom functions to the Underscore object.
	  _.mixin = function (obj) {
	    _.each(_.functions(obj), function (name) {
	      var func = _[name] = obj[name];
	      _.prototype[name] = function () {
	        var args = [this._wrapped];
	        push.apply(args, arguments);
	        return result(this, func.apply(_, args));
	      };
	    });
	  };
	
	  // Add all of the Underscore functions to the wrapper object.
	  _.mixin(_);
	
	  // Add all mutator Array functions to the wrapper.
	  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function (name) {
	    var method = ArrayProto[name];
	    _.prototype[name] = function () {
	      var obj = this._wrapped;
	      method.apply(obj, arguments);
	      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
	      return result(this, obj);
	    };
	  });
	
	  // Add all accessor Array functions to the wrapper.
	  _.each(['concat', 'join', 'slice'], function (name) {
	    var method = ArrayProto[name];
	    _.prototype[name] = function () {
	      return result(this, method.apply(this._wrapped, arguments));
	    };
	  });
	
	  // Extracts the result from a wrapped and chained object.
	  _.prototype.value = function () {
	    return this._wrapped;
	  };
	
	  // Provide unwrapping proxy for some methods used in engine operations
	  // such as arithmetic and JSON stringification.
	  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;
	
	  _.prototype.toString = function () {
	    return '' + this._wrapped;
	  };
	
	  // AMD registration happens at the end for compatibility with AMD loaders
	  // that may not enforce next-turn semantics on modules. Even though general
	  // practice for AMD registration is to be anonymous, underscore registers
	  // as a named module because, like jQuery, it is a base library that is
	  // popular enough to be bundled in a third party lib, but not be part of
	  // an AMD load request. Those cases could generate an error when an
	  // anonymous define() is called outside of a loader request.
	  if (true) {
	    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function () {
	      return _;
	    }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	  }
	}).call(undefined);

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	//     Backbone.js 1.1.2
	
	//     (c) 2010-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
	//     Backbone may be freely distributed under the MIT license.
	//     For all details and documentation:
	//     http://backbonejs.org
	
	var Events = __webpack_require__(8);
	var extend = __webpack_require__(10);
	var _ = __webpack_require__(11);
	var Model = __webpack_require__(7);
	
	// Create local references to array methods we'll want to use later.
	var array = [];
	var _slice = array.slice;
	
	// Backbone.Collection
	// -------------------
	
	// If models tend to represent a single row of data, a Backbone Collection is
	// more analogous to a table full of data ... or a small slice or page of that
	// table, or a collection of rows that belong together for a particular reason
	// -- all of the messages in this particular folder, all of the documents
	// belonging to this particular author, and so on. Collections maintain
	// indexes of their models, both in order, and for lookup by `id`.
	
	// Create a new **Collection**, perhaps to contain a specific type of `model`.
	// If a `comparator` is specified, the Collection will maintain
	// its models in sort order, as they're added and removed.
	var Collection = function Collection(models, options) {
	  options || (options = {});
	  if (options.model) this.model = options.model;
	  if (options.comparator !== void 0) this.comparator = options.comparator;
	  this._reset();
	  this.initialize.apply(this, arguments);
	  if (models) this.reset(models, _.extend({ silent: true }, options));
	};
	
	// Default options for `Collection#set`.
	var setOptions = { add: true, remove: true, merge: true };
	var addOptions = { add: true, remove: false };
	
	// Define the Collection's inheritable methods.
	_.extend(Collection.prototype, Events, {
	
	  // The default model for a collection is just a **Backbone.Model**.
	  // This should be overridden in most cases.
	  model: Model,
	
	  // Initialize is an empty function by default. Override it with your own
	  // initialization logic.
	  initialize: function initialize() {},
	
	  // The JSON representation of a Collection is an array of the
	  // models' attributes.
	  toJSON: function toJSON(options) {
	    return this.map(function (model) {
	      return model.toJSON(options);
	    });
	  },
	
	  // Proxy `Backbone.sync` by default.
	  sync: function sync() {
	    return Backbone.sync.apply(this, arguments);
	  },
	
	  // Add a model, or list of models to the set.
	  add: function add(models, options) {
	    return this.set(models, _.extend({ merge: false }, options, addOptions));
	  },
	
	  // Remove a model, or a list of models from the set.
	  remove: function remove(models, options) {
	    var singular = !_.isArray(models);
	    models = singular ? [models] : _.clone(models);
	    options || (options = {});
	    for (var i = 0, length = models.length; i < length; i++) {
	      var model = models[i] = this.get(models[i]);
	      if (!model) continue;
	      var id = this.modelId(model.attributes);
	      if (id != null) delete this._byId[id];
	      delete this._byId[model.cid];
	      var index = this.indexOf(model);
	      this.models.splice(index, 1);
	      this.length--;
	      if (!options.silent) {
	        options.index = index;
	        model.trigger('remove', model, this, options);
	      }
	      this._removeReference(model, options);
	    }
	    return singular ? models[0] : models;
	  },
	
	  // Update a collection by `set`-ing a new list of models, adding new ones,
	  // removing models that are no longer present, and merging models that
	  // already exist in the collection, as necessary. Similar to **Model#set**,
	  // the core operation for updating the data contained by the collection.
	  set: function set(models, options) {
	    options = _.defaults({}, options, setOptions);
	    if (options.parse) models = this.parse(models, options);
	    var singular = !_.isArray(models);
	    models = singular ? models ? [models] : [] : models.slice();
	    var id, model, attrs, existing, sort;
	    var at = options.at;
	    var sortable = this.comparator && at == null && options.sort !== false;
	    var sortAttr = _.isString(this.comparator) ? this.comparator : null;
	    var toAdd = [],
	        toRemove = [],
	        modelMap = {};
	    var add = options.add,
	        merge = options.merge,
	        remove = options.remove;
	    var order = !sortable && add && remove ? [] : false;
	
	    // Turn bare objects into model references, and prevent invalid models
	    // from being added.
	    for (var i = 0, length = models.length; i < length; i++) {
	      attrs = models[i];
	
	      // If a duplicate is found, prevent it from being added and
	      // optionally merge it into the existing model.
	      if (existing = this.get(attrs)) {
	        if (remove) modelMap[existing.cid] = true;
	        if (merge && attrs !== existing) {
	          attrs = this._isModel(attrs) ? attrs.attributes : attrs;
	          if (options.parse) attrs = existing.parse(attrs, options);
	          existing.set(attrs, options);
	          if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
	        }
	        models[i] = existing;
	
	        // If this is a new, valid model, push it to the `toAdd` list.
	      } else if (add) {
	        model = models[i] = this._prepareModel(attrs, options);
	        if (!model) continue;
	        toAdd.push(model);
	        this._addReference(model, options);
	      }
	
	      // Do not add multiple models with the same `id`.
	      model = existing || model;
	      if (!model) continue;
	      id = this.modelId(model.attributes);
	      if (order && (model.isNew() || !modelMap[id])) order.push(model);
	      modelMap[id] = true;
	    }
	
	    // Remove nonexistent models if appropriate.
	    if (remove) {
	      for (var i = 0, length = this.length; i < length; i++) {
	        if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
	      }
	      if (toRemove.length) this.remove(toRemove, options);
	    }
	
	    // See if sorting is needed, update `length` and splice in new models.
	    if (toAdd.length || order && order.length) {
	      if (sortable) sort = true;
	      this.length += toAdd.length;
	      if (at != null) {
	        for (var i = 0, length = toAdd.length; i < length; i++) {
	          this.models.splice(at + i, 0, toAdd[i]);
	        }
	      } else {
	        if (order) this.models.length = 0;
	        var orderedModels = order || toAdd;
	        for (var i = 0, length = orderedModels.length; i < length; i++) {
	          this.models.push(orderedModels[i]);
	        }
	      }
	    }
	
	    // Silently sort the collection if appropriate.
	    if (sort) this.sort({ silent: true });
	
	    // Unless silenced, it's time to fire all appropriate add/sort events.
	    if (!options.silent) {
	      var addOpts = at != null ? _.clone(options) : options;
	      for (var i = 0, length = toAdd.length; i < length; i++) {
	        if (at != null) addOpts.index = at + i;
	        (model = toAdd[i]).trigger('add', model, this, addOpts);
	      }
	      if (sort || order && order.length) this.trigger('sort', this, options);
	    }
	
	    // Return the added (or merged) model (or models).
	    return singular ? models[0] : models;
	  },
	
	  // When you have more items than you want to add or remove individually,
	  // you can reset the entire set with a new list of models, without firing
	  // any granular `add` or `remove` events. Fires `reset` when finished.
	  // Useful for bulk operations and optimizations.
	  reset: function reset(models, options) {
	    options || (options = {});
	    for (var i = 0, length = this.models.length; i < length; i++) {
	      this._removeReference(this.models[i], options);
	    }
	    options.previousModels = this.models;
	    this._reset();
	    models = this.add(models, _.extend({ silent: true }, options));
	    if (!options.silent) this.trigger('reset', this, options);
	    return models;
	  },
	
	  // Add a model to the end of the collection.
	  push: function push(model, options) {
	    return this.add(model, _.extend({ at: this.length }, options));
	  },
	
	  // Remove a model from the end of the collection.
	  pop: function pop(options) {
	    var model = this.at(this.length - 1);
	    this.remove(model, options);
	    return model;
	  },
	
	  // Add a model to the beginning of the collection.
	  unshift: function unshift(model, options) {
	    return this.add(model, _.extend({ at: 0 }, options));
	  },
	
	  // Remove a model from the beginning of the collection.
	  shift: function shift(options) {
	    var model = this.at(0);
	    this.remove(model, options);
	    return model;
	  },
	
	  // Slice out a sub-array of models from the collection.
	  slice: function slice() {
	    return _slice.apply(this.models, arguments);
	  },
	
	  // Get a model from the set by id.
	  get: function get(obj) {
	    if (obj == null) return void 0;
	    var id = this.modelId(this._isModel(obj) ? obj.attributes : obj);
	    return this._byId[obj] || this._byId[id] || this._byId[obj.cid];
	  },
	
	  // Get the model at the given index.
	  at: function at(index) {
	    if (index < 0) index += this.length;
	    return this.models[index];
	  },
	
	  // Return models with matching attributes. Useful for simple cases of
	  // `filter`.
	  where: function where(attrs, first) {
	    if (_.isEmpty(attrs)) return first ? void 0 : [];
	    return this[first ? 'find' : 'filter'](function (model) {
	      for (var key in attrs) {
	        if (attrs[key] !== model.get(key)) return false;
	      }
	      return true;
	    });
	  },
	
	  // Return the first model with matching attributes. Useful for simple cases
	  // of `find`.
	  findWhere: function findWhere(attrs) {
	    return this.where(attrs, true);
	  },
	
	  // Force the collection to re-sort itself. You don't need to call this under
	  // normal circumstances, as the set will maintain sort order as each item
	  // is added.
	  sort: function sort(options) {
	    if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
	    options || (options = {});
	
	    // Run sort based on type of `comparator`.
	    if (_.isString(this.comparator) || this.comparator.length === 1) {
	      this.models = this.sortBy(this.comparator, this);
	    } else {
	      this.models.sort(_.bind(this.comparator, this));
	    }
	
	    if (!options.silent) this.trigger('sort', this, options);
	    return this;
	  },
	
	  // Pluck an attribute from each model in the collection.
	  pluck: function pluck(attr) {
	    return _.invoke(this.models, 'get', attr);
	  },
	
	  // Fetch the default set of models for this collection, resetting the
	  // collection when they arrive. If `reset: true` is passed, the response
	  // data will be passed through the `reset` method instead of `set`.
	  fetch: function fetch(options) {
	    options = options ? _.clone(options) : {};
	    if (options.parse === void 0) options.parse = true;
	    var success = options.success;
	    var collection = this;
	    options.success = function (resp) {
	      var method = options.reset ? 'reset' : 'set';
	      collection[method](resp, options);
	      if (success) success(collection, resp, options);
	      collection.trigger('sync', collection, resp, options);
	    };
	    wrapError(this, options);
	    return this.sync('read', this, options);
	  },
	
	  // Create a new instance of a model in this collection. Add the model to the
	  // collection immediately, unless `wait: true` is passed, in which case we
	  // wait for the server to agree.
	  create: function create(model, options) {
	    options = options ? _.clone(options) : {};
	    if (!(model = this._prepareModel(model, options))) return false;
	    if (!options.wait) this.add(model, options);
	    var collection = this;
	    var success = options.success;
	    options.success = function (model, resp) {
	      if (options.wait) collection.add(model, options);
	      if (success) success(model, resp, options);
	    };
	    model.save(null, options);
	    return model;
	  },
	
	  // **parse** converts a response into a list of models to be added to the
	  // collection. The default implementation is just to pass it through.
	  parse: function parse(resp, options) {
	    return resp;
	  },
	
	  // Create a new collection with an identical list of models as this one.
	  clone: function clone() {
	    return new this.constructor(this.models, {
	      model: this.model,
	      comparator: this.comparator
	    });
	  },
	
	  // Define how to uniquely identify models in the collection.
	  modelId: function modelId(attrs) {
	    return attrs[this.model.prototype.idAttribute || 'id'];
	  },
	
	  // Private method to reset all internal state. Called when the collection
	  // is first initialized or reset.
	  _reset: function _reset() {
	    this.length = 0;
	    this.models = [];
	    this._byId = {};
	  },
	
	  // Prepare a hash of attributes (or other model) to be added to this
	  // collection.
	  _prepareModel: function _prepareModel(attrs, options) {
	    if (this._isModel(attrs)) {
	      if (!attrs.collection) attrs.collection = this;
	      return attrs;
	    }
	    options = options ? _.clone(options) : {};
	    options.collection = this;
	    var model = new this.model(attrs, options);
	    if (!model.validationError) return model;
	    this.trigger('invalid', this, model.validationError, options);
	    return false;
	  },
	
	  // Method for checking whether an object should be considered a model for
	  // the purposes of adding to the collection.
	  _isModel: function _isModel(model) {
	    return model instanceof Model;
	  },
	
	  // Internal method to create a model's ties to a collection.
	  _addReference: function _addReference(model, options) {
	    this._byId[model.cid] = model;
	    var id = this.modelId(model.attributes);
	    if (id != null) this._byId[id] = model;
	    model.on('all', this._onModelEvent, this);
	  },
	
	  // Internal method to sever a model's ties to a collection.
	  _removeReference: function _removeReference(model, options) {
	    if (this === model.collection) delete model.collection;
	    model.off('all', this._onModelEvent, this);
	  },
	
	  // Internal method called every time a model in the set fires an event.
	  // Sets need to update their indexes when models change ids. All other
	  // events simply proxy through. "add" and "remove" events that originate
	  // in other collections are ignored.
	  _onModelEvent: function _onModelEvent(event, model, collection, options) {
	    if ((event === 'add' || event === 'remove') && collection !== this) return;
	    if (event === 'destroy') this.remove(model, options);
	    if (event === 'change') {
	      var prevId = this.modelId(model.previousAttributes());
	      var id = this.modelId(model.attributes);
	      if (prevId !== id) {
	        if (prevId != null) delete this._byId[prevId];
	        if (id != null) this._byId[id] = model;
	      }
	    }
	    this.trigger.apply(this, arguments);
	  }
	
	});
	
	// Underscore methods that we want to implement on the Collection.
	// 90% of the core usefulness of Backbone Collections is actually implemented
	// right here:
	var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl', 'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select', 'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke', 'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest', 'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle', 'lastIndexOf', 'isEmpty', 'chain', 'sample', 'partition'];
	
	// Mix in each Underscore method as a proxy to `Collection#models`.
	_.each(methods, function (method) {
	  if (!_[method]) return;
	  Collection.prototype[method] = function () {
	    var args = _slice.call(arguments);
	    args.unshift(this.models);
	    return _[method].apply(_, args);
	  };
	});
	
	// Underscore methods that take a property name as an argument.
	var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];
	
	// Use attributes instead of properties.
	_.each(attributeMethods, function (method) {
	  if (!_[method]) return;
	  Collection.prototype[method] = function (value, context) {
	    var iterator = _.isFunction(value) ? value : function (model) {
	      return model.get(value);
	    };
	    return _[method](this.models, iterator, context);
	  };
	});
	
	// setup inheritance
	Collection.extend = extend;
	module.exports = Collection;

/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _Selection = __webpack_require__(2);
	
	var _lodash = __webpack_require__(3);
	
	var Collection = __webpack_require__(6).Collection;
	
	// holds the current user selection
	var SelectionManager = Collection.extend({
	
	  model: _Selection.sel,
	
	  initialize: function initialize(data, opts) {
	    if (typeof opts !== "undefined" && opts !== null) {
	      this.g = opts.g;
	
	      this.listenTo(this.g, "residue:click", function (e) {
	        return this._handleE(e.evt, new _Selection.possel({
	          xStart: e.rowPos,
	          xEnd: e.rowPos,
	          seqId: e.seqId
	        }));
	      });
	
	      this.listenTo(this.g, "row:click", function (e) {
	        return this._handleE(e.evt, new _Selection.rowsel({
	          seqId: e.seqId
	        }));
	      });
	
	      return this.listenTo(this.g, "column:click", function (e) {
	        return this._handleE(e.evt, new _Selection.columnsel({
	          xStart: e.rowPos,
	          xEnd: e.rowPos + e.stepSize - 1
	        }));
	      });
	    }
	  },
	
	  getSelForRow: function getSelForRow(seqId) {
	    return this.filter(function (el) {
	      return el.inRow(seqId);
	    });
	  },
	
	  getSelForColumns: function getSelForColumns(rowPos) {
	    return this.filter(function (el) {
	      return el.inColumn(rowPos);
	    });
	  },
	
	  addJSON: function addJSON(model) {
	    return this.add(this._fromJSON(model));
	  },
	
	  _fromJSON: function _fromJSON(model) {
	    switch (model.type) {
	      case "column":
	        return new _Selection.columnsel(model);
	      case "row":
	        return new _Selection.rowsel(model);
	      case "pos":
	        return new _Selection.possel(model);
	    }
	  },
	
	  // allows normal JSON input
	  resetJSON: function resetJSON(arr) {
	    arr = arr.map(this._fromJSON);
	    return this.reset(arr);
	  },
	
	  // @returns array of all selected residues for a row
	  getBlocksForRow: function getBlocksForRow(seqId, maxLen) {
	    var selis = this.filter(function (el) {
	      return el.inRow(seqId);
	    });
	    var blocks = [];
	
	    var _loop = function _loop(i, seli) {
	      var seli = selis[i];
	      if (seli.attributes.type === "row") {
	        blocks = function () {
	          var result = [];
	          var i1 = 0;
	          if (0 <= maxLen) {
	            while (i1 <= maxLen) {
	              result.push(i1++);
	            }
	          } else {
	            while (i1 >= maxLen) {
	              result.push(i1--);
	            }
	          }
	          return result;
	        }();
	        return "break";
	      } else {
	        blocks = blocks.concat(function () {
	          var result = [];
	          var i1 = seli.attributes.xStart;
	          if (seli.attributes.xStart <= seli.attributes.xEnd) {
	            while (i1 <= seli.attributes.xEnd) {
	              result.push(i1++);
	            }
	          } else {
	            while (i1 >= seli.attributes.xEnd) {
	              result.push(i1--);
	            }
	          }
	          return result;
	        }());
	      }
	    };
	
	    for (var i = 0, seli; i < selis.length; i++) {
	      var _ret = _loop(i, seli);
	
	      if (_ret === "break") break;
	    }
	    return blocks;
	  },
	
	  // @returns array with all columns being selected
	  // example: 0-4... 12-14 selected -> [0,1,2,3,4,12,13,14]
	  getAllColumnBlocks: function getAllColumnBlocks(conf) {
	    var maxLen = conf.maxLen;
	    var withPos = conf.withPos;
	    var blocks = [];
	    var filtered = void 0;
	    if (conf.withPos) {
	      filtered = this.filter(function (el) {
	        return el.get('xStart') != null;
	      });
	    } else {
	      filtered = this.filter(function (el) {
	        return el.get('type') === "column";
	      });
	    }
	
	    var _loop2 = function _loop2(i, seli) {
	      var seli = filtered[i];
	      blocks = blocks.concat(function () {
	        var result = [];
	        var i1 = seli.attributes.xStart;
	        if (seli.attributes.xStart <= seli.attributes.xEnd) {
	          while (i1 <= seli.attributes.xEnd) {
	            result.push(i1++);
	          }
	        } else {
	          while (i1 >= seli.attributes.xEnd) {
	            result.push(i1--);
	          }
	        }
	        return result;
	      }());
	    };
	
	    for (var i = 0, seli; i < filtered.length; i++) {
	      _loop2(i, seli);
	    }
	    blocks = (0, _lodash.uniq)(blocks);
	    return blocks;
	  },
	
	  // inverts the current selection for columns
	  // @param rows [Array] all available seqId
	  invertRow: function invertRow(rows) {
	    var selRows = this.where({ type: "row" });
	    selRows = selRows.map(function (el) {
	      return el.attributes.seqId;
	    });
	    var inverted = (0, _lodash.filter)(rows, function (el) {
	      if (selRows.indexOf(el) >= 0) {
	        return false;
	      } // existing selection
	      return true;
	    });
	    // mass insert
	    var s = [];
	    for (var i = 0, el; i < inverted.length; i++) {
	      var el = inverted[i];
	      s.push(new _Selection.rowsel({ seqId: el }));
	    }
	    return this.reset(s);
	  },
	
	  // inverts the current selection for rows
	  // @param rows [Array] all available rows (0..max.length)
	  invertCol: function invertCol(columns) {
	    var selColumns = this.where({ type: "column" }).reduce(function (memo, el) {
	      return memo.concat(function () {
	        var result = [];
	        var i = el.attributes.xStart;
	        if (el.attributes.xStart <= el.attributes.xEnd) {
	          while (i <= el.attributes.xEnd) {
	            result.push(i++);
	          }
	        } else {
	          while (i >= el.attributes.xEnd) {
	            result.push(i--);
	          }
	        }
	        return result;
	      }());
	    }, []);
	    var inverted = (0, _lodash.filter)(columns, function (el) {
	      if (selColumns.indexOf(el) >= 0) {
	        // existing selection
	        return false;
	      }
	      return true;
	    });
	    // mass insert
	    if (inverted.length === 0) {
	      return;
	    }
	    var s = [];
	    var xStart = inverted[0];
	    var xEnd = xStart;
	    for (var i = 0, el; i < inverted.length; i++) {
	      el = inverted[i];
	      if (xEnd + 1 === el) {
	        // contiguous
	        xEnd = el;
	      } else {
	        // gap between
	        s.push(new _Selection.columnsel({ xStart: xStart, xEnd: xEnd }));
	        xStart = xEnd = el;
	      }
	    }
	    // check for last gap
	    if (xStart !== xEnd) {
	      s.push(new _Selection.columnsel({ xStart: xStart, xEnd: inverted[inverted.length - 1] }));
	    }
	    return this.reset(s);
	  },
	
	  // method to decide whether to start a new selection
	  // or append to the old one (depending whether CTRL was pressed)
	  _handleE: function _handleE(e, selection) {
	    if (e.ctrlKey || e.metaKey) {
	      return this.add(selection);
	    } else {
	      return this.reset([selection]);
	    }
	  },
	
	  // experimental reduce method for columns
	  _reduceColumns: function _reduceColumns() {
	    return this.each(function (el, index, arr) {
	      var cols = (0, _lodash.filter)(arr, function (el) {
	        return el.get('type') === 'column';
	      });
	      var xStart = el.get('xStart');
	      var xEnd = el.get('xEnd');
	
	      var lefts = (0, _lodash.filter)(cols, function (el) {
	        return el.get('xEnd') === xStart - 1;
	      });
	      for (var i = 0, left; i < lefts.length; i++) {
	        var left = lefts[i];
	        left.set('xEnd', xStart);
	      }
	
	      var rights = (0, _lodash.filter)(cols, function (el) {
	        return el.get('xStart') === xEnd + 1;
	      });
	      for (var j = 0, right; j < rights.length; j++) {
	        var right = rights[j];
	        right.set('xStart', xEnd);
	      }
	
	      if (lefts.length > 0 || rights.length > 0) {
	        console.log("removed el");
	        return el.collection.remove(el);
	      }
	    });
	  }
	});
	exports.default = SelectionManager;

/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	// this is the extracted view model from backbone
	// note that we inject jbone as jquery replacment
	// (and underscore directly)
	//
	// Views are almost more convention than they are actual code.
	//  MVC pattern
	// Backbone.View
	// -------------
	
	var _ = __webpack_require__(11);
	var Events = __webpack_require__(8);
	var extend = __webpack_require__(10);
	var $ = __webpack_require__(15);
	
	// Backbone Views are almost more convention than they are actual code. A View
	// is simply a JavaScript object that represents a logical chunk of UI in the
	// DOM. This might be a single item, an entire list, a sidebar or panel, or
	// even the surrounding frame which wraps your whole app. Defining a chunk of
	// UI as a **View** allows you to define your DOM events declaratively, without
	// having to worry about render order ... and makes it easy for the view to
	// react to specific changes in the state of your models.
	
	// Creating a Backbone.View creates its initial element outside of the DOM,
	// if an existing element is not provided...
	var View = function View(options) {
	  this.cid = _.uniqueId('view');
	  options || (options = {});
	  _.extend(this, _.pick(options, viewOptions));
	  this._ensureElement();
	  this.initialize.apply(this, arguments);
	};
	
	// Cached regex to split keys for `delegate`.
	var delegateEventSplitter = /^(\S+)\s*(.*)$/;
	
	// List of view options to be merged as properties.
	var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];
	
	// Set up all inheritable **Backbone.View** properties and methods.
	_.extend(View.prototype, Events, {
	
	  // The default `tagName` of a View's element is `"div"`.
	  tagName: 'div',
	
	  // jQuery delegate for element lookup, scoped to DOM elements within the
	  // current view. This should be preferred to global lookups where possible.
	  $: function $(selector) {
	    return this.$el.find(selector);
	  },
	
	  // Initialize is an empty function by default. Override it with your own
	  // initialization logic.
	  initialize: function initialize() {},
	
	  // **render** is the core function that your view should override, in order
	  // to populate its element (`this.el`), with the appropriate HTML. The
	  // convention is for **render** to always return `this`.
	  render: function render() {
	    return this;
	  },
	
	  // Remove this view by taking the element out of the DOM, and removing any
	  // applicable Backbone.Events listeners.
	  remove: function remove() {
	    this._removeElement();
	    this.stopListening();
	    return this;
	  },
	
	  // Remove this view's element from the document and all event listeners
	  // attached to it. Exposed for subclasses using an alternative DOM
	  // manipulation API.
	  _removeElement: function _removeElement() {
	    this.$el.remove();
	  },
	
	  // Change the view's element (`this.el` property) and re-delegate the
	  // view's events on the new element.
	  setElement: function setElement(element) {
	    this.undelegateEvents();
	    this._setElement(element);
	    this.delegateEvents();
	    return this;
	  },
	
	  // Creates the `this.el` and `this.$el` references for this view using the
	  // given `el`. `el` can be a CSS selector or an HTML string, a jQuery
	  // context or an element. Subclasses can override this to utilize an
	  // alternative DOM manipulation API and are only required to set the
	  // `this.el` property.
	  _setElement: function _setElement(el) {
	    this.$el = el instanceof $ ? el : $(el);
	    this.el = this.$el[0];
	  },
	
	  // Set callbacks, where `this.events` is a hash of
	  //
	  // *{"event selector": "callback"}*
	  //
	  //     {
	  //       'mousedown .title':  'edit',
	  //       'click .button':     'save',
	  //       'click .open':       function(e) { ... }
	  //     }
	  //
	  // pairs. Callbacks will be bound to the view, with `this` set properly.
	  // Uses event delegation for efficiency.
	  // Omitting the selector binds the event to `this.el`.
	  delegateEvents: function delegateEvents(events) {
	    if (!(events || (events = _.result(this, 'events')))) return this;
	    this.undelegateEvents();
	    for (var key in events) {
	      var method = events[key];
	      if (!_.isFunction(method)) method = this[events[key]];
	      if (!method) continue;
	      var match = key.match(delegateEventSplitter);
	      this.delegate(match[1], match[2], _.bind(method, this));
	    }
	    return this;
	  },
	
	  // Add a single event listener to the view's element (or a child element
	  // using `selector`). This only works for delegate-able events: not `focus`,
	  // `blur`, and not `change`, `submit`, and `reset` in Internet Explorer.
	  delegate: function delegate(eventName, selector, listener) {
	    this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
	  },
	
	  // Clears all callbacks previously bound to the view by `delegateEvents`.
	  // You usually don't need to use this, but may wish to if you have multiple
	  // Backbone views attached to the same DOM element.
	  undelegateEvents: function undelegateEvents() {
	    if (this.$el) this.$el.off('.delegateEvents' + this.cid);
	    return this;
	  },
	
	  // A finer-grained `undelegateEvents` for removing a single delegated event.
	  // `selector` and `listener` are both optional.
	  undelegate: function undelegate(eventName, selector, listener) {
	    this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
	  },
	
	  // Produces a DOM element to be assigned to your view. Exposed for
	  // subclasses using an alternative DOM manipulation API.
	  _createElement: function _createElement(tagName) {
	    return document.createElement(tagName);
	  },
	
	  // Ensure that the View has a DOM element to render into.
	  // If `this.el` is a string, pass it through `$()`, take the first
	  // matching element, and re-assign it to `el`. Otherwise, create
	  // an element from the `id`, `className` and `tagName` properties.
	  _ensureElement: function _ensureElement() {
	    if (!this.el) {
	      var attrs = _.extend({}, _.result(this, 'attributes'));
	      if (this.id) attrs.id = _.result(this, 'id');
	      if (this.className) attrs['class'] = _.result(this, 'className');
	      this.setElement(this._createElement(_.result(this, 'tagName')));
	      this._setAttributes(attrs);
	    } else {
	      this.setElement(_.result(this, 'el'));
	    }
	  },
	
	  // Set attributes from a hash on this view's element.  Exposed for
	  // subclasses using an alternative DOM manipulation API.
	  _setAttributes: function _setAttributes(attributes) {
	    this.$el.attr(attributes);
	  }
	
	});
	
	// setup inheritance
	View.extend = extend;
	module.exports = View;

/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;/* WEBPACK VAR INJECTION */(function(module) {"use strict";
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	/*!
	 * jBone v1.2.0 - 2016-04-13 - Library for DOM manipulation
	 *
	 * http://jbone.js.org
	 *
	 * Copyright 2016 Alexey Kupriyanenko
	 * Released under the MIT license.
	 */
	
	(function (win) {
	
	    var
	    // cache previous versions
	    _$ = win.$,
	        _jBone = win.jBone,
	
	
	    // Quick match a standalone tag
	    rquickSingleTag = /^<(\w+)\s*\/?>$/,
	
	
	    // A simple way to check for HTML strings
	    // Prioritize #id over <tag> to avoid XSS via location.hash
	    rquickExpr = /^(?:[^#<]*(<[\w\W]+>)[^>]*$|#([\w\-]*)$)/,
	
	
	    // Alias for function
	    slice = [].slice,
	        splice = [].splice,
	        keys = Object.keys,
	
	
	    // Alias for global variables
	    doc = document,
	        isString = function isString(el) {
	        return typeof el === "string";
	    },
	        isObject = function isObject(el) {
	        return el instanceof Object;
	    },
	        isFunction = function isFunction(el) {
	        return {}.toString.call(el) === "[object Function]";
	    },
	        isArray = function isArray(el) {
	        return Array.isArray(el);
	    },
	        jBone = function jBone(element, data) {
	        return new fn.init(element, data);
	    },
	        fn;
	
	    // set previous values and return the instance upon calling the no-conflict mode
	    jBone.noConflict = function () {
	        win.$ = _$;
	        win.jBone = _jBone;
	
	        return jBone;
	    };
	
	    fn = jBone.fn = jBone.prototype = {
	        init: function init(element, data) {
	            var elements, tag, wraper, fragment;
	
	            if (!element) {
	                return this;
	            }
	            if (isString(element)) {
	                // Create single DOM element
	                if (tag = rquickSingleTag.exec(element)) {
	                    this[0] = doc.createElement(tag[1]);
	                    this.length = 1;
	
	                    if (isObject(data)) {
	                        this.attr(data);
	                    }
	
	                    return this;
	                }
	                // Create DOM collection
	                if ((tag = rquickExpr.exec(element)) && tag[1]) {
	                    fragment = doc.createDocumentFragment();
	                    wraper = doc.createElement("div");
	                    wraper.innerHTML = element;
	                    while (wraper.lastChild) {
	                        fragment.appendChild(wraper.firstChild);
	                    }
	                    elements = slice.call(fragment.childNodes);
	
	                    return jBone.merge(this, elements);
	                }
	                // Find DOM elements with querySelectorAll
	                if (jBone.isElement(data)) {
	                    return jBone(data).find(element);
	                }
	
	                try {
	                    elements = doc.querySelectorAll(element);
	
	                    return jBone.merge(this, elements);
	                } catch (e) {
	                    return this;
	                }
	            }
	            // Wrap DOMElement
	            if (element.nodeType) {
	                this[0] = element;
	                this.length = 1;
	
	                return this;
	            }
	            // Run function
	            if (isFunction(element)) {
	                return element();
	            }
	            // Return jBone element as is
	            if (element instanceof jBone) {
	                return element;
	            }
	
	            // Return element wrapped by jBone
	            return jBone.makeArray(element, this);
	        },
	
	        pop: [].pop,
	        push: [].push,
	        reverse: [].reverse,
	        shift: [].shift,
	        sort: [].sort,
	        splice: [].splice,
	        slice: [].slice,
	        indexOf: [].indexOf,
	        forEach: [].forEach,
	        unshift: [].unshift,
	        concat: [].concat,
	        join: [].join,
	        every: [].every,
	        some: [].some,
	        filter: [].filter,
	        map: [].map,
	        reduce: [].reduce,
	        reduceRight: [].reduceRight,
	        length: 0
	    };
	
	    fn.constructor = jBone;
	
	    fn.init.prototype = fn;
	
	    jBone.setId = function (el) {
	        var jid = el.jid;
	
	        if (el === win) {
	            jid = "window";
	        } else if (el.jid === undefined) {
	            el.jid = jid = ++jBone._cache.jid;
	        }
	
	        if (!jBone._cache.events[jid]) {
	            jBone._cache.events[jid] = {};
	        }
	    };
	
	    jBone.getData = function (el) {
	        el = el instanceof jBone ? el[0] : el;
	
	        var jid = el === win ? "window" : el.jid;
	
	        return {
	            jid: jid,
	            events: jBone._cache.events[jid]
	        };
	    };
	
	    jBone.isElement = function (el) {
	        return el && el instanceof jBone || el instanceof HTMLElement || isString(el);
	    };
	
	    jBone._cache = {
	        events: {},
	        jid: 0
	    };
	
	    function isArraylike(obj) {
	        var length = obj.length,
	            type = typeof obj === "undefined" ? "undefined" : _typeof(obj);
	
	        if (isFunction(type) || obj === win) {
	            return false;
	        }
	
	        if (obj.nodeType === 1 && length) {
	            return true;
	        }
	
	        return isArray(type) || length === 0 || typeof length === "number" && length > 0 && length - 1 in obj;
	    }
	
	    fn.pushStack = function (elems) {
	        var ret = jBone.merge(this.constructor(), elems);
	
	        return ret;
	    };
	
	    jBone.merge = function (first, second) {
	        var l = second.length,
	            i = first.length,
	            j = 0;
	
	        while (j < l) {
	            first[i++] = second[j++];
	        }
	
	        first.length = i;
	
	        return first;
	    };
	
	    jBone.contains = function (container, contained) {
	        return container.contains(contained);
	    };
	
	    jBone.extend = function (target) {
	        var tg;
	
	        splice.call(arguments, 1).forEach(function (source) {
	            tg = target; //caching target for perf improvement
	
	            if (source) {
	                for (var prop in source) {
	                    tg[prop] = source[prop];
	                }
	            }
	        });
	
	        return target;
	    };
	
	    jBone.makeArray = function (arr, results) {
	        var ret = results || [];
	
	        if (arr !== null) {
	            if (isArraylike(arr)) {
	                jBone.merge(ret, isString(arr) ? [arr] : arr);
	            } else {
	                ret.push(arr);
	            }
	        }
	
	        return ret;
	    };
	
	    jBone.unique = function (array) {
	        if (array == null) {
	            return [];
	        }
	
	        var result = [];
	
	        for (var i = 0, length = array.length; i < length; i++) {
	            var value = array[i];
	            if (result.indexOf(value) < 0) {
	                result.push(value);
	            }
	        }
	        return result;
	    };
	
	    function BoneEvent(e, data) {
	        var key, setter;
	
	        this.originalEvent = e;
	
	        setter = function setter(key, e) {
	            if (key === "preventDefault") {
	                this[key] = function () {
	                    this.defaultPrevented = true;
	                    return e[key]();
	                };
	            } else if (key === "stopImmediatePropagation") {
	                this[key] = function () {
	                    this.immediatePropagationStopped = true;
	                    return e[key]();
	                };
	            } else if (isFunction(e[key])) {
	                this[key] = function () {
	                    return e[key]();
	                };
	            } else {
	                this[key] = e[key];
	            }
	        };
	
	        for (key in e) {
	            if (e[key] || typeof e[key] === "function") {
	                setter.call(this, key, e);
	            }
	        }
	
	        jBone.extend(this, data, {
	            isImmediatePropagationStopped: function isImmediatePropagationStopped() {
	                return !!this.immediatePropagationStopped;
	            }
	        });
	    }
	
	    jBone.Event = function (event, data) {
	        var namespace, eventType;
	
	        if (event.type && !data) {
	            data = event;
	            event = event.type;
	        }
	
	        namespace = event.split(".").splice(1).join(".");
	        eventType = event.split(".")[0];
	
	        event = doc.createEvent("Event");
	        event.initEvent(eventType, true, true);
	
	        return jBone.extend(event, {
	            namespace: namespace,
	            isDefaultPrevented: function isDefaultPrevented() {
	                return event.defaultPrevented;
	            }
	        }, data);
	    };
	
	    jBone.event = {
	
	        /**
	         * Attach a handler to an event for the elements
	         * @param {Node}        el         - Events will be attached to this DOM Node
	         * @param {String}      types      - One or more space-separated event types and optional namespaces
	         * @param {Function}    handler    - A function to execute when the event is triggered
	         * @param {Object}      [data]     - Data to be passed to the handler in event.data
	         * @param {String}      [selector] - A selector string to filter the descendants of the selected elements
	         */
	        add: function add(el, types, handler, data, selector) {
	            jBone.setId(el);
	
	            var eventHandler = function eventHandler(e) {
	                jBone.event.dispatch.call(el, e);
	            },
	                events = jBone.getData(el).events,
	                eventType,
	                t,
	                event;
	
	            types = types.split(" ");
	            t = types.length;
	            while (t--) {
	                event = types[t];
	
	                eventType = event.split(".")[0];
	                events[eventType] = events[eventType] || [];
	
	                if (events[eventType].length) {
	                    // override with previous event handler
	                    eventHandler = events[eventType][0].fn;
	                } else {
	                    el.addEventListener && el.addEventListener(eventType, eventHandler, false);
	                }
	
	                events[eventType].push({
	                    namespace: event.split(".").splice(1).join("."),
	                    fn: eventHandler,
	                    selector: selector,
	                    data: data,
	                    originfn: handler
	                });
	            }
	        },
	
	        /**
	         * Remove an event handler
	         * @param  {Node}       el        - Events will be deattached from this DOM Node
	         * @param  {String}     types     - One or more space-separated event types and optional namespaces
	         * @param  {Function}   handler   - A handler function previously attached for the event(s)
	         * @param  {String}     [selector] - A selector string to filter the descendants of the selected elements
	         */
	        remove: function remove(el, types, handler, selector) {
	            var removeListener = function removeListener(events, eventType, index, el, e) {
	                var callback;
	
	                // get callback
	                if (handler && e.originfn === handler || !handler) {
	                    callback = e.fn;
	                }
	
	                if (events[eventType][index].fn === callback) {
	                    // remove handler from cache
	                    events[eventType].splice(index, 1);
	
	                    if (!events[eventType].length) {
	                        el.removeEventListener(eventType, callback);
	                    }
	                }
	            },
	                events = jBone.getData(el).events,
	                l,
	                eventsByType;
	
	            if (!events) {
	                return;
	            }
	
	            // remove all events
	            if (!types && events) {
	                return keys(events).forEach(function (eventType) {
	                    eventsByType = events[eventType];
	                    l = eventsByType.length;
	
	                    while (l--) {
	                        removeListener(events, eventType, l, el, eventsByType[l]);
	                    }
	                });
	            }
	
	            types.split(" ").forEach(function (eventName) {
	                var eventType = eventName.split(".")[0],
	                    namespace = eventName.split(".").splice(1).join("."),
	                    e;
	
	                // remove named events
	                if (events[eventType]) {
	                    eventsByType = events[eventType];
	                    l = eventsByType.length;
	
	                    while (l--) {
	                        e = eventsByType[l];
	                        if ((!namespace || namespace && e.namespace === namespace) && (!selector || selector && e.selector === selector)) {
	                            removeListener(events, eventType, l, el, e);
	                        }
	                    }
	                }
	                // remove all namespaced events
	                else if (namespace) {
	                        keys(events).forEach(function (eventType) {
	                            eventsByType = events[eventType];
	                            l = eventsByType.length;
	
	                            while (l--) {
	                                e = eventsByType[l];
	                                if (e.namespace.split(".")[0] === namespace.split(".")[0]) {
	                                    removeListener(events, eventType, l, el, e);
	                                }
	                            }
	                        });
	                    }
	            });
	        },
	
	        /**
	         * Execute all handlers and behaviors attached to the matched elements for the given event type.
	         * @param  {Node}       el       - Events will be triggered for thie DOM Node
	         * @param  {String}     event    - One or more space-separated event types and optional namespaces
	         */
	        trigger: function trigger(el, event) {
	            var events = [];
	
	            if (isString(event)) {
	                events = event.split(" ").map(function (event) {
	                    return jBone.Event(event);
	                });
	            } else {
	                event = event instanceof Event ? event : jBone.Event(event);
	                events = [event];
	            }
	
	            events.forEach(function (event) {
	                if (!event.type) {
	                    return;
	                }
	
	                el.dispatchEvent && el.dispatchEvent(event);
	            });
	        },
	
	        dispatch: function dispatch(e) {
	            var i = 0,
	                j = 0,
	                el = this,
	                handlers = jBone.getData(el).events[e.type],
	                length = handlers.length,
	                handlerQueue = [],
	                targets = [],
	                l,
	                expectedTarget,
	                handler,
	                event,
	                eventOptions;
	
	            // cache all events handlers, fix issue with multiple handlers (issue #45)
	            for (; i < length; i++) {
	                handlerQueue.push(handlers[i]);
	            }
	
	            i = 0;
	            length = handlerQueue.length;
	
	            for (;
	            // if event exists
	            i < length &&
	            // if handler is not removed from stack
	            ~handlers.indexOf(handlerQueue[i]) &&
	            // if propagation is not stopped
	            !(event && event.isImmediatePropagationStopped()); i++) {
	                expectedTarget = null;
	                eventOptions = {};
	                handler = handlerQueue[i];
	                handler.data && (eventOptions.data = handler.data);
	
	                // event handler without selector
	                if (!handler.selector) {
	                    event = new BoneEvent(e, eventOptions);
	
	                    if (!(e.namespace && e.namespace !== handler.namespace)) {
	                        handler.originfn.call(el, event);
	                    }
	                }
	                // event handler with selector
	                else if (
	                    // if target and selected element the same
	                    ~(targets = jBone(el).find(handler.selector)).indexOf(e.target) && (expectedTarget = e.target) ||
	                    // if one of element matched with selector contains target
	                    el !== e.target && el.contains(e.target)) {
	                        // get element matched with selector
	                        if (!expectedTarget) {
	                            l = targets.length;
	                            j = 0;
	
	                            for (; j < l; j++) {
	                                if (targets[j] && targets[j].contains(e.target)) {
	                                    expectedTarget = targets[j];
	                                }
	                            }
	                        }
	
	                        if (!expectedTarget) {
	                            continue;
	                        }
	
	                        eventOptions.currentTarget = expectedTarget;
	                        event = new BoneEvent(e, eventOptions);
	
	                        if (!(e.namespace && e.namespace !== handler.namespace)) {
	                            handler.originfn.call(expectedTarget, event);
	                        }
	                    }
	            }
	        }
	    };
	
	    fn.on = function (types, selector, data, fn) {
	        var length = this.length,
	            i = 0;
	
	        if (data == null && fn == null) {
	            // (types, fn)
	            fn = selector;
	            data = selector = undefined;
	        } else if (fn == null) {
	            if (typeof selector === "string") {
	                // (types, selector, fn)
	                fn = data;
	                data = undefined;
	            } else {
	                // (types, data, fn)
	                fn = data;
	                data = selector;
	                selector = undefined;
	            }
	        }
	
	        if (!fn) {
	            return this;
	        }
	
	        for (; i < length; i++) {
	            jBone.event.add(this[i], types, fn, data, selector);
	        }
	
	        return this;
	    };
	
	    fn.one = function (event) {
	        var args = arguments,
	            i = 0,
	            length = this.length,
	            oneArgs = slice.call(args, 1, args.length - 1),
	            callback = slice.call(args, -1)[0],
	            addListener;
	
	        addListener = function addListener(el) {
	            var $el = jBone(el);
	
	            event.split(" ").forEach(function (event) {
	                var fn = function fn(e) {
	                    $el.off(event, fn);
	                    callback.call(el, e);
	                };
	
	                $el.on.apply($el, [event].concat(oneArgs, fn));
	            });
	        };
	
	        for (; i < length; i++) {
	            addListener(this[i]);
	        }
	
	        return this;
	    };
	
	    fn.trigger = function (event) {
	        var i = 0,
	            length = this.length;
	
	        if (!event) {
	            return this;
	        }
	
	        for (; i < length; i++) {
	            jBone.event.trigger(this[i], event);
	        }
	
	        return this;
	    };
	
	    fn.off = function (types, selector, handler) {
	        var i = 0,
	            length = this.length;
	
	        if (isFunction(selector)) {
	            handler = selector;
	            selector = undefined;
	        }
	
	        for (; i < length; i++) {
	            jBone.event.remove(this[i], types, handler, selector);
	        }
	
	        return this;
	    };
	
	    fn.find = function (selector) {
	        var results = [],
	            i = 0,
	            length = this.length,
	            finder = function finder(el) {
	            if (isFunction(el.querySelectorAll)) {
	                [].forEach.call(el.querySelectorAll(selector), function (found) {
	                    results.push(found);
	                });
	            }
	        };
	
	        for (; i < length; i++) {
	            finder(this[i]);
	        }
	
	        return jBone(results);
	    };
	
	    fn.get = function (index) {
	        return index != null ?
	
	        // Return just one element from the set
	        index < 0 ? this[index + this.length] : this[index] :
	
	        // Return all the elements in a clean array
	        slice.call(this);
	    };
	
	    fn.eq = function (index) {
	        return jBone(this[index]);
	    };
	
	    fn.parent = function () {
	        var results = [],
	            parent,
	            i = 0,
	            length = this.length;
	
	        for (; i < length; i++) {
	            if (!~results.indexOf(parent = this[i].parentElement) && parent) {
	                results.push(parent);
	            }
	        }
	
	        return jBone(results);
	    };
	
	    fn.toArray = function () {
	        return slice.call(this);
	    };
	
	    fn.is = function () {
	        var args = arguments;
	
	        return this.some(function (el) {
	            return el.tagName.toLowerCase() === args[0];
	        });
	    };
	
	    fn.has = function () {
	        var args = arguments;
	
	        return this.some(function (el) {
	            return el.querySelectorAll(args[0]).length;
	        });
	    };
	
	    fn.add = function (selector, context) {
	        return this.pushStack(jBone.unique(jBone.merge(this.get(), jBone(selector, context))));
	    };
	
	    fn.attr = function (key, value) {
	        var args = arguments,
	            i = 0,
	            length = this.length,
	            setter;
	
	        if (isString(key) && args.length === 1) {
	            return this[0] && this[0].getAttribute(key);
	        }
	
	        if (args.length === 2) {
	            setter = function setter(el) {
	                el.setAttribute(key, value);
	            };
	        } else if (isObject(key)) {
	            setter = function setter(el) {
	                keys(key).forEach(function (name) {
	                    el.setAttribute(name, key[name]);
	                });
	            };
	        }
	
	        for (; i < length; i++) {
	            setter(this[i]);
	        }
	
	        return this;
	    };
	
	    fn.removeAttr = function (key) {
	        var i = 0,
	            length = this.length;
	
	        for (; i < length; i++) {
	            this[i].removeAttribute(key);
	        }
	
	        return this;
	    };
	
	    fn.val = function (value) {
	        var i = 0,
	            length = this.length;
	
	        if (arguments.length === 0) {
	            return this[0] && this[0].value;
	        }
	
	        for (; i < length; i++) {
	            this[i].value = value;
	        }
	
	        return this;
	    };
	
	    fn.css = function (key, value) {
	        var args = arguments,
	            i = 0,
	            length = this.length,
	            setter;
	
	        // Get attribute
	        if (isString(key) && args.length === 1) {
	            return this[0] && win.getComputedStyle(this[0])[key];
	        }
	
	        // Set attributes
	        if (args.length === 2) {
	            setter = function setter(el) {
	                el.style[key] = value;
	            };
	        } else if (isObject(key)) {
	            setter = function setter(el) {
	                keys(key).forEach(function (name) {
	                    el.style[name] = key[name];
	                });
	            };
	        }
	
	        for (; i < length; i++) {
	            setter(this[i]);
	        }
	
	        return this;
	    };
	
	    fn.data = function (key, value) {
	        var args = arguments,
	            data = {},
	            i = 0,
	            length = this.length,
	            setter,
	            setValue = function setValue(el, key, value) {
	            if (isObject(value)) {
	                el.jdata = el.jdata || {};
	                el.jdata[key] = value;
	            } else {
	                el.dataset[key] = value;
	            }
	        },
	            getValue = function getValue(value) {
	            if (value === "true") {
	                return true;
	            } else if (value === "false") {
	                return false;
	            } else {
	                return value;
	            }
	        };
	
	        // Get all data
	        if (args.length === 0) {
	            this[0].jdata && (data = this[0].jdata);
	
	            keys(this[0].dataset).forEach(function (key) {
	                data[key] = getValue(this[0].dataset[key]);
	            }, this);
	
	            return data;
	        }
	        // Get data by name
	        if (args.length === 1 && isString(key)) {
	            return this[0] && getValue(this[0].dataset[key] || this[0].jdata && this[0].jdata[key]);
	        }
	
	        // Set data
	        if (args.length === 1 && isObject(key)) {
	            setter = function setter(el) {
	                keys(key).forEach(function (name) {
	                    setValue(el, name, key[name]);
	                });
	            };
	        } else if (args.length === 2) {
	            setter = function setter(el) {
	                setValue(el, key, value);
	            };
	        }
	
	        for (; i < length; i++) {
	            setter(this[i]);
	        }
	
	        return this;
	    };
	
	    fn.removeData = function (key) {
	        var i = 0,
	            length = this.length,
	            jdata,
	            dataset;
	
	        for (; i < length; i++) {
	            jdata = this[i].jdata;
	            dataset = this[i].dataset;
	
	            if (key) {
	                jdata && jdata[key] && delete jdata[key];
	                delete dataset[key];
	            } else {
	                for (key in jdata) {
	                    delete jdata[key];
	                }
	
	                for (key in dataset) {
	                    delete dataset[key];
	                }
	            }
	        }
	
	        return this;
	    };
	
	    fn.addClass = function (className) {
	        var i = 0,
	            j = 0,
	            length = this.length,
	            classes = className ? className.trim().split(/\s+/) : [];
	
	        for (; i < length; i++) {
	            j = 0;
	
	            for (j = 0; j < classes.length; j++) {
	                this[i].classList.add(classes[j]);
	            }
	        }
	
	        return this;
	    };
	
	    fn.removeClass = function (className) {
	        var i = 0,
	            j = 0,
	            length = this.length,
	            classes = className ? className.trim().split(/\s+/) : [];
	
	        for (; i < length; i++) {
	            j = 0;
	
	            for (j = 0; j < classes.length; j++) {
	                this[i].classList.remove(classes[j]);
	            }
	        }
	
	        return this;
	    };
	
	    fn.toggleClass = function (className, force) {
	        var i = 0,
	            length = this.length,
	            method = "toggle";
	
	        force === true && (method = "add") || force === false && (method = "remove");
	
	        if (className) {
	            for (; i < length; i++) {
	                this[i].classList[method](className);
	            }
	        }
	
	        return this;
	    };
	
	    fn.hasClass = function (className) {
	        var i = 0,
	            length = this.length;
	
	        if (className) {
	            for (; i < length; i++) {
	                if (this[i].classList.contains(className)) {
	                    return true;
	                }
	            }
	        }
	
	        return false;
	    };
	
	    fn.html = function (value) {
	        var args = arguments,
	            el;
	
	        // add HTML into elements
	        if (args.length === 1 && value !== undefined) {
	            return this.empty().append(value);
	        }
	        // get HTML from element
	        else if (args.length === 0 && (el = this[0])) {
	                return el.innerHTML;
	            }
	
	        return this;
	    };
	
	    fn.append = function (appended) {
	        var i = 0,
	            length = this.length,
	            setter;
	
	        // create jBone object and then append
	        if (isString(appended) && rquickExpr.exec(appended)) {
	            appended = jBone(appended);
	        }
	        // create text node for insertion
	        else if (!isObject(appended)) {
	                appended = document.createTextNode(appended);
	            }
	
	        appended = appended instanceof jBone ? appended : jBone(appended);
	
	        setter = function setter(el, i) {
	            appended.forEach(function (node) {
	                if (i) {
	                    el.appendChild(node.cloneNode(true));
	                } else {
	                    el.appendChild(node);
	                }
	            });
	        };
	
	        for (; i < length; i++) {
	            setter(this[i], i);
	        }
	
	        return this;
	    };
	
	    fn.appendTo = function (to) {
	        jBone(to).append(this);
	
	        return this;
	    };
	
	    fn.empty = function () {
	        var i = 0,
	            length = this.length,
	            el;
	
	        for (; i < length; i++) {
	            el = this[i];
	
	            while (el.lastChild) {
	                el.removeChild(el.lastChild);
	            }
	        }
	
	        return this;
	    };
	
	    fn.remove = function () {
	        var i = 0,
	            length = this.length,
	            el;
	
	        // remove all listeners
	        this.off();
	
	        for (; i < length; i++) {
	            el = this[i];
	
	            // remove data and nodes
	            delete el.jdata;
	            el.parentNode && el.parentNode.removeChild(el);
	        }
	
	        return this;
	    };
	
	    if (( false ? "undefined" : _typeof(module)) === "object" && module && _typeof(module.exports) === "object") {
	        // Expose jBone as module.exports in loaders that implement the Node
	        // module pattern (including browserify). Do not create the global, since
	        // the user will be storing it themselves locally, and globals are frowned
	        // upon in the Node module world.
	        module.exports = jBone;
	    }
	    // Register as a AMD module
	    else if (true) {
	            !(__WEBPACK_AMD_DEFINE_RESULT__ = function () {
	                return jBone;
	            }.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	
	            win.jBone = win.$ = jBone;
	        } else if ((typeof win === "undefined" ? "undefined" : _typeof(win)) === "object" && _typeof(win.document) === "object") {
	            win.jBone = win.$ = jBone;
	        }
	})(window);
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(4)(module)))

/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var _ = __webpack_require__(11);
	var viewType = __webpack_require__(14);
	var pluginator;
	
	/**
	 * Remove an element and provide a function that inserts it into its original position
	 * @param element {Element} The element to be temporarily removed
	 * @return {Function} A function that inserts the element into its original position
	 **/
	function removeToInsertLater(element) {
	  var parentNode = element.parentNode;
	  var nextSibling = element.nextSibling;
	  parentNode.removeChild(element);
	  return function () {
	    if (nextSibling) {
	      parentNode.insertBefore(element, nextSibling);
	    } else {
	      parentNode.appendChild(element);
	    }
	  };
	}
	
	var removeChilds = function removeChilds(node) {
	  var last;
	  while (last = node.lastChild) {
	    node.removeChild(last);
	  }
	};
	
	module.exports = pluginator = viewType.extend({
	  renderSubviews: function renderSubviews() {
	    // it is faster to remove the entire element and replace it
	    // -> however this will lead to lost id,class and style props
	    var oldEl = this.el;
	
	    // it might be that the element is not on the DOM yet
	    var elOnDom = oldEl.parentNode != undefined;
	    if (elOnDom) {
	      var insert = removeToInsertLater(oldEl);
	    }
	    removeChilds(oldEl);
	
	    var frag = document.createDocumentFragment();
	    var views = this._views();
	    var viewsSorted = _.sortBy(views, function (el) {
	      return el.ordering;
	    });
	    var view, node;
	    for (var i = 0; i < viewsSorted.length; i++) {
	      view = viewsSorted[i];
	      view.render();
	      node = view.el;
	      if (node != null) {
	        frag.appendChild(node);
	      }
	    }
	
	    oldEl.appendChild(frag);
	    if (elOnDom) {
	      insert();
	    }
	    return oldEl;
	  },
	  addView: function addView(key, view) {
	    var views = this._views();
	    if (view == null) {
	      throw "Invalid plugin. ";
	    }
	    if (view.ordering == null) {
	      view.ordering = key;
	    }
	    return views[key] = view;
	  },
	  removeViews: function removeViews() {
	    var el, key;
	    var views = this._views();
	    for (key in views) {
	      el = views[key];
	      el.undelegateEvents();
	      el.unbind();
	      if (el.removeViews != null) {
	        el.removeViews();
	      }
	      el.remove();
	    }
	    return this.views = {};
	  },
	  removeView: function removeView(key) {
	    var views = this._views();
	    views[key].remove();
	    return delete views[key];
	  },
	  getView: function getView(key) {
	    var views = this._views();
	    return views[key];
	  },
	  remove: function remove() {
	    this.removeViews();
	    return viewType.prototype.remove.apply(this);
	  },
	  _views: function _views() {
	    if (this.views == null) {
	      this.views = {};
	    }
	    return this.views;
	  }
	});

/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _SeqCollection = __webpack_require__(18);
	
	var _SeqCollection2 = _interopRequireDefault(_SeqCollection);
	
	var _colorscheme = __webpack_require__(22);
	
	var _colorscheme2 = _interopRequireDefault(_colorscheme);
	
	var _columns = __webpack_require__(40);
	
	var _columns2 = _interopRequireDefault(_columns);
	
	var _config = __webpack_require__(41);
	
	var _config2 = _interopRequireDefault(_config);
	
	var _package = __webpack_require__(42);
	
	var _package2 = _interopRequireDefault(_package);
	
	var _SelectionCol = __webpack_require__(13);
	
	var _SelectionCol2 = _interopRequireDefault(_SelectionCol);
	
	var _user = __webpack_require__(49);
	
	var _user2 = _interopRequireDefault(_user);
	
	var _visibility = __webpack_require__(51);
	
	var _visibility2 = _interopRequireDefault(_visibility);
	
	var _visOrdering = __webpack_require__(50);
	
	var _visOrdering2 = _interopRequireDefault(_visOrdering);
	
	var _zoomer = __webpack_require__(52);
	
	var _zoomer2 = _interopRequireDefault(_zoomer);
	
	var _StageScale = __webpack_require__(46);
	
	var _StageScale2 = _interopRequireDefault(_StageScale);
	
	var _Stage = __webpack_require__(53);
	
	var _Stage2 = _interopRequireDefault(_Stage);
	
	var _file = __webpack_require__(113);
	
	var _file2 = _interopRequireDefault(_file);
	
	var _tree = __webpack_require__(115);
	
	var _tree2 = _interopRequireDefault(_tree);
	
	var _proxy = __webpack_require__(122);
	
	var _proxy2 = _interopRequireDefault(_proxy);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	// MV from backbone
	
	
	// globals
	var boneView = __webpack_require__(16); // models
	
	var Eventhandler = __webpack_require__(57);
	
	// MSA views
	
	
	// statistics
	var Stats = __webpack_require__(126);
	
	// utils
    var $ = __webpack_require__(15);
	
	
	// opts is a dictionary consisting of
	// @param el [String] id or reference to a DOM element
	// @param seqs [SeqArray] Array of sequences for initlization
	// @param conf [Dict] user config
	// @param vis [Dict] config of visible views
	// @param zoomer [Dict] display settings like columnWidth
	var MSA = boneView.extend({
	
	  initialize: function initialize(data) {
	    var _this = this;
	
	    if (!(typeof data !== "undefined" && data !== null)) {
	      data = {};
	    }
	    // check for default arrays
	    if (!(data.colorscheme != null)) {
	      data.colorscheme = {};
	    }
	    if (!(data.columns != null)) {
	      data.columns = {};
	    }
	    if (!(data.conf != null)) {
	      data.conf = {};
	    }
	    if (!(data.vis != null)) {
	      data.vis = {};
	    }
	    if (!(data.visorder != null)) {
	      data.visorder = {};
	    }
	    if (!(data.zoomer != null)) {
	      data.zoomer = {};
	    }
	    if (!(data.conserv != null)) {
	      data.conserv = {};
	    }
	    if (!(data.scale != null)) {
	      data.scale = {};
	    }
	
	    // g is our global Mediator
	    this.g = Eventhandler.mixin({});
	
	    // load seqs and add subviews
	    this.seqs = this.g.seqs = new _SeqCollection2.default(data.seqs, this.g);
	
	    // populate it and init the global models
	    this.g.config = new _config2.default(data.conf);
	    this.g.package = new _package2.default(this.g);
	    this.g.selcol = new _SelectionCol2.default([], { g: this.g });
	    this.g.user = new _user2.default();
	    this.g.vis = new _visibility2.default(data.vis, { model: this.seqs });
	    this.g.visorder = new _visOrdering2.default(data.visorder);
	    this.g.zoomer = new _zoomer2.default(data.zoomer, { g: this.g, model: this.seqs });
	
	    this.g.scale = new _StageScale2.default(data.scale, { g: this.g });
	
	    // store config options for plugins
	    this.g.conservationConfig = data.conserv;
	
	    // debug mode
	    if (window.location.hostname === "localhost") {
	      this.g.config.set("debug", true);
	    }
	
	    this._loadSeqs(data);
	
	    // utils
	    this.u = {};
	    this.u.file = new _file2.default(this);
	    this.u.proxy = new _proxy2.default({ g: this.g });
	    this.u.tree = new _tree2.default(this);
	
	    if (this.g.config.get("eventBus") === true) {
	      this.startEventBus();
	    }
	
	    if (this.g.config.get("dropImport")) {
	      var events = { "dragover": this.dragOver,
	        "drop": this.dropFile
	      };
	      this.delegateEvents(events);
	    }
	
	    if (data.importURL) {
	      this.u.file.importURL(data.importURL, function () {
	        return _this.render();
	      });
	    }
	    /*
	        if (data.bootstrapMenu) {
	          // pass menu configuration to defaultmenu
	          if(data.menu){
	            this.menuConfig = data.menu;
	          }
	          this.g.config.set("bootstrapMenu", true);
	        }
	    */
	    this.draw();
	    // add models to the msa (convenience)
	    return this.m();
	  },
	
	  _loadSeqs: function _loadSeqs(data) {
	    // stats
	    var pureSeq = this.seqs.pluck("seq");
	    this.g.stats = new Stats(this.seqs, { useGaps: true });
	    this.g.stats.alphabetSize = this.g.config.get("alphabetSize");
	    this.g.columns = new _columns2.default(data.columns, this.g.stats); // for action on the columns like hiding
	
	    // depending config
	    this.g.colorscheme = new _colorscheme2.default(data.colorscheme, pureSeq, this.g.stats);
	
	    // more init
	    return this.g.zoomer.setEl(this.el, this.seqs);
	  },
	
	  // proxy to the utility package
	  importURL: function importURL() {
	    return this.u.file.importURL.apply(this.u.file, arguments);
	  },
	
	  // add models to the msa (convenience)
	  m: function m() {
	    var m = {};
	    m.model = __webpack_require__(127);
	    m.selection = __webpack_require__(2);
	    m.selcol = __webpack_require__(13);
	    m.view = __webpack_require__(14);
	    m.boneView = __webpack_require__(16);
	    return this.m = m;
	  },
	
	  draw: function draw() {
	    var _this2 = this;
	
	    this.removeViews();
	
	    this.addView("stage", new _Stage2.default({ model: this.seqs, g: this.g }));
	    this.$el.addClass("biojs_msa_div");
	
	    // bootstraps the menu bar by default -> destroys modularity
	    /*if (this.g.config.get("bootstrapMenu")) {
	      var menuDiv = document.createElement('div');
	      var wrapperDiv = document.createElement('div');
	      if (!this.el.parentNode) {
	        wrapperDiv.appendChild(menuDiv);
	        wrapperDiv.appendChild(this.el);
	      } else {
	        this.el.parentNode.replaceChild(wrapperDiv, this.el);
	        wrapperDiv.appendChild(menuDiv);
	        wrapperDiv.appendChild(this.el);
	      }
	       var bootstrapOpts = {el: menuDiv,
	        msa: this,
	      };
	      if(this.menuConfig){
	        bootstrapOpts.menu = this.menuConfig;
	      }
	      var defMenu = new msa.menu.defaultmenu(bootstrapOpts);
	      defMenu.render();
	    }*/
	
	    return $(window).on("resize", function (e) {
	      var f = function f() {
	        return this.g.zoomer.autoResize();
	      };
	      return setTimeout(f.bind(_this2), 5);
	    });
	  },
	
	  dragOver: function dragOver(e) {
	    // prevent the normal browser actions
	    e.preventDefault();
	    e.target.className = 'hover';
	    return false;
	  },
	
	  dropFile: function dropFile(e) {
	    e.preventDefault();
	    var files = e.target.files || e.dataTransfer.files;
	    this.u.file.importFiles(files);
	    return false;
	  },
	
	  startEventBus: function startEventBus() {
	    var _this3 = this;
	
	    var busObjs = ["config", "columns", "colorscheme", "selcol", "vis", "visorder", "zoomer"];
	    return function () {
	      var result = [];
	      for (var i = 0, key; i < busObjs.length; i++) {
	        key = busObjs[i];
	        result.push(_this3._proxyToG(key));
	      }
	      return result;
	    }();
	  },
	
	
	  _proxyToG: function _proxyToG(key) {
	    return this.listenTo(this.g[key], "all", function (name, prev, now, opts) {
	      // suppress duplicate events
	      if (name === "change") {
	        return;
	      }
	      // backbone uses the second argument for the next value -> swap
	      if (typeof opts !== "undefined" && opts !== null) {
	        return this.g.trigger(key + ":" + name, now, prev, opts);
	      } else {
	        return this.g.trigger(key + ":" + name, now, prev);
	      }
	    });
	  },
	
	  render: function render() {
	    if (this.seqs === undefined || this.seqs.length === 0) {
	      console.log("warning. empty seqs.");
	    }
	    this.renderSubviews();
	    this.g.vis.set("loaded", true);
	    return this;
	  }
	});
	exports.default = MSA;

/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _Sequence = __webpack_require__(19);
	
	var _Sequence2 = _interopRequireDefault(_Sequence);
	
	var _FeatureCol = __webpack_require__(20);
	
	var _FeatureCol2 = _interopRequireDefault(_FeatureCol);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var Collection = __webpack_require__(6).Collection;
	
	var SeqCollection = Collection.extend({
	  model: _Sequence2.default,
	
	  constructor: function constructor(seqs, g) {
	    var _this = this;
	
	    Collection.apply(this, arguments);
	    this.g = g;
	
	    this.on("add reset remove", function () {
	      // invalidate cache
	      _this.lengthCache = null;
	      return _this._bindSeqsWithFeatures();
	    }, this);
	
	    // use the first seq as reference as default
	    this.on("reset", function () {
	      return _this._autoSetRefSeq();
	    });
	    this._autoSetRefSeq();
	
	    this.lengthCache = null;
	
	    this.features = {};
	    return this;
	  },
	
	  // gives the max length of all sequences
	  // (cached)
	  getMaxLength: function getMaxLength() {
	    if (this.models.length === 0) {
	      return 0;
	    }
	    if (this.lengthCache === null) {
	      this.lengthCache = this.max(function (seq) {
	        return seq.get("seq").length;
	      }).get("seq").length;
	    }
	    return this.lengthCache;
	  },
	
	  // gets the previous model
	  // @param endless [boolean] for the first element
	  // true: returns the last element, false: returns undefined
	  prev: function prev(model, endless) {
	    var index = this.indexOf(model) - 1;
	    if (index < 0 && endless) {
	      index = this.length - 1;
	    }
	    return this.at(index);
	  },
	
	  // gets the next model
	  // @param endless [boolean] for the last element
	  // true: returns the first element, false: returns undefined
	  next: function next(model, endless) {
	    var index = this.indexOf(model) + 1;
	    if (index === this.length && endless) {
	      index = 0;
	    }
	    return this.at(index);
	  },
	
	  // @returns n [int] number of hidden columns until n
	  calcHiddenSeqs: function calcHiddenSeqs(n) {
	    var nNew = n;
	    for (var i = 0; 0 < nNew ? i <= nNew : i >= nNew; 0 < nNew ? i++ : i--) {
	      if (this.at(i).get("hidden")) {
	        nNew++;
	      }
	    }
	    return nNew - n;
	  },
	
	  // you can add features independent to the current seqs as they may be added
	  // later (lagging connection)
	  // sequence - feature binding is based on id
	  addFeatures: function addFeatures(features) {
	    var _this2 = this;
	
	    if (features.config != null) {
	      var obj = features;
	      features = features.seqs;
	      if (obj.config.colors != null) {
	        (function () {
	          var colors = obj.config.colors;
	          _.each(features, function (seq) {
	            return _.each(seq, function (val) {
	              if (colors[val.feature] != null) {
	                return val.fillColor = colors[val.feature];
	              }
	            });
	          });
	        })();
	      }
	    }
	    // we might already have features
	    if (_.isEmpty(this.features)) {
	      // replace (no existent features)
	      this.features = features;
	    } else {
	      // merge
	      _.each(features, function (val, key) {
	        if (!_this2.features.hasOwnProperty(key)) {
	          return _this2.features[key] = val;
	        } else {
	          return _this2.features[key] = _.union(_this2.features[key], val);
	        }
	      });
	    }
	    // rehash
	    return this._bindSeqsWithFeatures();
	  },
	
	  // adds features to a sequence
	  // does it silenty without triggering an event
	  _bindSeqWithFeatures: function _bindSeqWithFeatures(seq) {
	    // TODO: probably we don't always want to bind to name
	    var features = this.features[seq.attributes.name];
	    if (features) {
	      // do silently to avoid triggering to many events
	      seq.attributes.features = new _FeatureCol2.default(features);
	      seq.attributes.features.assignRows();
	      seq.attributes.height = seq.attributes.features.getCurrentHeight() + 1;
	    }
	  },
	
	  // rehash the sequence feature binding
	  _bindSeqsWithFeatures: function _bindSeqsWithFeatures() {
	    var _this3 = this;
	
	    return this.each(function (seq) {
	      return _this3._bindSeqWithFeatures(seq);
	    });
	  },
	
	  // removes all features from the cache (not from the seqs)
	  removeAllFeatures: function removeAllFeatures() {
	    return delete this.features;
	  },
	
	  _autoSetRefSeq: function _autoSetRefSeq() {
	    if (this.length > 0) {
	      return this.at(0).set("ref", true);
	    }
	  },
	
	  // sets a sequence (e.g. BLAST start or consensus seq) as reference
	  setRef: function setRef(seq) {
	    var obj = this.get(seq);
	    this.each(function (s) {
	      if (seq.cid) {
	        if (obj.cid === s.cid) {
	          return s.set("ref", true);
	        } else {
	          return s.set("ref", false);
	        }
	      }
	    });
	
	    this.g.config.set("hasRef", true);
	    return this.trigger("change:reference", seq);
	  }
	});
	exports.default = SeqCollection;

/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _FeatureCol = __webpack_require__(20);
	
	var _FeatureCol2 = _interopRequireDefault(_FeatureCol);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var Model = __webpack_require__(6).Model;
	
	
	var Sequence = Model.extend({
	
	  defaults: {
	    name: "",
	    id: "",
	    seq: "",
	    height: 1,
	    ref: false },
	
	  initialize: function initialize() {
	    // residues without color
	    this.set("grey", []);
	    if (!(this.get("features") != null)) {
	      return this.set("features", new _FeatureCol2.default());
	    }
	  }
	});
	exports.default = Sequence;

/***/ },
/* 20 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _lodash = __webpack_require__(3);
	
	var _Feature = __webpack_require__(21);
	
	var _Feature2 = _interopRequireDefault(_Feature);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var Collection = __webpack_require__(6).Collection;
	
	
	var FeatureCol = Collection.extend({
	  model: _Feature2.default,
	
	  constructor: function constructor() {
	    this.startOnCache = [];
	    // invalidate cache
	    this.on("all", function () {
	      return this.startOnCache = [];
	    }, this);
	    return Collection.apply(this, arguments);
	  },
	
	  // returns all features starting on index
	  startOn: function startOn(index) {
	    if (!(this.startOnCache[index] != null)) {
	      this.startOnCache[index] = this.where({ xStart: index });
	    }
	    return this.startOnCache[index];
	  },
	
	  contains: function contains(index) {
	    return this.reduce(function (el, memo) {
	      return memo || el.contains(index);
	    }, false);
	  },
	
	  getFeatureOnRow: function getFeatureOnRow(row, x) {
	    return this.filter(function (el) {
	      return el.get("row") === row && el.get("xStart") <= x && x <= el.get("xEnd");
	    });
	  },
	
	  // tries to auto-fit the rows
	  // not a very efficient algorithm
	  assignRows: function assignRows() {
	
	    var len = this.max(function (el) {
	      return el.get("xEnd");
	    }).attributes.xEnd;
	    var rows = function () {
	      var result = [];
	      for (var x = 0; 0 < len ? x <= len : x >= len; 0 < len ? x++ : x--) {
	        result.push(0);
	      }
	      return result;
	    }();
	
	    this.each(function (el) {
	      var max = 0;
	      var start = el.get("xStart");
	      var end = el.get("xEnd");
	      for (var x = start; start < end ? x <= end : x >= end; start < end ? x++ : x--) {
	        if (rows[x] > max) {
	          max = rows[x];
	        }
	        rows[x]++;
	      }
	      return el.set("row", max);
	    });
	
	    return (0, _lodash.max)(rows);
	  },
	
	  getCurrentHeight: function getCurrentHeight() {
	    return this.max(function (el) {
	      return el.get("row");
	    }).attributes.row + 1;
	  },
	
	  // gives the minimal needed number of rows
	  // not a very efficient algorithm
	  // (there is one in O(n) )
	  getMinRows: function getMinRows() {
	
	    var len = this.max(function (el) {
	      return el.get("xEnd");
	    }).attributes.xEnd;
	    var rows = function () {
	      var result = [];
	      for (var x = 0; 0 < len ? x <= len : x >= len; 0 < len ? x++ : x--) {
	        result.push(0);
	      }
	      return result;
	    }();
	
	    this.each(function (el) {
	      return function () {
	        var result = [];
	        var start = el.get("xStart");
	        var end = el.get("xEnd");
	        for (var x = start; start < end ? x <= end : x >= end; start < end ? x++ : x++) {
	          result.push(rows[x]++);
	        }
	        return result;
	      }();
	    });
	
	    return (0, _lodash.max)(rows);
	  }
	});
	exports.default = FeatureCol;

/***/ },
/* 21 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	var Model = __webpack_require__(6).Model;
	var Feature = Model.extend({
	
	  defaults: {
	    xStart: -1,
	    xEnd: -1,
	    height: -1,
	    text: "",
	    fillColor: "red",
	    strokeColor: "black",
	    validate: true,
	    row: 0
	  },
	
	  initialize: function initialize(obj) {
	    if (obj.start != null) {
	      // gff counts from 1 where MSA starts at 0
	      // This fix that misalignment
	      this.set("xStart", obj.start - 1);
	    }
	    if (obj.end != null) {
	      this.set("xEnd", obj.end - 1);
	    }
	    // name has a predefined meaning
	    if (obj.attributes != null) {
	      if (obj.attributes.Name != null) {
	        this.set("text", obj.attributes.Name);
	      }
	      if (obj.attributes.Color != null) {
	        this.set("fillColor", obj.attributes.Color);
	      }
	    }
	
	    if (this.attributes.xEnd < this.attributes.xStart) {
	      console.warn("invalid feature range for", this.attributes);
	    }
	
	    if (!_.isNumber(this.attributes.xStart) || !_.isNumber(this.attributes.xEnd)) {
	      console.warn("please provide numeric feature ranges", obj);
	      // trying auto-casting
	      this.set("xStart", parseInt(this.attributes.xStart));
	      return this.set("xEnd", parseInt(this.attributes.xEnd));
	    }
	  },
	
	  validate: function validate() {
	    if (isNaN(this.attributes.xStart || isNaN(this.attributes.xEnd))) {
	      return "features need integer start and end.";
	    }
	  },
	
	  contains: function contains(index) {
	    return this.attributes.xStart <= index && index <= this.attributes.xEnd;
	  }
	});
	exports.default = Feature;

/***/ },
/* 22 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var Colorscheme;
	var Colors = __webpack_require__(23);
	
	var Model = __webpack_require__(6).Model;
	
	// this is an example of how one could color the MSA
	// feel free to create your own color scheme in the /css/schemes folder
	module.exports = Colorscheme = Model.extend({
	
	  defaults: {
	    scheme: "taylor", // name of your color scheme
	    colorBackground: true, // otherwise only the text will be colored
	    showLowerCase: true, // used to hide and show lowercase chars in the overviewbox
	    opacity: 0.6 },
	
	  initialize: function initialize(data, seqs, stat) {
	    this.colors = new Colors({ seqs: seqs,
	      conservation: function conservation() {
	        return stat.scale(stat.conservation());
	      } });
	    // the stats module sends an event every time it is refreshed
	    return stat.on("reset", function () {
	      // some dynamic modules might require a redraw
	      if (this.getSelectedScheme().type === "dyn") {
	        var ref;
	        if (ref = "reset", this.getSelectedScheme().indexOf(ref) >= 0) {
	          return this.getSelectedScheme().reset();
	        }
	      }
	    }, this);
	  },
	
	  // You can enter your own color scheme here
	  addStaticScheme: function addStaticScheme(name, dict) {
	    return this.colors.addStaticScheme(name, dict);
	  },
	
	  addDynScheme: function addDynScheme(name, fun) {
	    return this.colors.addDynScheme(name, fun);
	  },
	
	  getScheme: function getScheme(name) {
	    return this.colors.getScheme(name);
	  },
	
	  getSelectedScheme: function getSelectedScheme() {
	    return this.colors.getScheme(this.get("scheme"));
	  }
	});

/***/ },
/* 23 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	var schemes = __webpack_require__(24);
	var StaticSchemeClass = schemes.stat;
	var DynSchemeClass = schemes.dyn;
	
	var Buried = __webpack_require__(25);
	var Cinema = __webpack_require__(26);
	var Clustal = __webpack_require__(27);
	var Clustal2 = __webpack_require__(28);
	var Helix = __webpack_require__(29);
	var Hydro = __webpack_require__(30);
	var Lesk = __webpack_require__(31);
	var Mae = __webpack_require__(32);
	var Nucleotide = __webpack_require__(33);
	var Purine = __webpack_require__(34);
	var Strand = __webpack_require__(35);
	var Taylor = __webpack_require__(36);
	var Turn = __webpack_require__(37);
	var Zappo = __webpack_require__(38);
	
	var staticSchemes = {
	  buried: Buried,
	  buried_index: Buried,
	  cinema: Cinema,
	  clustal2: Clustal2,
	  clustal: Clustal,
	  helix: Helix,
	  helix_propensity: Helix,
	  hydro: Hydro,
	  lesk: Lesk,
	  mae: Mae,
	  nucleotide: Nucleotide,
	  purine: Purine,
	  purine_pyrimidine: Purine,
	  strand: Strand,
	  strand_propensity: Strand,
	  taylor: Taylor,
	  turn: Turn,
	  turn_propensity: Turn,
	  zappo: Zappo
	};
	
	var pid = __webpack_require__(39);
	
	var dynSchemes = {
	  pid: pid
	};
	
	var Colors = function Colors(opt) {
	  this.maps = clone(staticSchemes);
	  this.dyn = clone(dynSchemes);
	  this.opt = opt;
	};
	module.exports = Colors;
	
	Colors.getScheme = function (scheme) {
	  return staticSchemes[scheme];
	};
	Colors.prototype.getScheme = function (scheme) {
	  var color = this.maps[scheme];
	  if (color === undefined) {
	    color = {};
	    if (this.dyn[scheme] != undefined) {
	      return new DynSchemeClass(this.dyn[scheme], this.opt);
	    }
	  }
	  return new StaticSchemeClass(color);
	};
	
	Colors.prototype.addStaticScheme = function (name, scheme) {
	  this.maps[name] = scheme;
	};
	
	Colors.prototype.addDynScheme = function (name, scheme) {
	  this.dyn[name] = scheme;
	};
	
	// small helper to clone an object
	function clone(obj) {
	  if (null == obj || "object" != (typeof obj === "undefined" ? "undefined" : _typeof(obj))) return obj;
	  var copy = obj.constructor();
	  for (var attr in obj) {
	    if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
	  }
	  return copy;
	}

/***/ },
/* 24 */
/***/ function(module, exports) {

	"use strict";
	
	var StaticSchemeClass = function StaticSchemeClass(map) {
	  this.defaultColor = "#ffffff";
	  this.type = "static";
	  this.map = map;
	  this.getColor = function (letter) {
	    if (this.map[letter] !== undefined) {
	      return this.map[letter];
	    } else {
	      return this.defaultColor;
	    }
	  };
	};
	
	var DynSchemeClass = function DynSchemeClass(fun, opt) {
	  this.type = "dyn";
	  this.opt = opt;
	  // init
	  if (fun.init !== undefined) {
	    fun.init.call(this);
	    this.getColor = fun.run;
	    this.reset = fun.init;
	  } else {
	    this.getColor = fun;
	  }
	};
	module.exports.stat = StaticSchemeClass;
	module.exports.dyn = DynSchemeClass;

/***/ },
/* 25 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: "#00a35c",
	  R: "#00fc03",
	  N: "#00eb14",
	  D: "#00eb14",
	  C: "#0000ff",
	  Q: "#00f10e",
	  E: "#00f10e",
	  G: "#009d62",
	  H: "#00d52a",
	  I: "#0054ab",
	  L: "#007b84",
	  K: "#00ff00",
	  M: "#009768",
	  F: "#008778",
	  P: "#00e01f",
	  S: "#00d52a",
	  T: "#00db24",
	  W: "#00a857",
	  Y: "#00e619",
	  V: "#005fa0",
	  B: "#00eb14",
	  X: "#00b649",
	  Z: "#00f10e"
	};

/***/ },
/* 26 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: "#BBBBBB",
	  B: "grey",
	  C: "yellow",
	  D: "red",
	  E: "red",
	  F: "magenta",
	  G: "brown",
	  H: "#00FFFF",
	  I: "#BBBBBB",
	  J: "#fff",
	  K: "#00FFFF",
	  L: "#BBBBBB",
	  M: "#BBBBBB",
	  N: "green",
	  O: "#fff",
	  P: "brown",
	  Q: "green",
	  R: "#00FFFF",
	  S: "green",
	  T: "green",
	  U: "#fff",
	  V: "#BBBBBB",
	  W: "magenta",
	  X: "grey",
	  Y: "magenta",
	  Z: "grey",
	  Gap: "grey"
	};

/***/ },
/* 27 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: "orange",
	  B: "#fff",
	  C: "green",
	  D: "red",
	  E: "red",
	  F: "blue",
	  G: "orange",
	  H: "red",
	  I: "green",
	  J: "#fff",
	  K: "red",
	  L: "green",
	  M: "green",
	  N: "#fff",
	  O: "#fff",
	  P: "orange",
	  Q: "#fff",
	  R: "red",
	  S: "orange",
	  T: "orange",
	  U: "#fff",
	  V: "green",
	  W: "blue",
	  X: "#fff",
	  Y: "blue",
	  Z: "#fff",
	  Gap: "#fff"
	};

/***/ },
/* 28 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: "#80a0f0",
	  R: "#f01505",
	  N: "#00ff00",
	  D: "#c048c0",
	  C: "#f08080",
	  Q: "#00ff00",
	  E: "#c048c0",
	  G: "#f09048",
	  H: "#15a4a4",
	  I: "#80a0f0",
	  L: "#80a0f0",
	  K: "#f01505",
	  M: "#80a0f0",
	  F: "#80a0f0",
	  P: "#ffff00",
	  S: "#00ff00",
	  T: "#00ff00",
	  W: "#80a0f0",
	  Y: "#15a4a4",
	  V: "#80a0f0",
	  B: "#fff",
	  X: "#fff",
	  Z: "#fff"
	};

/***/ },
/* 29 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: "#e718e7",
	  R: "#6f906f",
	  N: "#1be41b",
	  D: "#778877",
	  C: "#23dc23",
	  Q: "#926d92",
	  E: "#ff00ff",
	  G: "#00ff00",
	  H: "#758a75",
	  I: "#8a758a",
	  L: "#ae51ae",
	  K: "#a05fa0",
	  M: "#ef10ef",
	  F: "#986798",
	  P: "#00ff00",
	  S: "#36c936",
	  T: "#47b847",
	  W: "#8a758a",
	  Y: "#21de21",
	  V: "#857a85",
	  B: "#49b649",
	  X: "#758a75",
	  Z: "#c936c9"
	};

/***/ },
/* 30 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: "#ad0052",
	  B: "#0c00f3",
	  C: "#c2003d",
	  D: "#0c00f3",
	  E: "#0c00f3",
	  F: "#cb0034",
	  G: "#6a0095",
	  H: "#1500ea",
	  I: "#ff0000",
	  J: "#fff",
	  K: "#0000ff",
	  L: "#ea0015",
	  M: "#b0004f",
	  N: "#0c00f3",
	  O: "#fff",
	  P: "#4600b9",
	  Q: "#0c00f3",
	  R: "#0000ff",
	  S: "#5e00a1",
	  T: "#61009e",
	  U: "#fff",
	  V: "#f60009",
	  W: "#5b00a4",
	  X: "#680097",
	  Y: "#4f00b0",
	  Z: "#0c00f3"
	};

/***/ },
/* 31 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: " orange",
	  B: " #fff",
	  C: " green",
	  D: " red",
	  E: " red",
	  F: " green",
	  G: " orange",
	  H: " magenta",
	  I: " green",
	  J: " #fff",
	  K: " red",
	  L: " green",
	  M: " green",
	  N: " magenta",
	  O: " #fff",
	  P: " green",
	  Q: " magenta",
	  R: " red",
	  S: " orange",
	  T: " orange",
	  U: " #fff",
	  V: " green",
	  W: " green",
	  X: " #fff",
	  Y: " green",
	  Z: " #fff",
	  Gap: " #fff"
	};

/***/ },
/* 32 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: " #77dd88",
	  B: " #fff",
	  C: " #99ee66",
	  D: " #55bb33",
	  E: " #55bb33",
	  F: " #9999ff",
	  G: " #77dd88",
	  H: " #5555ff",
	  I: " #66bbff",
	  J: " #fff",
	  K: " #ffcc77",
	  L: " #66bbff",
	  M: " #66bbff",
	  N: " #55bb33",
	  O: " #fff",
	  P: " #eeaaaa",
	  Q: " #55bb33",
	  R: " #ffcc77",
	  S: " #ff4455",
	  T: " #ff4455",
	  U: " #fff",
	  V: " #66bbff",
	  W: " #9999ff",
	  X: " #fff",
	  Y: " #9999ff",
	  Z: " #fff",
	  Gap: " #fff"
	};

/***/ },
/* 33 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: " #64F73F",
	  C: " #FFB340",
	  G: " #EB413C",
	  T: " #3C88EE",
	  U: " #3C88EE"
	};

/***/ },
/* 34 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: " #FF83FA",
	  C: " #40E0D0",
	  G: " #FF83FA",
	  R: " #FF83FA",
	  T: " #40E0D0",
	  U: " #40E0D0",
	  Y: " #40E0D0"
	};

/***/ },
/* 35 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: "#5858a7",
	  R: "#6b6b94",
	  N: "#64649b",
	  D: "#2121de",
	  C: "#9d9d62",
	  Q: "#8c8c73",
	  E: "#0000ff",
	  G: "#4949b6",
	  H: "#60609f",
	  I: "#ecec13",
	  L: "#b2b24d",
	  K: "#4747b8",
	  M: "#82827d",
	  F: "#c2c23d",
	  P: "#2323dc",
	  S: "#4949b6",
	  T: "#9d9d62",
	  W: "#c0c03f",
	  Y: "#d3d32c",
	  V: "#ffff00",
	  B: "#4343bc",
	  X: "#797986",
	  Z: "#4747b8"
	};

/***/ },
/* 36 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: "#ccff00",
	  R: "#0000ff",
	  N: "#cc00ff",
	  D: "#ff0000",
	  C: "#ffff00",
	  Q: "#ff00cc",
	  E: "#ff0066",
	  G: "#ff9900",
	  H: "#0066ff",
	  I: "#66ff00",
	  L: "#33ff00",
	  K: "#6600ff",
	  M: "#00ff00",
	  F: "#00ff66",
	  P: "#ffcc00",
	  S: "#ff3300",
	  T: "#ff6600",
	  W: "#00ccff",
	  Y: "#00ffcc",
	  V: "#99ff00",
	  B: "#fff",
	  X: "#fff",
	  Z: "#fff"
	};

/***/ },
/* 37 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: "#2cd3d3",
	  R: "#708f8f",
	  N: "#ff0000",
	  D: "#e81717",
	  C: "#a85757",
	  Q: "#3fc0c0",
	  E: "#778888",
	  G: "#ff0000",
	  H: "#708f8f",
	  I: "#00ffff",
	  L: "#1ce3e3",
	  K: "#7e8181",
	  M: "#1ee1e1",
	  F: "#1ee1e1",
	  P: "#f60909",
	  S: "#e11e1e",
	  T: "#738c8c",
	  W: "#738c8c",
	  Y: "#9d6262",
	  V: "#07f8f8",
	  B: "#f30c0c",
	  X: "#7c8383",
	  Z: "#5ba4a4"
	};

/***/ },
/* 38 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  A: "#ffafaf",
	  R: "#6464ff",
	  N: "#00ff00",
	  D: "#ff0000",
	  C: "#ffff00",
	  Q: "#00ff00",
	  E: "#ff0000",
	  G: "#ff00ff",
	  H: "#6464ff",
	  I: "#ffafaf",
	  L: "#ffafaf",
	  K: "#6464ff",
	  M: "#ffafaf",
	  F: "#ffc800",
	  P: "#ff00ff",
	  S: "#00ff00",
	  T: "#00ff00",
	  W: "#ffc800",
	  Y: "#ffc800",
	  V: "#ffafaf",
	  B: "#fff",
	  X: "#fff",
	  Z: "#fff"
	};

/***/ },
/* 39 */
/***/ function(module, exports) {

	"use strict";
	
	var pid;
	module.exports = pid = {};
	
	// calculating the conservation is expensive 
	// we only want to do it once
	pid.init = function () {
	  this.cons = this.opt.conservation();
	};
	
	pid.run = function (letter, opts) {
	  var cons = this.cons[opts.pos];
	  if (cons > 0.8) {
	    return "#6464ff";
	  } else if (cons > 0.6) {
	    return "#9da5ff";
	  } else if (cons > 0.4) {
	    return "#cccccc";
	  } else {
	    return "#ffffff";
	  }
	};

/***/ },
/* 40 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var Columns;
	var Model = __webpack_require__(6).Model;
	
	// model for column properties (like their hidden state)
	module.exports = Columns = Model.extend({
	
	  initialize: function initialize(o, stat) {
	    // hidden columns
	    if (!(this.get("hidden") != null)) {
	      this.set("hidden", []);
	    }
	    return this.stats = stat;
	  },
	
	  // assumes hidden columns are sorted
	  // @returns n [int] number of hidden columns until n
	  calcHiddenColumns: function calcHiddenColumns(n) {
	    var hidden = this.get("hidden");
	    var newX = n;
	    for (var j = 0, i; j < hidden.length; j++) {
	      i = hidden[j];
	      if (i <= newX) {
	        newX++;
	      }
	    }
	    return newX - n;
	  }
	});

/***/ },
/* 41 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var Config;
	var Model = __webpack_require__(6).Model;
	
	// simple user config
	module.exports = Config = Model.extend({
	
	  defaults: { registerMouseHover: false,
	    registerMouseClicks: true,
	    importProxy: "https://cors-anywhere.herokuapp.com/",
	    importProxyStripHttp: true,
	    eventBus: true,
	    alphabetSize: 20,
	    dropImport: false,
	    debug: false,
	    hasRef: false, // hasReference
	    bootstrapMenu: false,
	    manualRendering: false // not recommended to turn on
	  }
	});

/***/ },
/* 42 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var Package;
	var Loader = __webpack_require__(43);
	var Model = __webpack_require__(6).Model;
	
	module.exports = Package = Model.extend({
	
	  initialize: function initialize(g) {
	    return this.g = g;
	  },
	
	  development: { "msa-tnt": "/node_modules/msa-tnt/build/bundle.js",
	    "biojs-io-newick": "/node_modules/biojs-io-newick/build/biojs-io-newick.min.js"
	  },
	
	  // loads a package into the MSA component (if it is not available yet)
	  loadPackage: function loadPackage(pkg, cb) {
	    try {
	      var p = __webpack_require__(45)(pkg);
	      return cb(p);
	    } catch (error) {
	      return Loader.default.loadScript(this._pkgURL(pkg), cb);
	    }
	  },
	
	  // loads multiple packages and calls the cb if all packages are loaded
	  loadPackages: function loadPackages(pkgs, cb) {
	    var _this = this;
	
	    var cbs = Loader.default.joinCb(function () {
	      return cb();
	    }, pkgs.length);
	    return pkgs.forEach(function (pkg) {
	      return _this.loadPackage(pkg, cbs);
	    });
	  },
	
	  // internal method to get the URL for a package
	  _pkgURL: function _pkgURL(pkg) {
	    var url = this.development[pkg];
	    return url;
	  }
	});

/***/ },
/* 43 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	var k = __webpack_require__(44);
	
	var Loader =
	
	// asynchronously require a script
	{ loadScript: function loadScript(url, cb) {
	    var s = k.mk("script");
	    s.type = "text/javascript";
	    s.src = url;
	    s.async = true;
	    s.onload = s.onreadystatechange = function () {
	      if (!r && (!this.readyState || this.readyState === "complete")) {
	        var r = true;
	        return cb();
	      }
	    };
	    var t = document.getElementsByTagName("script")[0];
	    return t.parentNode.appendChild(s);
	  },
	
	  // joins multiple callbacks into one callback
	  // a bit like Promise.all - but for callbacks
	  joinCb: function joinCb(retCb, finalLength, finalScope) {
	    finalLength = finalLength || 1;
	    var cbsFinished = 0;
	
	    var callbackWrapper = function callbackWrapper(cb, scope) {
	      if (!(typeof cb !== "undefined" && cb !== null)) {
	        // directly called (without cb)
	        return counter();
	      } else {
	        return function () {
	          var ref;
	          if (ref = "apply", cb.indexOf(ref) >= 0) {
	            cb.apply(scope, arguments);
	          }
	          return counter();
	        };
	      }
	    };
	
	    var counter = function counter() {
	      cbsFinished++;
	      if (cbsFinished === finalLength) {
	        return retCb.call(finalScope);
	      }
	    };
	
	    return callbackWrapper;
	  }
	};
	exports.default = Loader;

/***/ },
/* 44 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(module) {"use strict";
	
	var koalajs = {};
	
	// pass an alternative default value
	koalajs.d = koalajs.defaultValue = function defaultValue(obj, defValue) {
	  if (obj === undefined) {
	    if (typeof obj === "function") {
	      return defValue();
	    }
	    return defValue;
	  }
	  return obj;
	};
	
	// alias for getElementById
	koalajs.id = function mk(el) {
	  return document.getElementById(el);
	};
	
	// alias for createElement
	koalajs.mk = function mk(el) {
	  return document.createElement(el);
	};
	
	if (module !== undefined && module.exports !== undefined) {
	  module.exports = koalajs;
	}
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(4)(module)))

/***/ },
/* 45 */
/***/ function(module, exports, __webpack_require__) {

	var map = {
		"./StageScale": 46,
		"./StageScale.js": 46,
		"./colorscheme": 22,
		"./colorscheme.js": 22,
		"./columns": 40,
		"./columns.js": 40,
		"./config": 41,
		"./config.js": 41,
		"./package": 42,
		"./package.js": 42,
		"./selection/Selection": 2,
		"./selection/Selection.js": 2,
		"./selection/SelectionCol": 13,
		"./selection/SelectionCol.js": 13,
		"./selection/index": 48,
		"./selection/index.js": 48,
		"./user": 49,
		"./user.js": 49,
		"./visOrdering": 50,
		"./visOrdering.js": 50,
		"./visibility": 51,
		"./visibility.js": 51,
		"./zoomer": 52,
		"./zoomer.js": 52
	};
	function webpackContext(req) {
		return __webpack_require__(webpackContextResolve(req));
	};
	function webpackContextResolve(req) {
		return map[req] || (function() { throw new Error("Cannot find module '" + req + "'.") }());
	};
	webpackContext.keys = function webpackContextKeys() {
		return Object.keys(map);
	};
	webpackContext.resolve = webpackContextResolve;
	module.exports = webpackContext;
	webpackContext.id = 45;


/***/ },
/* 46 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var StageScale;
	var Model = __webpack_require__(6).Model;
	var LinearScale = __webpack_require__(47);
	
	// pixel properties for some components
	module.exports = StageScale = Model.extend({
	
	  constructor: function constructor(attributes, options) {
	    this.g = options.g;
	    Model.apply(this, arguments);
	    return this;
	  },
	
	  defaults: {
	    // general
	    currentSize: 5,
	    step: 1,
	    originalSize: false,
	    scaleCategories: [{ columnWidth: 1, markerStepSize: 20, stepSize: 0 }, { columnWidth: 3, markerStepSize: 20, stepSize: 0 }, { columnWidth: 5, markerStepSize: 10, stepSize: 0 }, { columnWidth: 9, markerStepSize: 5, stepSize: 1 }, { columnWidth: 15, markerStepSize: 2, stepSize: 1 }, { columnWidth: 20, markerStepSize: 1, stepSize: 1 }, { columnWidth: 30, markerStepSize: 1, stepSize: 1 }, { columnWidth: 45, markerStepSize: 1, stepSize: 1 }]
	  },
	
	  initialize: function initialize(args) {
	    var categories = this.get('scaleCategories');
	    var initialColumnWidth = this.g.zoomer.get('columnWidth') || this._getScaleInfo().columnWidth;
	
	    /* if the global columnWidth setting doesn't match any of our categories
	     * then create a category that does match and add it to a sensible place
	     * in the list
	     */
	    var category = _.find(categories, { columnWidth: initialColumnWidth });
	    if (!category) {
	      var catindex = this._insertScaleCategory(initialColumnWidth);
	      category = categories[catindex];
	      // custom columnWidth should overwrite the default currentSize
	      this.set('currentSize', catindex + 1);
	    }
	
	    var currentSize = this.get('currentSize');
	    this.set('originalSize', currentSize);
	    this.setSize(currentSize);
	
	    return this;
	  },
	
	  // insert new category based on columnWidth
	  // return the index of newly inserted category
	  _insertScaleCategory: function _insertScaleCategory(columnWidth) {
	    var categories = this.get('scaleCategories');
	    var lastcatindex = _.findLastIndex(categories, function (c) {
	      return c.columnWidth < columnWidth;
	    });
	    var lastcat = categories[lastcatindex];
	    var insertindex = lastcatindex + 1;
	    var category = { columnWidth: columnWidth, markerStepSize: lastcat.markerStepSize, stepSize: lastcat.markerStepSize };
	    categories.splice(insertindex, 0, category);
	    this.set('scaleCategories', categories);
	    return insertindex;
	  },
	
	  getSizeRange: function getSizeRange() {
	    return [1, this.get('scaleCategories').length];
	  },
	
	
	  bigger: function bigger() {
	    return this.setSize(this.get('currentSize') + this.get('step'));
	  },
	
	  smaller: function smaller() {
	    return this.setSize(this.get('currentSize') - this.get('step'));
	  },
	
	  reset: function reset() {
	    return this.setSize(this.get('originalSize'));
	  },
	
	  setSize: function setSize(size) {
	    var range = this.getSizeRange();
	    size = parseInt(size);
	    size = size < range[0] ? range[0] : size > range[1] ? range[1] : size;
	
	    this.set('currentSize', size);
	    var info = this._getScaleInfo();
	    this.g.zoomer.set({
	      columnWidth: info.columnWidth,
	      //rowHeight: columnWidth,
	      stepSize: info.stepSize,
	      markerStepSize: info.markerStepSize
	    });
	    return this;
	  },
	
	  getSize: function getSize() {
	    return this.get('currentSize');
	  },
	
	  _getScaleInfo: function _getScaleInfo() {
	    var size = this.getSize();
	    var categories = this.get('scaleCategories');
	    if (size > 0 && size <= categories.length) {
	      return categories[size - 1];
	    } else {
	      console.error("out of bounds");
	    }
	  }
	});

/***/ },
/* 47 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	(function (root) {
	  'use strict';
	
	  function LinearScale(domain, range) {
	    if (!(this instanceof LinearScale)) {
	      return new LinearScale(domain, range);
	    }
	    this.domain = [];
	    this.range = [];
	
	    if (Array.isArray(domain)) {
	      this.domain = domain;
	    }
	    if (Array.isArray(range)) {
	      this.range = range;
	    }
	
	    var scale = function (value) {
	      if (typeof value !== 'number') {
	        return null;
	      }
	
	      var minValue = this.domain[0];
	      var maxValue = this.domain[1];
	
	      var minScale = this.range[0];
	      var maxScale = this.range[1];
	
	      if (minScale !== 'number' && typeof maxScale !== 'number') {
	        minScale = minValue;
	        maxScale = maxValue;
	      }
	
	      var ratio = (maxScale - minScale) / (maxValue - minValue);
	      return minScale + ratio * (value - minValue);
	    }.bind(this);
	
	    scale.domain = function (value) {
	      if (Array.isArray(value)) {
	        this.domain = value;
	      }
	      return scale;
	    }.bind(this);
	
	    scale.range = function (value) {
	      if (Array.isArray(value)) {
	        this.range = value;
	      }
	      return scale;
	    }.bind(this);
	
	    return scale;
	  }
	
	  if (true) {
	    if (typeof module !== 'undefined' && module.exports) {
	      exports = module.exports = LinearScale;
	    }
	    exports.LinearScale = LinearScale;
	  } else if (typeof define === 'function' && define.amd) {
	    define([], function () {
	      return LinearScale;
	    });
	  } else {
	    root.LinearScale = LinearScale;
	  }
	})(undefined);

/***/ },
/* 48 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _SelectionCol = __webpack_require__(13);
	
	Object.defineProperty(exports, "SelectionManager", {
	  enumerable: true,
	  get: function get() {
	    return _SelectionCol.SelectionManager;
	  }
	});

/***/ },
/* 49 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var Config;
	var Model = __webpack_require__(6).Model;
	
	// simple user config
	module.exports = Config = Model.extend({
	
	  defaults: { searchText: "" }
	
	});

/***/ },
/* 50 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var Visibility;
	var Model = __webpack_require__(6).Model;
	
	// visible areas
	module.exports = Visibility = Model.extend({
	
	  defaults:
	
	  // for the Stage
	  { searchBox: -10,
	    overviewBox: 30,
	    headerBox: -1,
	    alignmentBody: 0,
	    scaleSlider: 50
	  }
	});

/***/ },
/* 51 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var Visibility;
	var Model = __webpack_require__(6).Model;
	
	// visible areas
	module.exports = Visibility = Model.extend({
	
	  defaults: { sequences: true,
	    markers: true,
	    metacell: false,
	    conserv: false,
	    overviewbox: false,
	    seqlogo: false,
	    gapHeader: false,
	    leftHeader: true,
	    scaleslider: false,
	
	    // about the labels
	    labels: true,
	    labelName: true,
	    labelId: true,
	    labelPartition: false,
	    labelCheckbox: false,
	
	    // meta stuff
	    metaGaps: true,
	    metaIdentity: true,
	    metaLinks: true
	  },
	
	  constructor: function constructor(attributes, options) {
	    this.calcDefaults(options.model);
	    return Model.apply(this, arguments);
	  },
	
	  initialize: function initialize() {
	
	    this.listenTo(this, "change:metaLinks change:metaIdentity change:metaGaps", function () {
	      return this.trigger("change:metacell");
	    }, this);
	
	    this.listenTo(this, "change:labelName change:labelId change:labelPartition change:labelCheckbox", function () {
	      return this.trigger("change:labels");
	    }, this);
	
	    return this.listenTo(this, "change:markers change:conserv change:seqlogo change:gapHeader", function () {
	      return this.trigger("change:header");
	    }, this);
	  },
	
	  calcDefaults: function calcDefaults(seqs) {
	    if (seqs.length > 0) {
	      var seq = seqs.at(0);
	      var ids = seq.get("ids");
	      if (ids !== undefined && Object.keys(ids).length === 0) {
	        return this.defaults.metaLinks = false;
	      }
	    }
	  }
	});

/***/ },
/* 52 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var Zoomer;
	var Model = __webpack_require__(6).Model;
	// pixel properties for some components
	module.exports = Zoomer = Model.extend({
	
	  constructor: function constructor(attributes, options) {
	    this.calcDefaults(options.model);
	    Model.apply(this, arguments);
	    this.g = options.g;
	
	    // events
	    this.listenTo(this, "change:labelIdLength change:labelNameLength change:labelPartLength change:labelCheckLength", function () {
	      return this.trigger("change:labelWidth", this.getLabelWidth());
	    }, this);
	    this.listenTo(this, "change:metaLinksWidth change:metaIdentWidth change:metaGapWidth", function () {
	      return this.trigger("change:metaWidth", this.getMetaWidth());
	    }, this);
	
	    return this;
	  },
	
	  defaults: {
	
	    // general
	    alignmentWidth: "auto",
	    alignmentHeight: 225,
	    columnWidth: 15,
	    rowHeight: 15,
	    autoResize: true, // only for the width
	
	    // labels
	    labelIdLength: 20,
	    labelNameLength: 100,
	    labelPartLength: 15,
	    labelCheckLength: 15,
	    labelFontsize: 13,
	    labelLineHeight: "13px",
	
	    // marker
	    markerFontsize: "10px",
	    stepSize: 1,
	    markerStepSize: 2,
	    markerHeight: 20,
	
	    // canvas
	    residueFont: "13", // in px
	    canvasEventScale: 1,
	    minLetterDrawSize: 11,
	
	    // overview box
	    boxRectHeight: 2,
	    boxRectWidth: 2,
	    overviewboxPaddingTop: 10,
	
	    // meta cell
	    metaGapWidth: 35,
	    metaIdentWidth: 40,
	    // metaLinksWidth: 25
	
	    // internal props
	    _alignmentScrollLeft: 0,
	    _alignmentScrollTop: 0
	  },
	
	  // sets some defaults, depending on the model
	  calcDefaults: function calcDefaults(model) {
	    var maxLen = model.getMaxLength();
	    if (maxLen < 200 && model.length < 30) {
	      this.defaults.boxRectWidth = this.defaults.boxRectHeight = 5;
	    }
	    return this;
	  },
	
	  // @param n [int] maxLength of all seqs
	  getAlignmentWidth: function getAlignmentWidth(n) {
	    if (this.get("autoResize") && n !== undefined) {
	      return this.get("columnWidth") * n;
	    }
	    if (this.get("alignmentWidth") === undefined || this.get("alignmentWidth") === "auto" || this.get("alignmentWidth") === 0) {
	      return this._adjustWidth();
	    } else {
	      return this.get("alignmentWidth");
	    }
	  },
	
	  // @param n [int] number of residues to scroll to the right
	  setLeftOffset: function setLeftOffset(n) {
	    var val = n;
	    val = Math.max(0, val);
	    val -= this.g.columns.calcHiddenColumns(val);
	    return this.set("_alignmentScrollLeft", val * this.get('columnWidth'));
	  },
	
	  // @param n [int] row that should be on top
	  setTopOffset: function setTopOffset(n) {
	    var val = Math.max(0, n - 1);
	    var height = 0;
	    for (var i = 0; 0 < val ? i <= val : i >= val; 0 < val ? i++ : i--) {
	      var seq = this.model.at(i);
	      height += seq.attributes.height || 1;
	    }
	    return this.set("_alignmentScrollTop", height * this.get("rowHeight"));
	  },
	
	  // length of all elements left to the main sequence body: labels, metacell, ..
	  getLeftBlockWidth: function getLeftBlockWidth() {
	    var paddingLeft = 0;
	    if (this.g.vis.get("labels")) {
	      paddingLeft += this.getLabelWidth();
	    }
	    if (this.g.vis.get("metacell")) {
	      paddingLeft += this.getMetaWidth();
	    }
	    //paddingLeft += 15 # scroll bar
	    return paddingLeft;
	  },
	
	  getMetaWidth: function getMetaWidth() {
	    var val = 0;
	    if (this.g.vis.get("metaGaps")) {
	      val += this.get("metaGapWidth");
	    }
	    if (this.g.vis.get("metaIdentity")) {
	      val += this.get("metaIdentWidth");
	    }
	    if (this.g.vis.get("metaLinks")) {
	      val += this.get("metaLinksWidth");
	    }
	    return val;
	  },
	
	  getLabelWidth: function getLabelWidth() {
	    var val = 0;
	    if (this.g.vis.get("labelName")) {
	      val += this.get("labelNameLength");
	    }
	    if (this.g.vis.get("labelId")) {
	      val += this.get("labelIdLength");
	    }
	    if (this.g.vis.get("labelPartition")) {
	      val += this.get("labelPartLength");
	    }
	    if (this.g.vis.get("labelCheckbox")) {
	      val += this.get("labelCheckLength");
	    }
	    return val;
	  },
	
	  _adjustWidth: function _adjustWidth() {
	    if (!(this.el !== undefined && this.model !== undefined)) {
	      return;
	    }
	    if (this.el.parentNode != null && this.el.parentNode.offsetWidth !== 0) {
	      var parentWidth = this.el.parentNode.offsetWidth;
	    } else {
	      parentWidth = document.body.clientWidth - 35;
	    }
	
	    // TODO: dirty hack
	    var maxWidth = parentWidth - this.getLeftBlockWidth();
	    var calcWidth = this.getAlignmentWidth(this.model.getMaxLength() - this.g.columns.get('hidden').length);
	    var val = Math.min(maxWidth, calcWidth);
	    // round to a valid AA box
	    val = Math.floor(val / this.get("columnWidth")) * this.get("columnWidth");
	
	    //@set "alignmentWidth", val
	    return this.attributes.alignmentWidth = val;
	  },
	
	  autoResize: function autoResize() {
	    if (this.get("autoResize")) {
	      return this._adjustWidth(this.el, this.model);
	    }
	  },
	
	  // max is the maximal allowed height
	  autoHeight: function autoHeight(max) {
	    // TODO!
	    // make seqlogo height configurable
	    var val = this.getMaxAlignmentHeight();
	    if (max !== undefined && max > 0) {
	      val = Math.min(val, max);
	    }
	
	    return this.set("alignmentHeight", val);
	  },
	
	  setEl: function setEl(el, model) {
	    this.el = el;
	    return this.model = model;
	  },
	
	  // updates both scroll properties (if needed)
	  _checkScrolling: function _checkScrolling(scrollObj, opts) {
	    var xScroll = scrollObj[0];
	    var yScroll = scrollObj[1];
	
	    this.set("_alignmentScrollLeft", xScroll, opts);
	    return this.set("_alignmentScrollTop", yScroll, opts);
	  },
	
	  getMaxAlignmentHeight: function getMaxAlignmentHeight() {
	    var height = 0;
	    this.model.each(function (seq) {
	      return height += seq.attributes.height || 1;
	    });
	
	    return height * this.get("rowHeight");
	  },
	
	  getMaxAlignmentWidth: function getMaxAlignmentWidth() {
	    return this.model.getMaxLength() * this.get("columnWidth");
	  }
	});

/***/ },
/* 53 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _lodash = __webpack_require__(3);
	
	var _AlignmentBody = __webpack_require__(54);
	
	var _AlignmentBody2 = _interopRequireDefault(_AlignmentBody);
	
	var _HeaderBlock = __webpack_require__(87);
	
	var _HeaderBlock2 = _interopRequireDefault(_HeaderBlock);
	
	var _OverviewBox = __webpack_require__(110);
	
	var _OverviewBox2 = _interopRequireDefault(_OverviewBox);
	
	var _Search = __webpack_require__(111);
	
	var _Search2 = _interopRequireDefault(_Search);
	
	var _ScaleSlider = __webpack_require__(112);
	
	var _ScaleSlider2 = _interopRequireDefault(_ScaleSlider);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var boneView = __webpack_require__(16);
	
	
	// a neat collection view
	var View = boneView.extend({
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	
	    this.draw();
	    //@listenTo @model,"reset", ->
	    // we need to wait until stats gives us the ok
	    this.listenTo(this.g.stats, "reset", function () {
	      return this.rerender();
	    });
	
	    // debounce a bulk operation
	    this.listenTo(this.model, "change:hidden", (0, _lodash.debounce)(this.rerender, 10));
	
	    this.listenTo(this.model, "sort", this.rerender);
	    this.listenTo(this.model, "add", function () {
	      return console.log("seq add");
	    });
	
	    this.listenTo(this.g.vis, "change:sequences", this.rerender);
	    this.listenTo(this.g.vis, "change:overviewbox", this.rerender);
	    this.listenTo(this.g.visorder, "change", this.rerender);
	    this.listenTo(this.g.zoomer, "change:columnWidth", this.rerender);
	    this.listenTo(this.g.vis, "change:scaleslider", this.rerender);
	
	    return this;
	  },
	
	  draw: function draw() {
	    this.removeViews();
	
	    if (this.g.vis.get("overviewbox")) {
	      var overviewbox = new _OverviewBox2.default({ model: this.model, g: this.g });
	      overviewbox.ordering = this.g.visorder.get('overviewBox');
	      this.addView("overviewBox", overviewbox);
	    }
	
	    if (true) {
	      var headerblock = new _HeaderBlock2.default({ model: this.model, g: this.g });
	      headerblock.ordering = this.g.visorder.get('headerBox');
	      this.addView("headerBox", headerblock);
	    }
	
	    if (true) {
	      var searchblock = new _Search2.default({ model: this.model, g: this.g });
	      searchblock.ordering = this.g.visorder.get('searchBox');
	      this.addView("searchbox", searchblock);
	    }
	
	    var body = new _AlignmentBody2.default({ model: this.model, g: this.g });
	    body.ordering = this.g.visorder.get('alignmentBody');
	    this.addView("body", body);
	
	    if (this.g.vis.get("scaleslider")) {
	      var scaleslider = new _ScaleSlider2.default({ model: this.g.scale, g: this.g });
	      scaleslider.ordering = this.g.visorder.get('scaleSlider');
	      this.addView("scaleSlider", scaleslider);
	    }
	
	    return this;
	  },
	
	  render: function render(e) {
	    this.renderSubviews();
	    this.el.className = "biojs_msa_stage";
	    return this;
	  },
	
	  rerender: function rerender() {
	    if (!this.g.config.get("manualRendering")) {
	      this.draw();
	      return this.render();
	    }
	  }
	});
	exports.default = View;

/***/ },
/* 54 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _CanvasSeqBlock = __webpack_require__(55);
	
	var _CanvasSeqBlock2 = _interopRequireDefault(_CanvasSeqBlock);
	
	var _LabelBlock = __webpack_require__(62);
	
	var _LabelBlock2 = _interopRequireDefault(_LabelBlock);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var boneView = __webpack_require__(16);
	
	
	var View = boneView.extend({
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	
	    if (true) {
	      var labelblock = new _LabelBlock2.default({ model: this.model, g: this.g });
	      labelblock.ordering = -1;
	      this.addView("labelblock", labelblock);
	    }
	
	    if (this.g.vis.get("sequences")) {
	      var seqblock = new _CanvasSeqBlock2.default({ model: this.model, g: this.g });
	      seqblock.ordering = 0;
	      this.addView("seqblock", seqblock);
	    }
	
	    this.listenTo(this.g.zoomer, "change:alignmentHeight", this.adjustHeight);
	    this.listenTo(this.g.zoomer, "change:alignmentWidth", this.adjustWidth);
	    this.listenTo(this.g.columns, "change:hidden", this.adjustHeight);
	    return this;
	  },
	
	  render: function render() {
	    this.renderSubviews();
	    this.el.className = "biojs_msa_albody";
	    this.el.style.whiteSpace = "nowrap";
	    this.adjustHeight();
	    this.adjustWidth();
	    return this;
	  },
	
	  adjustHeight: function adjustHeight() {
	    if (this.g.zoomer.get("alignmentHeight") === "auto") {
	      // TODO: fix the magic 5
	      return this.el.style.height = this.g.zoomer.get("rowHeight") * this.model.length + 5;
	    } else {
	      return this.el.style.height = this.g.zoomer.get("alignmentHeight");
	    }
	  },
	
	  adjustWidth: function adjustWidth() {
	    // TODO: 15 is the width of the scrollbar
	    return this.el.style.width = this.getWidth();
	  },
	
	  getWidth: function getWidth() {
	    var width = 0;
	    width += this.g.zoomer.getLeftBlockWidth();
	    if (this.g.vis.get("sequences")) {
	      width += this.g.zoomer.get("alignmentWidth");
	    }
	    return width;
	  }
	});
	exports.default = View;

/***/ },
/* 55 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	var _lodash = __webpack_require__(3);
	
	var _CanvasCharCache = __webpack_require__(56);
	
	var _CanvasCharCache2 = _interopRequireDefault(_CanvasCharCache);
	
	var _CanvasSelection = __webpack_require__(58);
	
	var _CanvasSelection2 = _interopRequireDefault(_CanvasSelection);
	
	var _CanvasSeqDrawer = __webpack_require__(59);
	
	var _CanvasSeqDrawer2 = _interopRequireDefault(_CanvasSeqDrawer);
	
	var _CanvasCoordsCache = __webpack_require__(60);
	
	var _CanvasCoordsCache2 = _interopRequireDefault(_CanvasCoordsCache);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var boneView = __webpack_require__(16);
	var mouse = __webpack_require__(61);
	
	var jbone = __webpack_require__(15);
	
	var View = boneView.extend({
	
	  tagName: "canvas",
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	
	    this.listenTo(this.g.zoomer, "change:_alignmentScrollLeft change:_alignmentScrollTop", function (model, value, options) {
	      if (!((typeof options !== "undefined" && options !== null ? options.origin : undefined) != null) || options.origin !== "canvasseq") {
	        return this.render();
	      }
	    });
	
	    this.listenTo(this.g.columns, "change:hidden", this.render);
	    this.listenTo(this.g.zoomer, "change:alignmentWidth change:alignmentHeight", this.render);
	    this.listenTo(this.g.colorscheme, "change", this.render);
	    this.listenTo(this.g.selcol, "reset add", this.render);
	    this.listenTo(this.model, "reset add", this.render);
	
	    // el props
	    this.el.style.display = "inline-block";
	    this.el.style.overflowX = "hidden";
	    this.el.style.overflowY = "hidden";
	    this.el.className = "biojs_msa_seqblock";
	
	    this.ctx = this.el.getContext('2d');
	    this.cache = new _CanvasCharCache2.default(this.g);
	    this.coordsCache = new _CanvasCoordsCache2.default(this.g, this.model);
	
	    // clear the char cache
	    this.listenTo(this.g.zoomer, "change:residueFont", function () {
	      this.cache = new _CanvasCharCache2.default(this.g);
	      return this.render();
	    });
	
	    // init selection
	    this.sel = new _CanvasSelection2.default(this.g, this.ctx);
	
	    this._setColor();
	
	    // throttle the expensive draw function
	    this.throttleTime = 0;
	    this.throttleCounts = 0;
	    if (document.documentElement.style.webkitAppearance != null) {
	      // webkit browser - no throttling needed
	      this.throttledDraw = function () {
	        var start = +new Date();
	        this.draw();
	        this.throttleTime += +new Date() - start;
	        this.throttleCounts++;
	        if (this.throttleCounts > 15) {
	          var tTime = Math.ceil(this.throttleTime / this.throttleCounts);
	          console.log("avgDrawTime/WebKit", tTime);
	          // remove perf analyser
	          return this.throttledDraw = this.draw;
	        }
	      };
	    } else {
	      // slow browsers like Gecko
	      this.throttledDraw = (0, _lodash.throttle)(this.throttledDraw, 30);
	    }
	
	    return this.manageEvents();
	  },
	
	  // measures the time of a redraw and thus set the throttle limit
	  throttledDraw: function throttledDraw() {
	    // +new is the fastest: http://jsperf.com/new-date-vs-date-now-vs-performance-now/6
	    var start = +new Date();
	    this.draw();
	    this.throttleTime += +new Date() - start;
	    this.throttleCounts++;
	
	    // remove itself after analysis
	    if (this.throttleCounts > 15) {
	      var tTime = Math.ceil(this.throttleTime / this.throttleCounts);
	      console.log("avgDrawTime", tTime);
	      tTime *= 1.2; // add safety time
	      tTime = Math.max(20, tTime); // limit for ultra fast computers
	      return this.throttledDraw = _.throttle(this.draw, tTime);
	    }
	  },
	
	  manageEvents: function manageEvents() {
	    var events = {};
	    events.mousedown = "_onmousedown";
	    events.touchstart = "_ontouchstart";
	
	    if (this.g.config.get("registerMouseClicks")) {
	      events.dblclick = "_onclick";
	    }
	    if (this.g.config.get("registerMouseHover")) {
	      events.mousein = "_onmousein";
	      events.mouseout = "_onmouseout";
	    }
	
	    events.mousewheel = "_onmousewheel";
	    events.DOMMouseScroll = "_onmousewheel";
	    this.delegateEvents(events);
	
	    // listen for changes
	    this.listenTo(this.g.config, "change:registerMouseHover", this.manageEvents);
	    this.listenTo(this.g.config, "change:registerMouseClick", this.manageEvents);
	    return this.dragStart = [];
	  },
	
	  _setColor: function _setColor() {
	    return this.color = this.g.colorscheme.getSelectedScheme();
	  },
	
	  draw: function draw() {
	    // fastest way to clear the canvas
	    // http://jsperf.com/canvas-clear-speed/25
	    this.el.width = this.el.width;
	
	    // draw all the stuff
	    if (this.seqDrawer != null && this.model.length > 0) {
	      // char based
	      this.seqDrawer.drawLetters();
	      // row based
	      this.seqDrawer.drawRows(this.sel._appendSelection, this.sel);
	      return this.seqDrawer.drawRows(this.drawFeatures, this);
	    }
	  },
	
	  drawFeatures: function drawFeatures(data) {
	    var _this = this;
	
	    var rectWidth = this.g.zoomer.get("columnWidth");
	    var rectHeight = this.g.zoomer.get("rowHeight");
	    if (data.model.attributes.height > 1) {
	      var _ret = function () {
	        var ctx = _this.ctx;
	        data.model.attributes.features.each(function (feature) {
	          ctx.fillStyle = feature.attributes.fillColor || "red";
	          ctx.strokeStyle = feature.attributes.strokeColor || "black";
	          var len = feature.attributes.xEnd - feature.attributes.xStart + 1;
	          var y = (feature.attributes.row + 1) * rectHeight;
	          ctx.beginPath();
	          ctx.rect(feature.attributes.xStart * rectWidth + data.xZero, y + data.yZero, rectWidth * len, rectHeight);
	          ctx.stroke();
	          ctx.fill();
	          return;
	        });
	
	        // draw text
	        ctx.fillStyle = "black";
	        ctx.font = _this.g.zoomer.get("residueFont") + "px mono";
	        ctx.textBaseline = 'middle';
	        ctx.textAlign = "center";
	
	        return {
	          v: data.model.attributes.features.each(function (feature) {
	            var len = feature.attributes.xEnd - feature.attributes.xStart + 1;
	            var y = (feature.attributes.row + 1) * rectHeight;
	            return ctx.fillText(feature.attributes.text, data.xZero + feature.attributes.xStart * rectWidth + len / 2 * rectWidth, data.yZero + rectHeight * 0.5 + y);
	          })
	        };
	      }();
	
	      if ((typeof _ret === "undefined" ? "undefined" : _typeof(_ret)) === "object") return _ret.v;
	    }
	  },
	
	  render: function render() {
	
	    this.el.setAttribute('height', this.g.zoomer.get("alignmentHeight") + "px");
	    this.el.setAttribute('width', this.g.zoomer.getAlignmentWidth() + "px");
	
	    this.g.zoomer._checkScrolling(this._checkScrolling([this.g.zoomer.get('_alignmentScrollLeft'), this.g.zoomer.get('_alignmentScrollTop')]), { header: "canvasseq" });
	
	    this._setColor();
	
	    this.seqDrawer = new _CanvasSeqDrawer2.default(this.g, this.ctx, this.model, { width: this.el.width,
	      height: this.el.height,
	      color: this.color,
	      cache: this.cache
	    });
	
	    this.throttledDraw();
	    return this;
	  },
	
	  _onmousemove: function _onmousemove(e, reversed) {
	    if (this.dragStart.length === 0) {
	      return;
	    }
	
	    var dragEnd = mouse.abs(e);
	    // relative to first click
	    var relEnd = [dragEnd[0] - this.dragStart[0], dragEnd[1] - this.dragStart[1]];
	    // relative to initial scroll status
	
	    // scale events
	    var scaleFactor = this.g.zoomer.get("canvasEventScale");
	    if (reversed) {
	      scaleFactor = 3;
	    }
	    for (var i = 0; i <= 1; i++) {
	      relEnd[i] = relEnd[i] * scaleFactor;
	    }
	
	    // calculate new scrolling vals
	    var relDist = [this.dragStartScroll[0] - relEnd[0], this.dragStartScroll[1] - relEnd[1]];
	
	    // round values
	    for (var _i = 0; _i <= 1; _i++) {
	      relDist[_i] = Math.round(relDist[_i]);
	    }
	
	    // update scrollbar
	    var scrollCorrected = this._checkScrolling(relDist);
	    this.g.zoomer._checkScrolling(scrollCorrected, { origin: "canvasseq" });
	
	    // reset start if use scrolls out of bounds
	    for (var _i2 = 0; _i2 <= 1; _i2++) {
	      if (scrollCorrected[_i2] !== relDist[_i2]) {
	        if (scrollCorrected[_i2] === 0) {
	          // reset of left, top
	          this.dragStart[_i2] = dragEnd[_i2];
	          this.dragStartScroll[_i2] = 0;
	        } else {
	          // recalibrate on right, bottom
	          this.dragStart[_i2] = dragEnd[_i2] - scrollCorrected[_i2];
	        }
	      }
	    }
	
	    this.throttledDraw();
	
	    // abort selection events of the browser (mouse only)
	    if (e.preventDefault != null) {
	      e.preventDefault();
	      return e.stopPropagation();
	    }
	  },
	
	  // converts touches into old mouse event
	  _ontouchmove: function _ontouchmove(e) {
	    this._onmousemove(e.changedTouches[0], true);
	    e.preventDefault();
	    return e.stopPropagation();
	  },
	
	  // start the dragging mode
	  _onmousedown: function _onmousedown(e) {
	    var _this2 = this;
	
	    this.dragStart = mouse.abs(e);
	    this.dragStartScroll = [this.g.zoomer.get('_alignmentScrollLeft'), this.g.zoomer.get('_alignmentScrollTop')];
	    jbone(document.body).on('mousemove.overmove', function (e) {
	      return _this2._onmousemove(e);
	    });
	    jbone(document.body).on('mouseup.overup', function () {
	      return _this2._cleanup();
	    });
	    //jbone(document.body).on 'mouseout.overout', (e) => @_onmousewinout(e)
	    return e.preventDefault();
	  },
	
	  // starts the touch mode
	  _ontouchstart: function _ontouchstart(e) {
	    var _this3 = this;
	
	    this.dragStart = mouse.abs(e.changedTouches[0]);
	    this.dragStartScroll = [this.g.zoomer.get('_alignmentScrollLeft'), this.g.zoomer.get('_alignmentScrollTop')];
	    jbone(document.body).on('touchmove.overtmove', function (e) {
	      return _this3._ontouchmove(e);
	    });
	    return jbone(document.body).on('touchend.overtend touchleave.overtleave touchcancel.overtcanel', function (e) {
	      return _this3._touchCleanup(e);
	    });
	  },
	
	  // checks whether mouse moved out of the window
	  // -> terminate dragging
	  _onmousewinout: function _onmousewinout(e) {
	    if (e.toElement === document.body.parentNode) {
	      return this._cleanup();
	    }
	  },
	
	  // terminates dragging
	  _cleanup: function _cleanup() {
	    this.dragStart = [];
	    // remove all listeners
	    jbone(document.body).off('.overmove');
	    jbone(document.body).off('.overup');
	    return jbone(document.body).off('.overout');
	  },
	
	  // terminates touching
	  _touchCleanup: function _touchCleanup(e) {
	    if (e.changedTouches.length > 0) {
	      // maybe we can send a final event
	      this._onmousemove(e.changedTouches[0], true);
	    }
	
	    this.dragStart = [];
	    // remove all listeners
	    jbone(document.body).off('.overtmove');
	    jbone(document.body).off('.overtend');
	    jbone(document.body).off('.overtleave');
	    return jbone(document.body).off('.overtcancel');
	  },
	
	  // might be incompatible with some browsers
	  _onmousewheel: function _onmousewheel(e) {
	    var delta = mouse.wheelDelta(e);
	    this.g.zoomer.set('_alignmentScrollLeft', this.g.zoomer.get('_alignmentScrollLeft') + delta[0]);
	    this.g.zoomer.set('_alignmentScrollTop', this.g.zoomer.get('_alignmentScrollTop') + delta[1]);
	    return e.preventDefault();
	  },
	
	  _onclick: function _onclick(e) {
	    var res = this._getClickPos(e);
	    if (typeof res !== "undefined" && res !== null) {
	      if (res.feature != null) {
	        this.g.trigger("feature:click", res);
	      } else {
	        this.g.trigger("residue:click", res);
	      }
	    }
	    return this.throttledDraw();
	  },
	
	  _onmousein: function _onmousein(e) {
	    var res = this._getClickPos(e);
	    if (typeof res !== "undefined" && res !== null) {
	      if (res.feature != null) {
	        this.g.trigger("feature:mousein", res);
	      } else {
	        this.g.trigger("residue:mousein", res);
	      }
	    }
	    return this.throttledDraw();
	  },
	
	  _onmouseout: function _onmouseout(e) {
	    var res = this._getClickPos(e);
	    if (typeof res !== "undefined" && res !== null) {
	      if (res.feature != null) {
	        this.g.trigger("feature:mouseout", res);
	      } else {
	        this.g.trigger("residue:mouseout", res);
	      }
	    }
	
	    return this.throttledDraw();
	  },
	
	  _getClickPos: function _getClickPos(e) {
	    var coords = mouse.rel(e);
	
	    coords[0] += this.g.zoomer.get("_alignmentScrollLeft");
	    var x = Math.floor(coords[0] / this.g.zoomer.get("columnWidth"));
	
	    var _seqDrawer$_getSeqFor = this.seqDrawer._getSeqForYClick(coords[1]),
	        _seqDrawer$_getSeqFor2 = _slicedToArray(_seqDrawer$_getSeqFor, 2),
	        y = _seqDrawer$_getSeqFor2[0],
	        rowNumber = _seqDrawer$_getSeqFor2[1];
	
	    // add hidden columns
	
	
	    x += this.g.columns.calcHiddenColumns(x);
	    // add hidden seqs
	    y += this.model.calcHiddenSeqs(y);
	
	    x = Math.max(0, x);
	    y = Math.max(0, y);
	
	    var seqId = this.model.at(y).get("id");
	
	    if (rowNumber > 0) {
	      // click on a feature
	      var features = this.model.at(y).get("features").getFeatureOnRow(rowNumber - 1, x);
	      if (!(features.length === 0)) {
	        var feature = features[0];
	        console.log(features[0].attributes);
	        return { seqId: seqId, feature: feature, rowPos: x, evt: e };
	      }
	    } else {
	      // click on a seq
	      return { seqId: seqId, rowPos: x, evt: e };
	    }
	  },
	
	  // checks whether the scrolling coordinates are valid
	  // @returns: [xScroll,yScroll] valid coordinates
	  _checkScrolling: function _checkScrolling(scrollObj) {
	
	    // 0: maxLeft, 1: maxTop
	    var max = [this.coordsCache.maxScrollWidth, this.coordsCache.maxScrollHeight];
	
	    for (var i = 0; i <= 1; i++) {
	      if (scrollObj[i] > max[i]) {
	        scrollObj[i] = max[i];
	      }
	
	      if (scrollObj[i] < 0) {
	        scrollObj[i] = 0;
	      }
	    }
	
	    return scrollObj;
	  }
	});
	exports.default = View;

/***/ },
/* 56 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
	
	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
	
	var Events = __webpack_require__(57);
	
	var CanvasCharCache = function () {
	  function CanvasCharCache(g) {
	    _classCallCheck(this, CanvasCharCache);
	
	    this.g = g;
	    this.cache = {};
	    this.cacheHeight = 0;
	    this.cacheWidth = 0;
	  }
	
	  // returns a cached canvas
	
	
	  _createClass(CanvasCharCache, [{
	    key: "getFontTile",
	    value: function getFontTile(letter, width, height) {
	      // validate cache
	      if (width !== this.cacheWidth || height !== this.cacheHeight) {
	        this.cacheHeight = height;
	        this.cacheWidth = width;
	        this.cache = {};
	      }
	
	      if (this.cache[letter] === undefined) {
	        this.createTile(letter, width, height);
	      }
	
	      return this.cache[letter];
	    }
	
	    // creates a canvas with a single letter
	    // (for the fast font cache)
	
	  }, {
	    key: "createTile",
	    value: function createTile(letter, width, height) {
	
	      var canvas = this.cache[letter] = document.createElement("canvas");
	      canvas.width = width;
	      canvas.height = height;
	      this.ctx = canvas.getContext('2d');
	      this.ctx.font = this.g.zoomer.get("residueFont") + "px mono";
	
	      this.ctx.textBaseline = 'middle';
	      this.ctx.textAlign = "center";
	
	      return this.ctx.fillText(letter, width / 2, height / 2, width);
	    }
	  }]);
	
	  return CanvasCharCache;
	}();
	
	;
	exports.default = CanvasCharCache;

/***/ },
/* 57 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var events = __webpack_require__(8);
	
	events.onAll = function (callback, context) {
	  this.on("all", callback, context);
	  return this;
	};
	
	// Mixin utility
	events.oldMixin = events.mixin;
	events.mixin = function (proto) {
	  events.oldMixin(proto);
	  // add custom onAll
	  var exports = ['onAll'];
	  for (var i = 0; i < exports.length; i++) {
	    var name = exports[i];
	    proto[name] = this[name];
	  }
	  return proto;
	};
	
	module.exports = events;

/***/ },
/* 58 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _lodash = __webpack_require__(3);
	
	var CanvasSelection = function CanvasSelection(g, ctx) {
	  this.g = g;
	  this.ctx = ctx;
	  return this;
	};
	
	_.extend(CanvasSelection.prototype, {
	
	  // TODO: should I be moved to the selection manager?
	  // returns an array with the currently selected residues
	  // e.g. [0,3] = pos 0 and 3 are selected
	  _getSelection: function _getSelection(model) {
	    var maxLen = model.get("seq").length;
	    var selection = [];
	    var sels = this.g.selcol.getSelForRow(model.get("id"));
	    var rows = (0, _lodash.find)(sels, function (el) {
	      return el.get("type") === "row";
	    });
	    if (typeof rows !== "undefined" && rows !== null) {
	      // full match
	      var end = maxLen - 1;
	      for (var n = 0; n <= end; n++) {
	        selection.push(n);
	      }
	    } else if (sels.length > 0) {
	      for (var i = 0, sel; i < sels.length; i++) {
	        sel = sels[i];
	        var start = sel.get("xStart");
	        var _end = sel.get("xEnd");
	        for (var _n = start; _n <= _end; _n++) {
	          selection.push(_n);
	        }
	      }
	    }
	
	    return selection;
	  },
	
	  // loops over all selection and calls the render method
	  _appendSelection: function _appendSelection(data) {
	    var _this = this;
	
	    var seq = data.model.get("seq");
	    var selection = this._getSelection(data.model);
	    // get the status of the upper and lower row
	    var getNextPrev = this._getPrevNextSelection(data.model);
	    var mPrevSel = getNextPrev[0];
	    var mNextSel = getNextPrev[1];
	
	    var boxWidth = this.g.zoomer.get("columnWidth");
	    var boxHeight = this.g.zoomer.get("rowHeight");
	
	    // avoid unnecessary loops
	    if (selection.length === 0) {
	      return;
	    }
	
	    var hiddenOffset = 0;
	    return function () {
	      var result = [];
	      var end = seq.length - 1;
	
	      var _loop = function _loop(n) {
	        result.push(function () {
	          if (data.hidden.indexOf(n) >= 0) {
	            return hiddenOffset++;
	          } else {
	            var k = n - hiddenOffset;
	            // only if its a new selection
	            if (selection.indexOf(n) >= 0 && (k === 0 || selection.indexOf(n - 1) < 0)) {
	              return _this._renderSelection({ n: n,
	                k: k,
	                selection: selection,
	                mPrevSel: mPrevSel,
	                mNextSel: mNextSel,
	                xZero: data.xZero,
	                yZero: data.yZero,
	                model: data.model });
	            }
	          }
	        }());
	      };
	
	      for (var n = 0; n <= end; n++) {
	        _loop(n);
	      }
	      return result;
	    }();
	  },
	
	  // draws a single user selection
	  _renderSelection: function _renderSelection(data) {
	
	    var xZero = data.xZero;
	    var yZero = data.yZero;
	    var n = data.n;
	    var k = data.k;
	    var selection = data.selection;
	    // and checks the prev and next row for selection  -> no borders in a selection
	    var mPrevSel = data.mPrevSel;
	    var mNextSel = data.mNextSel;
	
	    // get the length of this selection
	    var selectionLength = 0;
	    var end = data.model.get("seq").length - 1;
	    for (var i = n; i <= end; i++) {
	      if (selection.indexOf(i) >= 0) {
	        selectionLength++;
	      } else {
	        break;
	      }
	    }
	
	    // TODO: ugly!
	    var boxWidth = this.g.zoomer.get("columnWidth");
	    var boxHeight = this.g.zoomer.get("rowHeight");
	    var totalWidth = boxWidth * selectionLength + 1;
	
	    var hidden = this.g.columns.get('hidden');
	
	    this.ctx.beginPath();
	    var beforeWidth = this.ctx.lineWidth;
	    this.ctx.lineWidth = 3;
	    var beforeStyle = this.ctx.strokeStyle;
	    this.ctx.strokeStyle = "#FF0000";
	
	    xZero += k * boxWidth;
	
	    // split up the selection into single cells
	    var xPart = 0;
	    var end1 = selectionLength - 1;
	    for (var _i = 0; _i <= end1; _i++) {
	      var xPos = n + _i;
	      if (hidden.indexOf(xPos) >= 0) {
	        continue;
	      }
	      // upper line
	      if (!(typeof mPrevSel !== "undefined" && mPrevSel !== null && mPrevSel.indexOf(xPos) >= 0)) {
	        this.ctx.moveTo(xZero + xPart, yZero);
	        this.ctx.lineTo(xPart + boxWidth + xZero, yZero);
	      }
	      // lower line
	      if (!(typeof mNextSel !== "undefined" && mNextSel !== null && mNextSel.indexOf(xPos) >= 0)) {
	        this.ctx.moveTo(xPart + xZero, boxHeight + yZero);
	        this.ctx.lineTo(xPart + boxWidth + xZero, boxHeight + yZero);
	      }
	
	      xPart += boxWidth;
	    }
	
	    // left
	    this.ctx.moveTo(xZero, yZero);
	    this.ctx.lineTo(xZero, boxHeight + yZero);
	
	    // right
	    this.ctx.moveTo(xZero + totalWidth, yZero);
	    this.ctx.lineTo(xZero + totalWidth, boxHeight + yZero);
	
	    this.ctx.stroke();
	    this.ctx.strokeStyle = beforeStyle;
	    return this.ctx.lineWidth = beforeWidth;
	  },
	
	  // looks at the selection of the prev and next el
	  // TODO: this is very naive, as there might be gaps above or below
	  _getPrevNextSelection: function _getPrevNextSelection(model) {
	
	    var modelPrev = model.collection.prev(model);
	    var modelNext = model.collection.next(model);
	    var mPrevSel = void 0,
	        mNextSel = void 0;
	    if (typeof modelPrev !== "undefined" && modelPrev !== null) {
	      mPrevSel = this._getSelection(modelPrev);
	    }
	    if (typeof modelNext !== "undefined" && modelNext !== null) {
	      mNextSel = this._getSelection(modelNext);
	    }
	    return [mPrevSel, mNextSel];
	  }
	});
	exports.default = CanvasSelection;

/***/ },
/* 59 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();
	
	var _lodash = __webpack_require__(3);
	
	var Drawer = {
	
	  // caching the access is done for performance reasons
	  updateConfig: function updateConfig() {
	    this.rectWidth = this.g.zoomer.get('columnWidth');
	    this.rectHeight = this.g.zoomer.get('rowHeight');
	  },
	
	  drawLetters: function drawLetters() {
	
	    this.updateConfig();
	
	    // rects
	    this.ctx.globalAlpha = this.g.colorscheme.get("opacity");
	    this.drawSeqs(function (data) {
	      return this.drawSeq(data, this._drawRect);
	    });
	    this.ctx.globalAlpha = 1;
	
	    // letters
	    if (this.rectWidth >= this.g.zoomer.get('minLetterDrawSize')) {
	      this.drawSeqs(function (data) {
	        return this.drawSeq(data, this._drawLetter);
	      });
	    }
	
	    return this;
	  },
	
	  drawSeqs: function drawSeqs(callback, target) {
	    var hidden = this.g.columns.get("hidden");
	
	    target = target || this;
	
	    var _getStartSeq = this.getStartSeq(),
	        _getStartSeq2 = _slicedToArray(_getStartSeq, 2),
	        start = _getStartSeq2[0],
	        y = _getStartSeq2[1];
	
	    for (var i = start; i < this.model.length; i++) {
	      var seq = this.model.at(i);
	      if (seq.get('hidden')) {
	        continue;
	      }
	      callback.call(target, { model: seq, yPos: y, y: i, hidden: hidden });
	
	      var seqHeight = (seq.attributes.height || 1) * this.rectHeight;
	      y = y + seqHeight;
	
	      // out of viewport - stop
	      if (y > this.height) {
	        break;
	      }
	    }
	  },
	
	  // calls the callback for every drawable row
	  drawRows: function drawRows(callback, target) {
	    return this.drawSeqs(function (data) {
	      return this.drawRow(data, callback, target);
	    });
	  },
	
	  // draws a single row
	  drawRow: function drawRow(data, callback, target) {
	    var rectWidth = this.g.zoomer.get("columnWidth");
	    var start = Math.max(0, Math.abs(Math.ceil(-this.g.zoomer.get('_alignmentScrollLeft') / rectWidth)));
	    var x = -Math.abs(-this.g.zoomer.get('_alignmentScrollLeft') % rectWidth);
	
	    var xZero = x - start * rectWidth;
	    var yZero = data.yPos;
	    return callback.call(target, { model: data.model, xZero: xZero, yZero: yZero, hidden: data.hidden });
	  },
	
	  // returns first sequence in the viewport
	  // y is the position to start drawing
	  getStartSeq: function getStartSeq() {
	    var start = Math.max(0, Math.floor(this.g.zoomer.get('_alignmentScrollTop') / this.rectHeight)) + 1;
	    var counter = 0;
	    var i = 0;
	    while (counter < start && i < this.model.length) {
	      counter += this.model.at(i).attributes.height || 1;
	      i++;
	    }
	    var y = Math.max(0, this.g.zoomer.get('_alignmentScrollTop') - counter * this.rectHeight + (this.model.at(i - 1).attributes.height || 1) * this.rectHeight);
	    return [i - 1, -y];
	  },
	
	  // returns [the clicked seq for a viewport, row number]
	  _getSeqForYClick: function _getSeqForYClick(click) {
	    var _getStartSeq3 = this.getStartSeq(),
	        _getStartSeq4 = _slicedToArray(_getStartSeq3, 2),
	        start = _getStartSeq4[0],
	        yDiff = _getStartSeq4[1];
	
	    var yRel = yDiff % this.rectHeight;
	    var clickedRows = Math.max(0, Math.floor((click - yRel) / this.rectHeight)) + 1;
	    var counter = 0;
	    var i = start;
	    while (counter < clickedRows && i < this.model.length) {
	      counter += this.model.at(i).attributes.height || 1;
	      i++;
	    }
	    var rowNumber = Math.max(0, Math.floor(click / this.rectHeight) - counter + (this.model.at(i - 1).get("height") || 1));
	    return [i - 1, rowNumber];
	  },
	
	  // TODO: very expensive method
	  drawSeq: function drawSeq(data, callback) {
	    var seq = data.model.get("seq");
	    var y = data.yPos;
	    var rectWidth = this.rectWidth;
	    var rectHeight = this.rectHeight;
	
	    // skip unneeded blocks at the beginning
	    var start = Math.max(0, Math.abs(Math.ceil(-this.g.zoomer.get('_alignmentScrollLeft') / rectWidth)));
	    var x = -Math.abs(-this.g.zoomer.get('_alignmentScrollLeft') % rectWidth);
	
	    var res = { rectWidth: rectWidth, rectHeight: rectHeight, yPos: y, y: data.y };
	    var elWidth = this.width;
	
	    for (var j = start; j < seq.length; j++) {
	      var c = seq[j];
	      c = c.toUpperCase();
	
	      // call the custom function
	      res.x = j;
	      res.c = c;
	      res.xPos = x;
	
	      // local call is faster than apply
	      // http://jsperf.com/function-calls-direct-vs-apply-vs-call-vs-bind/6
	      if (data.hidden.indexOf(j) < 0) {
	        callback(this, res);
	      } else {
	        continue;
	      }
	
	      // move to the right
	      x = x + rectWidth;
	
	      // out of viewport - stop
	      if (x > elWidth) {
	        break;
	      }
	    }
	  },
	
	  _drawRect: function _drawRect(that, data) {
	    var color = that.color.getColor(data.c, {
	      pos: data.x,
	      y: data.y
	    });
	    if (typeof color !== "undefined" && color !== null) {
	      that.ctx.fillStyle = color;
	      return that.ctx.fillRect(data.xPos, data.yPos, data.rectWidth, data.rectHeight);
	    }
	  },
	
	  // REALLY expensive call on FF
	  // Performance:
	  // chrome: 2000ms drawLetter - 1000ms drawRect
	  // FF: 1700ms drawLetter - 300ms drawRect
	  _drawLetter: function _drawLetter(that, data) {
	    return that.ctx.drawImage(that.cache.getFontTile(data.c, data.rectWidth, data.rectHeight), data.xPos, data.yPos, data.rectWidth, data.rectHeight);
	  }
	};
	
	var CanvasSeqDrawer = function CanvasSeqDrawer(g, ctx, model, opts) {
	  this.g = g;
	  this.ctx = ctx;
	  this.model = model;
	  this.width = opts.width;
	  this.height = opts.height;
	  this.color = opts.color;
	  this.cache = opts.cache;
	  this.rectHeight = this.g.zoomer.get("rowHeight");
	  this.rectWidth = this.g.zoomer.get("columnWidth"); // note: this can change
	  return this;
	};
	
	(0, _lodash.extend)(CanvasSeqDrawer.prototype, Drawer);
	exports.default = CanvasSeqDrawer;

/***/ },
/* 60 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _lodash = __webpack_require__(3);
	
	var Events = __webpack_require__(57);
	
	var cache = {
	  setMaxScrollHeight: function setMaxScrollHeight() {
	    return this.maxScrollHeight = this.g.zoomer.getMaxAlignmentHeight() - this.g.zoomer.get('alignmentHeight');
	  },
	  setMaxScrollWidth: function setMaxScrollWidth() {
	    return this.maxScrollWidth = this.g.zoomer.getMaxAlignmentWidth() - this.g.zoomer.getAlignmentWidth();
	  }
	};
	
	var CacheConstructor = function CacheConstructor(g, model) {
	  this.g = g;
	  this.model = model;
	  this.maxScrollWidth = 0;
	  this.maxScrollHeight = 0;
	  this.setMaxScrollHeight();
	  this.setMaxScrollWidth();
	
	  this.listenTo(this.g.zoomer, "change:rowHeight", this.setMaxScrollHeight);
	  this.listenTo(this.g.zoomer, "change:columnWidth", this.setMaxScrollWidth);
	  this.listenTo(this.g.zoomer, "change:alignmentWidth", this.setMaxScrollWidth);
	  this.listenTo(this.g.zoomer, "change:alignmentHeight", this.setMaxScrollHeight);
	  this.listenTo(this.model, "add change reset", function () {
	    this.setMaxScrollHeight();
	    return this.setMaxScrollWidth();
	  }, this);
	  return this;
	};
	
	(0, _lodash.extend)(CacheConstructor.prototype, cache);
	Events.mixin(CacheConstructor.prototype);
	exports.default = CacheConstructor;

/***/ },
/* 61 */
/***/ function(module, exports) {

	"use strict";
	
	var Mouse;
	
	module.exports = Mouse = {
	  rel: function rel(e) {
	    var mouseX, mouseY, rect, target;
	    mouseX = e.offsetX;
	    mouseY = e.offsetY;
	    if (mouseX == undefined) {
	      rect = target.getBoundingClientRect();
	      target = e.target || e.srcElement;
	      if (mouseX == undefined) {
	        mouseX = e.clientX - rect.left;
	        mouseY = e.clientY - rect.top;
	      }
	      if (mouseX == undefined) {
	        mouseX = e.pageX - target.offsetLeft;
	        mouseY = e.pageY - target.offsetTop;
	      }
	      if (mouseX == undefined) {
	        console.log(e, "no mouse event defined. your browser sucks");
	        return;
	      }
	    }
	    return [mouseX, mouseY];
	  },
	  abs: function abs(e) {
	    var mouseX, mouseY;
	    mouseX = e.pageX;
	    mouseY = e.pageY;
	    if (mouseX == undefined) {
	      mouseX = e.layerX;
	      mouseY = e.layerY;
	    }
	    if (mouseX == undefined) {
	      mouseX = e.clientX;
	      mouseY = e.clientY;
	    }
	    if (mouseX == undefined) {
	      mouseX = e.x;
	      mouseY = e.y;
	    }
	    return [mouseX, mouseY];
	  },
	  wheelDelta: function wheelDelta(e) {
	    var delta;
	    delta = [e.deltaX, e.deltaY];
	    if (delta[0] == undefined) {
	      // in case there is a more detailed scroll sensor - use it
	      if (e.mozMovementX) {
	        delta = [0, e.mozMovementX];
	      }
	    }
	    // safety first
	    if (isNaN(delta[0])) {
	      delta[0] = 0;
	    }
	    if (isNaN(delta[1])) {
	      delta[1] = 0;
	    }
	    return delta;
	  }
	};

/***/ },
/* 62 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _LabelRowView = __webpack_require__(63);
	
	var _LabelRowView2 = _interopRequireDefault(_LabelRowView);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var boneView = __webpack_require__(16);
	
	
	var View = boneView.extend({
	
	  initialize: function initialize(data) {
	    var _this = this;
	
	    this.g = data.g;
	    this.draw();
	    this.listenTo(this.g.zoomer, "change:_alignmentScrollTop", this._adjustScrollingTop);
	    this.g.vis.once('change:loaded', this._adjustScrollingTop, this);
	
	    this.listenTo(this.g.zoomer, "change:alignmentHeight", this._setHeight);
	    this.listenTo(this.model, "change:reference", this.draw);
	
	    return this.listenTo(this.model, "reset add remove", function () {
	      _this.draw();
	      return _this.render();
	    });
	  },
	
	  draw: function draw() {
	    this.removeViews();
	    console.log("redraw columns", this.model.length);
	    for (var i = 0; i < this.model.length; i++) {
	      if (this.model.at(i).get('hidden')) {
	        continue;
	      }
	      var view = new _LabelRowView2.default({ model: this.model.at(i), g: this.g });
	      view.ordering = i;
	      this.addView("row_" + i, view);
	    }
	  },
	
	  events: { "scroll": "_sendScrollEvent" },
	
	  // broadcast the scrolling event (by the scrollbar)
	  _sendScrollEvent: function _sendScrollEvent() {
	    return this.g.zoomer.set("_alignmentScrollTop", this.el.scrollTop, { origin: "label" });
	  },
	
	  // sets the scrolling property (from another event e.g. dragging)
	  _adjustScrollingTop: function _adjustScrollingTop() {
	    return this.el.scrollTop = this.g.zoomer.get("_alignmentScrollTop");
	  },
	
	
	  render: function render() {
	    this.renderSubviews();
	    this.el.className = "biojs_msa_labelblock";
	    this.el.style.display = "inline-block";
	    this.el.style.verticalAlign = "top";
	    this.el.style.overflowY = "auto";
	    this.el.style.overflowX = "hidden";
	    this.el.style.fontSize = this.g.zoomer.get('labelFontsize') + "px";
	    this.el.style.lineHeight = "" + this.g.zoomer.get("labelLineHeight");
	    this._setHeight();
	    return this;
	  },
	
	  _setHeight: function _setHeight() {
	    return this.el.style.height = this.g.zoomer.get("alignmentHeight") + "px";
	  }
	});
	exports.default = View;

/***/ },
/* 63 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _LabelView = __webpack_require__(64);
	
	var _LabelView2 = _interopRequireDefault(_LabelView);
	
	var _MetaView = __webpack_require__(66);
	
	var _MetaView2 = _interopRequireDefault(_MetaView);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var boneView = __webpack_require__(16);
	
	
	var View = boneView.extend({
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	    this.draw();
	
	    this.listenTo(this.g.vis, "change:labels", this.drawR);
	    this.listenTo(this.g.vis, "change:metacell", this.drawR);
	    this.listenTo(this.g.zoomer, "change:rowHeight", function () {
	      return this.el.style.height = this.g.zoomer.get("rowHeight") + "px";
	    });
	
	    return this.listenTo(this.g.selcol, "change reset add", this.setSelection);
	  },
	
	  draw: function draw() {
	    this.removeViews();
	    if (this.g.vis.get("labels")) {
	      this.addView("labels", new _LabelView2.default({ model: this.model, g: this.g }));
	    }
	    if (this.g.vis.get("metacell")) {
	      var meta = new _MetaView2.default({ model: this.model, g: this.g });
	      return this.addView("metacell", meta);
	    }
	  },
	
	  drawR: function drawR() {
	    this.draw();
	    return this.render();
	  },
	
	  render: function render() {
	    this.renderSubviews();
	
	    this.el.setAttribute("class", "biojs_msa_labelrow");
	    this.el.style.height = this.g.zoomer.get("rowHeight") * (this.model.attributes.height || 1) + "px";
	
	    this.setSelection();
	    return this;
	  },
	
	  setSelection: function setSelection() {
	    var sel = this.g.selcol.getSelForRow(this.model.id);
	    if (sel.length > 0) {
	      return this.el.style.fontWeight = "bold";
	    } else {
	      return this.el.style.fontWeight = "normal";
	    }
	  }
	});
	exports.default = View;

/***/ },
/* 64 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	var view = __webpack_require__(14);
	var dom = __webpack_require__(65);
	
	var LabelView = view.extend({
	
	  initialize: function initialize(data) {
	    this.seq = data.seq;
	    this.g = data.g;
	
	    return this.manageEvents();
	  },
	
	  manageEvents: function manageEvents() {
	    var events = {};
	    if (this.g.config.get("registerMouseClicks")) {
	      events.click = "_onclick";
	    }
	
	    events.mousein = "_onmousein";
	    events.mouseout = "_onmouseout";
	    this.delegateEvents(events);
	    this.listenTo(this.g.config, "change:registerMouseHover", this.manageEvents);
	    this.listenTo(this.g.config, "change:registerMouseClick", this.manageEvents);
	    this.listenTo(this.g.vis, "change:labelName change:labelId change:labelPartition change:labelCheckbox", this.render);
	    this.listenTo(this.g.zoomer, "change:labelIdLength change:labelNameLength change:labelPartLength change:labelCheckLength", this.render);
	    return this.listenTo(this.g.zoomer, "change:labelFontSize change:labelLineHeight change:labelWidth change:rowHeight", this.render);
	  },
	
	  render: function render() {
	    dom.removeAllChilds(this.el);
	
	    this.el.style.width = this.g.zoomer.getLabelWidth() + "px";
	    //@el.style.height = "#{@g.zoomer.get "rowHeight"}px"
	    this.el.setAttribute("class", "biojs_msa_labels");
	
	    if (this.g.vis.get("labelCheckbox")) {
	      var checkBox = document.createElement("input");
	      checkBox.setAttribute("type", "checkbox");
	      checkBox.value = this.model.get('id');
	      checkBox.name = "seq";
	      checkBox.style.width = this.g.zoomer.get("labelCheckLength") + "px";
	      this.el.appendChild(checkBox);
	    }
	
	    if (this.g.vis.get("labelId")) {
	      var id = document.createElement("span");
	      var val = this.model.get("id");
	      if (!isNaN(val)) {
	        val++;
	      }
	      id.textContent = val;
	      id.style.width = this.g.zoomer.get("labelIdLength") + "px";
	      id.style.display = "inline-block";
	      this.el.appendChild(id);
	    }
	
	    if (this.g.vis.get("labelPartition")) {
	      var part = document.createElement("span");
	      part.style.width = this.g.zoomer.get("labelPartLength") + "px";
	      part.textContent = this.model.get("partition");
	      part.style.display = "inline-block";
	      this.el.appendChild(id);
	      this.el.appendChild(part);
	    }
	
	    if (this.g.vis.get("labelName")) {
	      var name = document.createElement("span");
	      name.textContent = this.model.get("name");
	      if (this.model.get("ref") && this.g.config.get("hasRef")) {
	        name.style.fontWeight = "bold";
	      }
	      name.style.width = this.g.zoomer.get("labelNameLength") + "px";
	      this.el.appendChild(name);
	    }
	
	    this.el.style.overflow = scroll;
	    this.el.style.fontSize = this.g.zoomer.get('labelFontsize') + "px";
	    return this;
	  },
	
	  _onclick: function _onclick(evt) {
	    var seqId = this.model.get("id");
	    return this.g.trigger("row:click", { seqId: seqId, evt: evt });
	  },
	
	  _onmousein: function _onmousein(evt) {
	    var seqId = this.model.get("id");
	    return this.g.trigger("row:mousein", { seqId: seqId, evt: evt });
	  },
	
	  _onmouseout: function _onmouseout(evt) {
	    var seqId = this.model.get("id");
	    return this.g.trigger("row:mouseout", { seqId: seqId, evt: evt });
	  }
	});
	
	exports.default = LabelView;

/***/ },
/* 65 */
/***/ function(module, exports) {

	"use strict";
	
	var Utils = {};
	
	/*
	Remove an element and provide a function that inserts it into its original position
	https://developers.google.com/speed/articles/javascript-dom
	@param element {Element} The element to be temporarily removed
	@return {Function} A function that inserts the element into its original position
	 */
	
	Utils.removeToInsertLater = function (element) {
	  var nextSibling, parentNode;
	  parentNode = element.parentNode;
	  nextSibling = element.nextSibling;
	  parentNode.removeChild(element);
	  return function () {
	    if (nextSibling) {
	      parentNode.insertBefore(element, nextSibling);
	    } else {
	      parentNode.appendChild(element);
	    }
	  };
	};
	
	/*
	fastest possible way to destroy all sub nodes (aka childs)
	http://jsperf.com/innerhtml-vs-removechild/15
	@param element {Element} The element for which all childs should be removed
	 */
	
	Utils.removeAllChilds = function (element) {
	  var count;
	  count = 0;
	  while (element.firstChild) {
	    count++;
	    element.removeChild(element.firstChild);
	  }
	};
	
	module.exports = Utils;

/***/ },
/* 66 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _bio = __webpack_require__(67);
	
	var _lodash = __webpack_require__(3);
	
	var view = __webpack_require__(14);
	var dom = __webpack_require__(65);
	//import MenuBuilder from "../../menu/menubuilder";
	
	
	var MetaView = view.extend({
	
	  className: "biojs_msa_metaview",
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	    this.listenTo(this.g.vis, "change:metacell", this.render);
	    return this.listenTo(this.g.zoomer, "change:metaWidth", this.render);
	  },
	
	  events: { click: "_onclick",
	    mousein: "_onmousein",
	    mouseout: "_onmouseout"
	  },
	
	  render: function render() {
	    dom.removeAllChilds(this.el);
	
	    this.el.style.display = "inline-block";
	
	    var width = this.g.zoomer.getMetaWidth();
	    this.el.style.width = width - 10;
	    this.el.style.paddingRight = 5;
	    this.el.style.paddingLeft = 5;
	    // TODO: why do we need to decrease the font size?
	    // otherwise we see a scrollbar
	    this.el.style.fontSize = this.g.zoomer.get('labelFontsize') - 2 + "px";
	
	    if (this.g.vis.get("metaGaps")) {
	      // adds gaps
	      var seq = this.model.get('seq');
	      var gaps = (0, _lodash.reduce)(seq, function (memo, c) {
	        return c === '-' ? ++memo : undefined;
	      }, 0);
	      // 2-place percentage , e.g. 42%
	      gaps = (gaps * 100 / seq.length).toFixed(0) + "%";
	
	      // append gap count
	      var gapSpan = document.createElement('span');
	      gapSpan.textContent = gaps;
	      gapSpan.style.display = "inline-block";
	      gapSpan.style.width = 35;
	      this.el.appendChild(gapSpan);
	    }
	
	    if (this.g.vis.get("metaIdentity")) {
	      // identity
	      // TODO: there must be a better way to pass the id
	      var ident = this.g.stats.identity()[this.model.id];
	      var identSpan = document.createElement('span');
	
	      if (this.model.get("ref") && this.g.config.get("hasRef")) {
	        identSpan.textContent = "ref.";
	      } else if (typeof ident !== "undefined" && ident !== null) {
	        identSpan.textContent = ident.toFixed(2);
	      }
	
	      identSpan.style.display = "inline-block";
	      identSpan.style.width = 40;
	      this.el.appendChild(identSpan);
	    }
	    /*
	        if (this.g.vis.get("metaLinks")) {
	          // TODO: this menu builder is just an example how one could customize this
	          // view
	          if (this.model.attributes.ids) {
	            var links = st.buildLinks(this.model.attributes.ids);
	            if (Object.keys(links).length > 0) {
	              var menu = new MenuBuilder({name: "↗"});
	              console.log(Object.keys(links));
	              links.forEach(function(val, key) {
	                return menu.addNode(key,function(e) {
	                  return window.open(val);
	                });
	              });
	    
	              var linkEl = menu.buildDOM();
	              linkEl.style.cursor = "pointer";
	              return this.el.appendChild(linkEl);
	            }
	          }
	        }*/
	  },
	
	  //@el.style.height = "#{@g.zoomer.get "rowHeight"}px"
	
	  _onclick: function _onclick(evt) {
	    return this.g.trigger("meta:click", { seqId: this.model.get("id", { evt: evt }) });
	  },
	
	  _onmousein: function _onmousein(evt) {
	    return this.g.trigger("meta:mousein", { seqId: this.model.get("id", { evt: evt }) });
	  },
	
	  _onmouseout: function _onmouseout(evt) {
	    return this.g.trigger("meta:mouseout", { seqId: this.model.get("id", { evt: evt }) });
	  }
	});
	exports.default = MetaView;

/***/ },
/* 67 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	exports.version = exports.xhr = exports.seqs = exports.parser = exports.newick = exports.matrix = exports.gff = exports.fasta = exports.clustal = undefined;
	
	var _clustal2 = __webpack_require__(68);
	
	var _clustal3 = _interopRequireDefault(_clustal2);
	
	var _fasta2 = __webpack_require__(78);
	
	var _fasta3 = _interopRequireDefault(_fasta2);
	
	var _gff2 = __webpack_require__(80);
	
	var _gff3 = _interopRequireDefault(_gff2);
	
	var _matrix2 = __webpack_require__(83);
	
	var _matrix3 = _interopRequireDefault(_matrix2);
	
	var _newick2 = __webpack_require__(84);
	
	var _newick3 = _interopRequireDefault(_newick2);
	
	var _parser2 = __webpack_require__(69);
	
	var _parser3 = _interopRequireDefault(_parser2);
	
	var _seqs2 = __webpack_require__(77);
	
	var _seqs3 = _interopRequireDefault(_seqs2);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	exports.clustal = _clustal3.default; // TODO: make BLAST slim
	//export blast from "./blast";
	
	exports.fasta = _fasta3.default;
	exports.gff = _gff3.default;
	exports.matrix = _matrix3.default;
	exports.newick = _newick3.default;
	exports.parser = _parser3.default;
	exports.seqs = _seqs3.default;
	
	// convenience export
	
	var xhr = __webpack_require__(70);
	exports.xhr = xhr;
	
	// version will be automatically injected by webpack
	// IO_VERSION is only defined if loaded via webpack
	
	var VERSION = "imported";
	if (typeof IO_VERSION !== "undefined") {
	    VERSION = IO_VERSION;
	}
	
	var version = exports.version = VERSION;

/***/ },
/* 68 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _parser = __webpack_require__(69);
	
	var _parser2 = _interopRequireDefault(_parser);
	
	var _seqs = __webpack_require__(77);
	
	var _seqs2 = _interopRequireDefault(_seqs);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var Clustal = void 0;
	exports.default = Clustal = {
	  parse: function parse(text) {
	    var seqs = [];
	
	    if (Object.prototype.toString.call(text) === '[object Array]') {
	      var lines = text;
	    } else {
	      var lines = text.split("\n");
	    }
	
	    // The first line in the file must start with the words "CLUSTAL"
	    if (lines[0].slice(0, 6) === !"CLUSTAL") {
	      throw new Error("Invalid CLUSTAL Header");
	    }
	
	    var k = 0;
	    // 0: reading sequences, 1: reading new lines
	    var blockstate = 1;
	    // count the sequence for every block
	    var seqCounter = 0;
	
	    while (k < lines.length) {
	      k++;
	      var line = lines[k];
	
	      if (!(line != null) || line.length === 0) {
	        blockstate = 1;
	        continue;
	      }
	
	      // okay we have an empty line
	      if (line.trim().length === 0) {
	        blockstate = 1;
	        continue;
	      } else {
	        // ignore annotations
	        if (_seqs2.default.contains(line, "*")) {
	          continue;
	        }
	        if (blockstate === 1) {
	          // new block recognized - reset
	          seqCounter = 0;
	          blockstate = 0;
	        }
	
	        var regex = /^(?:\s*)(\S+)(?:\s+)(\S+)(?:\s*)(\d*)(?:\s*|$)/g;
	        var match = regex.exec(line);
	        if (match != null) {
	          var label = match[1].trim();
	          var sequence = match[2].trim();
	
	          // check for the first block
	          if (seqCounter >= seqs.length) {
	
	            var obj = _seqs2.default.getMeta(label.trim());
	            label = obj.name;
	
	            var cSeq = new _seqs2.default.model(sequence, label, seqCounter);
	            cSeq.ids = obj.ids || {};
	            cSeq.details = obj.details || {};
	
	            var keys = Object.keys(cSeq.ids);
	            if (keys.length > 0) {
	              cSeq.id = cSeq.ids[keys[0]];
	            }
	            seqs.push(cSeq);
	          } else {
	            seqs[seqCounter].seq += sequence;
	          }
	
	          seqCounter++;
	        } else {
	          console.log("parse error", line);
	        }
	      }
	    }
	
	    //remove ill-parsed consensus symbols
	    seqs = seqs.filter(function (s) {
	      return s.seq.search(/[:.*]/i) === -1 && s.name.search(/[:.*]/i) === -1;
	    });
	
	    return seqs;
	  }
	};
	
	
	_parser2.default.mixin(Clustal);

/***/ },
/* 69 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	var xhr = __webpack_require__(70);
	var GenericReader = {};
	
	exports.default = GenericReader;
	
	// returns a promise if callback is undefined
	
	GenericReader.read = function (url, callback) {
	  var onret = function (_this) {
	    return function (err, response, text) {
	      return GenericReader._onRetrieval(err, text, callback, _this);
	    };
	  }(this);
	
	  if (typeof callback === "undefined") {
	    return new Promise(function (resolve, reject) {
	      callback = function callback(err, res) {
	        if (err) {
	          reject(err);
	        } else {
	          resolve(res);
	        }
	      };
	      xhr(url, onret);
	    });
	  } else {
	    return xhr(url, onret);
	  }
	};
	
	GenericReader._onRetrieval = function (err, text, callback, _this) {
	  var rText = void 0;
	  if (typeof err !== "undefined") {
	    rText = _this.parse(text);
	  }
	  return callback.call(_this, err, rText);
	};
	
	// provide a convenient shortcut to inherit
	GenericReader.extend = function (obj, statics) {
	  return extend(GenericReader, obj, statics);
	};
	// Mixin utility
	GenericReader.mixin = function (proto) {
	  var exports = ['read'];
	  if ((typeof proto === "undefined" ? "undefined" : _typeof(proto)) !== "object") {
	    proto = proto.prototype;
	  }
	  exports.forEach(function (name) {
	    proto[name] = GenericReader[name];
	  }, this);
	  return proto;
	};

/***/ },
/* 70 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var window = __webpack_require__(71);
	var isFunction = __webpack_require__(72);
	var parseHeaders = __webpack_require__(73);
	var xtend = __webpack_require__(76);
	
	module.exports = createXHR;
	createXHR.XMLHttpRequest = window.XMLHttpRequest || noop;
	createXHR.XDomainRequest = "withCredentials" in new createXHR.XMLHttpRequest() ? createXHR.XMLHttpRequest : window.XDomainRequest;
	
	forEachArray(["get", "put", "post", "patch", "head", "delete"], function (method) {
	    createXHR[method === "delete" ? "del" : method] = function (uri, options, callback) {
	        options = initParams(uri, options, callback);
	        options.method = method.toUpperCase();
	        return _createXHR(options);
	    };
	});
	
	function forEachArray(array, iterator) {
	    for (var i = 0; i < array.length; i++) {
	        iterator(array[i]);
	    }
	}
	
	function isEmpty(obj) {
	    for (var i in obj) {
	        if (obj.hasOwnProperty(i)) return false;
	    }
	    return true;
	}
	
	function initParams(uri, options, callback) {
	    var params = uri;
	
	    if (isFunction(options)) {
	        callback = options;
	        if (typeof uri === "string") {
	            params = { uri: uri };
	        }
	    } else {
	        params = xtend(options, { uri: uri });
	    }
	
	    params.callback = callback;
	    return params;
	}
	
	function createXHR(uri, options, callback) {
	    options = initParams(uri, options, callback);
	    return _createXHR(options);
	}
	
	function _createXHR(options) {
	    if (typeof options.callback === "undefined") {
	        throw new Error("callback argument missing");
	    }
	
	    var called = false;
	    var callback = function cbOnce(err, response, body) {
	        if (!called) {
	            called = true;
	            options.callback(err, response, body);
	        }
	    };
	
	    function readystatechange() {
	        if (xhr.readyState === 4) {
	            loadFunc();
	        }
	    }
	
	    function getBody() {
	        // Chrome with requestType=blob throws errors arround when even testing access to responseText
	        var body = undefined;
	
	        if (xhr.response) {
	            body = xhr.response;
	        } else {
	            body = xhr.responseText || getXml(xhr);
	        }
	
	        if (isJson) {
	            try {
	                body = JSON.parse(body);
	            } catch (e) {}
	        }
	
	        return body;
	    }
	
	    function errorFunc(evt) {
	        clearTimeout(timeoutTimer);
	        if (!(evt instanceof Error)) {
	            evt = new Error("" + (evt || "Unknown XMLHttpRequest Error"));
	        }
	        evt.statusCode = 0;
	        return callback(evt, failureResponse);
	    }
	
	    // will load the data & process the response in a special response object
	    function loadFunc() {
	        if (aborted) return;
	        var status;
	        clearTimeout(timeoutTimer);
	        if (options.useXDR && xhr.status === undefined) {
	            //IE8 CORS GET successful response doesn't have a status field, but body is fine
	            status = 200;
	        } else {
	            status = xhr.status === 1223 ? 204 : xhr.status;
	        }
	        var response = failureResponse;
	        var err = null;
	
	        if (status !== 0) {
	            response = {
	                body: getBody(),
	                statusCode: status,
	                method: method,
	                headers: {},
	                url: uri,
	                rawRequest: xhr
	            };
	            if (xhr.getAllResponseHeaders) {
	                //remember xhr can in fact be XDR for CORS in IE
	                response.headers = parseHeaders(xhr.getAllResponseHeaders());
	            }
	        } else {
	            err = new Error("Internal XMLHttpRequest Error");
	        }
	        return callback(err, response, response.body);
	    }
	
	    var xhr = options.xhr || null;
	
	    if (!xhr) {
	        if (options.cors || options.useXDR) {
	            xhr = new createXHR.XDomainRequest();
	        } else {
	            xhr = new createXHR.XMLHttpRequest();
	        }
	    }
	
	    var key;
	    var aborted;
	    var uri = xhr.url = options.uri || options.url;
	    var method = xhr.method = options.method || "GET";
	    var body = options.body || options.data || null;
	    var headers = xhr.headers = options.headers || {};
	    var sync = !!options.sync;
	    var isJson = false;
	    var timeoutTimer;
	    var failureResponse = {
	        body: undefined,
	        headers: {},
	        statusCode: 0,
	        method: method,
	        url: uri,
	        rawRequest: xhr
	    };
	
	    if ("json" in options && options.json !== false) {
	        isJson = true;
	        headers["accept"] || headers["Accept"] || (headers["Accept"] = "application/json"); //Don't override existing accept header declared by user
	        if (method !== "GET" && method !== "HEAD") {
	            headers["content-type"] || headers["Content-Type"] || (headers["Content-Type"] = "application/json"); //Don't override existing accept header declared by user
	            body = JSON.stringify(options.json === true ? body : options.json);
	        }
	    }
	
	    xhr.onreadystatechange = readystatechange;
	    xhr.onload = loadFunc;
	    xhr.onerror = errorFunc;
	    // IE9 must have onprogress be set to a unique function.
	    xhr.onprogress = function () {
	        // IE must die
	    };
	    xhr.onabort = function () {
	        aborted = true;
	    };
	    xhr.ontimeout = errorFunc;
	    xhr.open(method, uri, !sync, options.username, options.password);
	    //has to be after open
	    if (!sync) {
	        xhr.withCredentials = !!options.withCredentials;
	    }
	    // Cannot set timeout with sync request
	    // not setting timeout on the xhr object, because of old webkits etc. not handling that correctly
	    // both npm's request and jquery 1.x use this kind of timeout, so this is being consistent
	    if (!sync && options.timeout > 0) {
	        timeoutTimer = setTimeout(function () {
	            if (aborted) return;
	            aborted = true; //IE9 may still call readystatechange
	            xhr.abort("timeout");
	            var e = new Error("XMLHttpRequest timeout");
	            e.code = "ETIMEDOUT";
	            errorFunc(e);
	        }, options.timeout);
	    }
	
	    if (xhr.setRequestHeader) {
	        for (key in headers) {
	            if (headers.hasOwnProperty(key)) {
	                xhr.setRequestHeader(key, headers[key]);
	            }
	        }
	    } else if (options.headers && !isEmpty(options.headers)) {
	        throw new Error("Headers cannot be set on an XDomainRequest object");
	    }
	
	    if ("responseType" in options) {
	        xhr.responseType = options.responseType;
	    }
	
	    if ("beforeSend" in options && typeof options.beforeSend === "function") {
	        options.beforeSend(xhr);
	    }
	
	    xhr.send(body);
	
	    return xhr;
	}
	
	function getXml(xhr) {
	    if (xhr.responseType === "document") {
	        return xhr.responseXML;
	    }
	    var firefoxBugTakenEffect = xhr.status === 204 && xhr.responseXML && xhr.responseXML.documentElement.nodeName === "parsererror";
	    if (xhr.responseType === "" && !firefoxBugTakenEffect) {
	        return xhr.responseXML;
	    }
	
	    return null;
	}
	
	function noop() {}

/***/ },
/* 71 */
/***/ function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {"use strict";
	
	if (typeof window !== "undefined") {
	    module.exports = window;
	} else if (typeof global !== "undefined") {
	    module.exports = global;
	} else if (typeof self !== "undefined") {
	    module.exports = self;
	} else {
	    module.exports = {};
	}
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ },
/* 72 */
/***/ function(module, exports) {

	'use strict';
	
	module.exports = isFunction;
	
	var toString = Object.prototype.toString;
	
	function isFunction(fn) {
	  var string = toString.call(fn);
	  return string === '[object Function]' || typeof fn === 'function' && string !== '[object RegExp]' || typeof window !== 'undefined' && (
	  // IE8 and below
	  fn === window.setTimeout || fn === window.alert || fn === window.confirm || fn === window.prompt);
	};

/***/ },
/* 73 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var trim = __webpack_require__(74),
	    forEach = __webpack_require__(75),
	    isArray = function isArray(arg) {
	  return Object.prototype.toString.call(arg) === '[object Array]';
	};
	
	module.exports = function (headers) {
	  if (!headers) return {};
	
	  var result = {};
	
	  forEach(trim(headers).split('\n'), function (row) {
	    var index = row.indexOf(':'),
	        key = trim(row.slice(0, index)).toLowerCase(),
	        value = trim(row.slice(index + 1));
	
	    if (typeof result[key] === 'undefined') {
	      result[key] = value;
	    } else if (isArray(result[key])) {
	      result[key].push(value);
	    } else {
	      result[key] = [result[key], value];
	    }
	  });
	
	  return result;
	};

/***/ },
/* 74 */
/***/ function(module, exports) {

	'use strict';
	
	exports = module.exports = trim;
	
	function trim(str) {
	  return str.replace(/^\s*|\s*$/g, '');
	}
	
	exports.left = function (str) {
	  return str.replace(/^\s*/, '');
	};
	
	exports.right = function (str) {
	  return str.replace(/\s*$/, '');
	};

/***/ },
/* 75 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var isFunction = __webpack_require__(72);
	
	module.exports = forEach;
	
	var toString = Object.prototype.toString;
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	
	function forEach(list, iterator, context) {
	    if (!isFunction(iterator)) {
	        throw new TypeError('iterator must be a function');
	    }
	
	    if (arguments.length < 3) {
	        context = this;
	    }
	
	    if (toString.call(list) === '[object Array]') forEachArray(list, iterator, context);else if (typeof list === 'string') forEachString(list, iterator, context);else forEachObject(list, iterator, context);
	}
	
	function forEachArray(array, iterator, context) {
	    for (var i = 0, len = array.length; i < len; i++) {
	        if (hasOwnProperty.call(array, i)) {
	            iterator.call(context, array[i], i, array);
	        }
	    }
	}
	
	function forEachString(string, iterator, context) {
	    for (var i = 0, len = string.length; i < len; i++) {
	        // no such thing as a sparse string.
	        iterator.call(context, string.charAt(i), i, string);
	    }
	}
	
	function forEachObject(object, iterator, context) {
	    for (var k in object) {
	        if (hasOwnProperty.call(object, k)) {
	            iterator.call(context, object[k], k, object);
	        }
	    }
	}

/***/ },
/* 76 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = extend;
	
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	
	function extend() {
	    var target = {};
	
	    for (var i = 0; i < arguments.length; i++) {
	        var source = arguments[i];
	
	        for (var key in source) {
	            if (hasOwnProperty.call(source, key)) {
	                target[key] = source[key];
	            }
	        }
	    }
	
	    return target;
	}

/***/ },
/* 77 */
/***/ function(module, exports) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	var st = {};
	exports.default = st;
	
	/****
	 * Seems to be lots of different ways to format FASTA headers.
	 *
	 * Generally there's an ID and a DESCRIPTION
	 *   >ID DESCRIPTION
	 *
	 *   >(parts|of|ID) (DESCRIPTION with optional key=values)
	 *
	 * This is complicated by the fact that the "values" in the description can have spaces
	 * e.g. OS=Arabidopsis thaliana GN=CCD8
	 *
	 ****
	*/
	
	// extract IDs and push them to the meta dict
	
	st.getMeta = function (label) {
	
	  var full_id = false,
	      full_desc = false;
	  var name,
	      ids = {},
	      details = {},
	      description;
	
	  var label_parts = label.split(" ");
	
	  if (label_parts.length >= 1) {
	    full_id = label_parts.shift(); // everything up to the first white space
	    full_desc = label_parts.join(" "); // everything else
	  } else {
	    full_id = label;
	  }
	
	  if (full_id) {
	    var id_parts = full_id.split('|');
	
	    // the last item is the accession
	    name = id_parts.pop();
	
	    details.en = name;
	
	    // everything else should be pairs: db|id
	    while (id_parts.length != 0) {
	      var db = id_parts.shift();
	      var id = id_parts.shift();
	      ids[db] = id;
	    }
	  } else {
	    name = full_id;
	  }
	
	  if (full_desc) {
	
	    var kv_parts = full_desc.split('=');
	
	    if (kv_parts.length > 1) {
	
	      var current_key, next_key;
	      var kv;
	      var kv_idx_max = kv_parts.length - 1;
	      var kv_idx = 0;
	      kv_parts.forEach(function (value_and_maybe_next_key) {
	
	        value_and_maybe_next_key = value_and_maybe_next_key.trim();
	
	        var value_parts = value_and_maybe_next_key.split(" ");
	        var value;
	        if (value_parts.length > 1) {
	          next_key = value_parts.pop();
	          value = value_parts.join(' ');
	        } else {
	          value = value_and_maybe_next_key;
	        }
	
	        if (current_key) {
	          var key = current_key.toLowerCase();
	          details[key] = value;
	        } else {
	          description = value;
	        }
	        current_key = next_key;
	      });
	    } else {
	      description = kv_parts.shift();
	    }
	  }
	
	  var meta = {
	    name: name,
	    ids: ids,
	    details: details
	  };
	
	  if (description) {
	    meta.desc = description;
	  }
	
	  return meta;
	};
	
	var findSepInArr = function findSepInArr(arr, sep) {
	  for (var i = 0; i < arr.lenght; i++) {
	    if (arr[i].indexOf(i)) {
	      return i;
	    }
	  }
	  return arr.length - 1;
	};
	
	var strToDict = function strToDict(str, sep, toJoin) {
	  toJoin = toJoin || {};
	  var entries = str.split(sep);
	  toJoin[entries[0].toLowerCase()] = entries[1];
	  return toJoin;
	};
	
	var identDB = {
	  "sp": {
	    link: "http://www.uniprot.org/%s",
	    name: "Uniprot"
	  },
	  "tr": {
	    link: "http://www.uniprot.org/%s",
	    name: "Trembl"
	  },
	  "gb": {
	    link: "http://www.ncbi.nlm.nih.gov/nuccore/%s",
	    name: "Genbank"
	  },
	  "pdb": {
	    link: "http://www.rcsb.org/pdb/explore/explore.do?structureId=%s",
	    name: "PDB"
	  }
	};
	
	st.buildLinks = function (meta) {
	  var links = {};
	  meta = meta || {};
	  Object.keys(meta).forEach(function (id) {
	    if (id in identDB) {
	      var entry = identDB[id];
	      var link = entry.link.replace("%s", meta[id]);
	      links[entry.name] = link;
	    }
	  });
	  return links;
	};
	
	// search for a text
	st.contains = function (text, search) {
	  return ''.indexOf.call(text, search, 0) !== -1;
	};
	
	// split after e.g. 80 chars
	st.splitNChars = function (txt, num) {
	  var i, _ref;
	  num = num || 80;
	  var result = [];
	  for (i = 0, _ref = txt.length - 1; i <= _ref; i += num) {
	    result.push(txt.substr(i, num));
	  }
	  return result;
	};
	
	st.reverse = function (seq) {
	  return seq.split('').reverse().join('');
	};
	
	st.complement = function (seq) {
	  var newSeq = seq + "";
	  var replacements = [
	  // cg
	  [/g/g, "0"], [/c/g, "1"], [/0/g, "c"], [/1/g, "g"],
	  // CG
	  [/G/g, "0"], [/C/g, "1"], [/0/g, "C"], [/1/g, "G"],
	  // at
	  [/a/g, "0"], [/t/g, "1"], [/0/g, "t"], [/1/g, "a"],
	  // AT
	  [/A/g, "0"], [/T/g, "1"], [/0/g, "T"], [/1/g, "A"]];
	
	  for (var rep in replacements) {
	    newSeq = newSeq.replace(replacements[rep][0], replacements[rep][1]);
	  }
	  return newSeq;
	};
	
	st.reverseComplement = function (seq) {
	  return st.reverse(st.complement(seq));
	};
	
	st.model = function Seq(seq, name, id) {
	  this.seq = seq;
	  this.name = name;
	  this.id = id;
	  this.ids = {};
	};

/***/ },
/* 78 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _seqs = __webpack_require__(77);
	
	var _seqs2 = _interopRequireDefault(_seqs);
	
	var _extend2 = __webpack_require__(79);
	
	var _extend3 = _interopRequireDefault(_extend2);
	
	var _parser = __webpack_require__(69);
	
	var _parser2 = _interopRequireDefault(_parser);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var Fasta = void 0;
	exports.default = Fasta = {
	
	  getMeta: _seqs2.default.getMeta,
	
	  extend: function extend(metaParser) {
	    var customFasta = (0, _extend3.default)(Fasta);
	    Fasta.getMeta = metaParser;
	    return customFasta;
	  },
	  parse: function parse(text) {
	    var seqs = [];
	
	    // catch empty string
	    if (!text || text.length === 0) {
	      return [];
	    }
	
	    if (Object.prototype.toString.call(text) !== '[object Array]') {
	      text = text.split("\n");
	    }
	
	    var _Fasta = Fasta,
	        getMeta = _Fasta.getMeta;
	
	
	    for (var i = 0; i < text.length; i++) {
	      // check for header
	      var line = text[i];
	      if (line[0] === ">" || line[0] === ";") {
	
	        var label = line.slice(1).trim();
	        // extract IDs and push them to the meta dict
	        var obj = getMeta(label.trim());
	        label = obj.name;
	        var id = obj.id || seqs.length;
	        var currentSeq = new _seqs2.default.model("", obj.name, id);
	        currentSeq.ids = obj.ids || {};
	        currentSeq.details = obj.details || {};
	        seqs.push(currentSeq);
	      } else {
	        currentSeq.seq += line;
	      }
	    }
	    return seqs;
	  },
	  write: function write(seqs, access) {
	    var text = "";
	    for (var i = 0; i < seqs.length; i++) {
	      var seq = seqs[i];
	      if (access != null) {
	        seq = access(seq);
	      }
	      //FASTA header
	      text += ">" + seq.name + "\n";
	      // seq
	      text += _seqs2.default.splitNChars(seq.seq, 80).join("\n");
	
	      text += "\n";
	    }
	    return text;
	  }
	};
	
	_parser2.default.mixin(Fasta);

/***/ },
/* 79 */
/***/ function(module, exports) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
		value: true
	});
	
	exports.default = function (out) {
		out = out || {};
		var iterable = __range__(0, arguments.length, false);
		for (var j = 0; j < iterable.length; j++) {
			var i = iterable[j];
			if (!arguments[i]) {
				continue;
			}
	
			for (var k = 0; k < arguments[i].length; k++) {
				var key = arguments[i][k];
				if (arguments[i].hasOwnProperty(key)) {
					out[key] = arguments[i][key];
				}
			}
		}
		return out;
	};
	
	;
	
	function __range__(left, right, inclusive) {
		var range = [];
		var ascending = left < right;
		var end = !inclusive ? right : ascending ? right + 1 : right - 1;
		for (var i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
			range.push(i);
		}
		return range;
	}

/***/ },
/* 80 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _parser = __webpack_require__(69);
	
	var _parser2 = _interopRequireDefault(_parser);
	
	var _utils = __webpack_require__(81);
	
	var _utils2 = _interopRequireDefault(_utils);
	
	var _jalview = __webpack_require__(82);
	
	var _jalview2 = _interopRequireDefault(_jalview);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var gff = function gff() {}; /*
	                              * biojs-io-gff
	                              * https://github.com/greenify/biojs-io-gff
	                              *
	                              * Copyright (c) 2014 greenify
	                              * Licensed under the Apache 2 license.
	                              */
	
	_parser2.default.mixin(gff);
	exports.default = gff;
	
	
	/**
	 * Method responsible to parse GFF
	 * @see https://www.sanger.ac.uk/resources/software/gff/spec.html#t_2
	 *
	 * @example
	 *
	 *     biojsiogff.parse('SEQ1  EMBL  atg  103  105  .  +  0');
	 *
	 * @method parse
	 * @param {String} file GFF file
	 * @return {String} Returns JSON representation
	 */
	
	gff.parseLines = function (file) {
	  var lines = file.split("\n");
	  var config = {};
	  var arr = [];
	  config.type = gff._guessType(lines);
	  var offset = 0;
	  if (config.type === "jalview") {
	    var ret = _jalview2.default.readHeader(lines);
	    //console.log(ret);
	    offset = ret.offset;
	    config.colors = ret.colors;
	    arr = ret.features;
	  }
	  for (var i = offset; i < lines.length; i++) {
	    // ignore comments for now
	    var line = lines[i];
	    if (line.length === 0 || line[0] === "#") continue;
	
	    line = gff.parseLine(line);
	    if (line !== undefined) arr.push(line);
	  }
	  return {
	    features: arr,
	    config: config
	  };
	};
	
	gff._guessType = function (line) {
	  if (line[0].substring(0, 15) === "##gff-version 3") {
	    return "gff3";
	  } else if (line[0].indexOf("#") < 0 && line[0].split("\t").length === 2) {
	    // no comments and two columns. let's hope this is from jalview
	    return "jalview";
	  }
	  // unable to read file header. lets hope this is gff3
	  return "gff3";
	};
	
	/**
	 * parses GFF and returns a dictionary of all seqs with their features
	 * @method parseSeqs
	 * @param {String} file GFF file
	 * @return {String} Returns dictionary of sequences with an array of their features
	 */
	gff.parseSeqs = gff.parse = function (file) {
	  var obj = gff.parseLines(file);
	  var seqs = {};
	  obj.features.forEach(function (entry) {
	    var key = entry.seqname;
	    if (seqs[key] === undefined) seqs[key] = [];
	    delete entry.seqname;
	    seqs[key].push(entry);
	  });
	  delete obj.features;
	  obj.seqs = seqs;
	  return obj;
	};
	
	/*
	 * parses one GFF line and returns it
	 */
	gff.parseLine = function (line) {
	  var tLine = {};
	
	  var columns = line.split(/\s+/);
	  // ignore empty lines
	  if (columns.length === 1) return;
	
	  tLine.seqname = columns[0];
	  tLine.source = columns[1];
	  tLine.feature = columns[2];
	  tLine.start = parseInt(columns[3]);
	  tLine.end = parseInt(columns[4]);
	  tLine.score = columns[5]; // only DNA,RNA
	  tLine.strand = columns[6]; // only DNA,RNA
	  tLine.frame = columns[7]; // only DNA,RNA
	  var attr = columns.slice(8).join(" "); // plain text comments
	
	  // remove undefined (dot)
	  Object.keys(tLine).forEach(function (key) {
	    if (typeof tLine[key] === "string") {
	      tLine[key] = tLine[key].trim(); // triming is important
	    }
	    if (tLine[key] === ".") {
	      tLine[key] = undefined;
	    }
	  });
	
	  // parse optional parameters
	  if (tLine.score) {
	    tLine.score = parseFloat(tLine.score);
	  }
	  if (tLine.frame) {
	    tLine.frame = parseInt(tLine.frame);
	  }
	
	  tLine.attributes = _utils2.default.extractKeys(attr);
	  return tLine;
	};
	
	gff.exportLine = function (line) {
	  var attrs = Object.keys(line.attributes).map(function (key) {
	    return key + "=" + line.attributes[key];
	  }).join(";");
	  var cells = [line.seqname, line.source, line.feature, line.start, line.end, line.score, line.strand, line.frame, attrs];
	  cells = cells.map(function (e) {
	    if (e === undefined) {
	      return ".";
	    }
	    return e;
	  });
	  return cells.join("\t");
	};
	
	gff.exportLines = function (lines) {
	  return "##gff-version 3\n" + lines.map(gff.exportLine).join("\n");
	};
	
	gff.exportSeqs = gff.export = function (seqs) {
	  var lines = [];
	  var pLine = function pLine(e) {
	    e.seqname = key;
	    lines.push(e);
	  };
	
	  for (var key in seqs) {
	    seqs[key].forEach(pLine);
	  }
	  return gff.exportLines(lines);
	};
	
	// expose utils
	gff.utils = _utils2.default;

/***/ },
/* 81 */
/***/ function(module, exports) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.extractKeys = extractKeys;
	exports.rgbToHex = rgbToHex;
	function extractKeys(attr) {
	  // extract key-value definitions
	  var attributes = {};
	  var attrArr = attr.split(";");
	  attrArr.forEach(function (el) {
	    var keyArr, key, val;
	    if (el.indexOf("=") > 0) {
	      keyArr = el.split("=");
	      key = keyArr[0];
	      val = keyArr[1];
	      attributes[key] = val;
	    } else if (el.indexOf(" ") > 0) {
	      keyArr = el.split(" ");
	      key = keyArr[0];
	      val = keyArr[1].replace(/"/g, '');
	      attributes[key] = val;
	    }
	  });
	  return attributes;
	};
	
	function componentToHex(c) {
	  var hex = c.toString(16);
	  return hex.length === 1 ? "0" + hex : hex;
	}
	
	function rgbToHex(r, g, b) {
	  if (r.length === 3) {
	    return rgbToHex(r[0], r[1], r[2]);
	  }
	  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
	};
	
	// exporting with star is expensive
	exports.default = {
	  extractKeys: extractKeys,
	  rgbToHex: rgbToHex
	};

/***/ },
/* 82 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _utils = __webpack_require__(81);
	
	var jalview = {};
	exports.default = jalview;
	
	// http://www.jalview.org/help/html/features/featuresFormat.html
	
	jalview.readHeader = function (lines) {
	  var colors = {};
	  var i = 0;
	  var features = [];
	  var currentGroup;
	
	  for (; i < lines.length; i++) {
	    var line = lines[i];
	    if (line.indexOf("#") >= 0) {
	      // no comments allowed -> stop
	      break;
	    }
	    var columns = line.split(/\t/);
	    var firstCell = columns[0].trim();
	    if (firstCell === "GFF") {
	      // this symbolizes the end
	      break;
	    } else if (columns.length === 2) {
	      if (firstCell === "startgroup") {
	        currentGroup = columns[1].trim();
	      } else if (firstCell === "endgroup") {
	        currentGroup = "";
	        continue;
	      } else {
	        // parse color
	        colors[columns[0]] = jalview.parseColor(columns[1]);
	      }
	    } else if (columns.length >= 5) {
	      var arr = jalview.parseLine(columns);
	      if (currentGroup) {
	        arr.attributes.Parent = currentGroup;
	      }
	      features.push(arr);
	    }
	  }
	
	  return {
	    offset: i,
	    colors: colors,
	    features: features
	  };
	};
	
	jalview.parseColor = function (cell) {
	  if (cell.indexOf(",") >= 0) {
	    // rgb code
	    return (0, _utils.rgbToHex)(cell.split(",").map(function (el) {
	      return parseInt(el);
	    }));
	  }
	  // color names with length == 6
	  // 'bisque,maroon,orange,orchid,purple,salmon,sienna,tomato,violet,yellow'
	  if (cell.length === 6 && parseInt(cell.charAt(0), 16) <= 16 && cell !== 'bisque') {
	    // hex code
	    return "#" + cell;
	  }
	  // color name
	  return cell;
	};
	
	jalview.parseLine = function (columns) {
	  var obj = {
	    attributes: {}
	  };
	  obj.attributes.Name = columns[0].trim(); //desc
	  obj.seqname = columns[1].trim(); // id
	  obj.start = parseInt(columns[3]);
	  obj.end = parseInt(columns[4]);
	  obj.feature = columns[5].trim();
	  if (obj.seqname === "ID_NOT_SPECIFIED") {
	    obj.seqname = columns[2].trim(); // alternative id
	  }
	  return obj;
	};

/***/ },
/* 83 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var _parser = __webpack_require__(69);
	
	var _parser2 = _interopRequireDefault(_parser);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	/** Example of a simple 2d matrix parser
	 * Can be used for e.g. BLOSUM
	 * */
	
	var MatrixReader = function MatrixReader(text) {
	  if (this.constructor != MatrixReader) return new MatrixReader(text);
	  this.matrix = {};
	  this.parsingOrder = [];
	  if (text != undefined) {
	    this.parse(text);
	  }
	  return this;
	};
	
	_parser2.default.mixin(MatrixReader);
	
	module.exports = MatrixReader;
	
	MatrixReader.prototype.parse = function (text) {
	  text.split("\n").forEach(function (el) {
	    this.parseLine(el);
	  }.bind(this));
	  this.buildMatrix();
	  return this.matrix;
	};
	
	MatrixReader.read = function (url, cb) {
	  return new MatrixReader().read(url, cb);
	};
	
	MatrixReader.parse = function (text) {
	  return new MatrixReader().parse(text);
	};
	
	MatrixReader.prototype.parseLine = function (line) {
	  var c = line.charAt(0);
	  if (c === '#') {
	    return;
	  } else {
	    this.parsingOrder.push(c);
	    var intStr = line.substring(1);
	    var ints = intStr.split(/\s+/).filter(function (e) {
	      return e.length > 0;
	    }).map(function (e) {
	      return parseInt(e);
	    });
	
	    var m = {};
	    for (var i = 0; i < ints.length; i++) {
	      m[this.parsingOrder[i]] = ints[i];
	    }
	    this.matrix[c] = m;
	  }
	};
	
	MatrixReader.prototype.export = function () {
	  return MatrixReader.export(this.matrix);
	};
	
	MatrixReader.export = function (matrix) {
	  var lines = [];
	  var max = 1;
	  // use the matrix attribute if an object is given
	  if ("matrix" in matrix) {
	    matrix = matrix.matrix;
	  }
	  for (var key in matrix) {
	    var line = key;
	    var keys = Object.keys(matrix[key]);
	    for (var i = 0; i < max; i++) {
	      line += "\t" + matrix[key][keys[i]];
	    }
	    lines.push(line);
	    max++;
	  }
	  return lines.join("\n");
	};
	
	/**
	 * faster access time
	 */
	MatrixReader.prototype.buildMatrix = function () {
	  for (var i = this.parsingOrder.length - 1; i >= 0; i--) {
	    var curC = this.parsingOrder[i];
	    var map = this.matrix[curC];
	    for (var key in map) {
	      this.matrix[key][curC] = map[key];
	    }
	  }
	};

/***/ },
/* 84 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.parseNhx = exports.parse = undefined;
	
	var _newick = __webpack_require__(85);
	
	var _newick2 = _interopRequireDefault(_newick);
	
	var _extended_newick = __webpack_require__(86);
	
	var _extended_newick2 = _interopRequireDefault(_extended_newick);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var newick = {};
	newick.parse = _newick2.default;
	newick.parseNhx = _extended_newick2.default;
	
	exports.default = newick;
	exports.parse = _newick2.default;
	exports.parseNhx = _extended_newick2.default;

/***/ },
/* 85 */
/***/ function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.default = parse_newick;
	/**
	 * Newick format parser in JavaScript.
	 *
	 * Copyright (c) edited by Miguel Pignatelli 2014, based on Jason Davies 2010.
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
	 *
	 * Example tree (from http://en.wikipedia.org/wiki/Newick_format):
	 *
	 * +--0.1--A
	 * F-----0.2-----B            +-------0.3----C
	 * +------------------0.5-----E
	 *                            +---------0.4------D
	 *
	 * Newick format:
	 * (A:0.1,B:0.2,(C:0.3,D:0.4)E:0.5)F;
	 *
	 * Converted to JSON:
	 * {
	 *   name: "F",
	 *   children: [
	 *     {name: "A", branch_length: 0.1},
	 *     {name: "B", branch_length: 0.2},
	 *     {
	 *       name: "E",
	 *       length: 0.5,
	 *       children: [
	 *         {name: "C", branch_length: 0.3},
	 *         {name: "D", branch_length: 0.4}
	 *       ]
	 *     }
	 *   ]
	 * }
	 *
	 * Converted to JSON, but with no names or lengths:
	 * {
	 *   children: [
	 *     {}, {}, {
	 *       children: [{}, {}]
	 *     }
	 *   ]
	 * }
	 */
	
	function parse_newick(s) {
	  var ancestors = [];
	  var tree = {};
	  var tokens = s.split(/\s*(;|\(|\)|,|:)\s*/);
	  for (var i = 0; i < tokens.length; i++) {
	    var token = tokens[i];
	    var subtree = void 0;
	    switch (token) {
	      case '(':
	        // new children
	        subtree = {};
	        tree.children = [subtree];
	        ancestors.push(tree);
	        tree = subtree;
	        break;
	      case ',':
	        // another branch
	        subtree = {};
	        ancestors[ancestors.length - 1].children.push(subtree);
	        tree = subtree;
	        break;
	      case ')':
	        // optional name next
	        tree = ancestors.pop();
	        break;
	      case ':':
	        // optional length next
	        break;
	      default:
	        var x = tokens[i - 1];
	        if (x == ')' || x == '(' || x == ',') {
	          tree.name = token;
	        } else if (x == ':') {
	          tree.branch_length = parseFloat(token);
	        }
	    }
	  }
	  return tree;
	};

/***/ },
/* 86 */
/***/ function(module, exports) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	exports.default = parse_nhx;
	/**
	 * Extended Newick format parser in JavaScript.
	 *
	 * Copyright (c) Miguel Pignatelli 2014 based on Jason Davies
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
	 *
	 * Example tree (from http://en.wikipedia.org/wiki/Newick_format):
	 *
	 * +--0.1--A
	 * F-----0.2-----B            +-------0.3----C
	 * +------------------0.5-----E
	 *                            +---------0.4------D
	 *
	 * Newick format:
	 * (A:0.1,B:0.2,(C:0.3,D:0.4)E:0.5)F;
	 *
	 * Converted to JSON:
	 * {
	 *   name: "F",
	 *   children: [
	 *     {name: "A", branch_length: 0.1},
	 *     {name: "B", branch_length: 0.2},
	 *     {
	 *       name: "E",
	 *       length: 0.5,
	 *       children: [
	 *         {name: "C", branch_length: 0.3},
	 *         {name: "D", branch_length: 0.4}
	 *       ]
	 *     }
	 *   ]
	 * }
	 *
	 * Converted to JSON, but with no names or lengths:
	 * {
	 *   children: [
	 *     {}, {}, {
	 *       children: [{}, {}]
	 *     }
	 *   ]
	 * }
	 */
	
	function parse_nhx(s) {
	  var ancestors = [];
	  var tree = {};
	  // var tokens = s.split(/\s*(;|\(|\)|,|:)\s*/);
	  //[&&NHX:D=N:G=ENSG00000139618:T=9606]
	  var tokens = s.split(/\s*(;|\(|\)|\[|\]|,|:|=)\s*/);
	  for (var i = 0; i < tokens.length; i++) {
	    var token = tokens[i];
	    var subtree = void 0;
	    switch (token) {
	      case '(':
	        // new children
	        subtree = {};
	        tree.children = [subtree];
	        ancestors.push(tree);
	        tree = subtree;
	        break;
	      case ',':
	        // another branch
	        subtree = {};
	        ancestors[ancestors.length - 1].children.push(subtree);
	        tree = subtree;
	        break;
	      case ')':
	        // optional name next
	        tree = ancestors.pop();
	        break;
	      case ':':
	        // optional length next
	        break;
	      default:
	        var x = tokens[i - 1];
	        // var x2 = tokens[i-2];
	        if (x == ')' || x == '(' || x == ',') {
	          tree.name = token;
	        } else if (x == ':') {
	          var test_type = typeof token === 'undefined' ? 'undefined' : _typeof(token);
	          if (!isNaN(token)) {
	            tree.branch_length = parseFloat(token);
	          }
	          // tree.length = parseFloat(token);
	        } else if (x == '=') {
	          var x2 = tokens[i - 2];
	          switch (x2) {
	            case 'D':
	              tree.duplication = token;
	              break;
	            case 'G':
	              tree.gene_id = token;
	              break;
	            case 'T':
	              tree.taxon_id = token;
	              break;
	
	          }
	        } else {
	          var test;
	        }
	    }
	  }
	  return tree;
	};

/***/ },
/* 87 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _LabelHeader = __webpack_require__(88);
	
	var _LabelHeader2 = _interopRequireDefault(_LabelHeader);
	
	var _RightHeaderBlock = __webpack_require__(89);
	
	var _RightHeaderBlock2 = _interopRequireDefault(_RightHeaderBlock);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var boneView = __webpack_require__(16);
	
	
	var View = boneView.extend({
	
	  initialize: function initialize(data) {
	    var _this = this;
	
	    this.g = data.g;
	    this.draw();
	    return this.listenTo(this.g.vis, "change:labels change:metacell change:leftHeader", function () {
	      _this.draw();
	      return _this.render();
	    });
	  },
	
	  draw: function draw() {
	    this.removeViews();
	
	    if (this.g.vis.get("leftHeader") && (this.g.vis.get("labels") || this.g.vis.get("metacell"))) {
	      var lHeader = new _LabelHeader2.default({ model: this.model, g: this.g });
	      lHeader.ordering = -50;
	      this.addView("lHeader", lHeader);
	    }
	
	    var rHeader = new _RightHeaderBlock2.default({ model: this.model, g: this.g });
	    rHeader.ordering = 0;
	    return this.addView("rHeader", rHeader);
	  },
	
	  render: function render() {
	    this.renderSubviews();
	
	    return this.el.className = "biojs_msa_header";
	  }
	});
	exports.default = View;

/***/ },
/* 88 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	var k = __webpack_require__(44);
	var view = __webpack_require__(14);
	var dom = __webpack_require__(65);
	
	var LabelHeader = view.extend({
	
	  className: "biojs_msa_headers",
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	
	    this.listenTo(this.g.vis, "change:metacell change:labels", this.render);
	    return this.listenTo(this.g.zoomer, "change:labelWidth change:metaWidth", this.render);
	  },
	
	  render: function render() {
	
	    dom.removeAllChilds(this.el);
	
	    var width = 0;
	    width += this.g.zoomer.getLeftBlockWidth();
	    this.el.style.width = width + "px";
	
	    if (this.g.vis.get("labels")) {
	      this.el.appendChild(this.labelDOM());
	    }
	
	    if (this.g.vis.get("metacell")) {
	      this.el.appendChild(this.metaDOM());
	    }
	
	    this.el.style.display = "inline-block";
	    this.el.style.fontSize = this.g.zoomer.get("markerFontsize");
	    return this;
	  },
	
	  labelDOM: function labelDOM() {
	    var labelHeader = k.mk("div");
	    labelHeader.style.width = this.g.zoomer.getLabelWidth();
	    labelHeader.style.display = "inline-block";
	
	    if (this.g.vis.get("labelCheckbox")) {
	      labelHeader.appendChild(this.addEl(".", 10));
	    }
	
	    if (this.g.vis.get("labelId")) {
	      labelHeader.appendChild(this.addEl("ID", this.g.zoomer.get("labelIdLength")));
	    }
	
	    if (this.g.vis.get("labelPartition")) {
	      labelHeader.appendChild(this.addEl("part", 15));
	    }
	
	    if (this.g.vis.get("labelName")) {
	      var name = this.addEl("Label");
	      //name.style.marginLeft = "50px"
	      labelHeader.appendChild(name);
	    }
	
	    return labelHeader;
	  },
	
	  addEl: function addEl(content, width) {
	    var id = document.createElement("span");
	    id.textContent = content;
	    if (typeof width !== "undefined" && width !== null) {
	      id.style.width = width + "px";
	    }
	    id.style.display = "inline-block";
	    return id;
	  },
	
	  metaDOM: function metaDOM() {
	    var metaHeader = k.mk("div");
	    metaHeader.style.width = this.g.zoomer.getMetaWidth();
	    metaHeader.style.display = "inline-block";
	
	    if (this.g.vis.get("metaGaps")) {
	      metaHeader.appendChild(this.addEl("Gaps", this.g.zoomer.get('metaGapWidth')));
	    }
	    if (this.g.vis.get("metaIdentity")) {
	      metaHeader.appendChild(this.addEl("Ident", this.g.zoomer.get('metaIdentWidth')));
	    }
	    // if @.g.vis.get "metaLinks"
	    //   metaHeader.appendChild @addEl("Links")
	
	    return metaHeader;
	  }
	});
	exports.default = LabelHeader;

/***/ },
/* 89 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _MarkerView = __webpack_require__(90);
	
	var _MarkerView2 = _interopRequireDefault(_MarkerView);
	
	var _ConservationView = __webpack_require__(92);
	
	var _ConservationView2 = _interopRequireDefault(_ConservationView);
	
	var _SeqLogoWrapper = __webpack_require__(93);
	
	var _SeqLogoWrapper2 = _interopRequireDefault(_SeqLogoWrapper);
	
	var _GapView = __webpack_require__(109);
	
	var _GapView2 = _interopRequireDefault(_GapView);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var boneView = __webpack_require__(16);
	
	var View = boneView.extend({
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	    this.blockEvents = false;
	
	    this.listenTo(this.g.vis, "change:header", function () {
	      this.draw();
	      return this.render();
	    });
	    this.listenTo(this.g.vis, "change", this._setSpacer);
	    this.listenTo(this.g.zoomer, "change:alignmentWidth", this._setWidth);
	    this.listenTo(this.g.zoomer, "change:_alignmentScrollLeft", this._adjustScrollingLeft);
	
	    // TODO: duplicate rendering
	    this.listenTo(this.g.columns, "change:hidden", function () {
	      this.draw();
	      return this.render();
	    });
	
	    this.draw();
	
	    return this.g.vis.once('change:loaded', this._adjustScrollingLeft, this);
	  },
	
	  events: { "scroll": "_sendScrollEvent" },
	
	  draw: function draw() {
	    this.removeViews();
	
	    if (this.g.vis.get("conserv")) {
	      var conserv = new _ConservationView2.default({ model: this.model, g: this.g });
	      conserv.ordering = -20;
	      this.addView("conserv", conserv);
	    }
	
	    if (this.g.vis.get("markers")) {
	      var marker = new _MarkerView2.default({ model: this.model, g: this.g });
	      marker.ordering = -10;
	      this.addView("marker", marker);
	    }
	
	    if (this.g.vis.get("seqlogo")) {
	      var seqlogo = new _SeqLogoWrapper2.default({ model: this.model, g: this.g });
	      seqlogo.ordering = -30;
	      this.addView("seqlogo", seqlogo);
	    }
	
	    if (this.g.vis.get("gapHeader")) {
	      var gapview = new _GapView2.default({ model: this.model, g: this.g });
	      gapview.ordering = -25;
	      return this.addView("gapview", gapview);
	    }
	  },
	
	  render: function render() {
	    this.renderSubviews();
	
	    this._setSpacer();
	
	    this.el.className = "biojs_msa_rheader";
	    this.el.style.overflowX = "auto";
	    this.el.style.display = "inline-block";
	    //@el.style.height = @g.zoomer.get("markerHeight") + "px"
	    this._setWidth();
	    this._adjustScrollingLeft();
	    return this;
	  },
	
	  // scrollLeft triggers a reflow of the whole area (even only get)
	  _sendScrollEvent: function _sendScrollEvent() {
	    if (!this.blockEvents) {
	      this.g.zoomer.set("_alignmentScrollLeft", this.el.scrollLeft, { origin: "header" });
	    }
	    return this.blockEvents = false;
	  },
	
	  _adjustScrollingLeft: function _adjustScrollingLeft(model, value, options) {
	    if (!((typeof options !== "undefined" && options !== null ? options.origin : undefined) != null) || options.origin !== "header") {
	      var scrollLeft = this.g.zoomer.get("_alignmentScrollLeft");
	      this.blockEvents = true;
	      return this.el.scrollLeft = scrollLeft;
	    }
	  },
	
	  _setSpacer: function _setSpacer() {
	    // spacer / padding element
	    return this.el.style.marginLeft = this._getLabelWidth() + "px";
	  },
	
	  _getLabelWidth: function _getLabelWidth() {
	    var paddingLeft = 0;
	    if (!this.g.vis.get("leftHeader")) {
	      paddingLeft += this.g.zoomer.getLeftBlockWidth();
	    }
	    return paddingLeft;
	  },
	
	  _setWidth: function _setWidth() {
	    return this.el.style.width = this.g.zoomer.getAlignmentWidth() + "px";
	  }
	});
	exports.default = View;

/***/ },
/* 90 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _svg = __webpack_require__(91);
	
	var svg = _interopRequireWildcard(_svg);
	
	function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }
	
	var view = __webpack_require__(14);
	var dom = __webpack_require__(65);
	var jbone = __webpack_require__(15);
	
	
	var MarkerView = view.extend({
	
	  className: "biojs_msa_marker",
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	    this.listenTo(this.g.zoomer, "change:stepSize change:labelWidth change:columnWidth change:markerStepSize change:markerFontsize", this.render);
	    this.listenTo(this.g.vis, "change:labels change:metacell", this.render);
	    return this.manageEvents();
	  },
	
	  render: function render() {
	    dom.removeAllChilds(this.el);
	
	    var fontSize = this.g.zoomer.get("markerFontsize");
	    var cellWidth = this.g.zoomer.get("columnWidth");
	    var stepSize = this.g.zoomer.get("stepSize");
	    var markerStepSize = this.g.zoomer.get("markerStepSize");
	
	    var hidden = this.g.columns.get("hidden");
	
	    this.el.style.fontSize = fontSize;
	
	    var container = document.createElement("span");
	    var nMax = this.model.getMaxLength();
	
	    for (var n = 0; n < nMax; n++) {
	      if (hidden.indexOf(n) >= 0) {
	        var el = this.markerHidden(n, stepSize);
	        if (!!el) container.appendChild(el);
	        n += stepSize;
	        continue;
	      }
	      var span = document.createElement("span");
	      span.className = 'msa-col-header';
	      span.style.width = cellWidth + "px";
	      span.style.display = "inline-block";
	
	      if ((n + 1) % markerStepSize === 0) {
	        span.textContent = n + 1;
	      } else if ((n + 1) % stepSize === 0) {
	        span.textContent = ".";
	      } else {
	        span.textContent = " ";
	      }
	      span.rowPos = n;
	      container.appendChild(span);
	    }
	
	    this.el.appendChild(container);
	    return this;
	  },
	
	  markerHidden: function markerHidden(n, stepSize) {
	    var _this = this;
	
	    var hidden = this.g.columns.get("hidden").slice(0);
	
	    var min = Math.max(0, n - stepSize);
	    var prevHidden = true;
	    for (var j = min; j <= n; j++) {
	      prevHidden &= hidden.indexOf(j) >= 0;
	    }
	
	    // filter duplicates
	    if (prevHidden) {
	      return;
	    }
	
	    var nMax = this.model.getMaxLength();
	
	    var length = 0;
	    var index = -1;
	    // accumlate multiple rows
	    for (var n2 = n; n2 <= nMax; n2++) {
	      if (!(index >= 0)) {
	        index = hidden.indexOf(n2);
	      } // sets the first index
	      if (hidden.indexOf(n2) >= 0) {
	        length++;
	      } else {
	        break;
	      }
	    }
	
	    var s = svg.base({ height: 10, width: 10 });
	    s.style.position = "relative";
	    var triangle = svg.polygon({ points: "0,0 5,5 10,0", style: "fill:lime;stroke:purple;stroke-width:1"
	    });
	    jbone(triangle).on("click", function (evt) {
	      hidden.splice(index, length);
	      return _this.g.columns.set("hidden", hidden);
	    });
	
	    s.appendChild(triangle);
	    return s;
	  },
	
	  manageEvents: function manageEvents() {
	    var events = {};
	    if (this.g.config.get("registerMouseClicks")) {
	      events.click = "_onclick";
	    }
	    if (this.g.config.get("registerMouseHover")) {
	      events.mousein = "_onmousein";
	      events.mouseout = "_onmouseout";
	    }
	    this.delegateEvents(events);
	    this.listenTo(this.g.config, "change:registerMouseHover", this.manageEvents);
	    return this.listenTo(this.g.config, "change:registerMouseClick", this.manageEvents);
	  },
	
	  _onclick: function _onclick(evt) {
	    var rowPos = evt.target.rowPos;
	    var stepSize = this.g.zoomer.get("stepSize");
	    return this.g.trigger("column:click", { rowPos: rowPos, stepSize: stepSize, evt: evt });
	  },
	
	  _onmousein: function _onmousein(evt) {
	    var rowPos = this.g.zoomer.get("stepSize" * evt.rowPos);
	    var stepSize = this.g.zoomer.get("stepSize");
	    return this.g.trigger("column:mousein", { rowPos: rowPos, stepSize: stepSize, evt: evt });
	  },
	
	  _onmouseout: function _onmouseout(evt) {
	    var rowPos = this.g.zoomer.get("stepSize" * evt.rowPos);
	    var stepSize = this.g.zoomer.get("stepSize");
	    return this.g.trigger("column:mouseout", { rowPos: rowPos, stepSize: stepSize, evt: evt });
	  }
	});
	
	exports.default = MarkerView;

/***/ },
/* 91 */
/***/ function(module, exports) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	// mini svg helper
	
	var svgns = "http://www.w3.org/2000/svg";
	
	var setAttr = function setAttr(obj, opts) {
	  for (var name in opts) {
	    var value = opts[name];
	    obj.setAttributeNS(null, name, value);
	  }
	  return obj;
	};
	
	var Base = function Base(opts) {
	  var svg = document.createElementNS(svgns, 'svg');
	  svg.setAttribute("width", opts.width);
	  svg.setAttribute("height", opts.height);
	  return svg;
	};
	
	var Rect = function Rect(opts) {
	  var rect = document.createElementNS(svgns, 'rect');
	  return setAttr(rect, opts);
	};
	
	var Line = function Line(opts) {
	  var line = document.createElementNS(svgns, 'line');
	  return setAttr(line, opts);
	};
	
	var Polygon = function Polygon(opts) {
	  var line = document.createElementNS(svgns, 'polygon');
	  return setAttr(line, opts);
	};
	
	exports.base = Base;
	exports.line = Line;
	exports.rect = Rect;
	exports.polygon = Polygon;

/***/ },
/* 92 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };
	
	var _svg = __webpack_require__(91);
	
	var svg = _interopRequireWildcard(_svg);
	
	function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }
	
	var view = __webpack_require__(14);
	var dom = __webpack_require__(65);
	
	
	var ConservationView = view.extend({
	
	  className: "biojs_msa_conserv",
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	    this.listenTo(this.g.zoomer, "change:stepSize change:labelWidth change:columnWidth", this.render);
	    this.listenTo(this.g.vis, "change:labels change:metacell", this.render);
	    this.listenTo(this.g.columns, "change:scaling", this.render);
	    // we need to wait until stats gives us the ok
	    //@listenTo @model, "reset",@render
	    this.listenTo(this.g.stats, "reset", this.render);
	
	    var opts = _.extend({}, {
	      fillColor: ['#660', '#ff0'],
	      strokeColor: '#330',
	      maxHeight: 20,
	      rectStyler: function rectStyler(rect, data) {
	        return rect;
	      }
	    }, this.g.conservationConfig);
	
	    this.fillColor = opts.fillColor;
	    this.strokeColor = opts.strokeColor;
	    this.maxHeight = opts.maxHeight;
	    this.rectStyler = opts.rectStyler;
	
	    return this.manageEvents();
	  },
	
	  // returns a function that will decide a colour
	  // based on the conservation data it is given
	  colorer: function colorer(colorRange) {
	    var _this = this;
	
	    var colorer = function colorer() {
	      return "none";
	    };
	
	    if (typeof colorRange === 'string') {
	      colorer = function colorer() {
	        return colorRange;
	      };
	    } else if (Array.isArray(colorRange)) {
	      if (colorRange.length != 2) {
	        console.error("ERROR: colorRange array should have exactly two elements", colorRange);
	      }
	
	      // d3 is shipped modular nowadays - we can support both
	      var d3BundledScale = typeof d3 != "undefined" && !!d3.scale;
	      var d3SeperatedScale = typeof d3_scale != "undefined";
	      if (!(d3BundledScale || d3SeperatedScale)) {
	        console.warn("providing a [min/max] range as input requires d3 to be included - only using the first color");
	        colorer = function colorer(d) {
	          return colorRange[0];
	        };
	      } else {
	        (function () {
	          var d3LinearScale = d3BundledScale ? d3.scale.linear() : d3_scale.scaleLinear();
	          var scale = d3LinearScale.domain([0, _this.maxHeight]).range(colorRange);
	
	          colorer = function colorer(d) {
	            return scale(d.height);
	          };
	        })();
	      }
	    } else {
	      console.warn("expected colorRange to be '#rgb' or ['#rgb', '#rgb']", colorRange, '(' + (typeof colorRange === "undefined" ? "undefined" : _typeof(colorRange)) + ')');
	    }
	    return colorer;
	  },
	
	  render: function render() {
	    var conserv = this.g.stats.scale(this.g.stats.conservation());
	
	    dom.removeAllChilds(this.el);
	
	    var nMax = this.model.getMaxLength();
	    var cellWidth = this.g.zoomer.get("columnWidth");
	    var maxHeight = this.maxHeight;
	    var width = cellWidth * (nMax - this.g.columns.get('hidden').length);
	
	    var s = svg.base({ height: maxHeight, width: width });
	    s.style.display = "inline-block";
	    s.style.cursor = "pointer";
	
	    var rectData = this.rectData;
	    var fillColorer = this.colorer(this.fillColor);
	    var strokeColorer = this.colorer(this.strokeColor);
	    var rectStyler = this.rectStyler;
	
	    var stepSize = this.g.zoomer.get("stepSize");
	    var hidden = this.g.columns.get("hidden");
	    var x = 0;
	    var n = 0;
	    while (n < nMax) {
	      if (hidden.indexOf(n) >= 0) {
	        n += stepSize;
	        continue;
	      }
	      width = cellWidth * stepSize;
	      var avgHeight = 0;
	      var end = stepSize - 1;
	      for (var i = 0; 0 < end ? i <= end : i >= end; 0 < end ? i++ : i--) {
	        avgHeight += conserv[n];
	      }
	      var height = maxHeight * (avgHeight / stepSize);
	
	      var d = {
	        x: x,
	        y: maxHeight - height,
	        maxheight: maxHeight,
	        width: width - cellWidth / 4,
	        height: height,
	        rowPos: n
	      };
	
	      var rect = svg.rect(d);
	
	      rect.style.stroke = strokeColorer(d);
	      rect.style.fill = fillColorer(d);
	
	      if (typeof rectStyler === 'function') {
	        rectStyler(rect, d);
	      }
	
	      rect.rowPos = n;
	
	      s.appendChild(rect);
	      x += width;
	      n += stepSize;
	    }
	
	    this.el.appendChild(s);
	    return this;
	  },
	
	  //TODO: make more general with HeaderView
	  _onclick: function _onclick(evt) {
	    var _this2 = this;
	
	    var rowPos = evt.target.rowPos;
	    var stepSize = this.g.zoomer.get("stepSize");
	    // simulate hidden columns
	    return function () {
	      var result = [];
	      var end = stepSize - 1;
	      for (var i = 0; 0 < end ? i <= end : i >= end; 0 < end ? i++ : i--) {
	        result.push(_this2.g.trigger("bar:click", { rowPos: rowPos + i, evt: evt }));
	      }
	      return result;
	    }();
	  },
	
	  manageEvents: function manageEvents() {
	    var events = {};
	    if (this.g.config.get("registerMouseClicks")) {
	      events.click = "_onclick";
	    }
	    if (this.g.config.get("registerMouseHover")) {
	      events.mousein = "_onmousein";
	      events.mouseout = "_onmouseout";
	    }
	    this.delegateEvents(events);
	    this.listenTo(this.g.config, "change:registerMouseHover", this.manageEvents);
	    return this.listenTo(this.g.config, "change:registerMouseClick", this.manageEvents);
	  },
	
	  _onmousein: function _onmousein(evt) {
	    var rowPos = this.g.zoomer.get("stepSize" * evt.rowPos);
	    return this.g.trigger("bar:mousein", { rowPos: rowPos, evt: evt });
	  },
	
	  _onmouseout: function _onmouseout(evt) {
	    var rowPos = this.g.zoomer.get("stepSize" * evt.rowPos);
	    return this.g.trigger("bar:mouseout", { rowPos: rowPos, evt: evt });
	  }
	});
	
	exports.default = ConservationView;

/***/ },
/* 93 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	var SeqLogoView = __webpack_require__(94);
	var view = __webpack_require__(14);
	var dom = __webpack_require__(65);
	
	// this is a bridge between the MSA and the seqlogo viewer
	var SeqLogoWrapper = view.extend({
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	    this.listenTo(this.g.zoomer, "change:alignmentWidth", this.render);
	    this.listenTo(this.g.colorscheme, "change", function () {
	      var colors = this.g.colorscheme.getSelectedScheme();
	      this.seqlogo.changeColors(colors);
	      return this.render();
	    });
	
	    this.listenTo(this.g.zoomer, "change:columnWidth", function () {
	      this.seqlogo.column_width = this.g.zoomer.get('columnWidth');
	      return this.render();
	    });
	
	    //@listenTo @g.zoomer,"change:columnWidth change:rowHeight", ->
	
	    this.listenTo(this.g.stats, "reset", function () {
	      this.draw();
	      return this.render();
	    });
	
	    return this.draw();
	  },
	
	  draw: function draw() {
	    dom.removeAllChilds(this.el);
	
	    console.log("redraw seqlogo");
	    var arr = this.g.stats.conservResidue({ scaled: true });
	    arr = _.map(arr, function (el) {
	      return _.pick(el, function (e, k) {
	        return k !== "-";
	      });
	    });
	    var data = { alphabet: "aa",
	      heightArr: arr
	    };
	
	    var colors = this.g.colorscheme.getSelectedScheme();
	    // TODO: seqlogo might have problems with true dynamic schemes
	    return this.seqlogo = new SeqLogoView({ model: this.model, g: this.g, data: data, yaxis: false, scroller: false, xaxis: false, height: 100, column_width: this.g.zoomer.get('columnWidth'), positionMarker: false, zoom: 1, el: this.el, colors: colors });
	  },
	
	  render: function render() {
	    return this.seqlogo.render();
	  }
	});
	exports.default = SeqLogoWrapper;

/***/ },
/* 94 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	// this is a light-weight build without the scrolling module
	module.exports = __webpack_require__(95);

/***/ },
/* 95 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	_ = __webpack_require__(11);
	
	//var ConsensusColors = require("./consensusColors.js");
	var canvasSupport = __webpack_require__(96);
	var _render = __webpack_require__(97);
	var Letter = __webpack_require__(103);
	var view = __webpack_require__(14);
	var axis = __webpack_require__(104);
	var eventListener = __webpack_require__(105);
	var settings = __webpack_require__(106);
	
	var jbone = __webpack_require__(15);
	
	module.exports = view.extend({
	
	  options: {
	    xaxis: true,
	    yaxis: true,
	    height: 300,
	    column_width: 34,
	    debug: true,
	    scale_height_enabled: true,
	    scaled_max: true,
	    zoom_buttons: true,
	    colorscheme: 'default',
	    data: undefined,
	    start: 1,
	    end: undefined,
	    zoom: 0.4,
	    colors: undefined,
	    divider: false,
	    show_probs: false,
	    divider_step: 5,
	    show_divider: false,
	    border: false,
	    settings: false,
	    scroller: true,
	    positionMarker: true
	  },
	
	  loadDefault: function loadDefault(options) {
	    this.data = options.data;
	
	    // never show the alignment coordinates by default as that would get
	    // really confusing.
	    this.display_ali_map = 0;
	
	    this.alphabet = options.data.alphabet || 'dna';
	
	    this.start = options.start;
	    //this.end = options.end || this.data.heightArr.length;
	    this.zoom = parseFloat(options.zoom) || 0.4;
	    this.default_zoom = this.zoom;
	
	    this.column_width = options.column_width;
	    this.height = options.height;
	    this.canvas_width = 5000;
	    this.scale_height_enabled = options.scale_height_enabled;
	
	    // this needs to be set to null here so that we can initialise it after
	    // the render function has fired and the width determined.
	    this.scrollme = null;
	
	    this.previous_target = 0;
	    // keeps track of which canvas elements have been drawn and which ones haven't.
	    this.rendered = [];
	    this.previous_zoom = 0;
	
	    if (this.data.max_height == undefined) {
	      this.data.max_height = this.calcMaxHeight(this.data.heightArr);
	    }
	
	    // only show insert when we actually have the data
	    if (!this.data.insert_probs || !this.data.delete_probs) {
	      this.options.show_probs = false;
	    }
	
	    if (options.scaled_max) {
	      this.data.max_height = options.data.max_height_obs || this.data.max_height || 2;
	    } else {
	      this.data.max_height = options.data.max_height_theory || this.data.max_height || 2;
	    }
	
	    if (options.colors) {
	      this.changeColors(options.colors);
	    } else {
	      if (this.alphabet === 'aa') {
	        this.aa_colors = __webpack_require__(107);
	        this.changeColors(this.aa_colors);
	      } else {
	        this.dna_colors = __webpack_require__(108);
	        this.changeColors(this.dna_colors);
	      }
	    }
	  },
	  initialize: function initialize(options) {
	    if (!canvasSupport()) {
	      this.el.textContent = "Your browser doesn't support canvas.";
	      return;
	    }
	    if (options.data == undefined) {
	      this.el.textContent = "No data added.";
	    }
	
	    // load default settings
	    _.extend(this.options, options);
	    var opt = this.options;
	    this.loadDefault(opt);
	
	    if (!this.options.show_probs) {
	      this.info_content_height = this.height;
	    } else {
	      // turn off the insert rows if the hmm used the observed or weighted processing flags.
	      if (this.data.processing && /^observed|weighted/.test(this.data.processing)) {
	        this.show_inserts = 0;
	        this.info_content_height = this.height - 14;
	      } else {
	        this.show_inserts = 1;
	        this.info_content_height = this.height - 44;
	      }
	    }
	    this.$el = jbone(this.el);
	
	    this.initDivs();
	
	    if (this.options.settings) {
	      var form = settings(this, opt);
	      this.$el.append(form);
	    }
	
	    eventListener(this.$el, this, this.logo_graphic);
	    /*
	       if (opt.columnInfo) {
	       var columnInfo = require("./info/column_info.js");
	       columnInfo(this);
	       }
	       */
	  },
	  initDivs: function initDivs() {
	    var logo_graphic = mk("div");
	    logo_graphic.className = "logo_graphic";
	    this.logo_graphic = jbone(logo_graphic);
	
	    var container = mk("div");
	    container.className = "logo_container";
	    container.style.height = this.height;
	    this.container = jbone(container);
	
	    this.container.append(logo_graphic);
	
	    // add some internal divs for scrolling etc.
	    this.$el.append(container);
	
	    if (this.options.divider) {
	      var divider = mk("div");
	      divider.className = "logo_divider";
	      this.$el.append(divider);
	    }
	
	    this.dom_element = jbone(logo_graphic);
	    this.called_on = this.$el;
	
	    if (this.options.xaxis) {
	      axis.render_x_axis_label.call(this);
	    }
	    if (this.options.yaxis) {
	      axis.render_y_axis_label.call(this);
	    } else {
	      this.container[0].style.marginLeft = "0px";
	    }
	  },
	
	  render: function render() {
	    _render.call(this);
	    return this;
	  },
	
	  changeColors: function changeColors(colors) {
	    this.colors = colors;
	    var bUseColorObject = colors != undefined && colors.type != undefined;
	    if (bUseColorObject) {
	      this.colorscheme = "dynamic";
	    }
	    this.buildAlphabet();
	  },
	
	  buildAlphabet: function buildAlphabet() {
	    /*
	       if (this.alphabet === 'aa') {
	       var probs_arr = this.data.probs_arr;
	       if (probs_arr) {
	       var cc = new ConsensusColors();
	       this.cmap = cc.color_map(probs_arr);
	       }
	       }
	       */
	
	    //build the letter canvases
	    this.letters = {};
	    var colors = this.colors;
	    if (this.colorscheme == "dynamic") {
	      var tColors = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
	      colors = {};
	      tColors.forEach(function (e) {
	        colors[e] = "";
	      });
	    }
	    for (var letter in colors) {
	      if (colors.hasOwnProperty(letter)) {
	        var loptions = { color: colors[letter] };
	        this.letters[letter] = new Letter(letter, loptions);
	      }
	    }
	  },
	
	  toggleColorscheme: function toggleColorscheme(scheme) {
	    // work out the current column we are on so we can return there
	    var col_total = this.currentColumn();
	
	    if (scheme) {
	      if (scheme === 'default') {
	        this.colorscheme = 'default';
	      } else {
	        this.colorscheme = 'consensus';
	      }
	    } else {
	      if (this.colorscheme === 'default') {
	        this.colorscheme = 'consensus';
	      } else {
	        this.colorscheme = 'default';
	      }
	    }
	
	    // reset the rendered counter so that each section will re-render
	    // with the new heights
	    this.rendered = [];
	
	    // re-flow and re-render the content
	    this.scrollme.reflow();
	    //scroll off by one to force a render of the canvas.
	    this.scrollToColumn(col_total + 1);
	    //scroll back to the location we started at.
	    this.scrollToColumn(col_total);
	  },
	
	  toggleScale: function toggleScale(scale) {
	    // work out the current column we are on so we can return there
	    var col_total = this.currentColumn();
	
	    if (scale) {
	      if (scale === 'obs') {
	        this.data.max_height = this.data.max_height_obs;
	      } else {
	        this.data.max_height = this.data.max_height_theory;
	      }
	    } else {
	      // toggle the max height
	      if (this.data.max_height === this.data.max_height_obs) {
	        this.data.max_height = this.data.max_height_theory;
	      } else {
	        this.data.max_height = this.data.max_height_obs;
	      }
	    }
	    // reset the rendered counter so that each section will re-render
	    // with the new heights
	    this.rendered = [];
	    //update the y-axis
	    if (this.logoYAxis) {
	      this.logoYAxis.remove();
	      //this.called_on.find('.logo_yaxis').remove();
	    }
	    axis.render_y_axis_label.call(this);
	
	    // re-flow and re-render the content
	    this.scrollme.reflow();
	    //scroll off by one to force a render of the canvas.
	    this.scrollToColumn(col_total + 1);
	    //scroll back to the location we started at.
	    this.scrollToColumn(col_total);
	  },
	  toggleAliMap: function toggleAliMap(coords) {
	    // work out the current column we are on so we can return there
	    var col_total = this.currentColumn();
	
	    if (coords) {
	      if (coords === 'model') {
	        this.display_ali_map = 0;
	      } else {
	        this.display_ali_map = 1;
	      }
	    } else {
	      // toggle the max height
	      if (this.display_ali_map === 1) {
	        this.display_ali_map = 0;
	      } else {
	        this.display_ali_map = 1;
	      }
	    }
	    axis.render_x_axis_label(this);
	
	    // reset the rendered counter so that each section will re-render
	    // with the new heights
	    this.rendered = [];
	
	    // re-flow and re-render the content
	    this.scrollme.reflow();
	    //scroll off by one to force a render of the canvas.
	    this.scrollToColumn(col_total + 1);
	    //scroll back to the location we started at.
	    this.scrollToColumn(col_total);
	  },
	
	  currentColumn: function currentColumn() {
	    var before_left = this.scrollme.scroller.getValues().left,
	        col_width = this.column_width * this.zoom,
	        col_count = before_left / col_width,
	        half_visible_columns = this.container.width() / col_width / 2,
	        col_total = Math.ceil(col_count + half_visible_columns);
	    return col_total;
	  },
	
	  changeZoom: function changeZoom(options) {
	    var zoom_level = 0.3,
	        expected_width = null;
	    if (options.target) {
	      zoom_level = options.target;
	    } else if (options.distance) {
	      zoom_level = (parseFloat(this.zoom) - parseFloat(options.distance)).toFixed(1);
	      if (options.direction === '+') {
	        zoom_level = (parseFloat(this.zoom) + parseFloat(options.distance)).toFixed(1);
	      }
	    }
	
	    if (zoom_level > 1) {
	      zoom_level = 1;
	    } else if (zoom_level < 0.1) {
	      zoom_level = 0.1;
	    }
	
	    // see if we need to zoom or not
	    expected_width = this.logo_graphic.width() * zoom_level / this.zoom;
	    if (expected_width > this.container.width()) {
	      // if a center is not specified, then use the current center of the view
	      if (!options.column) {
	        //work out my current position
	        var col_total = this.currentColumn();
	
	        this.zoom = zoom_level;
	        this.render({ zoom: this.zoom });
	        this.scrollme.reflow();
	
	        //scroll to previous position
	        this.scrollToColumn(col_total);
	      } else {
	        // center around the mouse click position.
	        this.zoom = zoom_level;
	        this.render({ zoom: this.zoom });
	        this.scrollme.reflow();
	
	        var coords = this.coordinatesFromColumn(options.column);
	        this.scrollme.scroller.scrollTo(coords - options.offset);
	      }
	    }
	    return this.zoom;
	  },
	
	  columnFromCoordinates: function columnFromCoordinates(x) {
	    var column = Math.ceil(x / (this.column_width * this.zoom));
	    return column;
	  },
	
	  coordinatesFromColumn: function coordinatesFromColumn(col) {
	    var new_column = col - 1,
	        x = new_column * (this.column_width * this.zoom) + this.column_width * this.zoom / 2;
	    return x;
	  },
	
	  scrollToColumn: function scrollToColumn(num, animate) {
	    var half_view = this.logo_container.width() / 2,
	        new_left = this.coordinatesFromColumn(num);
	    this.scrollme.scroller.scrollTo(new_left - half_view, 0, animate);
	  },
	  calcMaxHeight: function calcMaxHeight(columns) {
	    // loops over all columns and return the max height seen 
	    return columns.reduce(function (m, c) {
	      var col = 0;
	      for (var k in c) {
	        col += c[k];
	      }
	      return col > m ? col : m;
	    }, 0);
	  }
	
	});
	
	var mk = function mk(name) {
	  return document.createElement(name);
	};

/***/ },
/* 96 */
/***/ function(module, exports) {

	'use strict';
	
	var canv_support = null;
	
	module.exports = function canvasSupport() {
	  if (!canv_support) {
	    var elem = document.createElement('canvas');
	    canv_support = !!(elem.getContext && elem.getContext('2d'));
	  }
	  return canv_support;
	};

/***/ },
/* 97 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var renderWithText = __webpack_require__(98);
	var renderWithRect = __webpack_require__(102);
	var jbone = __webpack_require__(15);
	
	// the main render function that draws the logo based on the provided options.
	module.exports = function (options) {
	  if (!this.data) {
	    return;
	  }
	  options = options || {};
	  var zoom = options.zoom || this.zoom,
	      target = options.target || 1,
	      scaled = options.scaled || null;
	  var parent_width = this.dom_element.parent().attr('width'),
	      max_canvas_width = 1,
	      end = null,
	      start = null,
	      i = 0;
	
	  /*
	  if (target === this.previous_target) {
	    return;
	  }
	  */
	
	  this.previous_target = target;
	
	  if (options.start) {
	    this.start = options.start;
	  }
	  if (options.end) {
	    this.end = options.end;
	  }
	
	  if (zoom <= 0.1) {
	    zoom = 0.1;
	  } else if (zoom >= 1) {
	    zoom = 1;
	  }
	
	  this.zoom = zoom;
	
	  end = this.end || this.data.heightArr.length;
	  start = this.start || 1;
	  end = end > this.data.heightArr.length ? this.data.heightArr.length : end;
	  end = end < start ? start : end;
	
	  start = start > end ? end : start;
	  start = start > 1 ? start : 1;
	
	  this.y = this.height - 20;
	  // Check to see if the logo will fit on the screen at full zoom.
	  this.max_width = this.column_width * (end - start + 1);
	  // If it fits then zoom out and disable zooming.
	  if (parent_width > this.max_width) {
	    zoom = 1;
	    this.zoom_enabled = false;
	  }
	  this.zoom = zoom;
	
	  this.zoomed_column = this.column_width * zoom;
	  this.total_width = this.zoomed_column * (end - start + 1);
	
	  // If zoom is not maxed and we still aren't filling the window
	  // then ramp up the zoom level until it fits, then disable zooming.
	  // Then we get a decent logo with out needing to zoom in or out.
	  if (zoom < 1) {
	    while (this.total_width < parent_width) {
	      this.zoom += 0.1;
	      this.zoomed_column = this.column_width * this.zoom;
	      this.total_width = this.zoomed_column * (end - start + 1);
	      this.zoom_enabled = false;
	      if (zoom >= 1) {
	        break;
	      }
	    }
	  }
	
	  if (target > this.total_width) {
	    target = this.total_width;
	  }
	  this.dom_element.attr({ 'width': this.total_width + 'px' }).css({ width: this.total_width + 'px' });
	
	  this.canvas_width = this.total_width;
	  var canvas_count = Math.ceil(this.total_width / this.canvas_width);
	  this.columns_per_canvas = Math.ceil(this.canvas_width / this.zoomed_column);
	
	  if (this.previous_zoom !== this.zoom) {
	    this.dom_element.find('canvas').remove();
	    this.previous_zoom = this.zoom;
	    this.rendered = [];
	  }
	
	  this.canvases = [];
	  this.contexts = [];
	
	  for (i = 0; i < canvas_count; i++) {
	
	    var split_start = this.columns_per_canvas * i + start,
	        split_end = split_start + this.columns_per_canvas - 1;
	    if (split_end > end) {
	      split_end = end;
	    }
	
	    var adjusted_width = (split_end - split_start + 1) * this.zoomed_column;
	
	    if (adjusted_width > max_canvas_width) {
	      max_canvas_width = adjusted_width;
	    }
	
	    var canv_start = max_canvas_width * i,
	        canv_end = canv_start + adjusted_width;
	
	    if (target < canv_end + canv_end / 2 && target > canv_start - canv_start / 2) {
	      // Check that we aren't redrawing the canvas and if not, then attach it and draw.
	      //if (this.rendered[i] !== 1) {
	
	      this.canvases[i] = attach_canvas(this.dom_element, this.height, adjusted_width, i, max_canvas_width);
	      this.contexts[i] = this.canvases[i].getContext('2d');
	      this.contexts[i].setTransform(1, 0, 0, 1, 0, 0);
	      this.contexts[i].clearRect(0, 0, adjusted_width, this.height);
	      this.contexts[i].fillStyle = "#ffffff";
	      this.contexts[i].fillRect(0, 0, canv_end, this.height);
	
	      if (this.zoomed_column > 12) {
	        var fontsize = parseInt(10 * zoom, 10);
	        fontsize = fontsize > 10 ? 10 : fontsize;
	        if (this.debug) {
	          renderWithRect.call(this, split_start, split_end, i, 1);
	        }
	        renderWithText.call(this, split_start, split_end, i, fontsize);
	      } else {
	        renderWithRect.call(this, split_start, split_end, i);
	      }
	      //this.rendered[i] = 1;
	      //}
	    }
	  }
	
	  // check if the scroller object has been initialised and if not then do so.
	  // we do this here as opposed to at object creation, because we need to
	  // make sure the logo has been rendered and the width is correct, otherwise
	  // we get a weird initial state where the canvas will bounce back to the
	  // beginning the first time it is scrolled, because it thinks it has a
	  // width of 0.
	  if (!this.scrollme && this.options.scroller) {
	    this.scrollme = new EasyScroller(this.dom_element[0], {
	      scrollingX: 1,
	      scrollingY: 0,
	      eventTarget: this.called_on
	    });
	  }
	
	  if (target !== 1) {
	    this.scrollme.reflow();
	  }
	  return;
	};
	
	function attach_canvas(DOMid, height, width, id, canv_width) {
	  var canvas = jbone(DOMid).find('#canv_' + id);
	
	  if (!canvas.length) {
	    jbone(DOMid).append('<canvas class="canvas_logo" id="canv_' + id + '"  height="' + height + '" width="' + width + '" style="left:' + canv_width * id + 'px"></canvas>');
	    canvas = jbone(DOMid).find('#canv_' + id);
	  }
	
	  jbone(canvas).attr('width', width).attr('height', height);
	
	  return canvas[0];
	}

/***/ },
/* 98 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var draw_border = __webpack_require__(99);
	var draw_ticks = __webpack_require__(100);
	var draw_column_number = __webpack_require__(101);
	
	module.exports = function (start, end, context_num, fontsize) {
	  var x = 0,
	      column_num = start,
	      column_label = null,
	      i = 0,
	      top_height = Math.abs(this.data.max_height),
	      bottom_height = isNaN(this.data.min_height_obs) ? 0 : parseInt(this.data.min_height_obs, 10),
	      total_height = top_height + Math.abs(bottom_height),
	      top_percentage = Math.round(Math.abs(this.data.max_height) * 100 / total_height),
	
	  //convert % to pixels
	  top_pix_height = Math.round(this.info_content_height * top_percentage / 100),
	      bottom_pix_height = this.info_content_height - top_pix_height,
	
	  // this is used to transform the 256px high letters into the correct size
	  // when displaying negative values, so that they fit above the 0 line.
	  top_pix_conversion = top_pix_height / this.info_content_height,
	      bottom_pix_conversion = bottom_pix_height / this.info_content_height;
	
	  // add 3 extra columns so that numbers don't get clipped at the end of a canvas
	  // that ends before a large column. DF0000830 was suffering at zoom level 0.6,
	  // column 2215. This adds a little extra overhead, but is the easiest fix for now.
	  if (end + 3 <= this.end) {
	    end += 3;
	  }
	
	  for (i = start; i <= end; i++) {
	    if (this.data.mmline && this.data.mmline[i - 1] === 1) {
	      this.contexts[context_num].fillStyle = '#cccccc';
	      this.contexts[context_num].fillRect(x, 10, this.zoomed_column, this.height - 40);
	    } else {
	      var column = this.data.heightArr[i - 1],
	          col_positions = [];
	      if (column) {
	        var previous_height = 0,
	            letters = column.length,
	            previous_neg_height = top_pix_height,
	            j = 0,
	            color = null;
	
	        for (var j in column) {
	          var letter = column[j],
	              values = [j, letter];
	          var x_pos = x + this.zoomed_column / 2,
	              letter_height = null;
	
	          // we don't render anything with a value between 0 and 0.01. These
	          // letters would be too small to be meaningful on any scale, so we
	          // just squash them out.
	          if (values[1] > 0.01) {
	            letter_height = parseFloat(values[1]) / this.data.max_height;
	            var y_pos = this.info_content_height - 2 - previous_height,
	                glyph_height = (this.info_content_height - 2) * letter_height;
	
	            col_positions[j] = [glyph_height, this.zoomed_column, x_pos, y_pos];
	            previous_height = previous_height + glyph_height;
	          }
	        }
	
	        // render the letters in reverse order so that the larger letters on the top
	        // don't clobber the smaller letters below them.
	        //for (j = letters; j >= 0; j--) {
	        for (var j in column) {
	          if (col_positions[j] && this.letters[j]) {
	
	            if (this.colorscheme === 'dynamic') {
	              color = this.colors.getColor(j, { pos: i - 1 });
	            } else {
	              if (this.colorscheme === 'consensus') {
	                color = this.cmap[i - 1][j] || "#7a7a7a";
	              } else {
	                color = null;
	              }
	            }
	            this.letters[j].draw(this.contexts[context_num], col_positions[j][0], col_positions[j][1], col_positions[j][2], col_positions[j][3], color);
	          }
	        }
	      }
	    }
	
	    // if ali_coordinates exist and toggle is set then display the
	    // alignment coordinates and not the model coordinates.
	    if (this.display_ali_map) {
	      column_label = this.data.ali_map[i - 1];
	    } else {
	      column_label = column_num;
	    }
	
	    if (this.options.show_divider) {
	      if (this.zoom < 0.7) {
	        if (i % this.options.divider_step === 0) {
	          draw_column_divider(this, {
	            context_num: context_num,
	            x: x,
	            fontsize: 10,
	            column_num: column_label,
	            ralign: true
	          });
	        }
	      } else {
	        draw_column_divider(this, {
	          context_num: context_num,
	          x: x,
	          fontsize: fontsize,
	          column_num: column_label
	        });
	      }
	    }
	
	    if (this.options.show_probs) {
	      draw_delete_odds(this.contexts[context_num], x, this.height, this.zoomed_column, this.data.delete_probs[i - 1], fontsize, this.show_inserts);
	      //draw insert length ticks
	      draw_ticks(this.contexts[context_num], x, this.height - 15, 5);
	      if (this.show_inserts) {
	        draw_insert_odds(this.contexts[context_num], x, this.height, this.zoomed_column, this.data.insert_probs[i - 1], fontsize);
	        draw_insert_length(this.contexts[context_num], x, this.height - 5, this.zoomed_column, this.data.insert_lengths[i - 1], fontsize);
	
	        // draw delete probability ticks
	        draw_ticks(this.contexts[context_num], x, this.height - 45, 5);
	        // draw insert probability ticks
	        draw_ticks(this.contexts[context_num], x, this.height - 30, 5);
	      }
	    }
	
	    x += this.zoomed_column;
	    column_num++;
	  }
	
	  if (this.options.show_probs) {
	    // draw other dividers
	    if (this.show_inserts) {
	      draw_border(this.contexts[context_num], this.height - 30, this.total_width);
	      draw_border(this.contexts[context_num], this.height - 45, this.total_width);
	    }
	    draw_border(this.contexts[context_num], this.height - 15, this.total_width);
	  }
	  if (this.options.border) {
	    draw_border(this.contexts[context_num], 0, this.total_width);
	  }
	};
	
	function draw_delete_odds(context, x, height, col_width, text, fontsize, show_inserts) {
	  var y = height - 4,
	      fill = '#ffffff',
	      textfill = '#555555';
	
	  if (show_inserts) {
	    y = height - 35;
	  }
	
	  if (text < 0.75) {
	    fill = '#2171b5';
	    textfill = '#ffffff';
	  } else if (text < 0.85) {
	    fill = '#6baed6';
	  } else if (text < 0.95) {
	    fill = '#bdd7e7';
	  }
	
	  draw_rect_with_text(context, x, y, text, fontsize, col_width, fill, textfill);
	}
	
	function draw_rect_with_text(context, x, y, text, fontsize, col_width, fill, textfill) {
	  context.font = fontsize + "px Arial";
	  context.fillStyle = fill;
	  context.fillRect(x, y - 10, col_width, 14);
	  context.textAlign = "center";
	  context.fillStyle = textfill;
	  context.fillText(text, x + col_width / 2, y);
	}
	
	function draw_column_divider(inst, opts) {
	  var div_x = opts.ralign ? opts.x + inst.zoomed_column : opts.x,
	      num_x = opts.ralign ? opts.x + 2 : opts.x;
	  // draw column dividers
	  draw_ticks(inst.contexts[opts.context_num], div_x, inst.height - 30, -30 - inst.height, '#dddddd');
	  // draw top ticks
	  draw_ticks(inst.contexts[opts.context_num], div_x, 0, 5);
	  // draw column numbers
	  draw_column_number(inst.contexts[opts.context_num], num_x, 10, inst.zoomed_column, opts.column_num, opts.fontsize, opts.ralign);
	};
	
	function draw_insert_odds(context, x, height, col_width, text, fontsize) {
	  var y = height - 20,
	      fill = '#ffffff',
	      textfill = '#555555';
	
	  if (text > 0.1) {
	    fill = '#d7301f';
	    textfill = '#ffffff';
	  } else if (text > 0.05) {
	    fill = '#fc8d59';
	  } else if (text > 0.03) {
	    fill = '#fdcc8a';
	  }
	
	  draw_rect_with_text(context, x, y, text, fontsize, col_width, fill, textfill);
	
	  //draw vertical line to indicate where the insert would occur
	  if (text > 0.03) {
	    draw_ticks(context, x + col_width, height - 30, -30 - height, fill);
	  }
	}
	function draw_insert_length(context, x, y, col_width, text, fontsize) {
	  var fill = '#ffffff',
	      textfill = '#555555';
	
	  if (text > 9) {
	    fill = '#d7301f';
	    textfill = '#ffffff';
	  } else if (text > 7) {
	    fill = '#fc8d59';
	  } else if (text > 4) {
	    fill = '#fdcc8a';
	  }
	  draw_rect_with_text(context, x, y, text, fontsize, col_width, fill, textfill);
	}

/***/ },
/* 99 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = function draw_border(context, y, width) {
	  context.beginPath();
	  context.moveTo(0, y);
	  context.lineTo(width, y);
	  context.lineWidth = 1;
	  context.strokeStyle = "#999999";
	  context.stroke();
	};

/***/ },
/* 100 */
/***/ function(module, exports) {

	'use strict';
	
	module.exports = function draw_ticks(context, x, y, height, color) {
	  color = color || '#999999';
	  context.beginPath();
	  context.moveTo(x, y);
	  context.lineTo(x, y + height);
	  context.lineWidth = 1;
	  context.strokeStyle = color;
	  context.stroke();
	};

/***/ },
/* 101 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = function draw_column_number(context, x, y, col_width, col_num, fontsize, right) {
	  context.font = fontsize + "px Arial";
	  context.textAlign = right ? "right" : "center";
	  context.fillStyle = "#666666";
	  context.fillText(col_num, x + col_width / 2, y);
	};

/***/ },
/* 102 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var draw_border = __webpack_require__(99);
	var draw_ticks = __webpack_require__(100);
	var draw_column_number = __webpack_require__(101);
	
	module.exports = function (start, end, context_num, borders) {
	  var x = 0,
	      column_num = start,
	      column_label = null,
	      i = 0,
	      top_height = Math.abs(this.data.max_height),
	      bottom_height = Math.abs(this.data.min_height_obs),
	      total_height = top_height + bottom_height,
	      top_percentage = Math.round(Math.abs(this.data.max_height) * 100 / total_height),
	
	  //convert % to pixels
	  top_pix_height = Math.round(this.info_content_height * top_percentage / 100),
	      bottom_pix_height = this.info_content_height - top_pix_height,
	      mod = 10;
	
	  for (i = start; i <= end; i++) {
	    if (this.data.mmline && this.data.mmline[i - 1] === 1) {
	      this.contexts[context_num].fillStyle = '#cccccc';
	      this.contexts[context_num].fillRect(x, 10, this.zoomed_column, this.height - 40);
	    } else {
	      var column = this.data.heightArr[i - 1],
	          previous_height = 0,
	          previous_neg_height = top_pix_height,
	          letters = column.length,
	          j = 0;
	      for (var j in column) {
	        var values = [j, column[j]];
	        if (values[1] > 0.01) {
	          var letter_height = parseFloat(values[1]) / this.data.max_height,
	              x_pos = x,
	              glyph_height = (this.info_content_height - 2) * letter_height,
	              y_pos = this.info_content_height - 2 - previous_height - glyph_height,
	              color = null;
	
	          if (this.colorscheme === 'dynamic') {
	            color = this.colors.getColor(values[0], { pos: i - 1 });
	          } else {
	            if (this.colorscheme === 'consensus') {
	              color = this.cmap[i - 1][values[0]] || "#7a7a7a";
	            } else {
	              color = this.colors[values[0]];
	            }
	          }
	
	          if (borders) {
	            this.contexts[context_num].strokeStyle = color;
	            this.contexts[context_num].strokeRect(x_pos, y_pos, this.zoomed_column, glyph_height);
	          } else {
	            this.contexts[context_num].fillStyle = color;
	            this.contexts[context_num].fillRect(x_pos, y_pos, this.zoomed_column, glyph_height);
	          }
	
	          previous_height = previous_height + glyph_height;
	        }
	      }
	    }
	
	    if (this.zoom < 0.2) {
	      mod = 20;
	    } else if (this.zoom < 0.3) {
	      mod = 10;
	    }
	
	    if (this.options.positionMarker) {
	      if (i % mod === 0) {
	        // draw column dividers
	        if (this.options.show_probs) {
	          draw_ticks(this.contexts[context_num], x + this.zoomed_column, this.height - 30, parseFloat(this.height), '#dddddd');
	        }
	        // draw top ticks
	        draw_ticks(this.contexts[context_num], x + this.zoomed_column, 0, 5);
	
	        // if ali_coordinates exist and toggle is set then display the
	        // alignment coordinates and not the model coordinates.
	        if (this.display_ali_map) {
	          column_label = this.data.ali_map[i - 1];
	        } else {
	          column_label = column_num;
	        }
	        // draw column numbers
	        draw_column_number(this.contexts[context_num], x - 2, 10, this.zoomed_column, column_label, 10, true);
	      }
	    }
	
	    // draw insert probabilities/lengths
	    if (this.options.show_probs) {
	      draw_small_insert(this.contexts[context_num], x, this.height - 42, this.zoomed_column, this.data.insert_probs[i - 1], this.data.insert_lengths[i - 1], this.data.delete_probs[i - 1], this.show_inserts);
	    }
	
	    if (this.options.show_probs) {
	      // draw other dividers
	      if (this.show_inserts) {
	        draw_border(this.contexts[context_num], this.height - 45, this.total_width);
	      } else {
	        draw_border(this.contexts[context_num], this.height - 15, this.total_width);
	      }
	    }
	
	    if (this.options.border) {
	      draw_border(this.contexts[context_num], 0, this.total_width);
	    }
	
	    x += this.zoomed_column;
	    column_num++;
	  }
	};
	
	function draw_small_insert(context, x, y, col_width, in_odds, in_length, del_odds, show_inserts) {
	  var fill = "#ffffff";
	  if (show_inserts) {
	    if (in_odds > 0.1) {
	      fill = '#d7301f';
	    } else if (in_odds > 0.05) {
	      fill = '#fc8d59';
	    } else if (in_odds > 0.03) {
	      fill = '#fdcc8a';
	    }
	    context.fillStyle = fill;
	    context.fillRect(x, y + 15, col_width, 10);
	
	    fill = "#ffffff";
	    // draw insert length
	    if (in_length > 9) {
	      fill = '#d7301f';
	    } else if (in_length > 7) {
	      fill = '#fc8d59';
	    } else if (in_length > 4) {
	      fill = '#fdcc8a';
	    }
	    context.fillStyle = fill;
	    context.fillRect(x, y + 30, col_width, 10);
	  } else {
	    y = y + 30;
	  }
	
	  fill = "#ffffff";
	  // draw delete odds
	  if (del_odds < 0.75) {
	    fill = '#2171b5';
	  } else if (del_odds < 0.85) {
	    fill = '#6baed6';
	  } else if (del_odds < 0.95) {
	    fill = '#bdd7e7';
	  }
	  context.fillStyle = fill;
	  context.fillRect(x, y, col_width, 10);
	}

/***/ },
/* 103 */
/***/ function(module, exports) {

	'use strict';
	
	module.exports = function Letter(letter, options) {
	  options = options || {};
	  this.value = letter;
	  this.width = parseInt(options.width, 10) || 100;
	
	  //W is 30% wider than the other letters, so need to make sure
	  //it gets modified accordingly.
	  if (this.value === 'W') {
	    this.width += this.width * 30 / 100;
	  }
	
	  this.height = parseInt(options.height, 10) || 100;
	
	  this.color = options.color || '#000000';
	  // if the height and width are changed from the default, then
	  // this will also need to be changed as it cant be calculated
	  // dynamically.
	  this.fontSize = options.fontSize || 138;
	
	  this.scaled = function () {};
	
	  this.draw = function (ext_ctx, target_height, target_width, x, y, color) {
	    var h_ratio = target_height / this.height,
	        w_ratio = target_width / this.width,
	        prev_font = ext_ctx.font;
	    ext_ctx.transform(w_ratio, 0, 0, h_ratio, x, y);
	    ext_ctx.fillStyle = color || this.color;
	    ext_ctx.textAlign = "center";
	    ext_ctx.font = "bold " + this.fontSize + "px Arial";
	
	    ext_ctx.fillText(this.value, 0, 0);
	    //restore the canvas settings
	    ext_ctx.setTransform(1, 0, 0, 1, 0, 0);
	    ext_ctx.fillStyle = '#000000';
	    ext_ctx.font = prev_font;
	  };
	};

/***/ },
/* 104 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = {
	  render_x_axis_label: function render_x_axis_label() {
	    var label = "Model Position";
	    if (this.display_ali_map) {
	      label = "Alignment Column";
	    }
	    this.called_on.find('.logo_xaxis').remove();
	    this.called_on.prepend('<div class="logo_xaxis" class="centered" style="margin-left:40px"><p class="xaxis_text" style="width:10em;margin:1em auto">' + label + '</p></div>');
	  },
	  render_y_axis_label: function render_y_axis_label() {
	    //attach a canvas for the y-axis
	    this.dom_element.parent().before('<canvas class="logo_yaxis" height="' + this.options.height + '" width="55"></canvas>');
	    var canvas = this.called_on.find('.logo_yaxis'),
	        top_pix_height = 0,
	        bottom_pix_height = 0,
	        top_height = Math.abs(this.data.max_height),
	        bottom_height = isNaN(this.data.min_height_obs) ? 0 : parseInt(this.data.min_height_obs, 10),
	        context = null,
	        axis_label = "Information Content (bits)";
	
	    context = canvas[0].getContext('2d');
	    //draw min/max tick marks
	    context.beginPath();
	    context.moveTo(55, 1);
	    context.lineTo(40, 1);
	
	    context.moveTo(55, this.info_content_height);
	    context.lineTo(40, this.info_content_height);
	
	    context.moveTo(55, this.info_content_height / 2);
	    context.lineTo(40, this.info_content_height / 2);
	    context.lineWidth = 1;
	    context.strokeStyle = "#666666";
	    context.stroke();
	
	    //draw the label text
	    context.fillStyle = "#666666";
	    context.textAlign = "right";
	    context.font = "bold 10px Arial";
	
	    // draw the max label
	    context.textBaseline = "top";
	    context.fillText(parseFloat(this.data.max_height).toFixed(1), 38, 0);
	    context.textBaseline = "middle";
	
	    // draw the midpoint labels
	    context.fillText(parseFloat(this.data.max_height / 2).toFixed(1), 38, this.info_content_height / 2);
	    // draw the min label
	    context.fillText('0', 38, this.info_content_height);
	
	    // draw the axis label
	    if (this.data.height_calc === 'score') {
	      axis_label = "Score (bits)";
	    }
	
	    context.save();
	    context.translate(5, this.height / 2 - 20);
	    context.rotate(-Math.PI / 2);
	    context.textAlign = "center";
	    context.font = "normal 12px Arial";
	    context.fillText(axis_label, 1, 0);
	    context.restore();
	
	    // draw the insert row labels
	    context.fillText('occupancy', 55, this.info_content_height + 7);
	    if (this.show_inserts) {
	      context.fillText('ins. prob.', 50, 280);
	      context.fillText('ins. len.', 46, 296);
	    }
	  }
	};

/***/ },
/* 105 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var $ = __webpack_require__(15);
	
	module.exports = function ($el, logo, logo_graphic) {
	
	  $el.find('.logo_settings_switch, .logo_settings .close').on('click', function (e) {
	    e.preventDefault();
	    $('.logo_settings').toggle();
	  });
	
	  $el.find('.logo_reset').on('click', function (e) {
	    e.preventDefault();
	    logo.changeZoom({ 'target': logo.default_zoom });
	  });
	
	  $el.find('.logo_change').on('click', function (e) {
	    e.preventDefault();
	  });
	
	  $el.find('.logo_zoomin').on('click', function (e) {
	    e.preventDefault();
	    logo.changeZoom({ 'distance': 0.1, 'direction': '+' });
	  });
	
	  $el.find('.logo_zoomout').on('click', function (e) {
	    e.preventDefault();
	    logo.changeZoom({ 'distance': 0.1, 'direction': '-' });
	  });
	
	  $el.find('.logo_scale').on('change', function (e) {
	    logo.toggleScale(this.value);
	  });
	
	  $el.find('.logo_color').on('change', function (e) {
	    logo.toggleColorscheme(this.value);
	  });
	
	  $el.find('.logo_ali_map').on('change', function (e) {
	    logo.toggleAliMap(this.value);
	  });
	
	  $el.find('.logo_position').on('change', function () {
	    if (!this.value.match(/^\d+$/m)) {
	      return;
	    }
	    logo.scrollToColumn(this.value, 1);
	  });
	
	  logo_graphic.on('dblclick', function (e) {
	    // need to get coordinates of mouse click
	    console.log("dblclick", logo);
	
	    offset = logo.logo_graphic.offset(), x = parseInt(e.pageX - offset.left, 10),
	
	    // get mouse position in the window
	    window_position = e.pageX - $el.parent().offset().left,
	
	    // get column number
	    col = logo.columnFromCoordinates(x), console.log("col", col);
	
	    // choose new zoom level and zoom in.
	    current = logo.zoom;
	
	    if (current < 1) {
	      logo.changeZoom({ 'target': 1, offset: window_position, column: col });
	    } else {
	      logo.changeZoom({ 'target': 0.3, offset: window_position, column: col });
	    }
	
	    return;
	  });
	
	  $(document).on($el.attr('id') + ".scrolledTo", function (e, left, top, zoom) {
	    logo.render({ target: left });
	  });
	
	  $(document).on('keydown', function (e) {
	    if (!e.ctrlKey) {
	      if (e.which === 61 || e.which === 107) {
	        zoom += 0.1;
	        logo.changeZoom({ 'distance': 0.1, 'direction': '+' });
	      }
	      if (e.which === 109 || e.which === 0) {
	        zoom = zoom - 0.1;
	        logo.changeZoom({ 'distance': 0.1, 'direction': '-' });
	      }
	    }
	  });
	};

/***/ },
/* 106 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var $ = __webpack_require__(15);
	
	module.exports = function (logo, options) {
	  var form = $('<form class="logo_form"><fieldset><label for="position">Column number</label>' + '<input type="text" name="position" class="logo_position"></input>' + '<button class="button logo_change">Go</button></fieldset>' + '</form>');
	
	  var settings = $('<div class="logo_settings"></div>');
	  settings.append('<span class="close">x</span>');
	
	  /* we don't want to toggle if the max height_obs is greater than max theoretical
	   * as letters will fall off the top.
	   */
	  if (logo.scale_height_enabled && logo.data.max_height_obs < logo.data.max_height_theory) {
	    var obs_checked = '',
	        theory_checked = '',
	        theory_help = '',
	        obs_help = '';
	
	    if (logo.data.max_height_obs === logo.data.max_height) {
	      obs_checked = 'checked';
	    } else {
	      theory_checked = 'checked';
	    }
	  }
	
	  var scale_controls = '<fieldset><legend>Scale</legend>' + '<label><input type="radio" name="scale" class="logo_scale" value="obs" ' + obs_checked + '/>Maximum Observed ' + obs_help + '</label></br>' + '<label><input type="radio" name="scale" class="logo_scale" value="theory" ' + theory_checked + '/>Maximum Theoretical ' + theory_help + '</label>' + '</fieldset>';
	
	  settings.append(scale_controls);
	
	  if (logo.data.height_calc !== 'score' && logo.data.alphabet === 'aa' && logo.data.probs_arr) {
	
	    var def_color = null,
	        con_color = null,
	        def_help = '',
	        con_help = '';
	
	    if (logo.colorscheme === 'default') {
	      def_color = 'checked';
	    } else {
	      con_color = 'checked';
	    };
	
	    if (options.help) {
	      def_help = '<a class="help" href="/help#colors_default" title="Each letter receives its own color.">' + '<span aria-hidden="true" data-icon="?"></span><span class="reader-text">help</span></a>';
	      con_help = '<a class="help" href="/help#colors_consensus" title="Letters are colored as in Clustalx and Jalview, with colors depending on composition of the column.">' + '<span aria-hidden="true" data-icon="?"></span><span class="reader-text">help</span></a>';
	    }
	
	    var color_controls = '<fieldset><legend>Color Scheme</legend>' + '<label><input type="radio" name="color" class="logo_color" value="default" ' + def_color + '/>Default ' + def_help + '</label></br>' + '<label><input type="radio" name="color" class="logo_color" value="consensus" ' + con_color + '/>Consensus Colors ' + con_help + '</label>' + '</fieldset>';
	    settings.append(color_controls);
	  }
	
	  if (logo.data.ali_map) {
	    var mod_checked = null,
	        ali_checked = null,
	        mod_help = '',
	        ali_help = '';
	
	    if (logo.display_ali_map === 0) {
	      mod_checked = 'checked';
	    } else {
	      ali_checked = 'checked';
	    }
	
	    if (options.help) {
	      mod_help = '<a class="help" href="/help#coords_model" title="The coordinates along the top of the plot show the model position.">' + '<span aria-hidden="true" data-icon="?"></span><span class="reader-text">help</span></a>';
	      ali_help = '<a class="help" href="/help#coords_ali" title="The coordinates along the top of the plot show the column in the alignment associated with the model">' + '<span aria-hidden="true" data-icon="?"></span><span class="reader-text">help</span></a>';
	    }
	
	    var ali_controls = '<fieldset><legend>Coordinates</legend>' + '<label><input type="radio" name="coords" class="logo_ali_map" value="model" ' + mod_checked + '/>Model ' + mod_help + '</label></br>' + '<label><input type="radio" name="coords" class="logo_ali_map" value="alignment" ' + ali_checked + '/>Alignment ' + ali_help + '</label>' + '</fieldset>';
	    settings.append(ali_controls);
	  }
	
	  var controls = $('<div class="logo_controls"></div>');
	  if (logo.zoom_enabled) {
	    controls.append('<button class="logo_zoomout button">-</button>' + '<button class="logo_zoomin button">+</button>');
	  }
	
	  if (settings.children().length > 0) {
	    controls.append('<button class="logo_settings_switch button">Settings</button>');
	    controls.append(settings);
	  }
	
	  form.append(controls);
	
	  return form;
	};

/***/ },
/* 107 */
/***/ function(module, exports) {

	'use strict';
	
	module.exports = {
	  'A': '#FF9966',
	  'C': '#009999',
	  'D': '#FF0000',
	  'E': '#CC0033',
	  'F': '#00FF00',
	  'G': '#f2f20c',
	  'H': '#660033',
	  'I': '#CC9933',
	  'K': '#663300',
	  'L': '#FF9933',
	  'M': '#CC99CC',
	  'N': '#336666',
	  'P': '#0099FF',
	  'Q': '#6666CC',
	  'R': '#990000',
	  'S': '#0000FF',
	  'T': '#00FFFF',
	  'V': '#FFCC33',
	  'W': '#66CC66',
	  'Y': '#006600'
	};

/***/ },
/* 108 */
/***/ function(module, exports) {

	'use strict';
	
	module.exports = {
	    'A': '#cbf751',
	    'C': '#5ec0cc',
	    'G': '#ffdf59',
	    'T': '#b51f16',
	    'U': '#b51f16'
	};

/***/ },
/* 109 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _svg = __webpack_require__(91);
	
	var svg = _interopRequireWildcard(_svg);
	
	function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }
	
	var view = __webpack_require__(14);
	var dom = __webpack_require__(65);
	
	
	// TODO: merge this with the conservation view
	var ConservationView = view.extend({
	
	  className: "biojs_msa_gapview",
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	    this.listenTo(this.g.zoomer, "change:stepSize change:labelWidth change:columnWidth", this.render);
	    this.listenTo(this.g.vis, "change:labels change:metacell", this.render);
	    this.listenTo(this.g.columns, "change:scaling", this.render);
	    // we need to wait until stats gives us the ok
	    this.listenTo(this.model, "reset", this.render);
	    return this.manageEvents();
	  },
	
	  render: function render() {
	    var gaps = this.g.stats.gaps();
	
	    dom.removeAllChilds(this.el);
	
	    var nMax = this.model.getMaxLength();
	    var cellWidth = this.g.zoomer.get("columnWidth");
	    var maxHeight = 20;
	    var width = cellWidth * (nMax - this.g.columns.get('hidden').length);
	
	    var s = svg.base({ height: maxHeight, width: width });
	    s.style.display = "inline-block";
	    s.style.cursor = "pointer";
	
	    var stepSize = this.g.zoomer.get("stepSize");
	    var hidden = this.g.columns.get("hidden");
	    var x = 0;
	    var n = 0;
	    while (n < nMax) {
	      if (hidden.indexOf(n) >= 0) {
	        n += stepSize;
	        continue;
	      }
	      width = cellWidth * stepSize;
	      var avgHeight = 0;
	      var end = stepSize - 1;
	      for (var i = 0; 0 < end ? i <= end : i >= end; 0 < end ? i++ : i--) {
	        avgHeight += gaps[n];
	      }
	      var height = maxHeight * (avgHeight / stepSize);
	
	      var rect = svg.rect({ x: x, y: maxHeight - height, width: width - cellWidth / 4, height: height, style: "stroke:red;stroke-width:1;"
	      });rect.rowPos = n;
	      s.appendChild(rect);
	      x += width;
	      n += stepSize;
	    }
	
	    this.el.appendChild(s);
	    return this;
	  },
	
	  //TODO: make more general with HeaderView
	  _onclick: function _onclick(evt) {
	    var _this = this;
	
	    var rowPos = evt.target.rowPos;
	    var stepSize = this.g.zoomer.get("stepSize");
	    // simulate hidden columns
	    return function () {
	      var result = [];
	      var end = stepSize - 1;
	      for (var i = 0; 0 < end ? i <= end : i >= end; 0 < end ? i++ : i--) {
	        result.push(_this.g.trigger("gap:click", { rowPos: rowPos + i, evt: evt }));
	      }
	      return result;
	    }();
	  },
	
	  manageEvents: function manageEvents() {
	    var events = {};
	    if (this.g.config.get("registerMouseClicks")) {
	      events.click = "_onclick";
	    }
	    if (this.g.config.get("registerMouseHover")) {
	      events.mousein = "_onmousein";
	      events.mouseout = "_onmouseout";
	    }
	    this.delegateEvents(events);
	    this.listenTo(this.g.config, "change:registerMouseHover", this.manageEvents);
	    return this.listenTo(this.g.config, "change:registerMouseClick", this.manageEvents);
	  },
	
	  _onmousein: function _onmousein(evt) {
	    var rowPos = this.g.zoomer.get("stepSize" * evt.rowPos);
	    return this.g.trigger("gap:mousein", { rowPos: rowPos, evt: evt });
	  },
	
	  _onmouseout: function _onmouseout(evt) {
	    var rowPos = this.g.zoomer.get("stepSize" * evt.rowPos);
	    return this.g.trigger("gap:mouseout", { rowPos: rowPos, evt: evt });
	  }
	});
	
	exports.default = ConservationView;

/***/ },
/* 110 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _Selection = __webpack_require__(2);
	
	var view = __webpack_require__(14);
	var mouse = __webpack_require__(61);
	var jbone = __webpack_require__(15);
	
	
	var OverviewBox = view.extend({
	
	  className: "biojs_msa_overviewbox",
	  tagName: "canvas",
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	    this.listenTo(this.g.zoomer, "change:boxRectWidth change:boxRectHeight change:overviewboxPaddingTop", this.rerender);
	    this.listenTo(this.g.selcol, "add reset change", this.rerender);
	    this.listenTo(this.g.columns, "change:hidden", this.rerender);
	    this.listenTo(this.g.colorscheme, "change:showLowerCase", this.rerender);
	    this.listenTo(this.model, "change", _.debounce(this.rerender, 5));
	
	    // color
	    this.color = this.g.colorscheme.getSelectedScheme();
	    this.listenTo(this.g.colorscheme, "change:scheme", function () {
	      this.color = this.g.colorscheme.getSelectedScheme();
	      return this.rerender();
	    });
	    return this.dragStart = [];
	  },
	
	  events: { click: "_onclick",
	    mousedown: "_onmousedown"
	  },
	
	  rerender: function rerender() {
	    if (!this.g.config.get("manualRendering")) {
	      return this.render();
	    }
	  },
	
	  render: function render() {
	    this._createCanvas();
	    this.el.textContent = "overview";
	    this.el.style.marginTop = this.g.zoomer.get("overviewboxPaddingTop");
	
	    // background bg for non-drawed area
	    this.ctx.fillStyle = "#ffffff";
	    this.ctx.fillRect(0, 0, this.el.width, this.el.height);
	
	    var rectWidth = this.g.zoomer.get("boxRectWidth");
	    var rectHeight = this.g.zoomer.get("boxRectHeight");
	    var hidden = this.g.columns.get("hidden");
	    var showLowerCase = this.g.colorscheme.get("showLowerCase");
	
	    var y = -rectHeight;
	    var len = this.model.length;
	    for (var i = 0; i < len; i++) {
	      // fixes weird bug on tatyana's machine
	      if (!this.model.at(i)) {
	        continue;
	      }
	      var seq = this.model.at(i).get("seq");
	      var x = 0;
	      y = y + rectHeight;
	
	      if (this.model.at(i).get("hidden")) {
	        // hidden seq
	        this.ctx.fillStyle = "grey";
	        this.ctx.fillRect(0, y, seq.length * rectWidth, rectHeight);
	        continue;
	      }
	
	      for (var j = 0; j < seq.length; j++) {
	        var c = seq[j];
	        // todo: optional uppercasing
	        if (showLowerCase) {
	          c = c.toUpperCase();
	        }
	        var color = this.color.getColor(c, { pos: j });
	
	        if (hidden.indexOf(j) >= 0) {
	          color = "grey";
	        }
	
	        if (typeof color !== "undefined" && color !== null) {
	          this.ctx.fillStyle = color;
	          this.ctx.fillRect(x, y, rectWidth, rectHeight);
	        }
	
	        x = x + rectWidth;
	      }
	    }
	
	    return this._drawSelection();
	  },
	
	  _drawSelection: function _drawSelection() {
	    var _this = this;
	
	    // hide during selection
	    if (this.dragStart.length > 0 && !this.prolongSelection) {
	      return;
	    }
	
	    var rectWidth = this.g.zoomer.get("boxRectWidth");
	    var rectHeight = this.g.zoomer.get("boxRectHeight");
	    var maxHeight = rectHeight * this.model.length;
	    this.ctx.fillStyle = "#666666";
	    this.ctx.globalAlpha = 0.9;
	    var len = this.g.selcol.length;
	
	    var _loop = function _loop(i) {
	      var sel = _this.g.selcol.at(i);
	      if (!sel) return "continue";
	      var seq = void 0,
	          pos = void 0;
	      if (sel.get('type') === 'column') {
	        _this.ctx.fillRect(rectWidth * sel.get('xStart'), 0, rectWidth * (sel.get('xEnd') - sel.get('xStart') + 1), maxHeight);
	      } else if (sel.get('type') === 'row') {
	        seq = _this.model.filter(function (el) {
	          return el.get('id') === sel.get('seqId');
	        })[0];
	        pos = _this.model.indexOf(seq);
	        _this.ctx.fillRect(0, rectHeight * pos, rectWidth * seq.get('seq').length, rectHeight);
	      } else if (sel.get('type') === 'pos') {
	        seq = _this.model.filter(function (el) {
	          return el.get('id') === sel.get('seqId');
	        })[0];
	        pos = _this.model.indexOf(seq);
	        _this.ctx.fillRect(rectWidth * sel.get('xStart'), rectHeight * pos, rectWidth * (sel.get('xEnd') - sel.get('xStart') + 1), rectHeight);
	      }
	    };
	
	    for (var i = 0; i < len; i++) {
	      var _ret = _loop(i);
	
	      if (_ret === "continue") continue;
	    }
	
	    return this.ctx.globalAlpha = 1;
	  },
	
	  _onclick: function _onclick(evt) {
	    return this.g.trigger("meta:click", { seqId: this.model.get("id", { evt: evt }) });
	  },
	
	  _onmousemove: function _onmousemove(e) {
	    // duplicate events
	    if (this.dragStart.length === 0) {
	      return;
	    }
	
	    this.render();
	    this.ctx.fillStyle = "#666666";
	    this.ctx.globalAlpha = 0.9;
	
	    var rect = this._calcSelection(mouse.abs(e));
	    this.ctx.fillRect(rect[0][0], rect[1][0], rect[0][1] - rect[0][0], rect[1][1] - rect[1][0]);
	
	    // abort selection events of the browser
	    e.preventDefault();
	    return e.stopPropagation();
	  },
	
	  // start the selection mode
	  _onmousedown: function _onmousedown(e) {
	    var _this2 = this;
	
	    this.dragStart = mouse.abs(e);
	    this.dragStartRel = mouse.rel(e);
	
	    if (e.ctrlKey || e.metaKey) {
	      this.prolongSelection = true;
	    } else {
	      this.prolongSelection = false;
	    }
	    // enable global listeners
	    jbone(document.body).on('mousemove.overmove', function (e) {
	      return _this2._onmousemove(e);
	    });
	    jbone(document.body).on('mouseup.overup', function (e) {
	      return _this2._onmouseup(e);
	    });
	    return this.dragStart;
	  },
	
	  // calculates the current selection
	  _calcSelection: function _calcSelection(dragMove) {
	    // relative to first click
	    var dragRel = [dragMove[0] - this.dragStart[0], dragMove[1] - this.dragStart[1]];
	
	    // relative to target
	    for (var i = 0; i <= 1; i++) {
	      dragRel[i] = this.dragStartRel[i] + dragRel[i];
	    }
	
	    // 0:x, 1: y
	    var rect = [[this.dragStartRel[0], dragRel[0]], [this.dragStartRel[1], dragRel[1]]];
	
	    // swap the coordinates if needed
	    for (var _i = 0; _i <= 1; _i++) {
	      if (rect[_i][1] < rect[_i][0]) {
	        rect[_i] = [rect[_i][1], rect[_i][0]];
	      }
	
	      // lower limit
	      rect[_i][0] = Math.max(rect[_i][0], 0);
	    }
	
	    return rect;
	  },
	
	  _endSelection: function _endSelection(dragEnd) {
	    // remove listeners
	    jbone(document.body).off('.overmove');
	    jbone(document.body).off('.overup');
	
	    // duplicate events
	    if (this.dragStart.length === 0) {
	      return;
	    }
	
	    var rect = this._calcSelection(dragEnd);
	
	    // x
	    for (var i = 0; i <= 1; i++) {
	      rect[0][i] = Math.floor(rect[0][i] / this.g.zoomer.get("boxRectWidth"));
	    }
	
	    // y
	    for (var i = 0; i <= 1; i++) {
	      rect[1][i] = Math.floor(rect[1][i] / this.g.zoomer.get("boxRectHeight"));
	    }
	
	    // upper limit
	    rect[0][1] = Math.min(this.model.getMaxLength() - 1, rect[0][1]);
	    rect[1][1] = Math.min(this.model.length - 1, rect[1][1]);
	
	    // select
	    var selis = [];
	    for (var j = rect[1][0]; j <= rect[1][1]; j++) {
	      var args = { seqId: this.model.at(j).get('id'), xStart: rect[0][0], xEnd: rect[0][1] };
	      selis.push(new _Selection.possel(args));
	    }
	
	    // reset
	    this.dragStart = [];
	    // look for ctrl key
	    if (this.prolongSelection) {
	      this.g.selcol.add(selis);
	    } else {
	      this.g.selcol.reset(selis);
	    }
	
	    // safety check + update offset
	    this.g.zoomer.setLeftOffset(rect[0][0]);
	    return this.g.zoomer.setTopOffset(rect[1][0]);
	  },
	
	  // ends the selection mode
	  _onmouseup: function _onmouseup(e) {
	    return this._endSelection(mouse.abs(e));
	  },
	
	  _onmouseout: function _onmouseout(e) {
	    return this._endSelection(mouse.abs(e));
	  },
	
	  // init the canvas
	  _createCanvas: function _createCanvas() {
	    var rectWidth = this.g.zoomer.get("boxRectWidth");
	    var rectHeight = this.g.zoomer.get("boxRectHeight");
	
	    this.el.height = this.model.length * rectHeight;
	    this.el.width = this.model.getMaxLength() * rectWidth;
	    this.ctx = this.el.getContext("2d");
	    this.el.style.overflow = "auto";
	    return this.el.style.cursor = "crosshair";
	  }
	});
	exports.default = OverviewBox;

/***/ },
/* 111 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _Selection = __webpack_require__(2);
	
	var boneView = __webpack_require__(16);
	var k = __webpack_require__(44);
	var dom = __webpack_require__(65);
	
	
	// this is a very simplistic approach to show search result
	// TODO: needs proper styling
	var View = boneView.extend({
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	
	    this.listenTo(this.g.user, "change:searchText", function (model, prop) {
	      this.search(prop);
	      return this.render();
	    });
	    this.sel = [];
	    return this.selPos = 0;
	  },
	
	  events: { "scroll": "_sendScrollEvent" },
	
	  render: function render() {
	    this.renderSubviews();
	
	    this.el.className = "biojs_msa_searchresult";
	    var searchText = this.g.user.get("searchText");
	    if (typeof searchText !== "undefined" && searchText !== null && searchText.length > 0) {
	      if (this.sel.length === 0) {
	        this.el.textContent = "no selection found";
	      } else {
	        this.resultBox = k.mk("div");
	        this.resultBox.className = "biojs_msa_searchresult_ovbox";
	        this.updateResult();
	        this.el.appendChild(this.resultBox);
	        this.el.appendChild(this.buildBtns());
	      }
	    }
	    return this;
	  },
	
	  updateResult: function updateResult() {
	    var text = "search pattern: " + this.g.user.get("searchText");
	    text += ", selection: " + (this.selPos + 1);
	    var seli = this.sel[this.selPos];
	    text += " (";
	    text += seli.get("xStart") + " - " + seli.get("xEnd");
	    text += ", id: " + seli.get("seqId");
	    text += ")";
	    return this.resultBox.textContent = text;
	  },
	
	  buildBtns: function buildBtns() {
	    var _this = this;
	
	    var prevBtn = k.mk("button");
	    prevBtn.textContent = "Prev";
	    prevBtn.addEventListener("click", function () {
	      return _this.moveSel(-1);
	    });
	
	    var nextBtn = k.mk("button");
	    nextBtn.textContent = "Next";
	    nextBtn.addEventListener("click", function () {
	      return _this.moveSel(1);
	    });
	
	    var allBtn = k.mk("button");
	    allBtn.textContent = "All";
	    allBtn.addEventListener("click", function () {
	      return _this.g.selcol.reset(_this.sel);
	    });
	
	    var searchrow = k.mk("div");
	    searchrow.appendChild(prevBtn);
	    searchrow.appendChild(nextBtn);
	    searchrow.appendChild(allBtn);
	    searchrow.className = "biojs_msa_searchresult_row";
	    return searchrow;
	  },
	
	  moveSel: function moveSel(relDist) {
	    var selNew = this.selPos + relDist;
	    if (selNew < 0 || selNew >= this.sel.length) {
	      return -1;
	    } else {
	      this.focus(selNew);
	      this.selPos = selNew;
	      return this.updateResult();
	    }
	  },
	
	  focus: function focus(selPos) {
	    var seli = this.sel[selPos];
	    var leftIndex = seli.get("xStart");
	    this.g.zoomer.setLeftOffset(leftIndex);
	    return this.g.selcol.reset([seli]);
	  },
	
	  search: function search(searchText) {
	    // marks all hits
	    var origIndex;
	    var search = new RegExp(searchText, "gi");
	    var newSeli = [];
	    var leftestIndex = origIndex = 100042;
	
	    this.model.each(function (seq) {
	      var strSeq = seq.get("seq");
	      return function () {
	        var match;
	        var result = [];
	        while (match = search.exec(strSeq)) {
	          var index = match.index;
	          var args = { xStart: index, xEnd: index + match[0].length - 1, seqId: seq.get("id") };
	          newSeli.push(new _Selection.possel(args));
	          result.push(leftestIndex = Math.min(index, leftestIndex));
	        }
	        return result;
	      }();
	    });
	
	    this.g.selcol.reset(newSeli);
	
	    // safety check + update offset
	    if (leftestIndex === origIndex) {
	      leftestIndex = 0;
	    }
	    this.g.zoomer.setLeftOffset(leftestIndex);
	
	    return this.sel = newSeli;
	  }
	});
	exports.default = View;

/***/ },
/* 112 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _lodash = __webpack_require__(3);
	
	var BoneView = __webpack_require__(14);
	
	var $ = __webpack_require__(15);
	//const Slider = require("bootstrap-slider");
	
	var View = BoneView.extend({
	
	  initialize: function initialize(data) {
	    this.g = data.g;
	    this.listenTo(this.g.zoomer, "change:columnWidth", this.render);
	    this.toggleClass = 'msa-hide';
	    this.isVisible = true;
	    return this;
	  },
	
	  attributes: {
	    class: "biojs_msa_scale"
	  },
	
	  events: {
	    'change input': 'updateSlider',
	    'click button.msa-btn-close': 'hide',
	    'click button.msa-btn-open': 'show',
	    'click button[data-action]': 'clickButton'
	  },
	
	  template: (0, _lodash.template)('\
	<div class="msa-scale-minimised">\
	  <button class="btn msa-btn msa-btn-open">Zoom</button>\
	</div>\
	<div class="msa-scale-maximised">\
	  <button class="btn msa-btn msa-btn-close" style="float:right">&times; close</button>\
	  <div>\
	  <input type="range" \
	    data-provide="slider" \
	    min="<%= min %>" \
	    max="<%= max %>" \
	    step="<%= step %>" \
	    value="<%= value %>" \
	  >\
	  </div>\
	  <div class="btngroup msa-btngroup">\
	    <button class="btn msa-btn" data-action="smaller"><span class="glyphicon-zoom-out"></span>-</button>\
	    <button class="btn msa-btn" data-action="bigger"><span class="glyphicon-zoom-in"></span>+</button>\
	    <button class="btn msa-btn" data-action="reset"><span class="glyphicon-repeat"></span>reset</button>\
	  </div>\
	</div>\
	'),
	
	  render: function render() {
	    var sizeRange = this.model.getSizeRange();
	    var stash = {
	      value: this.model.getSize(),
	      min: sizeRange[0],
	      max: sizeRange[1],
	      step: this.model.step || 1
	    };
	    this.$el.html(this.template(stash));
	    if (this.isVisible) {
	      this.show();
	    } else {
	      this.hide();
	    }
	    return this;
	  },
	
	  updateSlider: function updateSlider(e) {
	    var target = e.target;
	    var size = parseInt($(target).val());
	    //console.log( "updateSize", size );
	    this.model.setSize(size);
	  },
	
	  clickButton: function clickButton(e) {
	    console.log("clickButton", this, e);
	    var target = e.target;
	    var action = $(target).data('action');
	    var method = this.model[action];
	    // bigger, smaller, reset
	    if (typeof this.model[action] === 'function') {
	      this.model[action]();
	    }
	    return this;
	  },
	
	  hide: function hide() {
	    this.isVisible = false;
	    this.$el.find(".msa-scale-minimised").removeClass(this.toggleClass);
	    this.$el.find(".msa-scale-maximised").addClass(this.toggleClass);
	  },
	
	  show: function show() {
	    this.isVisible = false;
	    this.$el.find(".msa-scale-minimised").addClass(this.toggleClass);
	    this.$el.find(".msa-scale-maximised").removeClass(this.toggleClass);
	  }
	
	});
	exports.default = View;

/***/ },
/* 113 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();
	
	var _lodash = __webpack_require__(3);
	
	var _bio = __webpack_require__(67);
	
	var _recognize = __webpack_require__(114);
	
	var _recognize2 = _interopRequireDefault(_recognize);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var FileHelper = function FileHelper(msa) {
	  this.msa = msa;
	  return this;
	};
	
	var funs = { guessFileFromText: function guessFileFromText(text, opt) {
	    if (!(typeof text !== "undefined" && text !== null)) {
	      console.warn("invalid file format");
	      return ["", "error"];
	    }
	    var recognizedFile = (0, _recognize2.default)(text, opt);
	    switch (recognizedFile) {
	      case "clustal":
	        var reader = _bio.clustal;
	        var type = "seqs";
	        break;
	
	      case "fasta":
	        reader = _bio.fasta;
	        type = "seqs";
	        break;
	
	      case "newick":
	        type = "newick";
	        break;
	
	      case "gff":
	        reader = _bio.gff;
	        type = "features";
	        break;
	
	      default:
	        alert("Unknown file format. Please contact us on Github for help.");
	        break;
	    }
	    return [reader, type];
	  },
	
	  parseText: function parseText(text, opt) {
	    var _guessFileFromText = this.guessFileFromText(text, opt),
	        _guessFileFromText2 = _slicedToArray(_guessFileFromText, 2),
	        reader = _guessFileFromText2[0],
	        type = _guessFileFromText2[1];
	
	    if (type === "seqs") {
	      var seqs = reader.parse(text);
	      return [seqs, type];
	    } else if (type === "features") {
	      var features = reader.parseSeqs(text);
	      return [features, type];
	    } else {
	      return [text, type];
	    }
	  },
	
	  importFiles: function importFiles(files) {
	    var _this = this;
	
	    return function () {
	      var result = [];
	      var end = files.length - 1;
	      for (var i = 0; 0 < end ? i <= end : i >= end; 0 < end ? i++ : i--) {
	        var file = files[i];
	        var reader = new FileReader();
	        reader.onload = function (evt) {
	          return _this.importFile(evt.target.result);
	        };
	        result.push(reader.readAsText(file));
	      }
	      return result;
	    }();
	  },
	
	  importFile: function importFile(file, opt) {
	    var _this2 = this;
	
	    opt = opt || {};
	    opt.name = file.name;
	    var fileName;
	
	    var _parseText = this.parseText(file, opt),
	        _parseText2 = _slicedToArray(_parseText, 2),
	        objs = _parseText2[0],
	        type = _parseText2[1];
	
	    if (type === "error") {
	      alert("An error happened");
	      return "error";
	    }
	    if (type === "seqs") {
	      this.msa.seqs.reset(objs);
	      this.msa.g.config.set("url", "userimport");
	      this.msa.g.trigger("url:userImport");
	    } else if (type === "features") {
	      this.msa.seqs.addFeatures(objs);
	    } else if (type === "newick") {
	      this.msa.u.tree.loadTree(function () {
	        return _this2.msa.u.tree.showTree(file);
	      });
	    } else {
	      alert("Unknown file!");
	    }
	
	    return fileName = file.name;
	  },
	
	  importURL: function importURL(url, cb) {
	    var _this3 = this;
	
	    url = this.msa.u.proxy.corsURL(url);
	    this.msa.g.config.set("url", url);
	    return (0, _bio.xhr)({
	      url: url,
	      timeout: 0
	    }, function (err, status, body) {
	      if (!err) {
	        var res = _this3.importFile(body, { url: url });
	        if (res === "error") {
	          return;
	        }
	        _this3.msa.g.trigger("import:url", url);
	        if (cb) {
	          return cb();
	        }
	      } else {
	        return console.error(err);
	      }
	    });
	  }
	};
	
	(0, _lodash.extend)(FileHelper.prototype, funs);
	exports.default = FileHelper;

/***/ },
/* 114 */
/***/ function(module, exports) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	    value: true
	});
	
	exports.default = function (text, opt) {
	    var fileName = opt.name || opt.url || "";
	    var fileNameSplit = fileName.split(".");
	    var suffix = fileNameSplit[fileNameSplit.length - 1] || "";
	    for (var i = 0; i < recognizers.length; i++) {
	        var v = recognizers[i](text, suffix);
	        if (!!v) return v;
	    }
	    return "unknown";
	};
	
	/**
	 * Given a file type - what is typical for it?
	 */
	
	var isClustal = function isClustal(text, suffix) {
	    if (text.substring(0, 7) === "CLUSTAL" || suffix == "clustal" || suffix == "aln") {
	        return "clustal";
	    }
	    return false;
	};
	
	var isFasta = function isFasta(text, suffix) {
	    if (text.substring(0, 1) === ">" || suffix == "fasta" || suffix == "fa") {
	        return "fasta";
	    }
	    return false;
	};
	
	var isNewick = function isNewick(text, suffix) {
	    if (text.substring(0, 1) === "(" || suffix == "nwk") {
	        return "newick";
	    }
	    return false;
	};
	
	var isGFF = function isGFF(text, suffix) {
	    if (text.length <= 10) {
	        return false;
	    }
	    var lines = text.split('\n');
	    if (lines[0].indexOf("gff") >= 0 || suffix.indexOf("gff") >= 0) {
	        return "gff";
	    }
	    if (lines[0].indexOf("#") < 0 && lines[0].split("\t").length === 2) {
	        // no comments and two columns. let's hope this is from jalview
	        return "gff";
	    }
	    return false;
	};
	
	var recognizers = [isClustal, isFasta, isNewick, isGFF];
	
	/**
	Return the lowercase format for a given file
	*/

/***/ },
/* 115 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _lodash = __webpack_require__(3);
	
	var _SeqCollection = __webpack_require__(18);
	
	var _SeqCollection2 = _interopRequireDefault(_SeqCollection);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var TreeHelper = function TreeHelper(msa) {
	  this.msa = msa;
	  return this;
	};
	
	var tf = { loadTree: function loadTree(cb) {
	    return this.msa.g.package.loadPackages(["msa-tnt", "biojs-io-newick"], cb);
	  },
	
	  showTree: function showTree(newickStr) {
	    var newick = window.require("biojs-io-newick");
	    var mt = window.require("msa-tnt");
	
	    if (typeof newickStr === "string") {
	      var newickObj = newick.parse_newick(newickStr);
	    } else {
	      newickObj = newickStr;
	    }
	
	    var sel = new mt.selections();
	    var treeDiv;
	
	    if (this.msa.el.getElementsByClassName('tnt_groupDiv').length === 0) {
	      treeDiv = document.createElement("div");
	      this.msa.el.appendChild(treeDiv);
	    } else {
	      console.log('A tree already exists. It will be overridden.');
	      treeDiv = this.msa.el.getElementsByClassName('tnt_groupDiv')[0].parentNode;
	      treeDiv.innerHTML = '';
	    }
	
	    var seqs = this.msa.seqs.toJSON();
	    //adapt tree ids to sequence ids
	    function iterateTree(nwck) {
	      if (nwck.children != null) {
	        nwck.children.forEach(function (x) {
	          return iterateTree(x);
	        });
	      } else {
	        //found a leave
	        var seq = seqs.filter(function (s) {
	          return s.name === nwck.name;
	        })[0];
	
	        if (seq != null) {
	          if (typeof seq.id === 'number') {
	            //no tree has been uploaded so far, seqs have standard IDs
	            seq.ids = ["s" + (seq.id + 1)];
	            nwck.name = "s" + (seq.id + 1);
	          } else {
	            //seqs have custom ids - don't mess with these
	            nwck.name = seq.id;
	          }
	        }
	      }
	    }
	    iterateTree(newickObj);
	
	    var nodes = mt.app({
	      seqs: seqs,
	      tree: newickObj
	    });
	
	    var t = new mt.adapters.tree({
	      model: nodes,
	      el: treeDiv,
	      sel: sel
	    });
	
	    //treeDiv.style.width = "500px"
	
	    // construct msa in a virtual dom
	    var m = new mt.adapters.msa({
	      model: nodes,
	      sel: sel,
	      msa: this.msa
	    });
	
	    // remove top collection
	    nodes.models.forEach(function (e) {
	      delete e.collection;
	      return Object.setPrototypeOf(e, __webpack_require__(6).Model.prototype);
	    });
	
	    this.msa.seqs.reset(nodes.models);
	    //@msa.draw()
	    //@msa.render()
	    return console.log(this.msa.seqs);
	  },
	
	  // workaround against browserify's static analysis
	  require: function (_require) {
	    function require(_x) {
	      return _require.apply(this, arguments);
	    }
	
	    require.toString = function () {
	      return _require.toString();
	    };
	
	    return require;
	  }(function (pkg) {
	    return __webpack_require__(116)(pkg);
	  })
	};
	
	(0, _lodash.extend)(TreeHelper.prototype, tf);
	exports.default = TreeHelper;

/***/ },
/* 116 */
/***/ function(module, exports, __webpack_require__) {

	var map = {
		"./bmath": 117,
		"./bmath.js": 117,
		"./exporter": 118,
		"./exporter.js": 118,
		"./file": 113,
		"./file.js": 113,
		"./index": 121,
		"./index.js": 121,
		"./loader": 43,
		"./loader.js": 43,
		"./proxy": 122,
		"./proxy.js": 122,
		"./recognize": 114,
		"./recognize.js": 114,
		"./seqgen": 123,
		"./seqgen.js": 123,
		"./svg": 91,
		"./svg.js": 91,
		"./tree": 115,
		"./tree.js": 115
	};
	function webpackContext(req) {
		return __webpack_require__(webpackContextResolve(req));
	};
	function webpackContextResolve(req) {
		return map[req] || (function() { throw new Error("Cannot find module '" + req + "'.") }());
	};
	webpackContext.keys = function webpackContextKeys() {
		return Object.keys(map);
	};
	webpackContext.resolve = webpackContextResolve;
	module.exports = webpackContext;
	webpackContext.id = 116;


/***/ },
/* 117 */
/***/ function(module, exports) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
	
	function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
	
	// math utilities
	var BMath = function () {
	  function BMath() {
	    _classCallCheck(this, BMath);
	  }
	
	  _createClass(BMath, null, [{
	    key: "randomInt",
	    value: function randomInt(lower, upper) {
	      // Called with one argument
	      if (!(typeof upper !== "undefined" && upper !== null)) {
	        var _ref = [0, lower];
	        lower = _ref[0];
	        upper = _ref[1];
	      }
	      // Lower must be less then upper
	      if (lower > upper) {
	        var _ref2 = [upper, lower];
	        lower = _ref2[0];
	        upper = _ref2[1];
	      }
	      // Last statement is a return value
	      return Math.floor(Math.random() * (upper - lower + 1) + lower);
	    }
	
	    // @return [Integer] random id
	
	  }, {
	    key: "uniqueId",
	    value: function uniqueId() {
	      var length = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 8;
	
	      var id = "";
	      while (id.length < length) {
	        id += Math.random().toString(36).substr(2);
	      }
	      return id.substr(0, length);
	    }
	
	    // Returns a random integer between min (inclusive) and max (inclusive)
	
	  }, {
	    key: "getRandomInt",
	    value: function getRandomInt(min, max) {
	      return Math.floor(Math.random() * (max - min + 1)) + min;
	    }
	  }]);
	
	  return BMath;
	}();
	
	exports.default = BMath;
	;

/***/ },
/* 118 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _bio = __webpack_require__(67);
	
	var _lodash = __webpack_require__(3);
	
	var blobURL = __webpack_require__(119);
	var saveAs = __webpack_require__(120);
	
	
	var Exporter = { openInJalview: function openInJalview(url, colorscheme) {
	    if (url.charAt(0) === '.') {
	      // relative urls
	      url = document.URL.substr(0, document.URL.lastIndexOf('/')) + "/" + url;
	    }
	
	    // check whether this is a local url
	    if (url.indexOf("http") < 0) {
	      // append host and hope for the best
	      var host = "http://" + window.location.hostname;
	      url = host + url;
	    }
	
	    url = encodeURIComponent(url);
	    var jalviewUrl = "http://www.jalview.org/services/launchApp?open=" + url;
	    jalviewUrl += "&colour=" + colorscheme;
	    return window.open(jalviewUrl, '_blank');
	  },
	
	  publishWeb: function publishWeb(that, cb) {
	    var text = _bio.fasta.write(that.seqs.toJSON());
	    text = encodeURIComponent(text);
	    var url = "http://sprunge.biojs.net";
	    return (0, _bio.xhr)({
	      method: "POST",
	      body: "sprunge=" + text,
	      uri: url,
	      headers: { "Content-Type": "application/x-www-form-urlencoded" }
	    }, function (err, rep, body) {
	      var link = body.trim();
	      return cb(link);
	    });
	  },
	
	  shareLink: function shareLink(that, cb) {
	    var url = that.g.config.get("importURL");
	    var msaURL = "http://msa.biojs.net/app/?seq=";
	    var fCB = function fCB(link) {
	      var fURL = msaURL + link;
	      if (cb) {
	        return cb(fURL);
	      }
	    };
	    if (!url) {
	      return Exporter.publishWeb(that, fCB);
	    } else {
	      return fCB(url);
	    }
	  },
	
	  saveAsFile: function saveAsFile(that, name) {
	    // limit at about 256k
	    var text = _bio.fasta.write(that.seqs.toJSON());
	    var blob = new Blob([text], { type: 'text/plain' });
	    return saveAs(blob, name);
	  },
	
	  saveSelection: function saveSelection(that, name) {
	    var selection = that.g.selcol.pluck("seqId");
	    console.log(selection);
	    if (selection.length > 0) {
	      // filter those seqids
	      selection = that.seqs.filter(function (el) {
	        return selection.indexOf(el.get("id")) >= 0;
	      });
	      var end = selection.length - 1;
	      for (var i = 0; 0 < end ? i <= end : i >= end; 0 < end ? i++ : i--) {
	        selection[i] = selection[i].toJSON();
	      }
	    } else {
	      selection = that.seqs.toJSON();
	      console.warn("no selection found");
	    }
	    var text = _bio.fasta.write(selection);
	    var blob = new Blob([text], { type: 'text/plain' });
	    return saveAs(blob, name);
	  },
	
	  saveAnnots: function saveAnnots(that, name) {
	    var features = that.seqs.map(function (el) {
	      features = el.get("features");
	      if (features.length === 0) {
	        return;
	      }
	      var seqname = el.get("name");
	      features.each(function (s) {
	        return s.set("seqname", seqname);
	      });
	      return features.toJSON();
	    });
	    features = (0, _lodash.flatten)((0, _lodash.compact)(features));
	    console.log(features);
	    var text = _bio.gff.exportLines(features);
	    var blob = new Blob([text], { type: 'text/plain' });
	    return saveAs(blob, name);
	  },
	
	  saveAsImg: function saveAsImg(that, name) {
	    // TODO: this is very ugly
	    var canvas = that.getView('stage').getView('body').getView('seqblock').el;
	    if (typeof canvas !== "undefined" && canvas !== null) {
	      var url = canvas.toDataURL('image/png');
	      return saveAs(blobURL(url), name, "image/png");
	    }
	  }
	};
	exports.default = Exporter;

/***/ },
/* 119 */
/***/ function(module, exports) {

	'use strict';
	
	/*
	 * JavaScript Canvas to Blob 2.0.5
	 * https://github.com/blueimp/JavaScript-Canvas-to-Blob
	 *
	 * Copyright 2012, Sebastian Tschan
	 * https://blueimp.net
	 *
	 * Licensed under the MIT license:
	 * http://www.opensource.org/licenses/MIT
	 *
	 * Based on stackoverflow user Stoive's code snippet:
	 * http://stackoverflow.com/q/4998908
	 */
	var CanvasPrototype = window.HTMLCanvasElement && window.HTMLCanvasElement.prototype,
	    hasBlobConstructor = window.Blob && function () {
	  try {
	    return Boolean(new Blob());
	  } catch (e) {
	    return false;
	  }
	}(),
	    hasArrayBufferViewSupport = hasBlobConstructor && window.Uint8Array && function () {
	  try {
	    return new Blob([new Uint8Array(100)]).size === 100;
	  } catch (e) {
	    return false;
	  }
	}(),
	    BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder,
	    dataURLtoBlob = (hasBlobConstructor || BlobBuilder) && window.atob && window.ArrayBuffer && window.Uint8Array && function (dataURI) {
	  var byteString, arrayBuffer, intArray, i, mimeString, bb;
	  if (dataURI.split(',')[0].indexOf('base64') >= 0) {
	    // Convert base64 to raw binary data held in a string:
	    byteString = atob(dataURI.split(',')[1]);
	  } else {
	    // Convert base64/URLEncoded data component to raw binary data:
	    byteString = decodeURIComponent(dataURI.split(',')[1]);
	  }
	  // Write the bytes of the string to an ArrayBuffer:
	  arrayBuffer = new ArrayBuffer(byteString.length);
	  intArray = new Uint8Array(arrayBuffer);
	  for (i = 0; i < byteString.length; i += 1) {
	    intArray[i] = byteString.charCodeAt(i);
	  }
	  // Separate out the mime component:
	  mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
	  // Write the ArrayBuffer (or ArrayBufferView) to a blob:
	  if (hasBlobConstructor) {
	    return new Blob([hasArrayBufferViewSupport ? intArray : arrayBuffer], { type: mimeString });
	  }
	  bb = new BlobBuilder();
	  bb.append(arrayBuffer);
	  return bb.getBlob(mimeString);
	};
	if (window.HTMLCanvasElement && !CanvasPrototype.toBlob) {
	  if (CanvasPrototype.mozGetAsFile) {
	    CanvasPrototype.toBlob = function (callback, type, quality) {
	      if (quality && CanvasPrototype.toDataURL && dataURLtoBlob) {
	        callback(dataURLtoBlob(this.toDataURL(type, quality)));
	      } else {
	        callback(this.mozGetAsFile('blob', type));
	      }
	    };
	  } else if (CanvasPrototype.toDataURL && dataURLtoBlob) {
	    CanvasPrototype.toBlob = function (callback, type, quality) {
	      callback(dataURLtoBlob(this.toDataURL(type, quality)));
	    };
	  }
	}
	
	module.exports = dataURLtoBlob;

/***/ },
/* 120 */
/***/ function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(module) {"use strict";
	
	/* FileSaver.js
	 *  A saveAs() FileSaver implementation.
	 *  2014-05-27
	 *
	 *  By Eli Grey, http://eligrey.com
	 *  License: X11/MIT
	 *    See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
	 */
	
	/*global self */
	/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */
	
	/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
	
	var saveAs = saveAs
	// IE 10+ (native saveAs)
	|| typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob && navigator.msSaveOrOpenBlob.bind(navigator)
	// Everyone else
	|| function (view) {
		"use strict";
		// IE <10 is explicitly unsupported
	
		if (typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
			return;
		}
		var doc = view.document
		// only get URL when necessary in case Blob.js hasn't overridden it yet
		,
		    get_URL = function get_URL() {
			return view.URL || view.webkitURL || view;
		},
		    save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a"),
		    can_use_save_link = !view.externalHost && "download" in save_link,
		    click = function click(node) {
			var event = doc.createEvent("MouseEvents");
			event.initMouseEvent("click", true, false, view, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
			node.dispatchEvent(event);
		},
		    webkit_req_fs = view.webkitRequestFileSystem,
		    req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem,
		    throw_outside = function throw_outside(ex) {
			(view.setImmediate || view.setTimeout)(function () {
				throw ex;
			}, 0);
		},
		    force_saveable_type = "application/octet-stream",
		    fs_min_size = 0,
		    deletion_queue = [],
		    process_deletion_queue = function process_deletion_queue() {
			var i = deletion_queue.length;
			while (i--) {
				var file = deletion_queue[i];
				if (typeof file === "string") {
					// file is an object URL
					get_URL().revokeObjectURL(file);
				} else {
					// file is a File
					file.remove();
				}
			}
			deletion_queue.length = 0; // clear queue
		},
		    dispatch = function dispatch(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		},
		    FileSaver = function FileSaver(blob, name) {
			// First try a.download, then web filesystem, then object URLs
			var filesaver = this,
			    type = blob.type,
			    blob_changed = false,
			    object_url,
			    target_view,
			    get_object_url = function get_object_url() {
				var object_url = get_URL().createObjectURL(blob);
				deletion_queue.push(object_url);
				return object_url;
			},
			    dispatch_all = function dispatch_all() {
				dispatch(filesaver, "writestart progress write writeend".split(" "));
			}
			// on any filesys errors revert to saving with object URLs
			,
			    fs_error = function fs_error() {
				// don't create more object URLs than needed
				if (blob_changed || !object_url) {
					object_url = get_object_url(blob);
				}
				if (target_view) {
					target_view.location.href = object_url;
				} else {
					window.open(object_url, "_blank");
				}
				filesaver.readyState = filesaver.DONE;
				dispatch_all();
			},
			    abortable = function abortable(func) {
				return function () {
					if (filesaver.readyState !== filesaver.DONE) {
						return func.apply(this, arguments);
					}
				};
			},
			    create_if_not_found = { create: true, exclusive: false },
			    slice;
			filesaver.readyState = filesaver.INIT;
			if (!name) {
				name = "download";
			}
			if (can_use_save_link) {
				object_url = get_object_url(blob);
				save_link.href = object_url;
				save_link.download = name;
				click(save_link);
				filesaver.readyState = filesaver.DONE;
				dispatch_all();
				return;
			}
			// Object and web filesystem URLs have a problem saving in Google Chrome when
			// viewed in a tab, so I force save with application/octet-stream
			// http://code.google.com/p/chromium/issues/detail?id=91158
			if (view.chrome && type && type !== force_saveable_type) {
				slice = blob.slice || blob.webkitSlice;
				blob = slice.call(blob, 0, blob.size, force_saveable_type);
				blob_changed = true;
			}
			// Since I can't be sure that the guessed media type will trigger a download
			// in WebKit, I append .download to the filename.
			// https://bugs.webkit.org/show_bug.cgi?id=65440
			if (webkit_req_fs && name !== "download") {
				name += ".download";
			}
			if (type === force_saveable_type || webkit_req_fs) {
				target_view = view;
			}
			if (!req_fs) {
				fs_error();
				return;
			}
			fs_min_size += blob.size;
			req_fs(view.TEMPORARY, fs_min_size, abortable(function (fs) {
				fs.root.getDirectory("saved", create_if_not_found, abortable(function (dir) {
					var save = function save() {
						dir.getFile(name, create_if_not_found, abortable(function (file) {
							file.createWriter(abortable(function (writer) {
								writer.onwriteend = function (event) {
									target_view.location.href = file.toURL();
									deletion_queue.push(file);
									filesaver.readyState = filesaver.DONE;
									dispatch(filesaver, "writeend", event);
								};
								writer.onerror = function () {
									var error = writer.error;
									if (error.code !== error.ABORT_ERR) {
										fs_error();
									}
								};
								"writestart progress write abort".split(" ").forEach(function (event) {
									writer["on" + event] = filesaver["on" + event];
								});
								writer.write(blob);
								filesaver.abort = function () {
									writer.abort();
									filesaver.readyState = filesaver.DONE;
								};
								filesaver.readyState = filesaver.WRITING;
							}), fs_error);
						}), fs_error);
					};
					dir.getFile(name, { create: false }, abortable(function (file) {
						// delete file if it already exists
						file.remove();
						save();
					}), abortable(function (ex) {
						if (ex.code === ex.NOT_FOUND_ERR) {
							save();
						} else {
							fs_error();
						}
					}));
				}), fs_error);
			}), fs_error);
		},
		    FS_proto = FileSaver.prototype,
		    saveAs = function saveAs(blob, name) {
			return new FileSaver(blob, name);
		};
		FS_proto.abort = function () {
			var filesaver = this;
			filesaver.readyState = filesaver.DONE;
			dispatch(filesaver, "abort");
		};
		FS_proto.readyState = FS_proto.INIT = 0;
		FS_proto.WRITING = 1;
		FS_proto.DONE = 2;
	
		FS_proto.error = FS_proto.onwritestart = FS_proto.onprogress = FS_proto.onwrite = FS_proto.onabort = FS_proto.onerror = FS_proto.onwriteend = null;
	
		view.addEventListener("unload", process_deletion_queue, false);
		saveAs.unload = function () {
			process_deletion_queue();
			view.removeEventListener("unload", process_deletion_queue, false);
		};
		return saveAs;
	}(typeof self !== "undefined" && self || typeof window !== "undefined" && window || undefined.content);
	// `self` is undefined in Firefox for Android content script context
	// while `this` is nsIContentFrameMessageManager
	// with an attribute `content` that corresponds to the window
	
	var amdDefine = window.define;
	if (typeof amdDefine === "undefined" && typeof window.almond !== "undefined" && "define" in window.almond) {
		amdDefine = window.almond.define;
	}
	
	if (typeof module !== "undefined" && module !== null) {
		module.exports = saveAs;
	} else if (typeof amdDefine !== "undefined" && amdDefine !== null && amdDefine.amd != null) {
		amdDefine("saveAs", [], function () {
			return saveAs;
		});
	}
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(4)(module)))

/***/ },
/* 121 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	exports.exporter = exports.file = exports.seqgen = exports.proxy = exports.bmath = undefined;
	
	var _bmath2 = __webpack_require__(117);
	
	var _bmath3 = _interopRequireDefault(_bmath2);
	
	var _proxy2 = __webpack_require__(122);
	
	var _proxy3 = _interopRequireDefault(_proxy2);
	
	var _seqgen2 = __webpack_require__(123);
	
	var _seqgen3 = _interopRequireDefault(_seqgen2);
	
	var _file2 = __webpack_require__(113);
	
	var _file3 = _interopRequireDefault(_file2);
	
	var _exporter2 = __webpack_require__(118);
	
	var _exporter3 = _interopRequireDefault(_exporter2);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	exports.bmath = _bmath3.default;
	exports.proxy = _proxy3.default;
	exports.seqgen = _seqgen3.default;
	exports.file = _file3.default;
	exports.exporter = _exporter3.default;

/***/ },
/* 122 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _lodash = __webpack_require__(3);
	
	var ProxyHelper = function ProxyHelper(opts) {
	  this.g = opts.g;
	  return this;
	};
	
	var proxyFun = { corsURL: function corsURL(url) {
	    // do not filter on localhost
	    if (document.URL.indexOf('localhost') >= 0 && url[0] === "/") {
	      return url;
	    }
	    if (url.charAt(0) === "." || url.charAt(0) === "/") {
	      return url;
	    }
	
	    // DEPRECATED as crossorigin.me requires http
	    // remove www + http
	    //url = url.replace("www\.", "");
	
	    if (this.g.config.get('importProxyStripHttp')) {
	      url = url.replace("http://", "");
	      url = url.replace("https://", "");
	    }
	
	    // prepend proxy
	    url = this.g.config.get('importProxy') + url;
	    return url;
	  }
	};
	
	(0, _lodash.extend)(ProxyHelper.prototype, proxyFun);
	exports.default = ProxyHelper;

/***/ },
/* 123 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _bmath = __webpack_require__(117);
	
	var _bmath2 = _interopRequireDefault(_bmath);
	
	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
	
	var Sequence = __webpack_require__(124).seq;
	
	var Stat = __webpack_require__(126);
	
	var SeqGen = {
	  _generateSequence: function _generateSequence(len) {
	    var text = "";
	    var end = len - 1;
	    for (var i = 0; 0 < end ? i <= end : i >= end; 0 < end ? i++ : i--) {
	      text += SeqGen.getRandomChar();
	    }
	    return text;
	  },
	
	  // generates a dummy sequences
	  // @param len [int] number of generated sequences
	  // @param seqLen [int] length of the generated sequences
	  getDummySequences: function getDummySequences(len, seqLen) {
	    var seqs = [];
	    if (!(typeof len !== "undefined" && len !== null)) {
	      len = _bmath2.default.getRandomInt(3, 5);
	    }
	    if (!(typeof seqLen !== "undefined" && seqLen !== null)) {
	      seqLen = _bmath2.default.getRandomInt(50, 200);
	    }
	
	    for (var i = 1; 1 < len ? i <= len : i >= len; 1 < len ? i++ : i--) {
	      seqs.push(new Sequence(SeqGen._generateSequence(seqLen), "seq" + i, "r" + i));
	    }
	    return seqs;
	  },
	
	  getRandomChar: function getRandomChar(dict) {
	    var possible = dict || "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	    return possible.charAt(Math.floor(Math.random() * possible.length));
	  },
	
	  // generates a dummy sequences
	  // @param len [int] number of generated sequences
	  // @param seqLen [int] length of the generated sequences
	  genConservedSequences: function genConservedSequences(len, seqLen, dict) {
	    var seqs = [];
	    if (!(typeof len !== "undefined" && len !== null)) {
	      len = _bmath2.default.getRandomInt(3, 5);
	    }
	    if (!(typeof seqLen !== "undefined" && seqLen !== null)) {
	      seqLen = _bmath2.default.getRandomInt(50, 200);
	    }
	
	    dict = dict || "ACDEFGHIKLMNPQRSTVWY---";
	
	    for (var _i = 1; 1 < len ? _i <= len : _i >= len; 1 < len ? _i++ : _i--) {
	      seqs[_i - 1] = "";
	    }
	
	    var tolerance = 0.2;
	
	    var conservAim = 1;
	    var end = seqLen - 1;
	    for (var _i2 = 0; 0 < end ? _i2 <= end : _i2 >= end; 0 < end ? _i2++ : _i2--) {
	      if (_i2 % 3 === 0) {
	        conservAim = _bmath2.default.getRandomInt(50, 100) / 100;
	      }
	      var observed = [];
	      var end1 = len - 1;
	      for (var j = 0; 0 < end1 ? j <= end1 : j >= end1; 0 < end1 ? j++ : j--) {
	        var counter = 0;
	        var c = void 0;
	        while (counter < 100) {
	          c = SeqGen.getRandomChar(dict);
	          var cConserv = Stat(observed);
	          cConserv.addSeq(c);
	          counter++;
	          if (Math.abs(conservAim - cConserv.scale(cConserv.conservation())[0]) < tolerance) {
	            break;
	          }
	        }
	        seqs[j] += c;
	        observed.push(c);
	      }
	    }
	
	    var pseqs = [];
	    for (var i = 1; 1 < len ? i <= len : i >= len; 1 < len ? i++ : i--) {
	      pseqs.push(new Sequence(seqs[i - 1], "seq" + i, "r" + i));
	    }
	
	    return pseqs;
	  }
	};
	exports.default = SeqGen;

/***/ },
/* 124 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	module.exports.seq = __webpack_require__(125);

/***/ },
/* 125 */
/***/ function(module, exports) {

	"use strict";
	
	module.exports = function (seq, name, id) {
	    this.seq = seq;
	    this.name = name;
	    this.id = id;
	    this.meta = {};
	};

/***/ },
/* 126 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	var _ = __webpack_require__(11);
	
	var stat = function stat(seqs, opts) {
	  // if someone forgets new
	  if (!this || this.constructor !== stat) {
	    return new stat(seqs);
	  }
	  if (seqs === undefined || typeof seqs === "string") {
	    throw new TypeError("you need to give the seq stat an array");
	  }
	  //if(seqs.length == 0){
	  //throw new TypeError("you need to give the seq stat a real array");
	  //}
	  this.resetSeqs(seqs);
	  this.alphabetSize = 4;
	  this._useBackground = false;
	  this.useGaps = false;
	  this.ignoredChars = ["-", "*"];
	  _.extend(this, opts);
	};
	
	stat.prototype.addSeq = function addSeq(seq) {
	  this.seqs.push(seq);
	  this._reset();
	};
	
	stat.prototype.removeSeq = function addSeq(seq) {
	  // check for int or string
	  if (typeof seq === 'number') {
	    this.seqs.splice(seq, 1);
	  } else {
	    // identify matches (we could have multiple)
	    _.each(this.seqs, function (s, i) {
	      if (seq === s) {
	        this.seqs.splice(i, 1);
	      }
	    }.bind(this));
	  }
	  this._reset();
	};
	
	stat.prototype.addSeqs = function addSeqs(seqs) {
	  seqs.forEach(function (seq) {
	    this.addSeq(seq);
	  }.bind(this));
	};
	
	stat.prototype.resetSeqs = function reset(seqs) {
	  this.seqs = [];
	
	  // support sequence models
	  if (!seqs instanceof Array || "at" in seqs) {
	    this.mseqs = seqs;
	    var mSeqsPluck = function mSeqsPluck() {
	      var seqArr = this.mseqs.pluck("seq");
	      this.resetSeqs(seqArr);
	    };
	    seqs.on("add change reset ", mSeqsPluck, this);
	    mSeqsPluck.call(this);
	  } else {
	    this.addSeqs(seqs);
	    this._reset();
	    this.trigger("reset");
	  }
	};
	
	var calcValues = ["consensus", "frequency", "maxLength", "ic", "gaps"];
	
	stat.prototype._reset = function _reset() {
	  for (var i = 0; i < calcValues.length; i++) {
	    this["_" + calcValues[i]] = undefined;
	  }
	  this._identity = undefined;
	  this._background = undefined;
	};
	
	// -----------------------------------------------------------------------------
	// BEGIN: setter/getter
	// -----------------------------------------------------------------------------
	
	stat.prototype.setBackground = function setBackground(b) {
	  this._useBackground = b;
	  this._reset();
	};
	
	stat.prototype.useBackground = function useBackground() {
	  this.setBackground(true);
	};
	
	stat.prototype.setDNA = function setNucleotide() {
	  this.alphabetSize = 4;
	};
	
	stat.prototype.setProtein = function setDNA() {
	  this.alphabetSize = 20;
	};
	
	// -----------------------------------------------------------------------------
	// BEGIN: auto wrappers
	// -----------------------------------------------------------------------------
	
	// neat auto-wrappers
	calcValues.forEach(function (key) {
	  stat.prototype[key] = function () {
	    if (this["_" + key] === undefined) {
	      this["_" + key] = this[key + "Calc"]();
	    }
	    return this["_" + key];
	  };
	});
	
	stat.prototype.identity = function identitiy(seq) {
	  // do not cache if its called with a special compare seq
	  var ident;
	  if (this._identity === undefined || seq) {
	    ident = this.identityCalc(seq);
	    this._identity = undefined;
	  }
	  return this._identity || ident;
	};
	
	// set your own background with obj.bg
	stat.prototype.background = function background() {
	  if (this.bg !== undefined) {
	    return this.bg;
	  }
	  if (this._background === undefined) {
	    this.backgroundCalc();
	  }
	  return this._background;
	};
	
	// -----------------------------------------------------------------------------
	// BEGIN: calc tools
	// -----------------------------------------------------------------------------
	
	// calculates the relative frequency of a base at a given position
	// this is needed e.g. for the entropy calculation
	// seqs: array of sequences (strings)
	// opts:
	//    all: boolean (use to show the frequencies for all letters [including the ignored ones]
	//    (default false)
	// @returns array of all positions with a dictionary of all bases with their relative frequency
	stat.prototype.frequencyCalc = function frequencyCalc(opts) {
	  var occs, totalPerPos;
	  occs = new Array(this.maxLength());
	  totalPerPos = new Array(this.seqs.length);
	  var ignoredChars = this.ignoredChars;
	  if (opts !== undefined && opts.all) {
	    ignoredChars = [];
	  }
	
	  // count the occurrences of the chars at a position
	  _.each(this.seqs, function (el) {
	    _.each(el, function (c, pos) {
	      if (ignoredChars.indexOf(c) >= 0) return;
	      if (occs[pos] === undefined) {
	        occs[pos] = {};
	      }
	      if (occs[pos][c] === undefined) {
	        occs[pos][c] = 0;
	      }
	      occs[pos][c]++;
	      if (totalPerPos[pos] === undefined) {
	        totalPerPos[pos] = 0;
	      }
	      totalPerPos[pos]++;
	    });
	  });
	
	  // normalize to 1
	  _.each(occs, function (el, pos) {
	    return _.each(el, function (val, c) {
	      return occs[pos][c] = val / totalPerPos[pos];
	    });
	  });
	  this._frequency = occs;
	  return occs;
	};
	
	// seqs: array of sequences (strings)
	stat.prototype.backgroundCalc = function backgroundCalc() {
	  var occ = {};
	  var total = 0;
	
	  // count the occurences of the chars of a position
	  _.each(this.seqs, function (el) {
	    _.each(el, function (c) {
	      if (occ[c] === undefined) {
	        occ[c] = 0;
	      }
	      occ[c]++;
	      return total++;
	    });
	  });
	
	  // normalize to 1
	  occ = _.mapValues(occ, function (val) {
	    return val / total;
	  });
	  this._background = occ;
	  return occ;
	};
	
	// information content after Shannon
	// * gaps are excluded
	stat.prototype.icCalc = function icCalc() {
	  var f = this.frequency();
	  if (this._useBackground) {
	    var b = this.background();
	  }
	  var ignoredChars = this.ignoredChars;
	  var useBackground = this._useBackground;
	  var ic = _.map(f, function (el) {
	    return _.reduce(el, function (memo, val, c) {
	      if (ignoredChars.indexOf(c) >= 0) return memo;
	      if (useBackground) {
	        val = val / b[c];
	      }
	      return memo - val * (Math.log(val) / Math.log(2));
	    }, 0);
	  });
	  this._ic = ic;
	  return ic;
	};
	
	// sequence conservation after Schneider and Stephens (1990)
	// @cite Schneider, T.D. and Stephens, R.M. 1990. Sequence logos: A new way to
	// display consensus sequences. Nucleic Acids Res. 18: 6097–6100.
	stat.prototype.conservation = function conservation(alphabetSize) {
	  var ic = this.ic();
	  var gaps = this.gaps();
	  var self = this;
	
	  alphabetSize = alphabetSize || this.alphabetSize;
	  var icMax = Math.log(alphabetSize) / Math.log(2);
	  var i = 0;
	  var conserv = _.map(ic, function (el) {
	    var ret = icMax - el;
	    if (self.useGaps) {
	      ret = ret * (1 - gaps[i++]);
	    }
	    return ret;
	  });
	  return conserv;
	};
	
	// sequence conservation after Schneider and Stephens (1990)
	// conservation for each amino acid
	// * gaps are excluded
	stat.prototype.conservResidue = function conservation(input) {
	  var alphabetSize = input ? input.alphabetSize : undefined;
	  var ic;
	  var ignoredChars = this.ignoredChars;
	  if (input !== undefined && input.scaled) {
	    ic = this.scale(this.conservation(alphabetSize));
	  } else {
	    ic = this.conservation(alphabetSize);
	  }
	  var f = this.frequency();
	  var keys;
	  var conserv = _.map(f, function (el, i) {
	    keys = _.reject(_.keys(el), function (c) {
	      return ignoredChars.indexOf(c) >= 0;
	    });
	    var obj = {};
	    _.each(keys, function (key) {
	      obj[key] = el[key] * ic[i];
	    });
	    return obj;
	  });
	  return conserv;
	};
	
	// type 2 sequence logo method
	// scales relative to background
	stat.prototype.conservResidue2 = function conservation(alphabetSize) {
	  var f = this.frequency();
	  var ic = this.conservation(alphabetSize);
	  var b = this.background();
	  var conserv = _.map(f, function (el, i) {
	    return _.map(el, function (val) {
	      var sum = _.reduce(f[i], function (memo, e) {
	        return memo + e / b[i];
	      }, 0);
	      return val / b[i] / sum * ic[i];
	    }, 0);
	  });
	  return conserv;
	};
	
	// scale information content or conservation to 1
	stat.prototype.scale = function conservation(ic, alphabetSize) {
	  alphabetSize = alphabetSize || this.alphabetSize;
	  var icMax = Math.log(alphabetSize) / Math.log(2);
	  var conserv = _.map(ic, function (el) {
	    return el / icMax;
	  });
	  return conserv;
	};
	
	stat.prototype.maxLengthCalc = function () {
	  if (this.seqs.length === 0) {
	    return 0;
	  }
	  return _.max(this.seqs, function (seq) {
	    return seq.length;
	  }).length;
	};
	
	// seqs: array of sequences (strings)
	// @returns consenus sequence
	stat.prototype.consensusCalc = function consensusCal() {
	  var occs = new Array(this.maxLength());
	
	  // count the occurrences of the chars of a position
	  _.each(this.seqs, function (el) {
	    _.each(el, function (c, pos) {
	      if (occs[pos] === undefined) {
	        occs[pos] = {};
	      }
	      if (occs[pos][c] === undefined) {
	        occs[pos][c] = 0;
	      }
	      occs[pos][c]++;
	    });
	  });
	
	  // now pick the char with most occurrences
	  this._consensus = _.reduce(occs, function (memo, occ) {
	    var keys;
	    keys = _.keys(occ);
	    return memo += _.max(keys, function (key) {
	      return occ[key];
	    });
	  }, "");
	
	  return this._consensus;
	};
	
	// seqs: array of sequences (strings)
	// consensus: calculated consensus seq
	// calculates for each sequence
	// * matches with the consensus seq
	// * identity = matchedChars / totalChars (excluding gaps)
	// @returns: array of length of the seqs with the identity to the consensus (double)
	stat.prototype.identityCalc = function identitiyCalc(compareSeq) {
	  var consensus = compareSeq || this.consensus();
	  this._identity = this.seqs.map(function (seq) {
	    var matches = 0;
	    var total = 0;
	    for (var i = 0; i < seq.length; i++) {
	      if (seq[i] !== "-" && consensus[i] !== "-") {
	        total++;
	        if (seq[i] === consensus[i]) {
	          matches++;
	        }
	      }
	    }
	    return matches / total;
	  });
	  return this._identity;
	};
	
	// percentage of gaps per column
	stat.prototype.gapsCalc = function gapsCount() {
	  var mLength = this.maxLength();
	  if (mLength <= 1 || typeof mLength === "undefined") {
	    return [];
	  }
	  var occs = new Array(this.maxLength());
	  // count the occurrences of the chars of a position
	  _.each(this.seqs, function (el) {
	    _.each(el, function (c, pos) {
	      if (occs[pos] === undefined) {
	        occs[pos] = {
	          g: 0,
	          t: 0
	        };
	      }
	      c = c === "-" ? "g" : "t";
	      occs[pos][c]++;
	    });
	  });
	
	  // now pick the char with most occurrences
	  this._gaps = _.map(occs, function (el) {
	    return el.g / (el.g + el.t);
	  });
	  return this._gaps;
	};
	
	_.mixin({
	  mapValues: function mapValues(obj, f_val) {
	    return _.object(_.keys(obj), _.map(obj, f_val));
	  }
	});
	
	__webpack_require__(57).mixin(stat.prototype);
	
	module.exports = stat;

/***/ },
/* 127 */
/***/ function(module, exports, __webpack_require__) {

	"use strict";
	
	Object.defineProperty(exports, "__esModule", {
	  value: true
	});
	
	var _Sequence = __webpack_require__(19);
	
	Object.defineProperty(exports, "seq", {
	  enumerable: true,
	  get: function get() {
	    return _interopRequireDefault(_Sequence).default;
	  }
	});
	
	var _SeqCollection = __webpack_require__(18);
	
	Object.defineProperty(exports, "seqcol", {
	  enumerable: true,
	  get: function get() {
	    return _interopRequireDefault(_SeqCollection).default;
	  }
	});
	
	var _Feature = __webpack_require__(21);
	
	Object.defineProperty(exports, "feature", {
	  enumerable: true,
	  get: function get() {
	    return _interopRequireDefault(_Feature).default;
	  }
	});
	
	var _FeatureCol = __webpack_require__(20);
	
	Object.defineProperty(exports, "featurecol", {
	  enumerable: true,
	  get: function get() {
	    return _interopRequireDefault(_FeatureCol).default;
	  }
	});

	function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/***/ },
/* 128 */
/***/ function(module, exports, __webpack_require__) {

	// style-loader: Adds some css to the DOM by adding a <style> tag
	
	// load the styles
	var content = __webpack_require__(129);
	if(typeof content === 'string') content = [[module.id, content, '']];
	// add the styles to the DOM
	var update = __webpack_require__(131)(content, {});
	if(content.locals) module.exports = content.locals;
	// Hot Module Replacement
	if(false) {
		// When the styles change, update the <style> tags
		if(!content.locals) {
			module.hot.accept("!!./../node_modules/css-loader/index.js!./msa.css", function() {
				var newContent = require("!!./../node_modules/css-loader/index.js!./msa.css");
				if(typeof newContent === 'string') newContent = [[module.id, newContent, '']];
				update(newContent);
			});
		}
		// When the module is disposed, remove the <style> tags
		module.hot.dispose(function() { update(); });
	}

/***/ },
/* 129 */
/***/ function(module, exports, __webpack_require__) {

	exports = module.exports = __webpack_require__(130)();
	// imports
	
	
	// module
	exports.push([module.id, "/* BASIC */\n\n.biojs_msa_div {\n\n}\n\n.biojs_msa_stage {\n    cursor: default;\n    line-height: normal;\n    font-family: Helvetica;\n}\n\n.biojs_msa_seqblock {\n    cursor: move;\n}\n\n.biojs_msa_layer{\n    display: block;\n    white-space: nowrap;\n}\n\n.biojs_msa_labels {\n    color:black;\n    display: inline-block;\n    white-space: nowrap;\n    cursor: pointer;\n    vertical-align:middle;\n    overflow: hidden;\n    text-overflow: clip;\n    /*margin:auto; */\n    text-align: left;\n}\n\n.biojs_msa_header {\n    white-space: nowrap;\n    text-align: left;\n}\n\n.biojs_msa_labelrow:before {\n    content: '';\n    display: inline-block;\n    width: 0;\n    height: 100%;\n    vertical-align: middle;\n}\n\n.biojs_msa_labelrow{\n    height: 100%;\n}\n\n.biojs_msa_labelblock::-webkit-scrollbar, .biojs_msa_rheader::-webkit-scrollbar{\n    // FIX scrollbars on Mac\n    -webkit-appearance: none;\n    width: 7px;\n    height: 7px;\n}\n.biojs_msa_labelblock::-webkit-scrollbar-thumb, .biojs_msa_rheader::-webkit-scrollbar-thumb{\n    border-radius: 4px;\n    background-color: rgba(0,0,0,.5);\n    box-shadow: 0 0 1px rgba(255,255,255,.5);\n}\n\n/* END BASIC */\n/* Marker */\n\n.biojs_msa_marker {\n  color: #999;\n  white-space: nowrap;\n}\n\n.biojs_msa_marker .msa-col-header {\n  cursor: pointer;\n  cursor: pointer;\n  text-align: center;\n}\n\n.biojs_msa_marker .msa-col-header:hover {\n  color: #f00;\n}\n\n/* END Marker */\n/* Menubar */\n\n.smenubar .smenubar_alink {\n    background: #3498db;\n    background-image: -webkit-linear-gradient(top, #3498db, #2980b9);\n    background-image: -moz-linear-gradient(top, #3498db, #2980b9);\n    background-image: -ms-linear-gradient(top, #3498db, #2980b9);\n    background-image: -o-linear-gradient(top, #3498db, #2980b9);\n    background-image: linear-gradient(to bottom, #3498db, #2980b9);\n    -webkit-border-radius: 28;\n    -moz-border-radius: 28;\n    border-radius: 28px;\n    font-family: Arial;\n    color: #ffffff;\n    padding: 3px 10px 3px 10px;\n    margin-left: 10px;\n    text-decoration: none;\n}\n.smenubar {\n    display: inline-block;\n}\n\n.smenubar .smenubar_alink:hover {\n    cursor: pointer;\n}\n\n\n/* jquery dropdown CSS */\n\n.smenu-dropdown {\n    position: absolute;\n    z-index: 9;\n    display: none;\n    margin-left: 5px;\n    margin-top: 22px;\n}\n\n.smenu-dropdown .smenu-dropdown-menu,\n.smenu-dropdown .smenu-dropdown-panel {\n    min-width: 160px;\n    max-width: 360px;\n    list-style: none;\n    background: #FFF;\n    border: solid 1px #DDD;\n    border: solid 1px rgba(0, 0, 0, .2);\n    border-radius: 6px;\n    box-shadow: 0 5px 10px rgba(0, 0, 0, .2);\n    overflow: visible;\n    padding: 4px 0;\n    margin: 0;\n}\n\n.smenu-dropdown .smenu-dropdown-panel {\n    padding: 10px;\n}\n\n.smenu-dropdown.smenu-dropdown-scroll .smenu-dropdown-menu,\n.smenu-dropdown.smenu-dropdown-scroll .smenu-dropdown-panel {\n    max-height: 358px;\n    overflow: auto;\n}\n\n.smenu-dropdown .smenu-dropdown-menu li {\n    display: block;\n    color: #555;\n    text-decoration: none;\n    line-height: 18px;\n    padding: 3px 15px;\n    white-space: nowrap;\n}\n\n.smenu-dropdown .smenu-dropdown-menu li:hover {\n    background-color: #08C;\n    color: #FFF;\n    cursor: pointer;\n}\n\n.smenu-dropdown .smenu-dropdown-menu .smenu-dropdown-divider {\n    font-size: 1px;\n    border-top: solid 1px #E5E5E5;\n    padding: 0;\n    margin: 5px 0;\n}\n\n/* END Menubar */\n\n.biojs_msa_div {\n  position: relative;\n}\n\n.biojs_msa_scale {\n  position: absolute;\n  bottom: 0;\n  right: 0;\n  background-color: #fff;\n  box-shadow: 0 2px 3px #999;\n  border-radius: 3px;\n  margin: 5px 0 0 auto;\n  padding: 5px;\n  text-align: center;\n}\n.biojs_msa_scale .msa-btngroup {\n  margin: 5px auto 0;\n}\n.biojs_msa_scale [type=\"range\"] {\n  cursor: pointer;\n}\n\n.biojs_msa_scale .msa-scale-minimised {\n}\n.biojs_msa_scale .msa-scale-minimised {\n}\n.biojs_msa_scale .msa-btn-close {\n  text-align: right;\n  font-size: 0.8em;\n  padding: 2px;\n}\n.biojs_msa_scale .msa-btn-open {\n  background-color: #fff;\n}\n\n.biojs_msa_scale .msa-hide {\n  display: none;\n}\n\n.msa-btn {\n  cursor: pointer;\n  font-size: 1.1em;\n  display: inline-block;\n  padding: 2px 8px;\n  margin-bottom: 0;\n  border: 1px solid transparent;\n  border-radius: 4px;\n  box-sizing: border-box;\n}\n.msa-btn:hover {\n  background-color: #ddd;\n}\n", ""]);
	
	// exports


/***/ },
/* 130 */
/***/ function(module, exports) {

	"use strict";
	
	/*
		MIT License http://www.opensource.org/licenses/mit-license.php
		Author Tobias Koppers @sokra
	*/
	// css base code, injected by the css-loader
	module.exports = function () {
		var list = [];
	
		// return the list of modules as css string
		list.toString = function toString() {
			var result = [];
			for (var i = 0; i < this.length; i++) {
				var item = this[i];
				if (item[2]) {
					result.push("@media " + item[2] + "{" + item[1] + "}");
				} else {
					result.push(item[1]);
				}
			}
			return result.join("");
		};
	
		// import a list of modules into the list
		list.i = function (modules, mediaQuery) {
			if (typeof modules === "string") modules = [[null, modules, ""]];
			var alreadyImportedModules = {};
			for (var i = 0; i < this.length; i++) {
				var id = this[i][0];
				if (typeof id === "number") alreadyImportedModules[id] = true;
			}
			for (i = 0; i < modules.length; i++) {
				var item = modules[i];
				// skip already imported module
				// this implementation is not 100% perfect for weird media query combinations
				//  when a module is imported multiple times with different media queries.
				//  I hope this will never occur (Hey this way we have smaller bundles)
				if (typeof item[0] !== "number" || !alreadyImportedModules[item[0]]) {
					if (mediaQuery && !item[2]) {
						item[2] = mediaQuery;
					} else if (mediaQuery) {
						item[2] = "(" + item[2] + ") and (" + mediaQuery + ")";
					}
					list.push(item);
				}
			}
		};
		return list;
	};

/***/ },
/* 131 */
/***/ function(module, exports, __webpack_require__) {

	/*
		MIT License http://www.opensource.org/licenses/mit-license.php
		Author Tobias Koppers @sokra
	*/
	var stylesInDom = {},
		memoize = function(fn) {
			var memo;
			return function () {
				if (typeof memo === "undefined") memo = fn.apply(this, arguments);
				return memo;
			};
		},
		isOldIE = memoize(function() {
			return /msie [6-9]\b/.test(window.navigator.userAgent.toLowerCase());
		}),
		getHeadElement = memoize(function () {
			return document.head || document.getElementsByTagName("head")[0];
		}),
		singletonElement = null,
		singletonCounter = 0,
		styleElementsInsertedAtTop = [];
	
	module.exports = function(list, options) {
		if(false) {
			if(typeof document !== "object") throw new Error("The style-loader cannot be used in a non-browser environment");
		}
	
		options = options || {};
		// Force single-tag solution on IE6-9, which has a hard limit on the # of <style>
		// tags it will allow on a page
		if (typeof options.singleton === "undefined") options.singleton = isOldIE();
	
		// By default, add <style> tags to the bottom of <head>.
		if (typeof options.insertAt === "undefined") options.insertAt = "bottom";
	
		var styles = listToStyles(list);
		addStylesToDom(styles, options);
	
		return function update(newList) {
			var mayRemove = [];
			for(var i = 0; i < styles.length; i++) {
				var item = styles[i];
				var domStyle = stylesInDom[item.id];
				domStyle.refs--;
				mayRemove.push(domStyle);
			}
			if(newList) {
				var newStyles = listToStyles(newList);
				addStylesToDom(newStyles, options);
			}
			for(var i = 0; i < mayRemove.length; i++) {
				var domStyle = mayRemove[i];
				if(domStyle.refs === 0) {
					for(var j = 0; j < domStyle.parts.length; j++)
						domStyle.parts[j]();
					delete stylesInDom[domStyle.id];
				}
			}
		};
	}
	
	function addStylesToDom(styles, options) {
		for(var i = 0; i < styles.length; i++) {
			var item = styles[i];
			var domStyle = stylesInDom[item.id];
			if(domStyle) {
				domStyle.refs++;
				for(var j = 0; j < domStyle.parts.length; j++) {
					domStyle.parts[j](item.parts[j]);
				}
				for(; j < item.parts.length; j++) {
					domStyle.parts.push(addStyle(item.parts[j], options));
				}
			} else {
				var parts = [];
				for(var j = 0; j < item.parts.length; j++) {
					parts.push(addStyle(item.parts[j], options));
				}
				stylesInDom[item.id] = {id: item.id, refs: 1, parts: parts};
			}
		}
	}
	
	function listToStyles(list) {
		var styles = [];
		var newStyles = {};
		for(var i = 0; i < list.length; i++) {
			var item = list[i];
			var id = item[0];
			var css = item[1];
			var media = item[2];
			var sourceMap = item[3];
			var part = {css: css, media: media, sourceMap: sourceMap};
			if(!newStyles[id])
				styles.push(newStyles[id] = {id: id, parts: [part]});
			else
				newStyles[id].parts.push(part);
		}
		return styles;
	}
	
	function insertStyleElement(options, styleElement) {
		var head = getHeadElement();
		var lastStyleElementInsertedAtTop = styleElementsInsertedAtTop[styleElementsInsertedAtTop.length - 1];
		if (options.insertAt === "top") {
			if(!lastStyleElementInsertedAtTop) {
				head.insertBefore(styleElement, head.firstChild);
			} else if(lastStyleElementInsertedAtTop.nextSibling) {
				head.insertBefore(styleElement, lastStyleElementInsertedAtTop.nextSibling);
			} else {
				head.appendChild(styleElement);
			}
			styleElementsInsertedAtTop.push(styleElement);
		} else if (options.insertAt === "bottom") {
			head.appendChild(styleElement);
		} else {
			throw new Error("Invalid value for parameter 'insertAt'. Must be 'top' or 'bottom'.");
		}
	}
	
	function removeStyleElement(styleElement) {
		styleElement.parentNode.removeChild(styleElement);
		var idx = styleElementsInsertedAtTop.indexOf(styleElement);
		if(idx >= 0) {
			styleElementsInsertedAtTop.splice(idx, 1);
		}
	}
	
	function createStyleElement(options) {
		var styleElement = document.createElement("style");
		styleElement.type = "text/css";
		insertStyleElement(options, styleElement);
		return styleElement;
	}
	
	function createLinkElement(options) {
		var linkElement = document.createElement("link");
		linkElement.rel = "stylesheet";
		insertStyleElement(options, linkElement);
		return linkElement;
	}
	
	function addStyle(obj, options) {
		var styleElement, update, remove;
	
		if (options.singleton) {
			var styleIndex = singletonCounter++;
			styleElement = singletonElement || (singletonElement = createStyleElement(options));
			update = applyToSingletonTag.bind(null, styleElement, styleIndex, false);
			remove = applyToSingletonTag.bind(null, styleElement, styleIndex, true);
		} else if(obj.sourceMap &&
			typeof URL === "function" &&
			typeof URL.createObjectURL === "function" &&
			typeof URL.revokeObjectURL === "function" &&
			typeof Blob === "function" &&
			typeof btoa === "function") {
			styleElement = createLinkElement(options);
			update = updateLink.bind(null, styleElement);
			remove = function() {
				removeStyleElement(styleElement);
				if(styleElement.href)
					URL.revokeObjectURL(styleElement.href);
			};
		} else {
			styleElement = createStyleElement(options);
			update = applyToTag.bind(null, styleElement);
			remove = function() {
				removeStyleElement(styleElement);
			};
		}
	
		update(obj);
	
		return function updateStyle(newObj) {
			if(newObj) {
				if(newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap)
					return;
				update(obj = newObj);
			} else {
				remove();
			}
		};
	}
	
	var replaceText = (function () {
		var textStore = [];
	
		return function (index, replacement) {
			textStore[index] = replacement;
			return textStore.filter(Boolean).join('\n');
		};
	})();
	
	function applyToSingletonTag(styleElement, index, remove, obj) {
		var css = remove ? "" : obj.css;
	
		if (styleElement.styleSheet) {
			styleElement.styleSheet.cssText = replaceText(index, css);
		} else {
			var cssNode = document.createTextNode(css);
			var childNodes = styleElement.childNodes;
			if (childNodes[index]) styleElement.removeChild(childNodes[index]);
			if (childNodes.length) {
				styleElement.insertBefore(cssNode, childNodes[index]);
			} else {
				styleElement.appendChild(cssNode);
			}
		}
	}
	
	function applyToTag(styleElement, obj) {
		var css = obj.css;
		var media = obj.media;
	
		if(media) {
			styleElement.setAttribute("media", media)
		}
	
		if(styleElement.styleSheet) {
			styleElement.styleSheet.cssText = css;
		} else {
			while(styleElement.firstChild) {
				styleElement.removeChild(styleElement.firstChild);
			}
			styleElement.appendChild(document.createTextNode(css));
		}
	}
	
	function updateLink(linkElement, obj) {
		var css = obj.css;
		var sourceMap = obj.sourceMap;
	
		if(sourceMap) {
			// http://stackoverflow.com/a/26603875
			css += "\n/*# sourceMappingURL=data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))) + " */";
		}
	
		var blob = new Blob([css], { type: "text/css" });
	
		var oldSrc = linkElement.href;
	
		linkElement.href = URL.createObjectURL(blob);
	
		if(oldSrc)
			URL.revokeObjectURL(oldSrc);
	}


/***/ }
/******/ ]);
//# sourceMappingURL=msa.js.map
