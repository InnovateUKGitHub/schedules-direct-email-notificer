# Schedules Direct Email Notificer

## Development

```npm i
lambda-local -l index.js -h handler  -E '{"username": "xdotgryph", "password": "", "keywords" : "http://play.aerian.com/~andy/keywords.txt", "genres": "http://play.aerian.com/~andy/excluded-genres.txt", "titles": "http://play.aerian.com/~andy/excluded-titles.txt", "days": 7, "recipient": "andy.max@aerian.com", "keyId": "", "secret": ""}' -e lambda-local-events/dummy.js -t 60  ```