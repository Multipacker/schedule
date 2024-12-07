import crypto from "crypto";
import fs     from "node:fs/promises";
import fsSync from "node:fs";
import os     from "os";
import path   from "path";

import { getEvents } from "./timeedit.js";

const config = await fs.readFile("config.json")
    .then(
        JSON.parse,
        error => {
            console.log(`Could not load configuration file 'config.json'. Using default configuration\n\t${error}`);
            return {};
        }
    )
    // NOTE(simon): Fill in defaults for values that are not specified.
    .then(data => ({
        cacheClearInterval: data.cacheClearInterval ?? 60 * 24,
        cacheDirectory:     data.cacheDirectory     ?? ".",
        calendarDirectory:  data.calendarDirectory  ?? ".",
        generateInterval:   data.generateInterval   ?? 60 * 24,
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
    console.log(hash);
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

    if (filters.codes !== undefined) {
        passes &= event.courses.some(entry => filters.codes.includes(entry.code));
    }

    if (filters.dates !== undefined) {
        passes &= filters.dates.map(date => Date.parse(date)).some(date => event.start <= date && date < event.end)
    }

    return passes;
};

const matchesRule = (event, rule) => {
    let passes = true;

    if (rule.include !== undefined) {
        passes &= matchesFilter(event, rule.include);
    }

    if (rule.exclude !== undefined) {
        passes &= !matchesFilter(event, rule.exclude);
    }

    return passes;
};

const processCalendar = ({ urls, name, rules, }) => getCalendar(urls)
    .then(events => events
        .map(event => ({ event: event, rule: rules.find(rule => matchesRule(event, rule)), }))
        .filter(({ rule, }) => rule !== undefined && !(rule.summary === undefined && rule.description === undefined && rule.rooms === undefined))
        .map(({ event, rule, }) => {
            const courses = event.courses
                .map(course => (rule.course ?? "")
                    .replace(/\$code\$/g, course.code)
                    .replace(/\$name\$/g, course.name))
                .join(rule.courseSep);
            const rooms = (event.rooms ?? "")
                .map(entry => rule.room
                    .replace(/\$room\$/g,     entry.room)
                    .replace(/\$floor\$/g,    entry.floor)
                    .replace(/\$building\$/g, entry.building))
                .join(rule.roomSep);

            const fillPattern = pattern => pattern
                .replace(/\$courses\$/g, courses)
                .replace(/\$heading\$/g, event.heading)
                .replace(/\$rooms\$/g,   rooms);

            return {
                summary:     fillPattern(rule.summary),
                description: fillPattern(rule.description),
                rooms:       fillPattern(rule.rooms),
                start:       event.start,
                end:         event.end,
            };
        })
    )
    .then(events => {
        const escape = string => string.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
        const formatDate = date => date.toISOString().replace(/[-:]|(\.\d{3})/g, "");
        const generationTime = formatDate(new Date());
        const hostID = escape(os.hostname());

        let output = "";
        output += "BEGIN:VCALENDAR\r\n";
        output += "VERSION:2.0\r\n";
        output += "METHOD:PUBLISH\r\n";
        output += `X-WR-CALNAME:${escape(name)}\r\n`
        output += `X-PUBLISHED-TTL:P${config.generateInterval}M\r\n`
        output += "CALSCALE:GREGORIAN\r\n";
        output += `PRODID:Schedule\r\n`
        events.forEach(({ summary, description, rooms, start, end, }, index) => {
            output += "BEGIN:VEVENT\r\n";
            output += `DTSTART:${formatDate(start)}\r\n`;
            output += `DTEND:${formatDate(end)}\r\n`;
            output += `SUMMARY:${escape(summary)}\r\n`;
            output += `DESCRIPTION:${escape(description)}\r\n`;
            output += `LOCATION:${escape(rooms)}\r\n`;
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
    fs.readFile("calendars.json", "utf8")
        .then(
            JSON.parse,
            error => {
                console.log(`Could not read 'calendars.json'\n\t${error}`);
                return [];
            }
        )
        .then(calendars => calendars.forEach(processCalendar))
};

const clearCache = () => {
    console.log("Clearing cache");
    const date           = new Date();
    const filenamePrefix = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-`;
    const filenameRegex  = new RegExp(/^\d+-\d{1,2}-\d{1,2}-.+\.ics$/);

    fs.readdir(config.cacheDirectory).then(
        files => {
            files
                .filter(file => !file.startsWith(filenamePrefix) && filenameRegex.test(file))
                .forEach(file => {
                    const filename = path.join(config.cacheDirectory, file);
                    console.log(`Deleting ${filename}`);
                    fs.unlink(filename).catch(error => console.log(`Could not delete ${filename}\n\t${error}`));
                });
        },
        error => {
            console.log(`Could not read cached files in '${config.cacheDirectory}\n\t${error}'`);
        }
    );
};

setInterval(processCalendars, 1000 * 60 * config.generateInterval);
setInterval(clearCache, 1000 * 60 * config.cacheClearInterval);

processCalendars();
fsSync.watchFile("calendars.json", { interval: (config.configReloadInterval ?? 10) * 1000}, (current, previous) => {
    if (current.mtime > previous.mtime) {
        processCalendars();
    }
});
