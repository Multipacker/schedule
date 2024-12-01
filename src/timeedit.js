import fs  from "node:fs";
import { parseCsv } from "./csv.js";

const data = fs.readFileSync("test.csv", "utf-8");

// TODO(simon): Maybe validate all data first

const records = parseCsv(data, 3)
    .map(record => {
        console.log(record);
        return {
            // TODO(simon): Timezones are annoying, what do we do with them?
            // Currently they are fixed at UTC+1.
            start:    new Date(`${record["Startdatum"]}T${record["Starttid"]}+01:00`),
            end:      new Date(`${record["Slutdatum"]}T${record["Sluttid"]}+01:00`),
            // TODO(simon): Course names
            header:   record["Rubrik"],
            activity: record["Aktivitet"],
            comment:  record["Bokningskommentar"],
            // TODO(simon): Room
            classes: record["Klass"].split(","),
            group:   record["Undergrupp"],
            staff:   record["Personal"].split(","),
            // TODO(simon): Exam
            // TODO(simon): Exam type
        };
    });

console.log(records);
