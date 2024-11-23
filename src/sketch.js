import { watchFile } from "node:fs";
import fs            from "node:fs/promises";
import ical          from "ical";

const getCalendar = async url => {
    const calendar = url.substring(url.lastIndexOf("/") + 1);
    const date     = new Date();
    const filename = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${calendar}`;

    return fs.readFile(filename, "utf8")
        .catch(_ => {
            console.log(`Downloading calendar from ${url}`);
            return fetch(url)
                .then(response => response.text())
                .then(data => {
                    fs.writeFile(filename, data);
                    return data;
                });
        });
};

const parseEvents = data => Object.values(ical.parseICS(data))
    .filter(event => event.type === "VEVENT")
    .map(event => {
        const names = event.summary
            .split(",")
            .map(part => part.trim().match("Kurskod: ([^.]+). Kursnamn: (.+)"))
            .filter(match => match != null)
            .map(match => ({ code: match[1], name: match[2], }));

        const heading = (event.summary.match("Rubrik: ([^,]+)") ?? ["", ""])[1];

        const other = event.summary
            .split(",")
            .filter(part => !part.includes(":"))
            .map(part => part.trim());

        const locations = event.location
            .split("\n")
            .map(line => line.trim().match("^([^.]+). Byggnad: ([^.]+)(. Våningsplan: (.+))?"))
            .filter(match => match != null)
            .map(match => ({ room: match[1], building: match[2], floor: match[4] ?? "", }));

        return {
            names:     names,
            heading:   heading,
            other:     other,
            locations: locations,
            start:     event.start,
            end:       event.end,
        };
    });

const matchesFilter = (event, filters) => {
    let passes = true;

    if (filters.codes !== undefined) {
        passes &= event.names.some(entry => filters.codes.includes(entry.code));
    }

    if (filters.other !== undefined) {
        passes &= event.other.some(other => filters.other.includes(other));
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

const processCalendar = ({ url, name, rules, }) => getCalendar(url)
    .then(parseEvents)
    .then(events => events
        .map(event => ({ event: event, rule: rules.find(rule => matchesRule(event, rule)), }))
        .filter(({ rule, }) => rule !== undefined && !(rule.summary === undefined && rule.description === undefined && rule.rooms === undefined))
        .map(({ event, rule, }) => {
            const rooms = event.locations
                .map(entry => rule.room
                    .replace("$room",     entry.room)
                    .replace("$floor",    entry.floor)
                    .replace("$building", entry.building))
                .join(rule.room_sep);
            const other = event.other.join(rule.other_sep);

            const fillPattern = pattern => pattern
                .replace("$heading", event.heading)
                .replace("$other",   other)
                .replace("$rooms",   rooms);

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
        // TODO(simon): Make sure this escapes everything that needs to be.
        const escape = string => string.replace(",", "\\,").replace("\n", "\\n");
        const formatDate = date => date.toISOString().replace(/[-:]|(\.\d{3})/g, "");

        let output = "";
        output += "BEGIN:VCALENDAR\n";
        output += "VERSION:2.0";
        output += "METHOD:PUBLISH\n";
        output += "CALSCALE:GREGORIAN\n";
        events.forEach(({ summary, description, rooms, start, end, }) => {
            output += "BEGIN:VEVENT\n";
            output += `DTSTART:${formatDate(start)}\n`;
            output += `DTEND:${formatDate(end)}\n`;
            output += `SUMMARY:${escape(summary)}\n`;
            output += `DESCRIPTION:${escape(description)}\n`;
            output += `LOCATION:${escape(rooms)}\n`;
            output += "END:VEVENT\n";
        });
        output += "END:VCALENDAR\n";

        console.log(`Saving ${name}.ical`);
        fs.writeFile(`${name}.ical`, output);
    });

const processCalendars = () => {
    console.log("Generating calendars");
    fs.readFile("calendars.json", "utf8")
        .then(data => JSON.parse(data))
        .then(calendars => calendars.forEach(processCalendar))
};

processCalendars();
watchFile("calendars.json", (current, previous) => {
    if (current.mtime > previous.mtime) {
        processCalendars();
    }
});
