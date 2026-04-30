package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"slices"
	"strings"
	"time"
	// "net/url"
	// "path"
	// "strings"
)

func unscramble(scrambled string) string {
	return scrambled
}

type Field struct {
	Id     int
	Values []string
}

type Record struct {
	Ident  string
	Fields []Field
}

type Response struct {
	Count   int
	Records []Record
}

type Course struct {
	id          string
	englishName string
	swedishName string
	code        string
	startDate   time.Time
	endDate     time.Time
}

type Class struct {
	id          string
	englishName string
	swedishName string
	code        string
}

type Activity struct {
	id          string
	englishName string
	swedishName string
}

type Subgroup struct {
	id          string
	englishName string
	swedishName string
	code        string
}

const (
	TimeEdit_Class      = 8
	TimeEdit_Course     = 10
	TimeEdit_Activity   = 12
	TimeEdit_Subgroup   = 9
	TimeEdit_CareerFair = 22
)

// part=t gives names of fields
// l = locale
// start = offset into results
// max = number of results
// types = what to request
// subtypes = ???
// sid = ??? 3 for chalmers public, 4 for students

func EnumerateObjects(objectType int) ([]Record, error) {
	recordMap := make(map[string]Record)

	for _, locale := range []string{ "sv_SE", "en_US" } {
		start := 0
		for {
			count := 100
			httpResponse, err := http.Get(fmt.Sprintf("https://cloud.timeedit.net/chalmers/web/public/objects.json?start=%d&max=%d&partajax=t&im=f&sid=3&l=%s&types=%d", start, count, locale, objectType))
			if err != nil {
				return []Record{}, fmt.Errorf("http get: %w", err)
			}
			defer httpResponse.Body.Close()

			response := Response{}
			err = json.NewDecoder(httpResponse.Body).Decode(&response)
			if err != nil {
				return []Record{}, fmt.Errorf("json decode: %w", err)
			}

			httpResponse.Body.Close()

			for _, record := range response.Records {
				if oldRecord, found := recordMap[record.Ident]; !found {
					recordMap[record.Ident] = record
				} else {
					for _, field := range record.Fields {
						if !slices.ContainsFunc(oldRecord.Fields, func(oldField Field) bool { return oldField.Id == field.Id }) {
							oldRecord.Fields = append(oldRecord.Fields, field)
						}
					}
					recordMap[record.Ident] = oldRecord
				}
			}

			if response.Count < count {
				break
			}

			start += response.Count

			time.Sleep(time.Millisecond)
		}
	}

	records := []Record{}
	for _, record := range recordMap {
		records = append(records, record)
	}

	return records, nil
}

func EnumerateCourses() ([]Course, error) {
	records, err := EnumerateObjects(TimeEdit_Course)
	if err != nil {
		return []Course{}, nil
	}

	courses := []Course{}

	for _, record := range records {
		course := Course{ id: record.Ident, }
		for _, field := range record.Fields {
			switch field.Id {
			case 16:
				course.swedishName = strings.Join(field.Values, "")
			case 23:
				course.englishName = strings.Join(field.Values, "")
			case 28:
				course.code = strings.Join(field.Values, "")
			case 29:
				if parsedTime, err := time.Parse(time.DateOnly, strings.Join(field.Values, "")); err != nil {
					log.Println(fmt.Errorf("time parse: %w", err))
				} else {
					course.startDate = parsedTime
				}
			case 30:
				if parsedTime, err := time.Parse(time.DateOnly, strings.Join(field.Values, "")); err != nil {
					log.Println(fmt.Errorf("time parse: %w", err))
				} else {
					course.endDate = parsedTime
				}
			}
		}

		courses = append(courses, course)
	}

	return courses, nil
}

func EnumerateClasses() ([]Class, error) {
	records, err := EnumerateObjects(TimeEdit_Class)
	if err != nil {
		return []Class{}, nil
	}

	classes := []Class{}

	for _, record := range records {
		class := Class{ id: record.Ident, }
		for _, field := range record.Fields {
			switch field.Id {
			case 10:
				class.swedishName = strings.Join(field.Values, "")
			case 34:
				class.code = strings.Join(field.Values, "")
			case 35:
				class.englishName = strings.Join(field.Values, "")
			}
		}

		classes = append(classes, class)
	}

	return classes, nil
}

func EnumerateActivities() ([]Activity, error) {
	records, err := EnumerateObjects(TimeEdit_Activity)
	if err != nil {
		return []Activity{}, nil
	}

	activities := []Activity{}

	for _, record := range records {
		activity := Activity{ id: record.Ident, }
		for _, field := range record.Fields {
			switch field.Id {
			case 19:
				activity.swedishName = strings.Join(field.Values, "")
			case 57:
				activity.englishName = strings.Join(field.Values, "")
			}
		}

		activities = append(activities, activity)
	}

	return activities, nil
}

func EnumerateSubgroups() ([]Subgroup, error) {
	records, err := EnumerateObjects(TimeEdit_Subgroup)
	if err != nil {
		return []Subgroup{}, nil
	}

	subgroups := []Subgroup{}

	for _, record := range records {
		subgroup := Subgroup{ id: record.Ident, }
		for _, field := range record.Fields {
			switch field.Id {
			case 10:
				subgroup.swedishName = strings.Join(field.Values, "")
			case 34:
				subgroup.code = strings.Join(field.Values, "")
			case 35:
				subgroup.englishName = strings.Join(field.Values, "")
			}
		}

		subgroups = append(subgroups, subgroup)
	}

	return subgroups, nil
}

func main() {
	log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds)

	courses, _ := EnumerateObjects(4)

	log.Println(courses)
	log.Printf("Enumerated %v courses\n", len(courses))

	/*
	decodedUrl, err := url.Parse("https://cloud.timeedit.net/chalmers/web/public/ri657QQQu1YZn1Q53Z85beZ4y6Z0Q.ics")

	if err == nil {
		file, _, _ := strings.Cut(path.Base(decodedUrl.Path), ".")
		log.Println(file)
		unscrambled := unscramble(file)
		log.Println(unscrambled)
		log.Println(url.QueryUnescape("hello+test"))
	}

	//request, err := http.Nehttps://cloud.timeedit.net/chalmers/web/public/ri657QQQu1YZn1Q53Z85beZ4y6Z0Q.icswRequest("GET",, nil)

	//var resp *http.Response
	//if err == nil {
	//	resp, err = (&http.Client{}).Do(request)
	//}

	//if err == nil {
	//}

	//if err != nil {
	//	log.Println(err)
	//}
	*/
}
