/**
 * UI component creators for game HUD elements
 */

export class UIComponents {
    /**
     * Create health display element
     */
    static createHealthDisplay() {
        const healthDisplay = document.createElement('div');
        healthDisplay.style.position = 'absolute';
        healthDisplay.style.bottom = '20px';
        healthDisplay.style.left = '20px';
        healthDisplay.style.color = '#ff0000';
        healthDisplay.style.fontSize = '32px';
        healthDisplay.style.fontWeight = 'bold';
        healthDisplay.style.fontFamily = 'Arial, sans-serif';
        healthDisplay.innerText = 'HEALTH: 100';
        document.body.appendChild(healthDisplay);
        return healthDisplay;
    }

    /**
     * Create chat container
     */
    static createChatContainer() {
        const chatContainer = document.createElement('div');
        chatContainer.style.position = 'absolute';
        chatContainer.style.bottom = '80px';
        chatContainer.style.left = '20px';
        chatContainer.style.width = '300px';
        chatContainer.style.height = '150px';
        chatContainer.style.overflowY = 'hidden';
        chatContainer.style.display = 'flex';
        chatContainer.style.flexDirection = 'column';
        chatContainer.style.justifyContent = 'flex-end';
        chatContainer.style.pointerEvents = 'none';
        chatContainer.style.fontFamily = 'Arial, sans-serif';
        chatContainer.style.fontSize = '16px';
        chatContainer.style.textShadow = '1px 1px 1px #000';
        document.body.appendChild(chatContainer);
        return chatContainer;
    }

    /**
     * Add a message to chat container
     */
    static addChatMessage(chatContainer, text, color = '#ffffff') {
        const msg = document.createElement('div');
        msg.innerText = text;
        msg.style.color = color;
        msg.style.marginBottom = '4px';
        chatContainer.appendChild(msg);

        // Keep last 10 messages
        if (chatContainer.children.length > 10) {
            chatContainer.removeChild(chatContainer.firstChild);
        }
    }

    /**
     * Create leaderboard UI
     */
    static createLeaderboard() {
        const leaderboard = document.createElement('div');
        leaderboard.style.position = 'absolute';
        leaderboard.style.top = '50%';
        leaderboard.style.left = '50%';
        leaderboard.style.transform = 'translate(-50%, -50%)';
        leaderboard.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        leaderboard.style.color = '#fff';
        leaderboard.style.padding = '20px';
        leaderboard.style.display = 'none';
        leaderboard.style.borderRadius = '10px';
        leaderboard.style.fontFamily = 'Arial, sans-serif';
        leaderboard.style.minWidth = '300px';
        document.body.appendChild(leaderboard);

        // Title
        const lbTitle = document.createElement('h2');
        lbTitle.innerText = 'Leaderboard';
        lbTitle.style.textAlign = 'center';
        lbTitle.style.marginTop = '0';
        leaderboard.appendChild(lbTitle);

        // Table
        const lbTable = document.createElement('table');
        lbTable.style.width = '100%';
        lbTable.style.borderCollapse = 'collapse';
        lbTable.innerHTML = `
            <thead>
                <tr style="border-bottom: 1px solid #555;">
                    <th style="padding: 10px; text-align: left;">Name</th>
                    <th style="padding: 10px; text-align: center;">Kills</th>
                    <th style="padding: 10px; text-align: center;">Deaths</th>
                </tr>
            </thead>
            <tbody id="lb-body"></tbody>
        `;
        leaderboard.appendChild(lbTable);

        return leaderboard;
    }

    /**
     * Update leaderboard with player list
     */
    static updateLeaderboard(playersList) {
        const tbody = document.getElementById('lb-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        // Sort by kills desc
        playersList.sort((a, b) => b.kills - a.kills);

        playersList.forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding: 5px;">${p.name || 'Unknown'}</td>
                <td style="padding: 5px; text-align: center;">${p.kills || 0}</td>
                <td style="padding: 5px; text-align: center;">${p.deaths || 0}</td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Setup chat input toggle
     */
    static setupChatInput(chatInputElement, controls, networkClient) {
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Enter') {
                if (chatInputElement.style.display === 'none') {
                    // Open chat
                    controls.unlock();
                    chatInputElement.style.display = 'block';
                    chatInputElement.focus();
                } else {
                    // Send message
                    const msg = chatInputElement.value;
                    if (msg.trim() !== '') {
                        networkClient.emit('chatMessage', msg);
                        chatInputElement.value = '';
                    }
                    chatInputElement.style.display = 'none';
                    controls.lock();
                }
            }
        });
    }

    /**
     * Setup leaderboard toggle (Tab key)
     */
    static setupLeaderboardToggle(leaderboardElement) {
        document.addEventListener('keydown', (event) => {
            if (event.code === 'Tab') {
                event.preventDefault();
                leaderboardElement.style.display = 'block';
            }
        });

        document.addEventListener('keyup', (event) => {
            if (event.code === 'Tab') {
                leaderboardElement.style.display = 'none';
            }
        });
    }
}
