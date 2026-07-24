# Leselampe - Foreign Language Reader & Translator

A modern, high-performance web application designed for reading foreign language books (PDF, TXT, or page photos/scans) with instant tap-to-translate, interactive vocabulary flashcards & quizzes, multiple reading themes, and zero-cost client-side processing.

## 🚀 Key Features

- **📖 Multi-Format Support**: Read `.pdf`, `.txt`, or scanned page photos (`OCR`).
- **🔤 Instant Tap-to-Translate**: Tap any word on the PDF canvas or text layer for immediate translation, pronunciation audio, and synonyms.
- **🎨 4 Reading Themes**: Midnight Dark, Warm Sepia Paper, Clean Day Light, and Emerald Forest.
- **🧠 Interactive Vocabulary Deck**: Save words, study 3D flashcards with speech pronunciation, and test your knowledge with interactive typing quizzes.
- **🔒 100% Local Device Storage**: All books, page renders, and vocabulary items stay private on your browser's IndexedDB.

## 🛠️ Tech Stack

- **Framework**: React.js + Vite
- **PDF Engine**: PDF.js (`pdfjs-dist`)
- **OCR Engine**: Tesseract.js
- **Styling**: Vanilla CSS with CSS custom variables & modern HSL design system
- **Storage**: IndexedDB (`idb-keyval`)

## 💻 Getting Started Locally

```bash
# Clone the repository
git clone https://github.com/Awaisalam786/translator.git

# Install dependencies
npm install

# Start development server
npm run dev
```
