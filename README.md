# 🖥️ Web-OS

A browser-based, OS-like environment built with **HTML**, **CSS**, **TypeScript**, and a **Node.js server** — bringing a desktop-style experience right into your web browser.

---

## 📸 Preview

> A windowed, taskbar-driven UI that mimics a desktop operating system — entirely in the browser.

---

## ✨ Features

- 🪟 Window management system (open, close, move app windows)
- 📌 Taskbar with app search input and suggestions
- 🖱️ Desktop-style interaction using HTML + CSS + TypeScript
- 🗂️ Modular app structure under `App/App_tester`
- ⚙️ Node.js backend server (`server.js`) to serve the OS environment
- 🔷 TypeScript source with compiled JavaScript output

---

## 🧰 Prerequisites

Before running Web-OS, make sure you have the following installed:

| Requirement | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org/) | `v16.x` or higher | Runs the backend server (`server.js`) |
| [npm](https://www.npmjs.com/) | `v8.x` or higher | Package management |
| [TypeScript](https://www.typescriptlang.org/) | `v4.x` or higher | Compiling `.ts` source files |
| A modern web browser | Latest | Chrome, Firefox, Edge, or Safari |

### Verify your environment

```bash
node --version      # Should be v16+
npm --version       # Should be v8+
tsc --version       # Should be v4+
```

---

## 📁 Project Structure

```
Web-OS/
├── App/
│   └── App_tester/       # App testing modules
├── javascript/           # Compiled JS output
├── typescript/           # TypeScript source files
├── index.html            # Entry point — the Web-OS shell
├── style.css             # Global OS-like styles
├── server.js             # Node.js server to host the app
└── README.md
```

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/code-tinker-art/Web-OS.git
cd Web-OS
```

### 2. Install dependencies

```bash
npm install
```

### 3. Compile TypeScript

If you make changes to the TypeScript source files, compile them:

```bash
tsc
```

> Compiled output will be placed in the `javascript/` directory.

### 4. Start the server

```bash
node server.js
```

### 5. Open in your browser

Navigate to:

```
http://localhost:3000
```

> The port may differ. Check the terminal output from `server.js` for the exact URL.

---

## 🛠️ Development

To watch TypeScript files and auto-compile on change:

```bash
tsc --watch
```

To install TypeScript globally (if not already installed):

```bash
npm install -g typescript
```

---

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source. Check the repository for license details.

---

## 🔗 Links

- **Repository:** [https://github.com/code-tinker-art/Web-OS](https://github.com/code-tinker-art/Web-OS)
- **Issues:** [https://github.com/code-tinker-art/Web-OS/issues](https://github.com/code-tinker-art/Web-OS/issues)
