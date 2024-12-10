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

    if (filters.dates) {
        passes &= filters.dates.map(date => Date.parse(date)).some(date => event.start <= date && date < event.end)
    }

    const check = (field, accepted) => {
        if (!accepted || accepted.length === 0) {
            return true;
        }

        return accepted.some(value => field.includes(value));
    };
    const checkArray = (fields, accepted) => {
        if (!accepted || accepted.length === 0) {
            return true;
        }

        return fields.some(field => accepted.some(value => field.includes(value)));
    };

    if (filters.codes && filters.codes.length !== 0) {
        passes &= event.courses.some(({ code, name, }) => check(code, filters.codes));
    }
    if (filters.names && filters.names.length !== 0) {
        passes &= event.courses.some(({ code, name, }) => check(name, filters.names));
    }
    passes &= check(event.header, filters.header);
    passes &= check(event.activity, filters.activity);
    passes &= check(event.comment, filters.comment);
    if (filters.rooms && filters.rooms.length !== 0) {
        passes &= event.rooms.some(({ room, building, }) => check(room, filters.rooms));
    }
    if (filters.buildings && filters.buildings.length !== 0) {
        passes &= event.rooms.some(({ room, building, }) => check(building, filters.buildings));
    }
    passes &= checkArray(event.classes, filters.classes);
    passes &= check(event.group, filters.group);
    passes &= checkArray(event.staff, filters.staff);

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

const processCalendar = ({ urls, name, rules, }) => getCalendar(urls)
    .then(events => events
        .map(event => ({ event: event, rule: rules.find(rule => matchesRule(event, rule)), }))
        .filter(({ rule, }) => rule && (rule.summary || rule.description || rule.rooms))
        .map(({ event, rule, }) => {
            const courses = event.courses
                .map(course => (rule.course ?? "")
                    .replace(/\$code\$/g, course.code)
                    .replace(/\$name\$/g, course.name))
                .join(rule.courseSep ?? ", ");
            const rooms = (event.rooms ?? [])
                .map(entry => rule.room
                    .replace(/\$room\$/g,     entry.room)
                    .replace(/\$building\$/g, entry.building))
                .join(rule.roomSep ?? ", ");
            const classes = (event.classes ?? "").join(rule.classSep ?? ", ");
            const staff = (event.staff ?? "").join(rule.staffSep ?? ", ");

            const fillPattern = pattern => (pattern ?? "")
                .replace(/\$courses\$/g,  courses)
                .replace(/\$header\$/g,   event.header)
                .replace(/\$activity\$/g, event.activity)
                .replace(/\$comment\$/g,  event.comment)
                .replace(/\$rooms\$/g,    rooms)
                .replace(/\$classes\$/g,  classes)
                .replace(/\$group\$/g,    event.group)
                .replace(/\$staff\$/g,    event.staff);

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
        const formatDate = date => date.toISOString().replace(/[-:]|(\.\d{3})/g, "");
        const generationTime = formatDate(new Date());
        const hostID = escape(os.hostname());

        let output = "";

        const outputField = (field, string) => {
            if (string.length === 0) {
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
        events.forEach(({ summary, description, rooms, start, end, }, index) => {
            output += "BEGIN:VEVENT\r\n";
            output += `DTSTART:${formatDate(start)}\r\n`;
            output += `DTEND:${formatDate(end)}\r\n`;
            outputField("SUMMARY", summary);
            outputField("DESCRIPTION", description);
            outputField("LOCATION", rooms);
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

setInterval(regenerate, 1000 * 60 * config.regenerateInterval);

processCalendars();
fsSync.watchFile("calendars.json", { interval: (config.configReloadInterval ?? 10) * 1000}, (current, previous) => {
    if (current.mtime > previous.mtime) {
        processCalendars();
    }
});
