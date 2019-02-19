/* eslint-disable no-process-env */
const axios = require("axios");
const sha1 = require("js-sha1");
const moment = require("moment");
const AWS = require("aws-sdk");

AWS.config.update({ region: "eu-west-1" });

const lineupId = "GBR-1000014-DEFAULT";
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

let axiosHttpClient = axios.create({
    timeout: 20000,
    headers: {
        "User-Agent": "Schedules Direct Email Notificer andy.max@aerian.com",
        "Accept-Encoding": "deflate,gzip",
    },
});

const URIs = {
    token: "https://json.schedulesdirect.org/20141201/token",
    status: "https://json.schedulesdirect.org/20141201/status",
    lineup: "https://json.schedulesdirect.org/20141201/lineups",
    schedule: "https://json.schedulesdirect.org/20141201/schedules",
    program: "https://json.schedulesdirect.org/20141201/programs",
};

const getChannels = (data) => Object.keys(data);

const getRemoteConfig = async (url) => {
    console.log(`Getting ${url}`);
    const response = await axiosHttpClient.get(url);

    return response.data.split("\n");
};

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
        console.log("A programme was missing a title or description");
    }

    return text;
};

const filterProgrammmeByExcludedTitles = (programmes, titles) => {
    console.log("filterProgrammmeByExcludedTitles...");

    return programmes.filter(
        (programme) => !titles.includes(programme.titles[0].title120)
    );
};

const filterProgrammmeByExcludedGenres = (programmes, genres) => {
    console.log("filterProgrammmeByExcludedGenres...");

    return programmes.filter(
        (programme) => !programme.genres.some((genre) => genres.includes(genre))
    );
};

const filterProgrammesByKeywords = (programmes, keywords) => {
    console.log("filterProgrammesByKeywords...");

    return programmes.filter((programme) => {
        const words = getTextFromProgramme(programme)
            .toLowerCase()
            .trim()
            .split(/\W+/);

        return words.some((word) => keywords.includes(word));
    });
};

const mergeProgrammeAndSchedule = (programme, schedule, stationId) => ({
    title: programme.titles[0].title120,
    description: programme.descriptions.description1000[0].description,
    genres: programme.genres,
    date: schedule.airDateTime,
    station: channelData[stationId],
});

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

const getProgrammeDetails = async (programmeIds) => {
    console.log("getProgrammes...");
    console.log(`count = ${programmeIds.length}`);

    const response = await axiosHttpClient.post(URIs.program, programmeIds);

    return response.data;
};

const getProgrammeIdsFromSchedule = (schedule) => {
    // get ids
    const ids = [];

    schedule.forEach((part) => {
        part.programs.forEach((programme) => {
            ids.push(programme.programID);
        });
    });

    // return a unique list of the ids
    return ids.filter((value, index, self) => self.indexOf(value) === index);
};

const getSchedule = async (config) => {
    console.log("getSchedule...");
    const response = await axiosHttpClient.post(URIs.schedule, config);

    return response.data;
};

const getScheduleRequestConfig = (dayCount, stationIds) => {
    console.log("getToken...");

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

const getToken = async (username, password) => {
    console.log("getToken...");

    const response = await axiosHttpClient.post(URIs.token, {
        username,
        password: sha1(password),
    });

    axiosHttpClient = axios.create({
        timeout: 20000,
        headers: {
            "User-Agent":
                "Schedules Direct Email Notificer andy.max@aerian.com",
            token: response.data.token,
            "Accept-Encoding": "deflate,gzip",
        },
    });

    console.log(`Token = ${response.data.token}`);

    return response.data.token;
};

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

const getStatus = async () => {
    console.log("getStatus...");

    const response = await axiosHttpClient.get(URIs.status);

    return response.data;
};

const addLineup = async (id) => {
    console.log("addLineup...");

    const response = await axiosHttpClient.put(`${URIs.lineup}/${id}`);

    if (response.data.response === "OK") {
        return true;
    }

    return false;
};

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

const getEmailBody = (programmes) => {
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
                programmes,
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

    console.log(emailBody);

    callback(null, `Found ${matchedSchedule.length} matching programmes`);
};

//     // Add a request interceptor
// axiosHttpClient.interceptors.request.use(function (config) {
//     // Do something before request is sent
//     console.log(config);
//     return config;
//   }, function (error) {
//     // Do something with request error
//     console.log(config);
//     return Promise.reject(error);
//   });

// // Add a response interceptor
// axiosHttpClient.interceptors.response.use(function (response) {
//     // Do something with response data
//     console.log(response);
//     return response;
//   }, function (error) {
//     // Do something with response error
//     console.log(error);
//     return Promise.reject(error);
//   });
