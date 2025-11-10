import crypto from "crypto";
import fs     from "node:fs/promises";
import fsSync from "node:fs";
import os     from "os";
import path   from "path";

import { getEvents }     from "./timeedit.js";
import { stripComments } from "./config.js";

const config = await fs.readFile("config.json", { encoding: "utf8", })
    .then(stripComments)
    .then(JSON.parse)
    .catch(error => {
        console.log(`Could not load configuration file 'config.json'. Using default configuration\n\t${error}`);
        return {};
    })
    // NOTE(simon): Fill in defaults for values that are not specified.
    .then(data => ({
        cacheDirectory:     data.cacheDirectory     ?? ".",
        calendarDirectory:  data.calendarDirectory  ?? ".",
        regenerateInterval: data.regenerateInterval ?? 20,
    }));

const ensureConfigDirectory = directory => {
    if (!fsSync.existsSync(directory)) {
        fsSync.mkdirSync(directory, { recursive: true, });
    }
};

ensureConfigDirectory(config.cacheDirectory);
ensureConfigDirectory(config.calendarDirectory);

const getCalendar = async urls => {
    const hash = crypto.createHmac("sha256", "schedule")
        .update(urls.sort().join(" "))
        .digest("hex")
    const filename = path.join(config.cacheDirectory, `${hash}.json`);

    return fs.readFile(filename, "utf8")
        .then(JSON.parse)
        .then(events => events.map(event => {
            event.start = new Date(event.start);
            event.end   = new Date(event.end);
            return event;
        }))
        .catch(_ => new Promise((resolve, reject) => resolve(getEvents(urls))).then(data => {
            fs.writeFile(filename, JSON.stringify(data));
            return data;
        }));
};

const matchesFilter = (event, filters) => {
    let passes = true;

    if (filters === "") {
        return false;
    } else if (filters === "*") {
        return true;
    } else {
        for (const filter in filters) {
            const values = typeof(filters[filter]) === "string" ? [filters[filter]] : filters[filter];

            if (filter == "dates") {
                passes &= values.some(value => {
                    if (value === "") {
                        return false;
                    } else if (value === "*") {
                        return true;
                    } else {
                        const date = Date.parse(date);
                        return event.start <= date && date < event.end;
                    }
                });
            } else {
                const column = (event.columns[filter] ?? "").toLowerCase();
                passes &= values.some(value => {
                    if (value === "") {
                        return column.length === 0;
                    } else if (value === "*") {
                        return true;
                    } else {
                        return column.includes(value.toLowerCase());
                    }
                });
            }
        }
    }

    return passes;
};

const matchesRule = (event, rule) => {
    let passes = true;

    if (rule.include) {
        passes &= matchesFilter(event, rule.include);
    }

    if (rule.exclude) {
        passes &= !matchesFilter(event, rule.exclude);
    }

    return passes;
};

const expandPatternString = (event, pattern) => {
    return pattern.replaceAll(/\$\[(.*)\]/g, (match, pattern) => {
        let indexOfColumnStart = pattern.indexOf("<");
        let indexOfColumnEnd   = pattern.indexOf(">");
        if (indexOfColumnEnd === -1) {
            indexOfColumnEnd = pattern.length;
        }

        const head = pattern.substring(0, indexOfColumnStart);
        const columnHeaders = pattern.substring(1 + indexOfColumnStart, indexOfColumnEnd).split(",");
        const tail = pattern.substring(1 + indexOfColumnEnd);

        const text = columnHeaders
            .map(header => {
                if (header === "summary") {
                    return event.summary ?? "";
                } else if (header === "description") {
                    return event.description ?? "";
                } else if (header === "location") {
                    return event.location ?? "";
                } else {
                    return event.columns[header] ?? "";
                }
            })
            .filter(column => column.length !== 0)
            .join(", ");

        return head + text + tail;
    });
};

const processCalendar = ({ urls, name, rules, }) => getCalendar(urls)
    .then(events => events
        .map(event => {
            for (const rule of rules) {
                const matches = matchesRule(event, rule);
                const isFilter = !rule.summary && !rule.description && !rule.location;

                if (isFilter && !matches) {
                    event.delete = true;
                }

                if (matches && rule.summary) {
                    event.summary = expandPatternString(event, rule.summary);
                }

                if (matches && rule.description) {
                    event.description = expandPatternString(event, rule.description);
                }

                if (matches && rule.location) {
                    event.location = expandPatternString(event, rule.location);
                }
            }

            return event;
        })
        .filter(event => !event.delete)
    )
    .then(events => {
        const zeroPad = (num, length) => String(num).padStart(length, "0");
        const formatDate = date => zeroPad(date.getUTCFullYear(), 4) + zeroPad(1 + date.getUTCMonth(), 2) + zeroPad(date.getUTCDate(), 2) + "T" + zeroPad(date.getUTCHours(), 2) + zeroPad(date.getUTCMinutes(), 2) + zeroPad(date.getUTCSeconds(), 2) + "Z";
        const generationTime = formatDate(new Date());
        const hostID = escape(os.hostname());

        let output = "";

        const outputField = (field, string) => {
            if (!string || string.length === 0) {
                return;
            }

            const escaped = string.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
            output += `${field}:${escaped}\r\n`;
        };

        output += "BEGIN:VCALENDAR\r\n";
        output += "VERSION:2.0\r\n";
        output += "METHOD:PUBLISH\r\n";
        outputField("X-WR-CALNAME", name);
        output += `X-PUBLISHED-TTL:P${config.regenerateInterval}M\r\n`
        output += "CALSCALE:GREGORIAN\r\n";
        output += `PRODID:Schedule\r\n`
        events.forEach(({ summary, description, location, start, end, }, index) => {
            output += "BEGIN:VEVENT\r\n";
            output += `DTSTART:${formatDate(start)}\r\n`;
            output += `DTEND:${formatDate(end)}\r\n`;
            outputField("SUMMARY", summary);
            outputField("DESCRIPTION", description);
            outputField("LOCATION", location);
            output += `UID:${generationTime}-${escape(name)}-${index}@${hostID}\r\n`;
            output += `DTSTAMP:${generationTime}\r\n`;
            output += `LAST-MODIFIED:${generationTime}\r\n`;
            output += "END:VEVENT\r\n";
        });
        output += "END:VCALENDAR\r\n";

        const filename = path.join(config.calendarDirectory, `${name}.ics`);
        console.log(`Saving ${filename}`);
        fs.writeFile(filename, output);
    });

const processCalendars = () => {
    console.log("Generating calendars");
    fs.readFile("calendars.json", { encoding: "utf8", })
        .then(stripComments)
        .then(JSON.parse)
        .catch(error => {
            console.log(`Could not read 'calendars.json'\n\t${error}`);
            return [];
        })
        .then(calendars => calendars.forEach(processCalendar))
        .catch(reason => console.log(`Could not read 'calendars.json':\n${reason}`));
};

const clearCache = () => {
    console.log("Clearing cache");
    fs.readdir(config.cacheDirectory).then(
        files => files
            .filter(file => file.endsWith(".json"))
            .forEach(file => {
                const filename = path.join(config.cacheDirectory, file);
                console.log(`Deleting ${filename}`);
                fs.unlink(filename).catch(error => console.log(`Could not delete ${filename}\n\t${error}`));
            }),
        error => {
            console.log(`Could not read cached files in '${config.cacheDirectory}\n\t${error}'`);
        }
    );
}

const regenerate = () => {
    clearCache();
    processCalendars();
}

const regenerateInterval = setInterval(regenerate, 1000 * 60 * config.regenerateInterval);

processCalendars();
fsSync.watchFile("calendars.json", { interval: (config.configReloadInterval ?? 10) * 1000}, (current, previous) => {
    if (current.mtime > previous.mtime) {
        processCalendars();
    }
}).unref();

process.on("SIGTERM", () => clearInterval(regenerateInterval));
