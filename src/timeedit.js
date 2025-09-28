/*
 * Explanation of the various fields you can send to TimeEdit:
 * * sid = must be equal to 3 (not sure what it is)
 * * p = how many weeks forward you want to get. 0 means just this week
 *       ("period", probably)
 * * objects = comma separated list of calendars to retrieve
 */

const tabledata = [
    [ 'h=t&sid=',           '6='  ],
    [ 'objects=',           '1='  ],
    [ 'sid=',               '2='  ],
    [ '&ox=0&types=0&fe=0', '3=3' ],
    [ '&types=0&fe=0',      '5=5' ],
    [ '&h=t&p=',            '4='  ]
];

const tabledataspecial = [
    [ '=', 'ZZZX1' ],
    [ '&', 'ZZZX2' ],
    [ ',', 'ZZZX3' ],
    [ '.', 'ZZZX4' ],
    [ ' ', 'ZZZX5' ],
    [ '-', 'ZZZX6' ],
    [ '/', 'ZZZX7' ],
    [ '%', 'ZZZX8' ]
];

const pairs = [
    [ '=', 'Q' ],
    [ '&', 'Z' ],
    [ ',', 'X' ],
    [ '.', 'Y' ],
    [ ' ', 'V' ],
    [ '-', 'W' ]
];

const pattern = [
    4,  22, 5,  37, 26, 17, 33, 15, 39, 11,
    45, 20, 2,  40, 19, 36, 28, 38, 30, 41,
    44, 42, 7,  24, 14, 27, 35, 25, 12, 1,
    43, 23, 6,  16, 3,  9,  47, 46, 48, 50,
    21, 10, 49, 32, 18, 31, 29, 34, 13, 8
];

const untablespecial = result => {
    for (let i = 0; i < 100; i++) {
        for (const key of tabledataspecial.reverse()) {
            result = result.replace(key[1], key[0]);
        }
    }
    return result;
}

const unmodKey = ch => {
    if (ch >= 97 && ch <= 122) {
        return (97 + (ch - 97 + 17) % 26);
    }
    if (ch >= 49 && ch <= 57) {
        return (49 + (ch - 49 + 5) % 9);
    }
    return ch;
}

const unscrambleChar = ch => {
    for (const pair of pairs) {
        if (ch === pair[1]) {
            return pair[0];
        }
        if (ch === pair[0]) {
            return pair[1];
        }
    }
    return String.fromCharCode(unmodKey(ch.charCodeAt(0)));
}

const swap = (result, from, to) => {
    if ((from < 0) || (from >= result.length)) {
        return;
    }
    if ((to < 0) || (to >= result.length)) {
        return;
    }
    const fromChar = result[from];
    result[from] = result[to];
    result[to] = fromChar;
}

const unswapPattern = result => {
    for (let step = result.length - 1; step >= 0; --step) {
        for (let index = pattern.length - 1; index >= 1; index -= 2) {
            swap(
                result,
                pattern[index] + step * pattern.length,
                pattern[index - 1] + step * pattern.length
            );
        }
    }
}

const unswapChar = result => {
    const split = result.split('');
    unswapPattern(split);
    return split.map(unscrambleChar).join('');
}

const untableshort = result => {
    for (const key of tabledata.reverse()) {
        result = result.replace(key[1], key[0]);
    }
    return result;
}

const unscramble = query => {
    if (query.length < 2) {
        return query;
    }
    if (query.substring(0, 2) === 'i=') {
        return query;
    }
    let result = decodeURIComponent(query);
    result = untablespecial(result);
    result = unswapChar(result);
    result = untableshort(result);
    return result;
}

const modKey = ch => {
    if (ch >= 97 && ch <= 122) {
        return (97 + (ch - 88) % 26);
    }
    if (ch >= 49 && ch <= 57) {
        return (49 + (ch - 45) % 9);
    }
    return ch;
}

const scrambleChar = ch => {
    for (const pair of pairs) {
        if (ch === pair[0]) {
            return pair[1];
        }
        if (ch === pair[1]) {
            return pair[0];
        }
    }
    return String.fromCharCode(modKey(ch.charCodeAt(0)));
}

const swapPattern = result => {
    for (let step = 0; step < result.length; ++step) {
        for (let index = 1; index < pattern.length; index += 2) {
            swap(
                result,
                pattern[index] + step * pattern.length,
                pattern[index - 1] + step * pattern.length
            );
        }
    }
}

const swapChar = result => {
    const split = result.split('').map(scrambleChar);
    swapPattern(split);
    return split.join('');
}

const tableshort = result => {
    for (const key of tabledata) {
        result = result.replace(key[0], key[1]);
    }
    return result;
}

const tablespecial = result => {
    for (let i = 0; i < 100; i++) {
        for (const key of tabledataspecial) {
            result = result.replace(key[0], key[1]);
        }
    }
    return result;
}

const scramble = query => {
    if (query.length < 2) {
        return query;
    }
    if (query.substring(0, 2) === 'i=') {
        return query;
    }
    let result = tableshort(query);
    result = swapChar(result);
    result = tablespecial(result);
    return encodeURIComponent(result);
}

const decode = url => {
    const lastSlash = url.lastIndexOf('/');
    const lastDot   = url.lastIndexOf('.');

    if (lastDot === -1) {
        lastDot = url.length;
    }

    const part = url.substring(lastSlash + 1 + 2, lastDot);
    const parameters = new Map();
    unscramble(part).split("&").forEach(parameter => {
        const keyValue = parameter.split("=");
        parameters.set(keyValue[0], keyValue[1]);
    });
    return parameters;
}

const encode = keyValues => {
    const parameters = keyValues.map(value => value.replace(/[+]/g, ' ')).join('&');
    const url = `https://cloud.timeedit.net/chalmers/web/public/ri${scramble(parameters)}.json`;
    return url;
};

const getEvents = urls => {
    const parameters = urls.map(decode);
    const objects = parameters.flatMap(parameters => parameters.get("objects").split(","));
    const url = encode([ "sid=3", "p=4", `objects=${objects.join(",")}`, ]);

    console.log(`Downloading calendar from ${url}.`);

    return fetch(url)
        .then(response => response.text())
        .then(JSON.parse)
        .then(schedule => {
            const column_names = schedule.columnheaders;
            console.log(`Available column names are: ${column_names}`);

            const events = schedule.reservations.map(event => {
                let new_event = {
                    start: new Date(event.startdate + "T" + event.starttime),
                    end:   new Date(event.enddate   + "T" + event.endtime),
                    columns: {},
                };

                const column_count = Math.min(column_names.length, event.columns.length);
                for (let i = 0; i < column_count; ++i) {
                    new_event.columns[column_names[i]] = event.columns[i];
                }

                return new_event;
            });

            return events;
        });
};

export { getEvents };
