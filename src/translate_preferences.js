function getId(id){
    return document.getElementById(id)
}
function querySelectorAll(element){
    return document.querySelectorAll(element)
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
getId("browserInfo").title = i18n.__("This option lets you download restricted content. You will get errors if cookies are not there")
getId("browserTxt").textContent = i18n.__("Select browser to use cookies from")
getId("none").textContent = i18n.__("None")
querySelectorAll(".autoTxt").forEach(item => {
    item.textContent = i18n.__("Automatic")
});
getId("preferredAudioTxt").textContent = i18n.__("Preferred audio format")
getId("preferredVideoTxt").textContent = i18n.__("Preferred video quality")