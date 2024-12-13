<p align="center">
  <img width="30%" src="app/assets/icon.png">
</p>

# Lexorium
*(Derived from "lexicon" and "orium," suggesting a place for words)* 

**Lexorium** is an open-source Electron application designed to streamline the management of text and code snippets. It's your go-to tool for those moments when you need to temporarily store text before it finds its final destination. Whether it's notes, code snippets, or any other text, **Lexorium** ensures you can easily save, search, and organize your content.

Proudly built with the assistance of ChatGPT, **Lexorium** is a testament to what can be achieved with knowledge, dedication, and AI-powered help. While it may not be perfect, contributions are greatly appreciated to help make it better.

## Features

- **Three-Column Interface**:
  - **Table of Contents**: Quickly navigate through your notes.
  - **Document View**: View your notes with full markdown support, including syntax highlighting and the ability to copy code blocks.
  - **Input Section**: Easily add new notes with headers and body content.

- **ChatGPT Integration**:
  - Use ChatGPT to generate notes based on your input.
  - Use ChatGPT to process your notes and generate new notes based on the existing ones.

- **Enhanced Editing**:
  - Edit any section directly in place with a click
  - Copy code blocks with a single click

- **Dark and Light Modes**:
  - Seamlessly switch between One Dark and One Light themes to suit your preference.
  - System theme support for automatic switching

- **Search Functionality**:
  - Quickly find notes by searching both headers and body content.

- **TOC Management**:
  - Directly manage your notes from the Table of Contents
  - Edit or delete sections with intuitive controls
  - Easily navigate through your document structure

- **Configuration**:
  - Access and edit configuration directly from the Edit menu
  - Customize your experience through the settings dialog
  - Recent files list for quick access to your documents

- **Open Source**:
  - Fully open-source, licensed under the ISC License
  - Contributions are welcome!

## Installation

All releases of **Lexorium** can be found here: [Lexorium Releases](https://github.com/antnsn/Lexorium/releases).

## Installation MacOS

To install **Lexorium** using Homebrew Cask:

1. Tap the repository:

   ```bash
   brew tap antnsn/lexorium
   ```

2. Install **Lexorium**:

   ```bash
   brew install --cask lexorium
   ```

> **Important:**  
> Due to unverified developer status, the macOS app requires manual permission to be opened.  
> [How to guide](https://support.apple.com/en-us/102445)

## Usage

1. **Create a New Note**:
   - In the top menu, go to: `File` -> `New`
   - Enter a new file name and save it in a suitable location
   - Access recent files quickly from the `File` -> `Recent Files` menu

2. **Adding and Editing Notes**:
   - Enter a header and body in the input fields
   - Click the edit icon next to any section to modify it directly
   - Notes are saved in markdown format and appear in the Table of Contents

3. **Searching and Navigation**:
   - Use the search bar above the Table of Contents to quickly find notes
   - Search matches both headers and body content with highlighted results
   - Click on any section in the Table of Contents to jump to it

4. **Managing Notes**:
   - Edit sections by clicking the pencil icon
   - Delete sections using the trash icon
   - Copy code blocks with the copy button in the top-right corner

5. **Customization**:
   - Switch between light and dark themes in the View menu
   - Access settings through `Edit` -> `Settings`
   - View and edit configuration directly via `Edit` -> `Open Config File`

## Contributing

We welcome contributions from the community! Feel free to fork the repository, submit issues, or create pull requests.

## License

**Lexorium** is licensed under the [ISC License](LICENSE).

---

Created with ❤️ by [Marius Antonsen](https://github.com/antnsn).
