// Global state
let currentDocumentData = {
    version: "1.0",
    sections: []
};
let currentFilePath = "";
let undoStack = []; // Stack to keep track of deleted sections for undo
let markdownContent = "";
let documentView = document.getElementById("document-view");
let tocSection = document.getElementById("toc");

// Function Definitions
function renderDocument(documentData) {
    let html = '';
    
    documentData.sections.forEach((section, index) => {
        html += `
            <div id="section-${section.id}" class="markdown-section">
                <div class="section-header">
                    <h2>${section.title}</h2>
                    <div class="section-controls">
                        <button class="edit-button" onclick="editSection('${section.id}')">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 00-.064.108l-.558 1.953 1.953-.558a.253.253 0 00.108-.064l6.286-6.286zm1.238-3.763a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086z"/>
                            </svg>
                        </button>
                        <button class="delete-button" onclick="deleteSection('${section.id}')">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path fill-rule="evenodd" d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="markdown-body" data-section-id="${section.id}">
                    ${marked.parse(section.content)}
                </div>
            </div>`;
    });

    documentView.innerHTML = html;

    // Add copy button to code blocks
    document.querySelectorAll('pre code').forEach((block) => {
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.innerHTML = '<i class="fas fa-copy"></i>';
        button.onclick = () => copyCodeToClipboard(block);
        
        const pre = block.parentNode;
        pre.style.position = 'relative';
        pre.insertBefore(button, block);
        
        // Apply syntax highlighting
        hljs.highlightElement(block);
    });
}

function updateTOC() {
    const sections = document.querySelectorAll('.markdown-section');
    tocSection.innerHTML = Array.from(sections)
        .map(section => {
            const header = section.querySelector('h2').textContent;
            const id = section.id;
            return `<a href="#${id}" class="toc-item">${header}</a>`;
        })
        .join('');
}

function createNewDocument() {
    currentDocumentData = {
        version: "1.0",
        sections: []
    };
    currentFilePath = "";
    renderDocument(currentDocumentData);
    updateTOC();
}

async function loadDocument(filePath) {
    try {
        // Use the correct IPC method to read file
        const { content } = await window.electronAPI.openFile();
        if (!content) return;

        try {
            // Try to parse as JSON
            currentDocumentData = JSON.parse(content);
            if (!currentDocumentData.version) {
                // Add version if it's missing
                currentDocumentData = {
                    version: "1.0",
                    sections: currentDocumentData.sections || []
                };
            }
        } catch (e) {
            // If it's not JSON, convert from old markdown format
            currentDocumentData = convertMarkdownToJSON(content);
        }

        currentFilePath = filePath;
        renderDocument(currentDocumentData);
        updateTOC();
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If it's a new file, create an empty document
            createNewDocument();
            currentFilePath = filePath;
        } else {
            console.error('Failed to load document:', error);
        }
    }
}

async function saveDocument() {
    if (!currentFilePath) {
        console.error('No file path specified');
        return;
    }

    try {
        await window.electronAPI.saveFile({
            filePath: currentFilePath,
            content: JSON.stringify(currentDocumentData, null, 2)
        });
    } catch (error) {
        console.error('Failed to save document:', error);
    }
}

function convertMarkdownToJSON(markdown) {
    const sections = markdown.split(/(?=## )/);
    const result = {
        version: "1.0",
        sections: []
    };

    sections.forEach(section => {
        if (!section.trim()) return;

        const headerMatch = section.match(/^## (.*?)$/m);
        if (!headerMatch) return;

        const header = headerMatch[1];
        let content = section.substring(section.indexOf('\n') + 1).trim();
        
        // Extract section markers and content
        const startMarkerMatch = content.match(/<!--\s*start-section-([a-z0-9]+)\s*-->/);
        const endMarkerMatch = content.match(/<!--\s*end-section-([a-z0-9]+)\s*-->/);
        
        const sectionData = {
            id: startMarkerMatch ? startMarkerMatch[1] : generateId(),
            title: header,
            content: content
        };

        if (startMarkerMatch && endMarkerMatch) {
            sectionData.content = content.substring(
                startMarkerMatch.index + startMarkerMatch[0].length,
                endMarkerMatch.index
            ).trim();
        }

        result.sections.push(sectionData);
    });

    return result;
}

function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

function updateDocumentView() {
    try {
        const markdownRenderFunction = marked.marked || marked.parse || marked;
        if (typeof markdownRenderFunction !== "function") {
            throw new Error("Cannot find the markdown rendering function");
        }

        // Configure marked options
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true,
            gfm: true
        });

        // Initialize marked with syntax highlighting
        marked.setOptions({
            highlight: function(code, lang) {
                const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                return hljs.highlight(code, { language }).value;
            },
            langPrefix: 'hljs language-'
        });

        // Configure marked renderer for links
        const renderer = new marked.Renderer();
        renderer.link = (href, title, text) => {
            // For internal links (starting with #), keep them as is
            if (href.startsWith('#')) {
                return `<a href="${href}">${text}</a>`;
            }
            // For external links (starting with http/https), add target="_blank"
            if (href.match(/^https?:\/\//)) {
                return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="external-link">${text}</a>`;
            }
            // For all other links, treat as internal
            return `<a href="${href}">${text}</a>`;
        };
        marked.setOptions({ renderer });

        const htmlContent = marked.parse(markdownContent);

        documentView.innerHTML = htmlContent;

        // Add copy buttons to code blocks
        document.querySelectorAll("pre code").forEach((block) => {
            const pre = block.parentNode;
            pre.style.position = "relative"; // Ensure pre is positioned for absolute button positioning

            const button = document.createElement("button");
            button.innerText = "Copy";
            button.className = "copy-button";
            button.addEventListener("click", () => {
                copyCodeToClipboard(block);
            });

            pre.appendChild(button); // Append the button to the pre element

            // Apply syntax highlighting with automatic language detection
            hljs.highlightElement(block);
        });

        // Scroll to specific headers if clicked from TOC
        document.querySelectorAll("#toc a").forEach((anchor, index) => {
            anchor.addEventListener("click", (event) => {
                event.preventDefault();
                const targetElement = document.getElementById(`section-${index}`);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: "smooth" });
                }
            });
        });
    } catch (error) {
        console.error("Error rendering markdown:", error);
    }
}

function copyCodeToClipboard(block) {
    const codeText = block.innerText;
    navigator.clipboard.writeText(codeText)
        .then(() => {
            console.log("Code copied to clipboard");

            // Provide feedback to the user
            const button = block.parentNode.querySelector(".copy-button");
            if (button) {
                const originalText = button.innerText;
                button.innerText = "Copied!";
                setTimeout(() => {
                    button.innerText = originalText;
                }, 2000); // Revert back after 2 seconds
            }
        })
        .catch((err) => {
            console.error("Error copying code to clipboard", err);
        });
}

// Event Listeners
electronAPI.onFileNew((event) => {
    createNewDocument();
});

electronAPI.onFileOpened((event, { filePath, content }) => {
    try {
        // Try to parse as JSON
        currentDocumentData = JSON.parse(content);
        if (!currentDocumentData.version) {
            // Add version if it's missing
            currentDocumentData = {
                version: "1.0",
                sections: currentDocumentData.sections || []
            };
        }
    } catch (e) {
        // If it's not JSON, convert from old markdown format
        currentDocumentData = convertMarkdownToJSON(content);
    }

    currentFilePath = filePath;
    renderDocument(currentDocumentData);
    updateTOC();
});

electronAPI.onFileSaveRequest((event) => {
    saveDocument();
});

// Dark mode handling
if (window.electronAPI.onUpdateDarkMode) {
    window.electronAPI.onUpdateDarkMode((event, darkMode) => {
        if (darkMode) {
            document.body.classList.add('dark-mode');
            updateCodeBlockTheme(true);
        } else {
            document.body.classList.remove('dark-mode');
            updateCodeBlockTheme(false);
        }
    });
}

// Function to update code block theme
function updateCodeBlockTheme(darkMode) {
    const themeLink = document.getElementById('highlight-style');
    if (darkMode) {
        themeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/atom-one-dark.min.css';
    } else {
        themeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/atom-one-light.min.css';
    }
}

// Settings and ChatGPT functionality
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeModal = document.querySelector('.close-modal');
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyBtn = document.getElementById('save-api-key');

// Show/hide settings modal
settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'block';
    // Load existing API key
    electronAPI.getApiKey().then(apiKey => {
        if (apiKey) {
            apiKeyInput.value = apiKey;
        }
    });
});

closeModal.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

// Save API key
saveApiKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('Please enter an API key');
        return;
    }

    try {
        const success = await electronAPI.setApiKey(apiKey);
        if (success) {
            alert('API key saved successfully');
            settingsModal.style.display = 'none';
        } else {
            alert('Failed to save API key');
        }
    } catch (error) {
        alert('Error saving API key: ' + error.message);
    }
});

// Event Listeners and IPC Handlers
const addNoteButton = document.getElementById("add-note");
const undoButton = document.getElementById("undo");

const getCurrentTimeStamp = () => {
    const now = new Date();
    return `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()} - ${now.getHours()}:${now.getMinutes()}`;
};

const generateRandomId = () => {
    return Math.random().toString(36).substr(2, 9);
};

function autoResizeTextarea(textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set new height to scrollHeight
    textarea.style.height = textarea.scrollHeight + 'px';
}

addNoteButton.addEventListener("click", async () => {
    const headerInput = document.getElementById("header-input");
    const bodyInput = document.getElementById("body-input");
    const useChatGPT = document.getElementById("use-chatgpt").checked;

    const bodyValue = bodyInput.value.trim();
    if (!bodyValue) {
        alert("Note body cannot be empty. Please enter some content.");
        return;
    }

    try {
        let headerValue = headerInput.value.trim();
        let content = bodyValue;

        if (useChatGPT) {
            // Process with ChatGPT
            const result = await electronAPI.processWithChatGPT("", bodyValue, headerValue);
            headerValue = result.title || headerValue || getCurrentTimeStamp();
            content = result.response;
        } else {
            headerValue = headerValue || getCurrentTimeStamp();
        }

        // Remove any quotes from the title
        headerValue = headerValue.replace(/['"]/g, '');

        // Create a new section in JSON format
        const newSection = {
            id: generateRandomId(),
            title: headerValue,
            content: content
        };

        // Add the new section to the document
        currentDocumentData.sections.push(newSection);

        // Update the view and save
        renderDocument(currentDocumentData);
        updateTOC();
        saveDocument();

        // Clear inputs
        headerInput.value = "";
        bodyInput.value = "";
        document.getElementById("use-chatgpt").checked = false;

    } catch (error) {
        console.error('Error creating note:', error);
        alert('Error: ' + error.message);
    }
});

function editSection(sectionId) {
    const section = currentDocumentData.sections.find(s => s.id === sectionId);
    if (!section) return;

    const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`).closest('.markdown-section');
    if (!sectionElement) return;

    // Add editing class to the section
    sectionElement.classList.add('editing');
    
    // Replace the h2 with an input
    const headerElement = sectionElement.querySelector('h2');
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = section.title;
    titleInput.className = 'edit-title-input';
    headerElement.replaceWith(titleInput);
    
    // Get the markdown body div
    const markdownBody = sectionElement.querySelector('.markdown-body');
    
    // Create textarea
    const textarea = document.createElement('textarea');
    textarea.value = section.content;
    
    // Calculate initial height based on content
    const lines = section.content.split('\n').length;
    const lineHeight = 24; // approximate line height in pixels
    textarea.style.height = (lines * lineHeight) + 'px';
    
    // Auto-resize the textarea
    const autoResize = (elem) => {
        elem.style.height = 'auto';
        elem.style.height = (elem.scrollHeight) + 'px';
    };
    
    // Clear and update markdown body
    markdownBody.innerHTML = '';
    markdownBody.appendChild(textarea);
    
    // Set up resize handlers
    textarea.addEventListener('input', () => autoResize(textarea));
    
    // Focus the title input
    titleInput.focus();
    titleInput.select();
    
    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'save-button';
    saveButton.onclick = async () => {
        // Update section data
        section.title = titleInput.value;
        section.content = textarea.value;
        
        // Save to storage
        await saveDocument();
        
        // Force a complete refresh
        window.electronAPI.reloadWindow();
    };
    markdownBody.appendChild(saveButton);
}

function saveSection(sectionId) {
    const section = currentDocumentData.sections.find(s => s.id === sectionId);
    if (!section) return;

    const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`).closest('.markdown-section');
    const textarea = sectionElement.querySelector('textarea');
    const titleInput = sectionElement.querySelector('input[type="text"]');
    
    section.content = textarea.value;
    section.title = titleInput.value;
    sectionElement.classList.remove('editing');
    
    saveDocument();
    window.electronAPI.reloadWindow();
}

function cancelEdit(sectionId) {
    const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`).closest('.markdown-section');
    if (!sectionElement) return;
    
    sectionElement.classList.remove('editing');
    renderDocument(currentDocumentData);
}

function deleteSection(sectionId) {
    const section = currentDocumentData.sections.find(s => s.id === sectionId);
    if (!section) return;
    
    // Add to undo stack
    undoStack.push(section);
    
    // Remove section
    currentDocumentData.sections = currentDocumentData.sections.filter(s => s.id !== sectionId);
    
    // Update view
    renderDocument(currentDocumentData);
    updateTOC();
    saveDocument();
}

function undoDelete() {
    const section = undoStack.pop();
    if (!section) return;
    
    // Add section back
    currentDocumentData.sections.push(section);
    
    // Update view
    renderDocument(currentDocumentData);
    updateTOC();
    saveDocument();
}

document.getElementById("search-input").addEventListener("input", (event) => {
    const searchTerm = event.target.value.toLowerCase();
    const tocSection = document.getElementById("toc");

    // Clear any previous highlights and show all sections
    document.querySelectorAll(".highlighted").forEach((el) => {
        el.classList.remove("highlighted");
    });
    document.querySelectorAll(".search-highlight").forEach((el) => {
        const parent = el.parentNode;
        if (parent) {
            parent.replaceChild(document.createTextNode(el.textContent || ''), el);
        }
    });
    document.querySelectorAll(".markdown-section").forEach((el) => {
        el.style.display = "block";
    });

    // If the search term is empty, reset the TOC and return
    if (searchTerm === "") {
        updateTOC();
        return;
    }

    // Filter sections based on the search term
    tocSection.innerHTML = currentDocumentData.sections
        .map((section) => {
            const headerText = section.title;
            const sectionContent = section.content;
            const sectionElement = document.querySelector(`[data-section-id="${section.id}"]`);

            const matches = headerText.toLowerCase().includes(searchTerm) ||
                          sectionContent.toLowerCase().includes(searchTerm);

            // Show/hide the section based on match
            if (sectionElement) {
                sectionElement.style.display = matches ? "block" : "none";
                if (matches) {
                    sectionElement.classList.add("highlighted");
                    
                    // Highlight matching text in the section
                    const contentElement = sectionElement.querySelector('.markdown-body');
                    if (contentElement) {
                        const regex = new RegExp(`(${searchTerm})`, 'gi');
                        const walker = document.createTreeWalker(
                            contentElement,
                            NodeFilter.SHOW_TEXT,
                            null,
                            false
                        );
                        
                        const textNodes = [];
                        let node;
                        while (node = walker.nextNode()) {
                            if (node.textContent.toLowerCase().includes(searchTerm)) {
                                textNodes.push(node);
                            }
                        }
                        
                        textNodes.forEach(node => {
                            const newContent = node.textContent.replace(
                                regex,
                                '<span class="search-highlight">$1</span>'
                            );
                            const span = document.createElement('span');
                            span.innerHTML = newContent;
                            node.parentNode.replaceChild(span, node);
                        });
                    }
                }
            }

            // Return TOC entry only if it matches
            if (matches) {
                const highlightedTitle = headerText.replace(
                    new RegExp(`(${searchTerm})`, 'gi'),
                    '<span class="search-highlight">$1</span>'
                );
                return `
                    <div class="toc-item">
                        <a href="#${sectionElement?.id || ''}">${highlightedTitle}</a>
                        <button class="delete-button" onclick="deleteSection('${section.id}')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>`;
            }
            return ""; // Exclude non-matching entries
        })
        .join("");
});

// Undo with Ctrl+Z or Cmd+Z
document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault();
        undoDelete();
    }
});

function saveToFile() {
    if (currentFilePath) {
        const documentData = {
            version: "1.0",
            sections: []
        };

        const sections = document.querySelectorAll('.markdown-section');
        sections.forEach(section => {
            const sectionId = section.id;
            const header = section.querySelector('h2').textContent;
            const content = section.querySelector('.markdown-body').innerHTML;

            documentData.sections.push({
                id: sectionId,
                title: header,
                content: content
            });
        });

        electronAPI.saveFile({
            filePath: currentFilePath,
            content: JSON.stringify(documentData, null, 2),
        });
    } else {
        alert("No file is currently open.");
    }
}

// Add event listener for undo button
undoButton.addEventListener("click", () => {
    undoDelete();
});
