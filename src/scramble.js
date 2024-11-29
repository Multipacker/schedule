let tabledata = [
    [ 'h=t&sid=',           '6='  ],
    [ 'objects=',           '1='  ],
    [ 'sid=',               '2='  ],
    [ '&ox=0&types=0&fe=0', '3=3' ],
    [ '&types=0&fe=0',      '5=5' ],
    [ '&h=t&p=',            '4='  ]
];
let tabledataspecial = [
    [ '=', 'ZZZX1' ],
    [ '&', 'ZZZX2' ],
    [ ',', 'ZZZX3' ],
    [ '.', 'ZZZX4' ],
    [ ' ', 'ZZZX5' ],
    [ '-', 'ZZZX6' ],
    [ '/', 'ZZZX7' ],
    [ '%', 'ZZZX8' ]
];
let pairs = [
    [ '=', 'Q' ],
    [ '&', 'Z' ],
    [ ',', 'X' ],
    [ '.', 'Y' ],
    [ ' ', 'V' ],
    [ '-', 'W' ]
];
let pattern = [
    4, 22, 5, 37, 26, 17, 33, 15,
    39, 11, 45, 20, 2, 40, 19, 36,
    28, 38, 30, 41, 44, 42, 7, 24,
    14, 27, 35, 25, 12, 1, 43, 23,
    6, 16, 3, 9, 47, 46, 48, 50,
    21, 10, 49, 32, 18, 31, 29, 34,
    13, 8
];

function untablespecial(result) {
    for (var i = 0; i < 100; i++) {
        for (var index = tabledataspecial.length - 1; index >= 0 ; --index) {
            var key = tabledataspecial[index];
            result = result.replace(key[1], key[0]);
        }
    }
    return result;
}

function tablespecial(result) {
    for (var i = 0; i < 100; i++) {
        for (var index = 0; index < tabledataspecial.length; index++) {
            var key = tabledataspecial[index];
            result = result.replace(key[0], key[1]);
        }
    }
    return result;
}

function untableshort(result) {
    for (var index = tabledata.length - 1; index >= 0; --index) {
        var key = tabledata[index];
        result = result.replace(key[1], key[0]);
    }
    return result;
}

function tableshort(result) {
    for (var index = 0; index < tabledata.length; index++) {
        var key = tabledata[index];
        result = result.replace(key[0], key[1]);
    }
    return result;
}

function unmodKey(ch) {
    if (ch >= 97 && ch <= 122) {
        return (97 + (ch - 97 + 9) % 26);
    }
    if (ch >= 49 && ch <= 57) {
        return (49 + (ch - 49 + 5) % 9);
    }
    return ch;
}

function modKey(ch) {
    if (ch >= 97 && ch <= 122) {
        return (97 + (ch - 88) % 26);
    }
    if (ch >= 49 && ch <= 57) {
        return (49 + (ch - 45) % 9);
    }
    return ch;
}

function unscrambleChar(ch) {
    for (var index = 0; index < pairs.length; index++) {
        var pair = pairs[index];
        if (ch === pair[1]) {
            return pair[0];
        }
        if (ch === pair[0]) {
            return pair[1];
        }
    }
    return String.fromCharCode(unmodKey(ch.charCodeAt(0)));
}

function scrambleChar(ch) {
    for (var index = 0; index < pairs.length; index++) {
        var pair = pairs[index];
        if (ch === pair[0]) {
            return pair[1];
        }
        if (ch === pair[1]) {
            return pair[0];
        }
    }
    return String.fromCharCode(modKey(ch.charCodeAt(0)));
}

function swap(result, from, to) {
    if ((from < 0) || (from >= result.length)) {
        return;
    }
    if ((to < 0) || (to >= result.length)) {
        return;
    }
    var fromChar = result[from];
    result[from] = result[to];
    result[to] = fromChar;
}

function unswapPattern(result) {
    var steps = result.length;
    for (var step = 0; step < steps; step++) {
        for (var index = pattern.length - 1; index >= 1; index -= 2) {
            swap(
                result,
                pattern[index] + step * pattern.length,
                pattern[index - 1] + step * pattern.length
            );
        }
    }
}

function swapPattern(result) {
    var steps = Math.ceil(result.length, pattern.length);
    for (var step = 0; step < steps; step++) {
        for (var index = 1; index < pattern.length; index += 2) {
            swap(
                result,
                pattern[index] + step * pattern.length,
                pattern[index - 1] + step * pattern.length
            );
        }
    }
}

function unswapChar(result) {
    var split = result.split('');
    unswapPattern(split);
    for (var index = 0; index < split.length; index++) {
        split[index] = unscrambleChar(split[index]);
    }
    return split.join('');
}

function swapChar(result) {
    var split = result.split('');
    for (var index = 0; index < split.length; index++) {
        split[index] = scrambleChar(split[index]);
    }
    swapPattern(split);
    return split.join('');
}

function scramble(query) {
    if (query.length < 2) {
        return query;
    }
    if (query.substring(0, 2) === 'i=') {
        return query;
    }
    var result = decodeURIComponent(query);
    result = tableshort(result);
    result = swapChar(result);
    result = tablespecial(result);
    return encodeURIComponent(result);
}

function unscramble(query) {
    if (query.length < 2) {
        return query;
    }
    if (query.substring(0, 2) === 'i=') {
        return query;
    }
    var result = encodeURIComponent(query);
    result = untablespecial(result);
    result = unswapChar(result);
    result = untableshort(result);
    return decodeURIComponent(result);
}

function encode(url, keyValues, extra) {
    for (var index = 0; index < keyValues.length; index++) {
        keyValues[index] = toString(keyValues[index]).replace(/[+]/g, ' ');
    }
    var lastSlash = toString(url).lastIndexOf('/');
    var page = url.substring(lastSlash + 1);
    if (page.indexOf('r') !== 0) {
        return url + '?i=' + scramble(keyValues.join('&') + toString(extra));
    }
    var dot = '.html';
    var lastDot = toString(url).lastIndexOf('.');

    if (lastDot != - 1) {
        dot = url.substring(lastDot, url.length);
    }
    if (lastSlash != - 1) {
        url = url.substring(0, lastSlash + 1);
    }

    return url + 'ri' + scramble(keyValues.join('&') + toString(extra)) + dot;
};

// NOTE(simon): Not complete
function decode(url) {
    var lastSlash = url.lastIndexOf('/');
    var lastDot   = url.lastIndexOf('.');

    if (lastDot === -1) {
        lastDot = url.length;
    }

    var part = url.substring(lastSlash + 1 + 2, lastDot);
    return unscramble(part);
}

const tests = [
    "https://cloud.timeedit.net/chalmers/web/public/ri167XQQ648Z50Qv87034gZ6y5Y7056Q5Y86Y1.html",
    "https://cloud.timeedit.net/chalmers/web/public/ri16785Q059Z05Q645656765yZ086W7488Y63Q5Q1.html",
    "https://cloud.timeedit.net/chalmers/web/public/ri10783Q056Z06Q645656765yZ086W7488Y63Q5Q1.html",
    "https://cloud.timeedit.net/chalmers/web/public/ri167XQv648Z5QQv87034ZZ6y5Y705fQ0Y86Y1gQ60750.txt",
    "https://cloud.timeedit.net/chalmers/web/public/ri16QXQb648Z5yQv87034ZQ6yvY705nQXY86Y1gQ6075f5ZZ070.csv",
    "https://cloud.timeedit.net/chalmers/web/public/ri617QQQY83Zn4Q5868548Z5y6Z55.ics",
    "https://cloud.timeedit.net/chalmers/web/public/ri1Y53y5Z65ZZ0Q1865698075946x4609gW850QQ5176QQ.html",
    "https://cloud.timeedit.net/chalmers/web/public/ri167XQQ608Z50Qv27003gZ6y6Y7053Q5Y66Y6.html",
    "https://cloud.timeedit.net/chalmers/web/public/ri16YXQ3608Z58Qv2X0037Q6y6Y005265Y66Y6gQ3075763Z7.html",
];

/*
 * objects is a comma separated list of calendar events you want
 * sid has to be 3
 *
 * h=t
 * h=0.e,20241220.p
 * h=20241125-20241201
 */

tests.forEach(url => {
    console.log(`${url}`);
    console.log(decode(url).split('&').sort());
});

const urls = [
    "https://cloud.timeedit.net/chalmers/web/public/ri16YXQ3608Z58Qv2X0037Q6y6Y005265Y66Y6gQ3075763Z7.html",
    "https://cloud.timeedit.net/chalmers/web/public/ri167XQQ648Z50Qv77034gZ6y5Y7051Q5Y86Y1.html",
];
const filtered = urls
    .flatMap(url => decode(url).split('&'))
    .filter(param => param.startsWith("objects"))
    .map(param => param.split("=")[1])
    .flatMap(param => param.split(","))
    .join(",");
console.log(filtered);
//console.log(`${scramble("objects=196842.194&sid=3&h=t")}`);
//console.log(`${scramble("objects=196842.194&sid=3&h=20241201-20241220")}`);
//console.log(`${scramble("objects=196842.194&sid=3&h=t,h=20241125-20241220")}`);
