const brawlAPI = "https://brawlhalla-api.herokuapp.com/v1/"

let webhookURL;
let clanID;
let season;
let showNotPlayed = true;

const headers = {
    "content-type": "application/json"
}

let data = {}
let msg = {}

const timer = ms => new Promise(res => setTimeout(res, ms))

async function getPlayerData() {
    consoleLog("Cleaning player data.")
    let shouldStop = false;
    for (const player of data.players) {
        if (shouldStop) {
            break;
        }
        await axios.get(encodeURI(brawlAPI + `ranked/name?name=${player.name}`))
            .then(res => {
                player.c_elo = 0
                player.p_elo = 0

                const brawldata = res.data.data

                if (player.id === brawldata.brawlhalla_id) {
                    player.c_elo = brawldata.rating
                    player.p_elo = brawldata.peak_rating
                } else {
                    consoleLog(`${player.name} - didnt match given id. no info.`)
                }
            })
            .then(await timer(800))
            .catch(err => {
                player.c_elo = 0
                player.p_elo = 0

                consoleLog(`${player.name} - error : no 1v1 ranked records found`)
                console.log(err.response.status)
                if (err.response.status === 429 || err.response.status === 428) {
                    shouldStop = true
                    consoleLog(`BRAWLHALLA API ERROR, RELOAD AND TRY AGAIN IN A FEW MINUTES`)
                    cleanupApp()
                }
            })

    }
}

const findAverageELO = (arr) => {
    const { length } = arr;
    return arr.reduce((acc, val) => {
        return acc + (val.p_elo / length);
    }, 0);
};

function cleanupClanData(res) {
    consoleLog("Fetching clan data.")
    const resdata = res.data.data
    data.clan = resdata.clan_name
    data.players = []
    for (const key in resdata.clan) {
        data.players.push({ id: resdata.clan[key].brawlhalla_id, name: resdata.clan[key].name })
    }
}

function sortPlayersByPeakElo() {
    consoleLog("Sorting player data.")
    data.players.sort((a, b) => b.p_elo - a.p_elo)
}

function hasPlayedRanked(player) {
    return player.c_elo > 0;
}

function createMessage() {
    consoleLog("Formatting player data.")
    msg.content = "```json\n"
    msg.content += `Clan: ${data.clan} (id: ${clanID})\nSeason: ${season}\n\n`
    msg.content += "Name  Current ELO  Peak ELO\n"
    data.players.forEach(player => {
        if (player.p_elo == 0) {
            if (showNotPlayed) {
                msg.content += `${player.name} ?\n`
            }
        }
        else {
            msg.content += `${player.name}  ${player.c_elo}  ${player.p_elo}\n`
        }
    })
    // remove the people who dont play ranked and then calc tha avg
    const result = data.players.filter(hasPlayedRanked)
    const avg = Math.floor(findAverageELO(result))
    //console.log(avg);
    msg.content += `\nAVG PEAK: ${avg}\n`
    msg.content += `\nSNAPSHOT TAKEN AT: ${new Date().toLocaleString()}\n\n`
    msg.content += `Made by HeatXD\n`
    msg.content += "```"
}

function notifyDiscordHook() {
    consoleLog("Notifying Discord Webhook.")
    axios.post(webhookURL, msg, headers)
        .then(_ => {
            consoleLog("Notifying Succesful.")
        })
        .catch(_ => {
            consoleLog("Failed to notify the Discord Webhook")
            cleanupApp();
        })
}

function main() {
    axios.get(encodeURI(brawlAPI + "utils/clan?clan_id=" + clanID))
        .then(res => cleanupClanData(res))
        .then(_ => getPlayerData())
        .then(_ => sortPlayersByPeakElo())
        .then(_ => createMessage())
        .then(_ => notifyDiscordHook())
        .then(_ => cleanupApp())
        .catch(error => {
            consoleLog(`Failed to fetch clan data. error: ${error}`)
            cleanupApp();
        })
}

function cleanupApp() {
    data = {}
    msg = {}
    season = 0;
    document.querySelector('#submit').disabled = false
}


function resetConsole() {
    document.getElementById("log").innerHTML = ""
}

function consoleLog(msg) {
    document.getElementById("log").innerHTML += `<li>${msg}</li>`
}

function runSearches(form) {
    webhookURL = form[0].value
    clanID = form[1].value
    season = form[2].value
    showNotPlayed = !form[3].checked
    main()
}