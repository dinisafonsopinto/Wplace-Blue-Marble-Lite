// ==UserScript==
// @name         Blue Marble (Lite)
// @namespace    https://github.com/SwingTheVine/
// @version      1.1.0
// @description  A stripped-down userscript for Wplace.live showing pixel timer, next level, and adding an archive button.
// @author       Dinis12481
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
                if (data && data.charges) updateStats(data);
            }).catch(() => {});
        }
        return response;
    };

    // 4. Archive Button Logic
    function createArchiveButton(id, originalShareBtn) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = 'btn btn-sm btn-primary btn-soft';
        btn.setAttribute('aria-label', 'Open in Archive');
        btn.title = 'Open in Archive';
        
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
        
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Step A: Temporarily hide dialogs and backdrops
            const styleId = 'eralyon-hide-dialog';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.innerHTML = 'dialog[open] { opacity: 0 !important; pointer-events: none !important; transition: none !important; } .modal-backdrop { opacity: 0 !important; transition: none !important; }';
                document.head.appendChild(style);
            }

            // Step B: Ghost click the native share button
            originalShareBtn.click();

            // Step C: Rapidly poll for the dialog and the input field
            let attempts = 0;
            const checkDialog = setInterval(() => {
                attempts++;
                
                // Find the open dialog that contains a readonly input
                const dialogs = Array.from(document.querySelectorAll('dialog[open]'));
                const targetDialog = dialogs.find(d => d.querySelector('input[readonly]'));
                
                if (targetDialog) {
                    const inputEl = targetDialog.querySelector('input[readonly]');
                    
                    // Wait for the game to actually populate the URL into the input field
                    if (inputEl && inputEl.value && inputEl.value.includes('http')) {
                        clearInterval(checkDialog);
                        
                        let lat, lng, zoom;
                        
                        try {
                            // Parse the generated share URL elegantly
                            const shareUrl = new URL(inputEl.value);
                            lat = shareUrl.searchParams.get('lat');
                            lng = shareUrl.searchParams.get('lng');
                            zoom = shareUrl.searchParams.get('zoom') || '12.52';
                        } catch (err) {
                            console.error("Failed to parse share URL", err);
                        }
                        
                        // Close the modal instantly
                        const closeBtn = targetDialog.querySelector('form[method="dialog"] button');
                        if (closeBtn) closeBtn.click();
                        
                        // Step D: Open the archive and clean up the hidden CSS
                        setTimeout(() => {
                            const styleEl = document.getElementById(styleId);
                            if (styleEl) styleEl.remove(); 
                            
                            if (lat && lng) {
                                window.open(`https://wplace.eralyon.net/en/?lat=${lat}&lng=${lng}&zoom=${zoom}&version=14545`, '_blank');
                            } else {
                                alert("Could not extract parameters from the share URL.");
                            }
                        }, 25);
                    }
                } else if (attempts > 50) { 
                    // Failsafe timeout after 500ms
                    clearInterval(checkDialog);
                    const styleEl = document.getElementById(styleId);
                    if (styleEl) styleEl.remove();
                    alert("Share modal or URL input didn't load in time.");
                }
            }, 10);
        };
        
        return btn;
    }

    function injectArchiveButton() {
        const popup = document.querySelector('.absolute.bottom-0.left-0.z-30');
        if (!popup) return;

        const shareButtons = popup.querySelectorAll('button[aria-label="Share"]');
        shareButtons.forEach((shareBtn, index) => {
            const btnId = 'eralyon-archive-btn-' + index;
            
            if (!document.getElementById(btnId)) {
                // Pass the specific share button element so we can ghost click it
                const archiveBtn = createArchiveButton(btnId, shareBtn);
                const parent = shareBtn.parentElement;
                
                if (parent && parent.className.includes('grid-cols-[1fr_auto_auto]')) {
                    parent.classList.remove('grid-cols-[1fr_auto_auto]');
                    parent.style.gridTemplateColumns = '1fr auto auto auto';
                }
                
                shareBtn.insertAdjacentElement('afterend', archiveBtn);
            }
        });
    }

    const observer = new MutationObserver(() => injectArchiveButton());
    observer.observe(document.body, { childList: true, subtree: true });

})();