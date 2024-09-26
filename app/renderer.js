let markdownContent = "";
let currentFilePath = "";
let undoStack = []; 

// Function Definitions
const updateDocumentView = () => {
  if (typeof markdownContent !== "string" || markdownContent.trim() === "") {
    // console.error("markdownContent is not properly initialized or is empty");
    return; // Prevent rendering if the content is invalid
  }
  try {
    const markdownRenderFunction = marked.marked || marked.parse || marked;
    if (typeof markdownRenderFunction !== "function") {
      throw new Error("Cannot find the markdown rendering function");
    }

    // Split markdown into sections based on headers
    const sections = markdownContent.split(/^## .+/gm);
    const headers = markdownContent.match(/^## .+/gm) || [];

    let htmlContent = "";

    headers.forEach((header, index) => {
      const sectionContent = sections[index + 1] || ""; // The content after the header
      htmlContent += `
        <div id="section-${index}" class="markdown-section">
          <h2>${header.replace(/^##\s*/, "")}</h2>
          ${markdownRenderFunction(sectionContent)}
        </div>`;
    });

    documentView.innerHTML = htmlContent;

    // Add copy buttons to code blocks
    document.querySelectorAll("pre code").forEach((block) => {
      const pre = block.parentNode;
      pre.style.position = "relative"; 

      const button = document.createElement("button");
      button.innerText = "Copy";
      button.className = "copy-button";
      button.addEventListener("click", () => {
        copyCodeToClipboard(block);
      });

      pre.appendChild(button); 

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
  const headers = markdownContent.match(/^## .+/gm) || [];

  if (headers.length === 0 || index >= headers.length) {
    console.error("Invalid header index or no headers found.");
    return;
  }

  const header = headers[index];
  const sectionId = header.replace(/^##\s*/, "").replace(/\s/g, "-");
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
  navigator.clipboard
    .writeText(codeText)
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

const saveToFile = async () => {
  if (currentFilePath) {
    try {
      await window.electronAPI.saveFile(currentFilePath, markdownContent);
      alert("File saved successfully!");
    } catch (error) {
      alert("Error saving file: " + error.message);
    }
  } else {
    alert("No file is currently open.");
  }
};


// Event Listeners and IPC Handlers

// Listen for file events from the main process
window.electronAPI.on("file-new", () => {
  const newFileContent = ""; // New file starts with empty content
  markdownContent = newFileContent;
  updateDocumentView();
  updateTOC();
});

window.electronAPI.on("file-opened", (data) => {
  const { filePath, content } = data;

  if (content === undefined) {
    console.error("Invalid content received: undefined");
    alert("Failed to open the file or the content is empty.");
    return; // Exit if content is invalid
  }

  // Update the markdown content and view
  currentFilePath = filePath;
  markdownContent = content.trim(); // Set the markdown content

  // Call the update functions after content is set
  updateDocumentView();
  updateTOC();
});

window.electronAPI.on("file-save-request", () => {
  saveToFile();
});

// Listen for dark mode updates from the main process
window.electronAPI.on("update-dark-mode", (isDarkMode) => {
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

const addNoteButton = document.getElementById("add-note");
const undoButton = document.getElementById("undo");
const tocSection = document.getElementById("toc");
const documentView = document.getElementById("document-view");

const getCurrentTimeStamp = () => {
  const now = new Date();
  return `${now.getDate()}.${
    now.getMonth() + 1
  }.${now.getFullYear()} - ${now.getHours()}:${now.getMinutes()}`;
};

addNoteButton.addEventListener("click", async () => {
  const headerInput = document.getElementById("header-input");
  const bodyInput = document.getElementById("body-input");

  const headerValue = headerInput.value || getCurrentTimeStamp();
  const bodyValue = bodyInput.value.trim();

  if (bodyValue === "") {
    alert("Note body cannot be empty. Please enter some content.");
    return;
  }

  const enableChatGPT = document.getElementById("enable-chatgpt").checked;
  let finalBodyValue = bodyValue;

  if (enableChatGPT) {
    // Load API key from the config
    let apiKey = await window.electronAPI.loadApiKey();

    // Check if API key is set
    if (!apiKey) {
      // Prompt for API key using the contextBridge exposed method
      const apiKeyFromPrompt = await window.electronAPI.promptForApiKey();

      // If the user cancels or doesn't provide an API key
      if (!apiKeyFromPrompt) {
        alert(
          "API key is required to use ChatGPT. Please set it in the ChatGPT menu."
        );
        return;
      }

      // Save and initialize OpenAI with the provided API key
      await window.electronAPI.initializeOpenAI(apiKeyFromPrompt);
      apiKey = apiKeyFromPrompt; // Update the local apiKey variable
    } else {
      // Initialize OpenAI with the existing API key
      await window.electronAPI.initializeOpenAI(apiKey);
    }

    try {
      finalBodyValue = await window.electronAPI.sendToChatGPT(bodyValue); 
      console.log("ChatGPT Response:", finalBodyValue);
    } catch (error) {
      console.error("Error communicating with ChatGPT:", error);
      alert("Failed to get a response from ChatGPT.");
      return;
    }
  }

  const newNote = `
<!-- start-section-${headerValue.replace(/\s/g, "-")} -->
## ${headerValue}

${finalBodyValue}
<!-- end-section-${headerValue.replace(/\s/g, "-")} -->

`;

  markdownContent += newNote;

  updateDocumentView();
  updateTOC();
  saveToFile();

  headerInput.value = "";
  bodyInput.value = "";
});

// Attach event listener to the Undo button
undoButton.addEventListener("click", undoDelete);

document.getElementById("search-input").addEventListener("input", (event) => {
  const searchTerm = event.target.value.toLowerCase();

  // Clear any previous highlights
  document.querySelectorAll(".highlighted").forEach((el) => {
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

      // Highlight matching sections
      if (sectionContent.includes(searchTerm)) {
        const highlightedContent = sectionContent.replace(
          new RegExp(searchTerm, "g"),
          (match) => `<span class="highlighted">${match}</span>`
        );
        document.querySelector(`#${sectionId}`).innerHTML = highlightedContent;
        return `<div class="toc-item"><a href="#${sectionId}">${headerText}</a></div>`;
      }
      return ""; // Exclude non-matching headers
    })
    .join("");
});

// Initialize with an empty document view
updateDocumentView();
updateTOC();
