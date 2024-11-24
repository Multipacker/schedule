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

* `cacheClearInterval`: The amount of time in minutes to wait between clearing
  cached files (defaults to 1440).
* `cacheDirectory`: Directory to place downloaded `.ics` files into (defaults
  is `.`).
* `calendarDirectory`: Directory to place generates `.ics` files into (default
  is `.`).
* `generateInterval`: The amount of time in minutes to wait between generating
  new calendars (defaults to 1440).

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
* `url`: The URL to download the calendar from.

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
* `other`: Other information, usually what kind of event it is (lab, lecture,
  etc.).

If an event matches a rule, it will use the formatting specified by the rule. The
following fields of an event can be set:

* `summary`: A short summary of the event.
* `description`: A more detailed description of the event.
* `rooms`: Where the event takes place.

You don't need to provide all of the fields, but if none are present, the event
won't be added to the calendar. This can be combined with the filters to remove
unwanted events.

The fields take a string pattern that can contain the following placeholders:

* `$heading$`: What the event is about. This matches with the "Rubrik" field on
  TimeEdit.
* `$other$`: Other information, usually what kind of event it is (lab, lecture,
  etc.).
* `$rooms$`: Which rooms the event takes place in.

For more fine grained formatting, there is also `otherSep` for specifying the
separator between different items in other. You can also specify how rooms are
formatted with the following options:

* `room`: Specifies how to format a single room. Can include `$room$`,
  `$building$` and `$floor$` to specify which rooms it is. Note that all of
  these aren't always available.
* `roomSep`: Specifies the separator to use between rooms.

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
    "url": "https://www.example.com/calendar.ics",
    "name": "example"
    "rules": [
        {
            "include": {
                "other": [ "Laboration" ]
            },
            "exclude": {
                "dates": [ "2024-11-25 17:15", "2024-12-13 17:15" ]
            }
        }
        {
            "include": {
                "codes": [ "ABC123" ]
            },
            "summary":     "$other$",
            "description": "$heading$",
            "otherSep":    ", ",
            "room":        "$room$: $building$ floor $floor$",
            "rooms":       "$rooms$"
        }
        {
            "otherSep": ", ",
            "summary":   "$heading$ $other$",
            "room":      "$room$: $building$ floor $floor$",
            "roomSep":  "\n",
            "rooms":     "$rooms$"
        }
    ]
}
```

## TODO

* Use `X-PUBLISHED-TTL` from source calendars to know when to evict the cache
  and regenerate calendars.
* Implement recurrence rules.
* Allow using multiple calendars as sources for one generated calendar.
* Allow specifying common formatting rules at the calendar level so you don't
  have to repeat them per rule.
* Allow more placeholders in format-strings.
* Keep the original values for each field in case the user wants to keep them.
