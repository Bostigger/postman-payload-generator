document.addEventListener('DOMContentLoaded', function() {
    const modelCode = document.getElementById('modelCode');
    const routesCode = document.getElementById('routesCode');
    const generateBtn = document.getElementById('generateBtn');
    const outputContainer = document.getElementById('outputContainer');
    const notification = document.getElementById('notification');

    // Generate button event
    generateBtn.addEventListener('click', generatePayloads);

    // Add API key input
    let apiKeyInput;

    function initializeApiKeyField() {
        const settingsDiv = document.createElement('div');
        settingsDiv.className = 'api-key-container';
        settingsDiv.innerHTML = `
            <label for="apiKey">OpenAI API Key:</label>
            <div class="api-key-input-container">
                <input type="password" id="apiKey" placeholder="Enter your OpenAI API key">
                <button id="saveApiKey">Save</button>
            </div>
            <small>Your API key is stored locally in your browser and never sent to our servers.</small>
        `;

        document.querySelector('.output-section .card').prepend(settingsDiv);

        apiKeyInput = document.getElementById('apiKey');
        const saveApiKeyBtn = document.getElementById('saveApiKey');

        // Load saved API key if available
        const savedApiKey = localStorage.getItem('openai_api_key');
        if (savedApiKey) {
            apiKeyInput.value = savedApiKey;
        }

        // Save API key
        saveApiKeyBtn.addEventListener('click', () => {
            const apiKey = apiKeyInput.value.trim();
            if (apiKey) {
                localStorage.setItem('openai_api_key', apiKey);
                notification.textContent = 'API key saved!';
                notification.classList.add('show');
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 2000);
            }
        });
    }

    // Initialize the API key field when the page loads
    initializeApiKeyField();

    // Generate JSON payloads using OpenAI API
    async function generatePayloads() {
        // Check if API key is available
        const apiKey = apiKeyInput.value.trim() || localStorage.getItem('openai_api_key');

        if (!apiKey) {
            outputContainer.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <p>Please enter your OpenAI API key to generate payloads.</p>
                </div>
            `;
            return;
        }

        // Show loading state
        outputContainer.innerHTML = `
            <div class="generating">
                <div class="loading"></div>
                <span>Generating Postman payloads with GPT-3.5...</span>
            </div>
        `;

        try {
            // Prepare prompt for OpenAI
            const prompt = `
I have a Sequelize model and Express routes that I need to generate JSON payload examples for Postman testing.

Here's my Sequelize model:
\`\`\`javascript
${modelCode.value}
\`\`\`

Here's my Express routes:
\`\`\`javascript
${routesCode.value}
\`\`\`

Please generate sample JSON payloads for POST, PUT, and PATCH routes that I can use directly in Postman.
The payloads should be raw JSON objects for the request body, with realistic sample values.
For example, instead of "Sample text", use actual valid values like "John" for firstName.
Only include the JSON object, not any wrapper objects like "request" or "response".
`;

            // Call OpenAI API with the real API
            const response = await callOpenAI(prompt, apiKey);

            // Process the response
            const payloads = processOpenAIResponse(response);

            // Display results
            displayResults(payloads);
        } catch (error) {
            console.error('Error generating payloads:', error);
            outputContainer.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <p>Error: ${error.message || 'Failed to generate payloads'}</p>
                </div>
            `;
        }
    }

    // Call OpenAI API
    async function callOpenAI(prompt, apiKey) {
        const apiUrl = 'https://api.openai.com/v1/chat/completions';

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that generates JSON payloads for Postman API testing based on Sequelize models and Express routes.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('OpenAI API error:', errorData);
                throw new Error(`API call failed with status: ${response.status}. ${errorData.error?.message || ''}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error calling OpenAI:', error);
            throw new Error(error.message || 'Failed to call OpenAI API');
        }
    }

    // Process OpenAI response to extract payloads
    function processOpenAIResponse(response) {
        try {
            const payloads = [];

            // Extract code blocks with regex
            const codeBlocks = response.match(/```json\s*([\s\S]*?)\s*```/g);

            if (!codeBlocks || codeBlocks.length === 0) {
                throw new Error('No JSON payload found in the response');
            }

            // Extract section titles for each code block
            const sections = response.split(/###\s+/);
            sections.shift(); // Remove the first element (intro text)

            // Process each code block and match with section title
            codeBlocks.forEach((block, index) => {
                // Clean the JSON string
                const jsonStr = block.replace(/```json\s*|\s*```/g, '').trim();

                try {
                    const payload = JSON.parse(jsonStr);

                    // Extract route info from section title if available
                    let method = 'POST';
                    let path = '/';
                    let description = '';

                    if (index < sections.length) {
                        const sectionTitle = sections[index].split('\n')[0].trim();
                        const routeMatch = sectionTitle.match(/([A-Z]+)\s+([^\s]+)/);

                        if (routeMatch) {
                            method = routeMatch[1];
                            path = routeMatch[2];
                        }

                        description = sectionTitle;
                    }

                    payloads.push({
                        method: method,
                        path: path,
                        description: description,
                        payload: payload,
                        explanation: sections[index].split('\n').slice(1).join('\n').trim()
                    });
                } catch (e) {
                    console.warn('Failed to parse JSON:', e);
                }
            });

            return payloads;
        } catch (error) {
            console.error('Error processing response:', error);
            throw new Error('Failed to process the generated payloads');
        }
    }

    // Display generated results
    function displayResults(payloads) {
        if (payloads.length === 0) {
            outputContainer.innerHTML = `
                <div class="empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <p>No payloads were generated. Try modifying your model or routes.</p>
                </div>
            `;
            return;
        }

        // Clear previous results
        outputContainer.innerHTML = '';

        // Add each endpoint result
        payloads.forEach(endpoint => {
            const methodClass = `badge-${endpoint.method.toLowerCase()}`;
            const endpointContainer = document.createElement('div');
            endpointContainer.className = 'endpoint-container';

            let content = `
                <div class="endpoint-header">
                    <span class="badge ${methodClass}">${endpoint.method}</span>
                    <span>${endpoint.path}</span>
                </div>
                <div class="endpoint-content">
                    <div class="header-with-copy">
                        <h3>${endpoint.method} ${endpoint.path} (${endpoint.description.split(/[\(\)]/)[1] || endpoint.description})</h3>
                        <button class="copy-btn" onclick="copyPayload(this, '${btoa(JSON.stringify(endpoint.payload))}')">Copy</button>
                    </div>
                    <pre class="json-content">
${JSON.stringify(endpoint.payload, null, 2)}
                    </pre>
                </div>
            `;

            endpointContainer.innerHTML = content;
            outputContainer.appendChild(endpointContainer);
        });

        // Add click-to-copy functionality to JSON blocks
        addCopyListeners();
    }

    // Copy payload to clipboard - needs to be global for the onclick to work
    window.copyPayload = function(button, encodedPayload) {
        const payload = JSON.parse(atob(encodedPayload));
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));

        button.innerText = "Copied!";
        setTimeout(() => {
            button.innerText = "Copy";
        }, 2000);

        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);
    };

    // Add event listeners after rendering results
    function addCopyListeners() {
        document.querySelectorAll('.json-content').forEach(pre => {
            pre.addEventListener('click', function() {
                const text = this.textContent.trim();
                navigator.clipboard.writeText(text);

                notification.classList.add('show');
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 2000);
            });
        });
    }
});