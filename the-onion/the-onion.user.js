// ==UserScript==
// @name         The Onion
// @namespace    https://github.com/marblenix/cookie-clicker/
// @version      1.0
// @description  News headlines from America's finest news source.
// @author       marblenix
// @homepage     https://github.com/marblenix/cookie-clicker
// @source       https://github.com/marblenix/cookie-clicker/raw/main/the-onion/the-onion.user.js
// @updateURL    Chttps://github.com/marblenix/cookie-clicker/raw/main/the-onion/the-onion.user.js
// @website      https://github.com/marblenix/cookie-clicker/tree/main/the-onion
// @supportURL   https://github.com/marblenix/cookie-clicker/issues/new?title=%5BBug%5D+The+Onion
// @icon         https://orteil.dashnet.org/cookieclicker/favicon.ico
// @match        https://orteil.dashnet.org/cookieclicker/
// @match        http://orteil.dashnet.org/cookieclicker/
// @resource rss https://www.theonion.com/rss
// @grant        GM_getResourceText
// ==/UserScript==

(function () {
  'use strict';

  let news = [];

  function tickerHook() {
    if (news.length > 0) {
      return news;
    }
    let rss = GM_getResourceText('rss')
    let parser = new DOMParser();
    let xmlDoc = parser.parseFromString(rss, 'text/xml');
    let titles = xmlDoc.getElementsByTagName('title')
    let titleStrings = [];
    for (let i = 1; i < titles.length; i++) {
      titleStrings.push(`News : ${titles[i].textContent}`);
    }
    news = titleStrings
    return news;
  }

  function init() {
    Game.registerMod('The Onion', {
      init: () => {
        Game.registerHook('ticker', tickerHook)
      },
    });
  }

  let interval;

  function checkGameState() {
    if (Game === undefined || !Game.ready) {
      return false
    } else {
      clearInterval(interval);
      init();
      return true;
    }
  }

  interval = setInterval(checkGameState, 1000);
})();
