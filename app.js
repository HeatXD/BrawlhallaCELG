const brawlAPI = "https://brawl-api-heat.herokuapp.com"

let webhookURL;
let clanID;
let season;
let showNotPlayed = true;

const headers = {
    "content-type": "application/json"
}

let data = {}
let msg = {}

function getPlayerEndpoints() {
    const endpoints = []
    data.players.forEach(player => endpoints.push({
        endp: encodeURI(`${brawlAPI}/player/${player.id}`),
        player: player
    }))
    return endpoints
}

async function getPlayerData() {
    consoleLog("Cleaning player data.")
    const endpoints = getPlayerEndpoints()
    for (const endpoint of endpoints) {
        try {
            const result = await axios.get(endpoint.endp);
            const resdata = result.data;
            //check if id's match
            if (resdata.playerRanked.rating !== undefined) {
                endpoint.player.c_elo = resdata.playerRanked.rating;
                endpoint.player.p_elo = resdata.playerRanked.peak_rating;
            } else {
                consoleLog(`${endpoint.player.name} - error : no ranked records found`)
                endpoint.player.c_elo = 0
                endpoint.player.p_elo = 0
            }
        } catch (error) {
            if (error.response.status === 429 || error.response.status === 408) {
                consoleLog("BRAWL API ERROR PLEASE TRY AFTER AGAIN WAITING A FEW MINUTES.")
                throw Error("Too Many Requests Error Or Request Timeout Error")
            } else if (error.response.status === 404) {
                endpoint.player.c_elo = 0
                endpoint.player.p_elo = 0
                consoleLog(`${endpoint.player.name} - error : no 1v1 ranked records found`)
            }
        }
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
    const resdata = res.data
    data.clan = resdata.clan_name
    data.players = []
    for (const key in resdata.clan) {
        //console.table(resdata.clan[key].brawlhalla_id, resdata.clan[key].name);
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
    axios.get(encodeURI(`${brawlAPI}/clan/${clanID}`))
        .then(res => cleanupClanData(res))
        .then(_ => getPlayerData())
        .then(_ => sortPlayersByPeakElo())
        .then(_ => createMessage())
        .then(_ => notifyDiscordHook())
        .then(_ => cleanupApp())
        .catch(error => {
            console.log(`Failed to fetch clan data. error: ${error}`)
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