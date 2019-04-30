# Schedules Direct Email Notificer

## Lambda process envs

* username - schedules direct username
* password - schedules direct password
* keywords - comma seperated list or http location where to fetch keywords from
* additionalKeywords - comma seperated list or http location where to fetch additional keywords from
* genres - comma seperated list or http location where to fetch genres from
* titles - comma seperated list or http location where to fetch excludes programme titles from
* days - number of days ahead to look
* recipient - recipient address of email
* from - sender address of email
* keyId - AWS access key
* secret - AWS secret key

## Development

```npm i
lambda-local -l index.js -h handler  -E '{"username": "", "password": "", "keywords" : "", "additionalKeywords" : "innovation,research,development,business,university", "genres": "", "titles": "", "days": 7, "recipient": "", "from": "", "keyId": "", "secret": ""}' -e lambda-local-events/dummy.js -t 60 ```

## Usage

Get schedules direct ( https://schedulesdirect.org ) username and password

Update lineupId and channel id

Get SES key and secrets

Create Lambda 