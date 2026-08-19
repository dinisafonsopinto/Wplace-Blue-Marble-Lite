// ==UserScript==
// @name         Blue Marble (Lite)
// @namespace    https://github.com/SwingTheVine/
// @version      1.0.0
// @description  A stripped-down userscript for Wplace.live showing only the pixel timer and pixels until next level.
// @author       SwingTheVine (Modified)
// @match        https://wplace.live/*
// @icon         https://i.etsystatic.com/7421639/r/il/4070fb/2078198039/il_570xN.2078198039_14y6.jpg
// @updateURL    https://raw.githubusercontent.com/dinisafonsopinto/Wplace-Blue-Marble-Lite/main/content.user.js
// @downloadURL  https://raw.githubusercontent.com/dinisafonsopinto/Wplace-Blue-Marble-Lite/main/content.user.js
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    Date.prototype.addSeconds = function(s, m=0, h=0) {
        this.setTime(this.getTime() + (h*60*60*1000) + (m*60*1000) + (s*1000));
        return this;
    }


    // 1. Create a minimal UI overlay
    const ui = document.createElement('div');
    ui.style.position = 'fixed';
    ui.style.top = '10px';
    ui.style.left = '75px'; // Keeps the exact positioning from original
    ui.style.backgroundColor = 'rgba(20, 20, 20, 0.9)';
    ui.style.color = 'white';
    ui.style.padding = '12px';
    ui.style.borderRadius = '5px';
    ui.style.zIndex = '9999';
    ui.style.fontFamily = 'monospace';
    ui.style.border = '1px solid #444';
    ui.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
    ui.style.pointerEvents = 'none'; // Lets you click through it

    ui.innerHTML = `
        <div style="font-weight:bold; border-bottom: 1px solid #555; margin-bottom: 8px; padding-bottom: 4px;">Blue Marble Lite</div>
        <div style="margin-bottom: 6px;">Next level in: <b id="bm-lite-next-level">Waiting...</b></div>
        <div>Full Charges in: <b id="bm-lite-timer">Waiting...</b></div>
    `;
    document.body.appendChild(ui);

    const nextLevelEl = document.getElementById('bm-lite-next-level');
    const timerEl = document.getElementById('bm-lite-timer');
    let countdownInterval = null;

    // 2. Data extraction and updating logic
    function updateStats(data) {
        // Calculate Pixels until next level using the original math
        if (data.level !== undefined && data.pixelsPainted !== undefined) {
            const nextLevelPixels = Math.ceil(Math.pow(Math.floor(data.level) * Math.pow(30, 0.65), 1 / 0.65) - data.pixelsPainted);
            nextLevelEl.textContent = `${nextLevelPixels.toLocaleString()} pixels`;
        }

        // Calculate and start Timer for full charges
        if (data.charges) {
            const endDate = Date.now() + (data.charges.max - data.charges.count) * data.charges.cooldownMs;

            if (countdownInterval) clearInterval(countdownInterval);

            countdownInterval = setInterval(() => {
                const remainingMs = Math.max(0, endDate - Date.now());

                if (remainingMs === 0) {
                    timerEl.textContent = "FULL";
                    timerEl.style.color = "#0f0"; // Green when full
                    clearInterval(countdownInterval);
                    return;
                }

                timerEl.style.color = "white";

                // Formatting time remaining
                const secondsTotal = Math.floor(remainingMs / 1000);
                const hours = Math.floor(secondsTotal / 3600);
                const minutes = Math.floor((secondsTotal % 3600) / 60);
                const seconds = Math.floor(secondsTotal % 60);

                const d = new Date();
                const newDate = d.addSeconds(seconds, minutes, hours);
                const formattedDate = String(newDate.getHours()).padStart(2, '0') + ':' + String(newDate.getMinutes()).padStart(2, '0');

                timerEl.textContent =
                    String(hours).padStart(2, '0') + ':' +
                    String(minutes).padStart(2, '0') + ':' +
                    String(seconds).padStart(2, '0') + ' (' +
                    formattedDate + ')';

            }, 500);
        }
    }

    // 3. Intercept Fetch requests to grab user data quietly from the background
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);

        // Clone response so we can read JSON without consuming the original stream Wplace needs
        const clone = response.clone();
        const url = (args[0] instanceof Request ? args[0].url : args[0]) || "";

        // Check if the request is grabbing the user profile ('/me')
        if (url.includes("/me")) {
            clone.json().then(data => {
                if (data && data.charges) {
                    updateStats(data);
                }
            }).catch(() => {}); // Suppress errors if response isn't standard JSON
        }

        return response;
    };
})();