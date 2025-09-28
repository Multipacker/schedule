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

Rules are applied in order from first to last, and an event will use all rules
that it matches. In order to select which rules to use, there are inclusion and
exclusion filters. You have to pass the inclusion filter and fail the exclusion
filter to be included in the rule. You can specify one, both, or neither of
these. If you don't specify either, all events will match the rule. The
rational for this system will be explained later.

The two filters use the same format, and consist of objects with arrays of data
that is used for matching. The fields specify what to match on, and the array
specifies the accepted substrings. To pass a filter, an event has to have at
least one item from each specified array as a substring.

The available fields can be seen either by looking at the log after the program
has downloaded a calendar, or you can look at TimeEdit and use the same names
that you see on the left hand side when you click on an event. There is also a
special field called `dates` that only passes the filter if the event contains
at least one of the specified dates.

There are two special values for filters: `"*"` which matches anything but
empty values, and `""` which only matches empty values. In the case that you
only have one value, you can also omit the array and specify the value
directly. Like this:

```json
"include": {
    "dates": "2025-09-28 08:00"
}
```

If an event matches a rule, it will use the formatting specified by the rule. The
following fields of an event can be set:

* `summary`: A short summary of the event.
* `description`: A more detailed description of the event.
* `location`: Where the event takes place.

You don't need to provide all of the fields, but if none are present, the event
will be removed. The fields take a pattern string which allow for formatting
with this syntax: `$[head text<Column 1,Column 2>tail text]`. The column names
are looked up and the fields are joined separated by `, `. If the result is
non-empty, the head text is inserted before the fields, and the tail text
afterwards. Both the head text and the tail text can be omitted.

Note that whitespace is significant here. There are three special column names
that are always allowed: `summary`, `description`, and `location`. These refer
to the fields on the event itself and allows you to have rules that append to
each other.


### Rational

The reason that rules are specified in this way is so that you can easily
filter our events that you aren't interested in, without having to exclude them
from every rule.

## Examples

The following rules remove lab sessions that we aren't interested in, includes
all remaining events that are part of a course, and provides a fallback for
events that don't have a course code. The produced calendar will be named
`example.ics`.

```json
{
    "name": "example"
    "urls": [ "https://www.example.com/calendar.ics" ]
    "rules": [
        {
            "exclude": {
                "dates": [ "2024-11-25 17:15", "2024-12-13 17:15" ]
            }
        }
        {
            "location": "$[Lokalnamn]",
        },
        {
            "include": {
                "Kurs kod": "ABC123"
            },
            "summary":     "ABC123",
            "description": "$[Activity]",
        },
        {
            "include": {
                "Kurs kod": ""
            },
            "summary":     "$[Titel]",
            "description": "$[Kommentar]",
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
* Allow for more expressive formatting rules.
