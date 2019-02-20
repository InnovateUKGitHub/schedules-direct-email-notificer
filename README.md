# Schedules Direct Email Notificer

## Lambda process envs

* username - schedules direct username
* password - schedules direct password
* keywords - http location where to fetch keywords from
* genres - http location where to fetch genres from
* titles - http location where to fetch excludes programme titles from
* days - number of days ahead to look
* recipient - recipient address of email
* from - sender address of email
* keyId - AWS access key
* secret - AWS secret key

## Development

```npm i``` 

```lambda-local -l index.js -h handler  -E '{"username": "xdotgryph", "password": "", "keywords" : "http://play.aerian.com/~andy/keywords.txt", "genres": "http://play.aerian.com/~andy/excluded-genres.txt", "titles": "http://play.aerian.com/~andy/excluded-titles.txt", "days": 7, "recipient": "andy.max@aerian.com", "from": "andy.max@aerian.com", "keyId": "", "secret": ""}' -e lambda-local-events/dummy.js -t 60 ```