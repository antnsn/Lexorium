const { ipcRenderer } = require("electron");

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
    })
    .catch((err) => {
      console.error("Error copying code to clipboard", err);
    });
};

const saveToFile = () => {
  if (currentFilePath) {
    ipcRenderer.invoke("file:save", {
      filePath: currentFilePath,
      content: markdownContent,
    });
  } else {
    alert("No file is currently open.");
  }
};

// Event Listeners and IPC Handlers

ipcRenderer.on("file-new", () => {
  const newFileContent = ""; // New file starts with empty content
  markdownContent = newFileContent;
  updateDocumentView();
  updateTOC();
});

ipcRenderer.on("file-opened", (event, { filePath, content }) => {
  currentFilePath = filePath;
  markdownContent = content;
  updateDocumentView();
  updateTOC();
});

ipcRenderer.on("file-save-request", () => {
  saveToFile();
});

// Listen for dark mode updates from the main process
ipcRenderer.on("update-dark-mode", (event, isDarkMode) => {
  document.body.classList.toggle("dark-mode", isDarkMode);
  const highlightStyle = document.getElementById("highlight-style");
  if (isDarkMode) {
    highlightStyle.href =
      "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github-dark.min.css";
  } else {
    highlightStyle.href =
      "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css";
  }
});

const addNoteButton = document.getElementById("add-note");
const undoButton = document.getElementById("undo"); // Add this line to get the Undo button
const tocSection = document.getElementById("toc");
const documentView = document.getElementById("document-view");

const getCurrentTimeStamp = () => {
  const now = new Date();
  return `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()} - ${now.getHours()}:${now.getMinutes()}`;
};

addNoteButton.addEventListener("click", () => {
  const headerInput = document.getElementById("header-input");
  const bodyInput = document.getElementById("body-input");

  const headerValue = headerInput.value || getCurrentTimeStamp();
  const bodyValue = bodyInput.value.trim(); // Trim whitespace from the body input

  // Check if the body is empty
  if (bodyValue === "") {
    alert("Note body cannot be empty. Please enter some content.");
    return; // Stop the submission if the body is empty
  }

  // Add markers for the start and end of the section
  const newNote = `
<!-- start-section-${headerValue.replace(/\s/g, "-")} -->
## ${headerValue}

${bodyValue}
<!-- end-section-${headerValue.replace(/\s/g, "-")} -->

`;

  markdownContent += newNote;

  updateDocumentView();
  updateTOC();
  saveToFile();

  // Clear input fields after submission
  headerInput.value = "";
  bodyInput.value = "";
});

// Attach event listener to the Undo button
undoButton.addEventListener("click", undoDelete);

// Column Resizing Logic
const dividers = document.querySelectorAll(".divider");
let isResizing = false;
let lastDownX = 0;

dividers.forEach((divider) => {
  divider.addEventListener("mousedown", (e) => {
    isResizing = true;
    lastDownX = e.clientX;

    const previous = divider.previousElementSibling;
    const next = divider.nextElementSibling;

    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;

      const offsetRight =
        container.clientWidth - (e.clientX - container.offsetLeft);
      const previousWidth =
        ((e.clientX - container.offsetLeft) / container.clientWidth) * 100;
      const nextWidth = (offsetRight / container.clientWidth) * 100;

      previous.style.width = previousWidth + "%";
      next.style.width = nextWidth + "%";
    });

    document.addEventListener("mouseup", () => {
      isResizing = false;
    });
  });
});

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
