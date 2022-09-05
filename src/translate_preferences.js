function getId(id){
    return document.getElementById(id)
}
function querySelector(element){
    return document.querySelector(element)
}
var i18n = new(require('../translations/i18n'))

// Translating texts
getId("title").textContent = i18n.__("Preferences")
getId("back").textContent = i18n.__("Homepage")
getId("dlText").textContent = i18n.__("Download location")
getId("clText").innerHTML = i18n.__("Current download location - ")
getId("selectLocation").textContent = i18n.__("Select Download Location")
getId("transparentText").textContent = i18n.__("Enable transparent dark mode(only Linux, needs relaunch)")
getId("preferences").textContent = i18n.__("Preferences")
getId("selectLn").textContent = i18n.__("Select Language (Requires relaunch)")
// getId("restart").textContent = i18n.__("Restart app")