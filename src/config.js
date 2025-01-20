const stripComments = string => {
    let result = "";

    const Modes = Object.freeze({
        DEFAULT: 0,
        STRING:  1,
        SINGLE_LINE:  2,
        MULTI_LINE:  3,
    });
    let mode = Modes.DEFAULT;
    let nest_count = 0;
    let copy_start = 0;
    for (let index = 0; index + 1 < string.length;) {
        const current = string[index + 0];
        const next    = string[index + 1]; // NOTE(simon): Gives undefined for the last character.

        switch (mode) {
            case Modes.DEFAULT: {
                if (current === '"') {
                    ++index;
                    mode = Modes.STRING;
                } else if (current === '/' && next === '/') {
                    result += string.substring(copy_start, index);
                    index += 2;
                    mode = Modes.SINGLE_LINE;
                } else if (current === '/' && next === '*') {
                    result += string.substring(copy_start, index);
                    index += 2;
                    mode = Modes.MULTI_LINE;
                } else {
                    ++index;
                }
            } break;
            case Modes.STRING: {
                if (current === '\\' && next == '"') {
                    index += 2;
                } else if (current === '"') {
                    ++index;
                    mode = Modes.DEFAULT;
                } else {
                    ++index;
                }
            } break;
            case Modes.SINGLE_LINE: {
                if (current === '\n') {
                    ++index;
                    copy_start = index;
                    mode = Modes.DEFAULT;
                } else {
                    ++index;
                }
            } break;
            case Modes.MULTI_LINE: {
                if (current === '/' && next === '*') {
                    index += 2;
                    ++nest_count;
                } else if (current === '*' && next === '/') {
                    index += 2;
                    if (nest_count === 0) {
                        mode = Modes.DEFAULT;
                        copy_start = index;
                    } else {
                        --nest_count;
                    }
                } else {
                    ++index;
                }
            } break;
        }
    }

    if (mode === Modes.SINGLE_LINE) {
        copy_start = string.length;
    } else if (mode === Modes.MULTI_LINE) {
        throw new Error("Unclosed multiline comment.");
    }

    result += string.substring(copy_start, string.length);

    return result;
};

export { stripComments };
