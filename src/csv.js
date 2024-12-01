const parseCsv = (data, firstLine) => {
    data = data.toWellFormed();
    let i = 0;
    let line = 1;

    const parseRecord = () => {
        let record = [];

        while (i < data.length) {
            let field = "";

            if (data.at(i) === '"') {
                ++i;

                while (true) {
                    if (i >= data.length) {
                        throw new Error(`Unclosed quoted field on line ${line}.`);
                    } else if (data.at(i) === '"' && data.at(i + 1) === '"') {
                        field += '"';
                        i += 2;
                    } else if (data.at(i) === '"') {
                        ++i
                        break;
                    } else {
                        field += data.at(i);
                        ++i
                    }
                }
            } else {
                while (i < data.length && !'",\n\r'.includes(data.at(i))) {
                    field += data.at(i);
                    ++i;
                }
            }

            record.push(field);

            if (data.at(i) === ',') {
                ++i;
            } else {
                break;
            }
        }

        return record;
    };

    const consumeNewline = () => {
        let consumed = false;
        if (data.at(i) === '\n') {
            ++i;
            ++line;
            consumed = true;
        } else if (data.at(i) === '\r' && data.at(i + 1) === '\n') {
            i += 2;
            ++line;
            consumed = true;
        }
        return consumed;
    }

    // NOTE(simon): Line numbers in the API are 0-indexed for programmer
    // convenience but we are 1-indexed internally for display purposes, hence
    // the +1.
    while (line < firstLine + 1) {
        if (i >= data.length) {
            throw new Error(`There are too few lines in the documents. The document should start on line ${firstLine} but there are only ${line} lines in total.`);
        }

        while (i < data.length && !"\n\r".includes(data.at(i))) {
            ++i;
        }

        consumeNewline();
    }

    const header = parseRecord();

    if ((new Set(header)).size !== header.length) {
        throw new Error(`Duplicate column names on line ${line}`);
    }

    if (!consumeNewline() && i < data.length) {
        throw new Error(`Invalid header on line ${line}, expected a comma or a newline.`);
    }

    let objects = [];

    while (i < data.length) {
        const record = parseRecord();

        if (record.length !== header.length) {
            throw new Error(`Record on line ${line} has too ${record.length < header.length ? "few" : "many"} fields. Expected ${header.length} but got ${record.length}.`);
        }

        let object = {};
        for (let j = 0; j < header.length; ++j) {
            object[header[j]] = record[j];
        }

        objects.push(object);

        if (!consumeNewline() && i < data.length) {
            throw new Error(`Invalid record on line ${line}, expected a comma or a newline.`);
        }
    }

    return objects;
};

export { parseCsv };
