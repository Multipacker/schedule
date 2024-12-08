# schedule

Filters and format iCalendar files. It is specifically made for the schedules
published by Chalmers on
[TimeEdit](https://cloud.timeedit.net/chalmers/web/public/ri1Q7.html), and is
thus capable of parsing out more information than what is provided by the iCal
format.

## Configuration

There are some general settings that can be configured in `config.json`. This
configuration is not hot-reloadable and needs a restart to apply. It consist of
a single object with the following fields:

* `cacheDirectory`: Directory to place downloaded `.ics` files into (defaults
  is `.`).
* `calendarDirectory`: Directory to place generates `.ics` files into (default
  is `.`).
* `regenerateInterval`: The amount of time in minutes to wait between generating
  new calendars (defaults to 20).

Example configuration that changes where cached files and generated calendars
are stored.

```json
{
    "cacheDirectory":    "cache",
    "calendarDirectory": "calendars",
}
```

## Calendars

Which calendars to source from and how to generate them is specified in
`calendars.json`. This file is hot-reloadable and will trigger a regeneration
of all calendars upon saving. It consists of an array of calendars, each of
which has the following fields:

* `name`: The base name for the generated file.
* `rules`: Specifies which events from the source calendar get included in the
  generated one and how information about an event is presented.
* `urls`: An array of URLs to download calendars from.

Rules are applied in order from first to last, and an event will use the first
rule that it matches. This means that more specific rules should be placed
earlier than more generic ones. In order to select which rule to use, there are
inclusion and exclusion filters. You have to pass the inclusion filter and fail
the exclusion filter to be included in the rule. You can specify one, both or
neither of these. If you don't specify either, all events will match the rule
and any following rules can never be reached. The rational for this system will
be explained later.

The two filters use the same format, and consist of objects with arrays of data
that is used for matching. To pass a filter, an event has to contain at least
one item from each specified array. The available arrays are:

* `codes`: Course codes.
* `dates`: Dates.

If an event matches a rule, it will use the formatting specified by the rule. The
following fields of an event can be set:

* `summary`: A short summary of the event.
* `description`: A more detailed description of the event.
* `rooms`: Where the event takes place.

You don't need to provide all of the fields, but if none are present, the event
won't be added to the calendar. This can be combined with the filters to remove
unwanted events.

The fields take a string pattern that can contain the following placeholders:

* `$courses$`: The courses that this event belongs to.
* `$header$`: What the event is about. This matches with the "Rubrik" field on
  TimeEdit.
* `$activity$`: What will happen at this event.
* `$comment$`: Additional information about this event.
* `$rooms$`: Which rooms the event takes place in.
* `$classes$`: Which classes this event is for.
* `$group$`: Which group the event is for.
* `$staff$`: Which staff will be present during the event.

You can also specify how rooms are formatted with the following options:

* `room`: Specifies how to format a single room. Can include `$room$` and
  `$building$` to specify which rooms it is.
* `roomSep`: Specifies the separator to use between rooms if there are multiple
  and defaults to `, `.

There are similar formatting options for courses:

* `course`: Specifies how to format a single course. Can include `$code$` and
  `$name$`.
* `courseSep`: Specifies the separator to use between courses if there are multiple
  and defaults to `, `.

Classes and staff also have separators (called `classSep` and `staffSep`
respectively) and they both have default values of `, `.


### Rational

The reason that rules are specified in this way is so that you can easily
filter our events that you aren't interested in, without having to exclude them
from every rule.

## Examples

The following rules remove lab sessions that we aren't interested in, includes
all remaining events that are part of a course, and provides a fallback for
events that don't match either. The produces calendar will be named
`example.ics`.

```json
{
    "name": "example"
    "urls": [ "https://www.example.com/calendar.ics", ]
    "rules": [
        {
            "exclude": {
                "dates": [ "2024-11-25 17:15", "2024-12-13 17:15" ]
            }
        }
        {
            "include": {
                "codes": [ "ABC123" ]
            },
            "description": "$header$",
            "room":        "$room$: $building$",
            "rooms":       "$rooms$"
        }
        {
            "room":      "$room$: $building$",
            "roomSep":  "\n",
            "rooms":     "$rooms$"
        }
    ]
}
```

There is also a complete example in the examples directory. It uses docker
compose and nginx and can be run with the following command:

```sh
docker compose -f examples/docker-compose.yml up
```

## TODO

* Implement recurrence rules.
* Allow specifying common formatting rules at the calendar level so you don't
  have to repeat them per rule.
* Allow for more expressive formatting rules, like only including certain text
  if a field is present.
