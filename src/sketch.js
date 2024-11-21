import ical from "ical";

const response = await fetch("https://cloud.timeedit.net/chalmers/web/public/ri617QQQY83Zn4Q5868548Z5y6Z55.ics");

if (response.ok) {
    let events = [];
    const ical_events = ical.parseICS(await response.text());
    for (const i in ical_events) {
        const event = ical_events[i];
        if (event.type !== "VEVENT") {
            continue;
        }

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

        events.push({
            names:     names,
            heading:    heading,
            other:     other,
            locations: locations,
            start:     event.start,
            end:       event.end,
        });
    }

    const rules = [
        {
            include: {
                other: [ "Laboration" ],
            },
            exclude: {
                dates: [ "2024-11-25 17:15", "2024-12-13 17:15" ],
            },
        },
        {
            include: {
                codes: [ "DAT038", "TIF085" ],
            },
            exclude: {
                codes: [ "DAT038", "TIF085" ],
            },
            description: "$heading",
            summary: "$other",
            other_sep: ", ",
            room: "$room: $building våning $floor",
            room_sep: ", ",
            rooms: "$rooms",
        },
        {
            other_sep: ", ",
            summary: "$heading $other",
            description: "",
            room: "$room: $building våning $floor",
            room_sep: "\n",
            rooms: "$rooms",
        },
    ];

    console.log(`BEGIN:VCALENDAR`);
    console.log(`VERSION:2.0`);
    console.log(`METHOD:PUBLISH`);
    console.log(`CALSCALE:GREGORIAN`);
    for (const event of events) {
        const matches = filters => {
            if (filters === undefined) {
                return true;
            }

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

        const passing_index = rules.findIndex(rule => {
            let passes = true;

            if (rule.include !== undefined) {
                passes &= matches(rule.include);
            }

            if (rule.exclude !== undefined) {
                passes &= !matches(rule.exclude);
            }

            return passes;
        });

        if (passing_index !== -1) {
            const rule = rules[passing_index];

            if (rule.summary === undefined && rule.description === undefined && rule.rooms === undefined) {
                continue;
            }

            const all_rooms = event.locations.map(entry => rule.room.replace("$room", entry.room).replace("$floor", entry.floor).replace("$building", entry.building)).join(rule.room_sep);
            const all_other = event.other.join(rule.other_sep);

            // TODO(simon): Make sure this escapes everything that needs to be.
            const escape = string => {
                return string.replace(",", "\\,").replace("\n", "\\n");
            };

            const fill_rule = rule => {
                return rule.replace("$heading", event.heading).replace("$other", all_other).replace("$rooms", all_rooms);
            };

            const summary     = escape(fill_rule(rule.summary));
            const description = escape(fill_rule(rule.description));
            const rooms       = escape(fill_rule(rule.rooms));

            // NOTE(simon): Serialize
            console.log(`BEGIN:VEVENT`);
            console.log(`DTSTART:${event.start.toISOString().replace(/[-:]|(\.\d{3})/g, "")}`);
            console.log(`DTEND:${event.end.toISOString().replace(/[-:]|(\.\d{3})/g, "")}`);
            console.log(`SUMMARY:${summary}`);
            console.log(`DESCRIPTION:${description}`);
            console.log(`LOCATION:${rooms}`);
            console.log(`END:VEVENT`);
        }
    }
    console.log(`END:VCALENDAR`);
} else {
    console.log("Could not fetch calendar");
    console.log(response.status);
}
