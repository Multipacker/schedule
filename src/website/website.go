package website

import (
	"log"
	"net/http"

	"Multipacker/schedule/src/timeedit"
)

func Execute() {
	reservations, err := timeedit.Fetch(http.DefaultClient, []string{
		"https://cloud.timeedit.net/chalmers/web/public/ri6373ZQ8QZZwYQ80Q51uQn25n06Zy4.ics",
		"https://cloud.timeedit.net/chalmers/web/public/ri6578wQQn0ZnYQ71y56ZuQ85Z1Q8Z04.ics",
	})
	if err != nil {
		log.Fatal(err)
	}

	for _, reservation := range reservations {
		log.Println(reservation)
	}
	//address := ":8080"
	//log.Printf("INFO: Serving on http://%s", address)
	//if err := http.ListenAndServe(address, nil); err != nil {
		//log.Fatal(err)
	//}
}
