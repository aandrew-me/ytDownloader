let rightToLeft = false;
if (localStorage.getItem("rightToLeft")) {
    rightToLeft = localStorage.getItem("rightToLeft")
}
if (rightToLeft == "true") {
    document.querySelectorAll(".prefBox").forEach(item => {
        item.style.flexDirection = "row-reverse"
    })
}
else {
    console.log("Change to left to right");
    document.querySelectorAll(".prefBox").forEach(item => {
        item.style.flexDirection = "row"
    })
}
let downloadPath = localStorage.getItem("downloadPath")
getId("path").textContent = downloadPath

const { ipcRenderer } = require("electron")
function getId(id) {
    return document.getElementById(id)
}

getId("back").addEventListener("click", () => {
    ipcRenderer.send("close-secondary")
})

// Selecting download directory
getId("selectLocation").addEventListener("click", () => {
    ipcRenderer.send("select-location", "")
})

ipcRenderer.on("downloadPath", (event, downloadPath) => {
    console.log(downloadPath);
    localStorage.setItem("downloadPath", downloadPath)
    getId("path").textContent = downloadPath
})


const enabledTransparent = getId("enableTransparent")
enabledTransparent.addEventListener("change", (event) => {
    if (enabledTransparent.checked) {
        localStorage.setItem("enabledTransparent", "true")
    }
    else {
        localStorage.setItem("enabledTransparent", "false")
    }
})

// Selecting config directory

getId("configBtn").addEventListener("click", () => {
    ipcRenderer.send("select-config", "")
})

ipcRenderer.on("configPath", (event, configPath) => {
    console.log(configPath);
    localStorage.setItem("configPath", configPath)
    getId("configPath").textContent = configPath
})


const configCheck = getId("configCheck")
configCheck.addEventListener("change", (event) => {
    if (configCheck.checked) {
        getId("configOpts").style.display = "flex"
    }
    else {
        getId("configOpts").style.display = "none"
        localStorage.setItem("configPath", "")

    }
})

const configPath = localStorage.getItem("configPath")
if (configPath){
    getId("configPath").textContent = configPath;
    configCheck.checked = true
    getId("configOpts").style.display = "flex"
}

// Language settings

const localEnabledTransparent = localStorage.getItem("enabledTransparent")
if (localEnabledTransparent == "true") {
    enabledTransparent.checked = true
}
const language = localStorage.getItem("language")

if (language) {
    getId("select").value = language
}
function changeLanguage() {
    const language = getId("select").value
    localStorage.setItem("language", language)
    if (language === "fa") {
        rightToLeft = true;
        localStorage.setItem("rightToLeft", true)
    }
    else {
        rightToLeft = false;
        localStorage.setItem("rightToLeft", false)
    }
}

// Browser preferences
let browser = localStorage.getItem("browser")
if (browser) {
    getId("browser").value = browser
}

getId("browser").addEventListener("change", () => {
    browser = getId("browser").value
    localStorage.setItem("browser", browser)
})


// Handling preferred video quality

let preferredVideoQuality = localStorage.getItem("preferredVideoQuality")
if (preferredVideoQuality){
    getId("preferredVideoQuality").value = preferredVideoQuality
}

getId("preferredVideoQuality").addEventListener("change", ()=>{
    preferredVideoQuality = getId("preferredVideoQuality").value
    localStorage.setItem("preferredVideoQuality", preferredVideoQuality) = preferredVideoQuality
})


// Handling preferred audio quality

let preferredAudioQuality = localStorage.getItem("preferredAudioQuality")
if (preferredAudioQuality){
    getId("preferredAudioQuality").value = preferredAudioQuality
}

getId("preferredAudioQuality").addEventListener("change", ()=>{
    preferredAudioQuality = getId("preferredAudioQuality").value
    localStorage.setItem("preferredAudioQuality", preferredAudioQuality) = preferredAudioQuality
})

// Reload
function reload(){
    ipcRenderer.send("reload")
}
getId("restart").addEventListener("click", () =>{
    reload()
})

require("../src/translate_preferences")
