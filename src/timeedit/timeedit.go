package timeedit

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Reservation struct {
	Id      string
	Start   time.Time
	End     time.Time
	Columns map[string]string
}

func Fetch(client *http.Client, urls []string) ([]Reservation, error) {
	type JsonReservation struct {
		Id        string
		StartDate string
		StartTime string
		EndDate   string
		EndTime   string
		Columns   []string
	}

	type JsonCalender struct {
		ColumnHeaders []string
		Reservations []JsonReservation
	}

	var baseUrl string
	var objects []string
	for _, url := range urls {
		base, values, err := DecodeURL(url)
		if err != nil {
			return nil, err
		}

		baseUrl = base
		if objects != nil {
			objects = append(objects, "-1")
		}
		objects = append(objects, values["objects"]...)
	}

	values := make(url.Values)
	values.Set("objects", strings.Join(objects, ","))
	values.Set("sid", "3")
	values.Set("p", "4")

	requestUrl, err := EncodeURL(baseUrl, values);
	if err != nil{
		return nil, err
	}

	response, err := client.Get(requestUrl)
	if err != nil{
		return nil, err
	}
	defer response.Body.Close()

	var jsonCalender JsonCalender
	err = json.NewDecoder(response.Body).Decode(&jsonCalender)
	if err != nil{
		return nil, err
	}

	var reservations []Reservation
	for _, jsonReservation := range jsonCalender.Reservations {
		start, err := time.ParseInLocation("2006-01-02 15:04", jsonReservation.StartDate + " " + jsonReservation.StartTime, time.UTC)
		if err != nil {
			return nil, err
		}

		end, err := time.ParseInLocation("2006-01-02 15:04", jsonReservation.EndDate + " " + jsonReservation.EndTime, time.UTC)
		if err != nil {
			return nil, err
		}

		reservation := Reservation{
			Id:    jsonReservation.Id,
			Start: start,
			End:   end,
			Columns: make(map[string]string),
		}

		for i := range min(len(jsonReservation.Columns), len(jsonCalender.ColumnHeaders)) {
			header := jsonCalender.ColumnHeaders[i]
			column := jsonReservation.Columns[i]

			if header != "" && column != "" {
				reservation.Columns[header] = column
			}
		}

		reservations = append(reservations, reservation)
	}

	return reservations, err
}
