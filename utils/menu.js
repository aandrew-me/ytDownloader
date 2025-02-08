function initializeMenu(menuIsOpen) {
    if (menuIsOpen) {
        getId("menuIcon").style.transform = "rotate(0deg)";
        menuIsOpen = false;
        let count = 0;
        let opacity = 1;
        const fade = setInterval(() => {
            if (count >= 10) {
                getId("menu").style.display = "none";
                clearInterval(fade);
            } else {
                opacity -= 0.1;
                getId("menu").style.opacity = opacity.toFixed(3).toString();
                count++;
            }
        }, 50);
    } else {
        getId("menuIcon").style.transform = "rotate(90deg)";
        menuIsOpen = true;

        setTimeout(() => {
            getId("menu").style.display = "flex";
            getId("menu").style.opacity = "1";
        }, 150);
    }

    return menuIsOpen;
}

module.exports = {
    initializeMenu,
}