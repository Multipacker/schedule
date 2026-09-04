package timeedit

import (
	"strings"
	"slices"
	"net/url"
	"path"
	"fmt"
)

var tabledata = [][]string{
	[]string{"h=t&sid=", "6="},
	[]string{"objects=", "1="},
	[]string{"sid=", "2="},
	[]string{"&ox=0&types=0&fe=0", "3=3"},
	[]string{"&types=0&fe=0", "5=5"},
	[]string{"&h=t&p=", "4="},
};
var tabledataspecial = [][]string{
	[]string{"=", "ZZZX1"}, 
	[]string{"&", "ZZZX2"},
	[]string{",", "ZZZX3"},
	[]string{".", "ZZZX4"},
	[]string{" ", "ZZZX5"},
	[]string{"-", "ZZZX6"},
	[]string{"/", "ZZZX7"},
	[]string{"%", "ZZZX8"},
}
var pairs = [][]rune{
	[]rune{'=', 'Q'},
	[]rune{'&', 'Z'},
	[]rune{',', 'X'},
	[]rune{'.', 'Y'},
	[]rune{' ', 'V'},
	[]rune{'-', 'W'},
}
var pattern = [][]int{
	[]int{4, 22},
	[]int{5, 37},
	[]int{26, 17},
	[]int{33, 15},
	[]int{39, 11},
	[]int{45, 20},
	[]int{2, 40},
	[]int{19, 36},
	[]int{28, 38},
	[]int{30, 41},
	[]int{44, 42},
	[]int{7, 24},
	[]int{14, 27},
	[]int{35, 25},
	[]int{12, 1},
	[]int{43, 23},
	[]int{6, 16},
	[]int{3, 9},
	[]int{47, 46},
	[]int{48, 50},
	[]int{21, 10},
	[]int{49, 32},
	[]int{18, 31},
	[]int{29, 34},
	[]int{13, 8},
}



func tablespecial(result string) string {
	for i := 0; i < 100; i++ {
		for _, key := range tabledataspecial {
			result = strings.Replace(result, key[0], key[1], 1)
		}
	}
	return result
}

func untablespecial(result string) string {
	for i := 0; i < 100; i++ {
		for _, key := range slices.Backward(tabledataspecial) {
			result = strings.Replace(result, key[1], key[0], 1)
		}
	}
	return result
}



func modKey(char rune) rune {
	if 97 <= char && char <= 122 {
		return 97 + (char - 88) % 26;
	}
	if 49 <= char && char <= 57 {
		return 49 + (char - 45) % 9;
	}
	return char;
}

func unmodKey(char rune) rune {
    if 97 <= char && char <= 122 {
        return (97 + (char - 97 + 17) % 26);
    }
    if 49 <= char && char <= 57 {
        return (49 + (char - 49 + 5) % 9);
    }
    return char;
}



func scrambleChar(char rune) rune {
	for _, pair := range pairs {
		if char == pair[0] {
			return pair[1];
		}
		if char == pair[1] {
			return pair[0];
		}
	}
	return modKey(char)
}

func unscrambleChar(char rune) rune {
	for _, pair := range pairs {
		if char == pair[1] {
			return pair[0];
		}
		if char == pair[0] {
			return pair[1];
		}
	}
	return unmodKey(char)

}



func swapPattern(result []rune) {
	for step := 0; step < len(result); step++ {
		for _, pair := range pattern {
			from := pair[0] + step * len(pattern)
			to   := pair[1] + step * len(pattern)
			if from < 0 || from >= len(result) {
				continue
			}
			if to < 0 || to >= len(result) {
				continue
			}
			result[to], result[from] = result[from], result[to]
		}
	}
}

func unswapPattern(result []rune) {
	for step := len(result) - 1; 0 <= step; step-- {
		for _, pair := range slices.Backward(pattern) {
			from := pair[0] + step * len(pattern)
			to   := pair[1] + step * len(pattern)
			if from < 0 || from >= len(result) {
				continue
			}
			if to < 0 || to >= len(result) {
				continue
			}
			result[to], result[from] = result[from], result[to]
		}
	}
}



func swapChar(result string) string{
	split := []rune(result)
	for index, char := range split {
		split[index] = scrambleChar(char);
	}
	swapPattern(split);
	return string(split);
}

func unswapChar(result string) string {
	split := []rune(result)
	unswapPattern(split);
	for index, char := range split {
		split[index] = unscrambleChar(char);
	}
	return string(split);
}



func tableshort(result string) string {
	for _, key := range tabledata {
		result = strings.Replace(result, key[0], key[1], 1)
	}
	return result;
}

func untableshort(result string) string {
	for _, key := range slices.Backward(tabledata) {
		result = strings.Replace(result, key[1], key[0], 1)
	}
	return result;
}



func scramble(query string) (string, error) {
	if len(query) < 2 {
		return query, nil
	}
	if strings.HasPrefix(query, "i=") {
		return query, nil
	}

	result, err := url.PathUnescape(query)
	if err != nil {
		return "", err
	}

	result = tableshort(result)
	result = swapChar(result)
	result = tablespecial(result)
	return url.PathEscape(result), nil
}

func unscramble(query string) (string, error) {
	if len(query) < 2 {
		return query, nil
	}

	if strings.HasPrefix(query, "i=") {
		return query, nil
	}

	result, err := url.PathUnescape(query)
	if err != nil {
		return "", err
	}

	result = untablespecial(result);
	result = unswapChar(result);
	result = untableshort(result);
	return url.PathEscape(result), nil
}



func EncodeURL(base string, values url.Values) (string, error) {
	baseUrl, err := url.Parse(base)
	if err != nil {
		return "", err
	}

	encoded := values.Encode()
	scrambled, err := scramble(encoded)
	if err != nil {
		return "", err
	}

	baseUrl.Path = path.Join(baseUrl.Path, "ri" + scrambled + ".json")
	
	return baseUrl.String(), nil
}

func DecodeURL(calenderUrl string) (string, url.Values, error) {
	calendar, err := url.Parse(calenderUrl)
	if err != nil {
		return "", nil, fmt.Errorf("failed to parse url: %v", err)
	}

	dir, file := path.Split(calendar.Path)
	calendar.Path = dir
	base := strings.TrimSuffix(file, path.Ext(file))
	if !strings.HasPrefix(base, "ri") {
		return "", nil, fmt.Errorf("unknown URL")
	}

	scrambled := strings.TrimPrefix(base, "ri")

	unscrambled, err := unscramble(scrambled)
	if err != nil {
		return "", nil, err
	}

	values, err := url.ParseQuery(unscrambled)
	if err != nil {
		return "", nil, err
	}

	return calendar.String(), values, nil
}
