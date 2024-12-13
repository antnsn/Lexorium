let markdownContent = "";
let currentFilePath = "";
let undoStack = []; // Stack to keep track of deleted sections for undo

// Function Definitions
const updateDocumentView = () => {
  try {
    const markdownRenderFunction = marked.marked || marked.parse || marked;
    if (typeof markdownRenderFunction !== "function") {
      throw new Error("Cannot find the markdown rendering function");
    }

    // Configure marked to use highlight.js for code blocks
    marked.setOptions({
      highlight: function(code, language) {
        const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
        return hljs.highlight(code, { language: validLanguage }).value;
      },
      langPrefix: 'hljs language-' // Add the hljs class for proper styling
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

    // Split markdown into sections based on headers
    const sections = markdownContent.split(/^## .+/gm);
    const headers = markdownContent.match(/^## .+/gm) || [];

    let htmlContent = "";

    headers.forEach((header, index) => {
      const sectionContent = sections[index + 1] || ""; // The content after the header
      htmlContent += `
        <div id="section-${index}" class="markdown-section">
          <div class="markdown-body">
            <h2>${header.replace(/^##\s*/, "")}</h2>
            ${markdownRenderFunction(sectionContent)}
          </div>
        </div>`;
    });

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
};

const updateTOC = () => {
  const headers = markdownContent.match(/^## .+/gm) || [];
  tocSection.innerHTML = headers
    .map((header, index) => {
      const headerId = `section-${index}`;
      const headerText = header.replace(/^##\s*/, "");
      return `
        <div class="toc-item">
          <a href="#${headerId}">${headerText}</a>
          <button class="delete-button" data-index="${index}">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>`;
    })
    .join("");

  // Attach delete button event listeners
  document.querySelectorAll(".delete-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const index = event.target.closest("button").getAttribute("data-index");
      deleteSection(index);
    });
  });
};

const deleteSection = (index) => {
  // Find all section markers
  const sectionMatches = [...markdownContent.matchAll(/<!-- start-section-([a-z0-9]+) -->/g)];
  
  if (sectionMatches.length === 0 || index >= sectionMatches.length) {
    console.error("Invalid section index or no sections found.");
    return;
  }

  // Get the section ID for the selected index
  const sectionId = sectionMatches[index][1];
  const startMarker = `<!-- start-section-${sectionId} -->`;
  const endMarker = `<!-- end-section-${sectionId} -->`;

  // Find the start and end positions of the section
  const startPos = markdownContent.indexOf(startMarker);
  const endPos = markdownContent.indexOf(endMarker) + endMarker.length;

  if (startPos === -1 || endPos === -1) {
    console.error("Could not find markers for section:", sectionId);
    return;
  }

  // Save the deleted section to the undo stack
  const deletedSection = markdownContent.slice(startPos, endPos);
  undoStack.push(deletedSection);

  // Remove the section between the start and end markers
  markdownContent =
    markdownContent.slice(0, startPos) + markdownContent.slice(endPos);

  updateDocumentView();
  updateTOC();
  saveToFile();
};

// Function to undo the last delete operation
const undoDelete = () => {
  if (undoStack.length === 0) {
    alert("Nothing to undo.");
    return;
  }

  const lastDeleted = undoStack.pop();
  markdownContent += lastDeleted;

  updateDocumentView();
  updateTOC();
  saveToFile();
};

const copyCodeToClipboard = (block) => {
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
};

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
const tocSection = document.getElementById("toc");
const documentView = document.getElementById("document-view");

const getCurrentTimeStamp = () => {
  const now = new Date();
  return `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()} - ${now.getHours()}:${now.getMinutes()}`;
};

const generateRandomId = () => {
  return Math.random().toString(36).substr(2, 9);
};

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
    let response = null;

    if (useChatGPT) {
      // Process with ChatGPT
      const result = await electronAPI.processWithChatGPT("", bodyValue, headerValue);
      headerValue = result.title || headerValue || getCurrentTimeStamp();
      response = result.response;
    } else {
      headerValue = headerValue || getCurrentTimeStamp();
    }

    // Create a new note
    const uniqueId = generateRandomId();
    const newNote = `
<!-- start-section-${uniqueId} -->
## ${headerValue}

${useChatGPT ? response : bodyValue}
<!-- end-section-${uniqueId} -->
`;

    // Add the new note
    if (markdownContent) {
      markdownContent += "\n\n" + newNote;
    } else {
      markdownContent = newNote;
    }

    // Update the view
    updateDocumentView();
    updateTOC();
    saveToFile();

    // Clear inputs
    headerInput.value = "";
    bodyInput.value = "";
    document.getElementById("use-chatgpt").checked = false;

  } catch (error) {
    console.error('Error creating note:', error);
    alert('Error: ' + error.message);
  }
});

// Attach event listener to the Undo button
undoButton.addEventListener("click", undoDelete);

document.getElementById("search-input").addEventListener("input", (event) => {
  const searchTerm = event.target.value.toLowerCase();

  // Clear any previous highlights
  document.querySelectorAll
  (".highlighted").forEach((el) => {
    el.classList.remove("highlighted");
  });

  // If the search term is empty, reset the TOC and return
  if (searchTerm === "") {
    updateTOC();
    return;
  }

  // Filter TOC items based on the search term
  const headers = markdownContent.match(/^## .+/gm) || [];
  tocSection.innerHTML = headers
    .map((header, index) => {
      const headerText = header.replace(/^##\s*/, "");
      const sectionId = `section-${index}`;
      const sectionContent = document
        .querySelector(`#${sectionId}`)
        .innerText.toLowerCase();

      if (
        headerText.toLowerCase().includes(searchTerm) ||
        sectionContent.includes(searchTerm)
      ) {
        // Highlight matching section
        document.querySelector(`#${sectionId}`).classList.add("highlighted");

        // Return TOC entry
        return `
          <div class="toc-item">
            <a href="#${sectionId}">${headerText}</a>
            <button class="delete-button" data-index="${index}">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>`;
      } else {
        return ""; // Exclude non-matching entries
      }
    })
    .join("");

  // Re-attach delete button event listeners
  document.querySelectorAll(".delete-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const index = event.target.closest("button").getAttribute("data-index");
      deleteSection(index);
    });
  });
});

// Undo with Ctrl+Z or Cmd+Z
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "z") {
    event.preventDefault();
    undoDelete();
  }
});

electronAPI.onFileNew((event) => {
  const newFileContent = ""; // New file starts with empty content
  markdownContent = newFileContent;
  currentFilePath = null;
  updateDocumentView();
  updateTOC();
});

electronAPI.onFileOpened((event, { filePath, content }) => {
  currentFilePath = filePath;
  markdownContent = content;
  updateDocumentView();
  updateTOC();
});

electronAPI.onFileSaveRequest((event) => {
  saveToFile();
});

// Listen for dark mode updates from the main process
electronAPI.onUpdateDarkMode((event, isDarkMode) => {
  document.body.classList.toggle("dark-mode", isDarkMode);
  const highlightStyle = document.getElementById("highlight-style");
  if (isDarkMode) {
    highlightStyle.href =
      "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/atom-one-dark.min.css";
  } else {
    highlightStyle.href =
      "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/atom-one-light.min.css";
  }
});

const saveToFile = () => {
  if (currentFilePath) {
    electronAPI.saveFile({
      filePath: currentFilePath,
      content: markdownContent,
    });
  } else {
    alert("No file is currently open.");
  }
};
