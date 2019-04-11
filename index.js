/* eslint-disable no-process-env */
const axios = require("axios");
const sha1 = require("js-sha1");
const moment = require("moment");
const AWS = require("aws-sdk");

// set aws region
AWS.config.update({ region: "eu-west-1" });

// schedules direct lineup
const lineupId = "GBR-1000014-DEFAULT";

// list of schedules direct channel ids
const channelData = {
    "30644": "BBC One London",
    "17154": "BBC Two",
    "17468": "ITV London",
    "17155": "Channel 4",
    "17157": "Channel 5",
    "47657": "More 4",
    "20684": "BBC 4",
    "19037": "BBC News",
    "24437": "BBC Radio 4",
    "31790": "BBC Radio 4 Extra",
    "24438": "BBC Radio 5 Live",
};

const userAgent = "Schedules Direct TV Searcher";

// http client used for scheduels direct requests
let axiosHttpClient = axios.create({
    timeout: 20000,
    headers: {
        "User-Agent": userAgent,
        "Accept-Encoding": "deflate,gzip",
    },
});

// schedules direct api endpoints
const URIs = {
    token: "https://json.schedulesdirect.org/20141201/token",
    status: "https://json.schedulesdirect.org/20141201/status",
    lineup: "https://json.schedulesdirect.org/20141201/lineups",
    schedule: "https://json.schedulesdirect.org/20141201/schedules",
    program: "https://json.schedulesdirect.org/20141201/programs",
};

/**
 * Get an array of channel IDs from channel data
 * @param {object} data
 * @return {array}
 */
const getChannels = (data) => Object.keys(data);

/**
 * Get a remote file and return the file split by new line or split by comma
 * @param {string} url
 * @return {array}
 */
const getRemoteConfig = async (url) => {
    if (url.substr(0, 7) === "http://" || url.substr(0, 8) === "https://") {
        console.log(`Getting ${url}`);
        const response = await axiosHttpClient.get(url);

        return response.data.split(/\r?\n/g).map((value) => value.trim());
    }

    return url.split(",");
};

/**
 * Extract text from a programme title and description if available
 * @param {object} programme
 * @return {string}
 */
const getTextFromProgramme = (programme) => {
    let text = "";

    try {
        if (typeof programme.titles[0].title120 !== "undefined") {
            text += ` ${programme.titles[0].title120}`;
        }
        if (
            typeof programme.descriptions.description1000[0].description !==
            "undefined"
        ) {
            text += ` ${programme.descriptions.description1000[0].description}`;
        }
    } catch (Err) {
        console.log(
            "A programme was missing a title or description, ignoring..."
        );
    }

    return text;
};

/**
 * Filter an array of programmes to exclude programmes whose titles exactly match given titles
 * @param {array} programmes
 * @param {array} titles
 * @return {array}
 */
const filterProgrammmeByExcludedTitles = (programmes, titles) => {
    console.log("filterProgrammmeByExcludedTitles...");

    return programmes.filter(
        (programme) => !titles.includes(programme.titles[0].title120)
    );
};

/**
 * Filter an array of programmes to exclude programmes which are a genre exactly match given genres
 * @param {array} programmes
 * @param {array} genres
 * @return {array}
 */
const filterProgrammmeByExcludedGenres = (programmes, genres) => {
    console.log("filterProgrammmeByExcludedGenres...");

    return programmes.filter(
        (programme) =>
            typeof programme.genres !== "undefined" &&
            !programme.genres.some((genre) => genres.includes(genre))
    );
};

/**
 * Filter an array of programmes to include programmes that have text content matching given keywords
 * @param {array} programmes
 * @param {array} keywords
 * @return {array}
 */
const filterProgrammesByKeywords = (programmes, keywords) => {
    console.log("filterProgrammesByKeywords...");

    return programmes.filter((programme) => {
        const text = getTextFromProgramme(programme);
        const words = text
            .toLowerCase()
            .trim()
            .match(/\w+(?:'\w+)*/g);
        let match = false;

        keywords.forEach((keyword) => {
            if (
                (keyword.indexOf(" ") === -1 && words.includes(keyword)) ||
                (keyword.indexOf(" ") !== -1 && text.indexOf(keyword) !== -1)
            ) {
                match = true;
                console.log(
                    `Title: ${
                        programme.titles[0].title120
                    },  Keyword Matched: '${keyword}'`
                );
            }
        });

        return match;
    });
};

/**
 * Returns a new programme schedule object that merges data from programmes, schedule and stations
 * @param {object} programme
 * @param {object} schedule
 * @param {string} stationId
 * @return {object}
 */
const mergeProgrammeAndSchedule = (programme, schedule, stationId) => ({
    title: programme.titles[0].title120,
    description: programme.descriptions.description1000[0].description,
    genres: programme.genres,
    date: schedule.airDateTime,
    station: channelData[stationId],
});

/**
 * Filters schedule to return only programmes given
 * @param {array} schedule
 * @param {array} matchedProgrammes
 * @return {array}
 */
const filterScheduleByProgrammes = (schedule, matchedProgrammes) => {
    console.log("filterScheduleByProgrammes...");

    const filteredSchedule = [];

    schedule.forEach((part) => {
        part.programs.forEach((scheduleProgramme) => {
            matchedProgrammes.forEach((matchedProgramme) => {
                if (
                    matchedProgramme.programID === scheduleProgramme.programID
                ) {
                    filteredSchedule.push(
                        mergeProgrammeAndSchedule(
                            matchedProgramme,
                            scheduleProgramme,
                            part.stationID
                        )
                    );
                }
            });
        });
    });

    return filteredSchedule;
};

/**
 * Makes a HTTP request to schedules direct to get programme details for a given set of programme ids
 * @param {array} programmeIds
 * @return {object}
 */
const getProgrammeDetails = async (programmeIds) => {
    console.log("getProgrammes...");
    console.log(`count = ${programmeIds.length}`);

    const response = await axiosHttpClient.post(URIs.program, programmeIds);

    return response.data;
};

/**
 * Get a list of unique programme ids from a schedule
 * @param {array} schedule
 * @return {array}
 */
const getProgrammeIdsFromSchedule = (schedule) => {
    console.log("getProgrammeIdsFromSchedule...");

    const ids = [];

    schedule.forEach((part) => {
        part.programs.forEach((programme) => {
            ids.push(programme.programID);
        });
    });

    // return a unique list of the ids
    return ids.filter((value, index, self) => self.indexOf(value) === index);
};

/**
 * Makes a HTTP request to schedules direct to get schedule data
 * @param {object} config
 * @return {object}
 */
const getSchedule = async (config) => {
    console.log("getSchedule...");
    const response = await axiosHttpClient.post(URIs.schedule, config);

    return response.data;
};

/**
 * Creates a config used o retrieve schedule data
 * @param {int} dayCount
 * @param {array} stationIds
 * @return {object}
 */
const getScheduleRequestConfig = (dayCount, stationIds) => {
    console.log("getScheduleRequestConfig...");

    const days = [];
    const configParts = [];

    for (let i = 0; i < dayCount; i++) {
        days.push(
            moment()
                .add(i, "days")
                .format("YYYY-MM-DD")
        );
    }

    stationIds.forEach((id) => {
        const part = {
            stationID: id,
            date: days,
        };

        configParts.push(part);
    });

    return configParts;
};

/**
 * Get a schedules direct authorisation token
 * @param {string} username
 * @param {string} password
 * @return {string}
 */
const getToken = async (username, password) => {
    console.log("getToken...");

    const response = await axiosHttpClient.post(URIs.token, {
        username,
        password: sha1(password),
    });

    axiosHttpClient = axios.create({
        timeout: 20000,
        headers: {
            "User-Agent": userAgent,
            token: response.data.token,
            "Accept-Encoding": "deflate,gzip",
        },
    });

    console.log(`Token = ${response.data.token}`);

    return response.data.token;
};

/**
 * Checks if schedules direct is available and user has active membership from a status response
 * @param {object} status
 * @return {boolean}
 */
const checkStatus = (status) => {
    console.log("checkStatus...");

    if (
        status.systemStatus[0].status !== "Online" ||
        new Date(status.account.expires) < new Date()
    ) {
        return false;
    }

    return true;
};

/**
 * Makes a HTTP request to schedules direct to get status info
 * @return {object}
 */
const getStatus = async () => {
    console.log("getStatus...");

    const response = await axiosHttpClient.get(URIs.status);

    return response.data;
};

/**
 * Makes a HTTP request to schedules direct to add a lineup to a user
 * @param {string} id
 * @return {boolean} true if successful
 */
const addLineup = async (id) => {
    console.log("addLineup...");

    const response = await axiosHttpClient.put(`${URIs.lineup}/${id}`);

    if (response.data.response === "OK") {
        return true;
    }

    return false;
};

/**
 * Makes a HTTP request to schedules direct to get lineups
 * @return {object}
 */
const getLineups = async () => {
    console.log("getLineups...");

    try {
        const response = await axiosHttpClient.get(URIs.lineup);

        return response.lineups;
    } catch (Err) {
        if (
            typeof Err.response.data !== "undefined" &&
            Err.response.data.response === "NO_LINEUPS"
        ) {
            return null;
        }
        console.log(Err);

        return null;
    }
};

/**
 * Sends an email via AWS SES
 * @param {text} body
 * @return {object} SES Response
 */
const sendEmail = async (body) => {
    console.log("sendEmail...");

    const params = {
        Destination: {
            ToAddresses: [process.env.recipient],
        },
        Message: {
            Body: {
                Text: {
                    Charset: "UTF-8",
                    Data: body,
                },
            },
            Subject: {
                Charset: "UTF-8",
                Data: "Schedules Direct TV Searcher",
            },
        },
        Source: process.env.from,
    };

    const ses = new AWS.SES({
        apiVersion: "2010-12-01",
        accessKeyId: process.env.keyId,
        secretAccessKey: process.env.secret,
    });

    return await ses.sendEmail(params).promise();
};

/**
 * Gets email body listing programmes found
 * @param {array} programmes
 * @return {string}
 */
const getEmailBody = (programmes) => {
    console.log("getEmailBody...");

    let body = `Hi
    `;

    if (programmes.length === 0) {
        body += `
We did not find any programmes in the next ${process.env.days} days.
        `;
    } else {
        body += `
I found the following ${programmes.length} programmes in the next ${
            process.env.days
        } days.
                `;

        programmes.forEach((programme) => {
            body += `

Title:        ${programme.title}
Time:         ${moment(programme.date).format("MMMM Do YYYY, HH:mm")}
Channel:      ${programme.station}
Genres:       ${programme.genres.join(", ")}
Description:  ${programme.description}

----------------------------------------------`;
        });
    }

    body += `

Thanks, Schedule Direct Programme Searcher`;

    return body;
};

/**
 * Lambda handler
 */
exports.handler = async (event, context, callback) => {
    await getToken(process.env.username, process.env.password);
    const status = checkStatus(await getStatus());

    if (!status) {
        throw new Error(
            "Schedules Direct is offline or membership has expired"
        );
    }

    const lineups = await getLineups();

    if (lineups === null) {
        await addLineup(lineupId);
    }

    const schedule = await getSchedule(
        getScheduleRequestConfig(process.env.days, getChannels(channelData))
    );
    const programmes = await getProgrammeDetails(
        getProgrammeIdsFromSchedule(schedule)
    );
    const matchedProgrammes = filterProgrammmeByExcludedTitles(
        filterProgrammmeByExcludedGenres(
            filterProgrammesByKeywords(
                filterProgrammesByKeywords(
                    programmes,
                    await getRemoteConfig(process.env.additionalKeywords)
                ),
                await getRemoteConfig(process.env.keywords)
            ),
            await getRemoteConfig(process.env.genres)
        ),
        await getRemoteConfig(process.env.titles)
    );
    const matchedSchedule = filterScheduleByProgrammes(
        schedule,
        matchedProgrammes
    );
    const emailBody = getEmailBody(matchedSchedule);
    const emailResult = await sendEmail(emailBody);

    console.log(emailResult);

    callback(null, `Found ${matchedSchedule.length} matching programmes`);
};
