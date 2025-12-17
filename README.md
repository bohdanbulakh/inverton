# Inverton

Inverton is a robust, CLI-based full-text search engine implementing an **Inverted Index** architecture backed by **Redis**. Built with **TypeScript**, **Node.js**, and **React Ink**, it provides a terminal user interface (TUI) for indexing local file systems and performing high-performance text searches.

## 🚀 Features

* **Inverted Index Storage**: Efficiently maps terms to documents using Redis sets and hashes.
* **Multiple Search Modes**:
    * **Keyword Search**: Standard search using TF-IDF scoring.
    * **Phrase Search**: Finds exact sequences of words.
    * **Boolean Search**: Supports complex queries using `AND`, `OR`, `NOT` operators.
* **Interactive TUI**: Rich terminal interface powered by [Ink](https://github.com/vadimdemedes/ink) for file browsing, indexing, and viewing search results.
* **Text Processing**: Includes tokenization, normalization, and lemmatization (with dictionary support).
* **Concurrency**: Optimized indexing queue to handle large directory structures.
* **Benchmarking Tools**: Built-in scripts to measure indexing throughput and query latency.

## 📋 Prerequisites

* **Node.js**: Version 24 or higher.
* **Yarn**: Package manager.
* **Docker & Docker Compose**: Required to run the Redis backend.

## 🛠️ Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/bohdanbulakh/inverton.git
    cd inverton
    ```

2.  **Install dependencies:**
    ```bash
    yarn install
    ```

3.  **Start the Redis backend:**
    This project relies on Redis for storing the index. Use Docker Compose to spin up Redis and Redis Commander (a web UI for Redis).
    ```bash
    docker-compose up -d
    ```
    * Redis will be available at `localhost:6379`.
    * Redis Commander will be available at `http://localhost:8081`.

## 💻 Usage

Inverton provides several CLI commands via Yarn scripts.

### 1. Main Application

To start the main TUI menu (if applicable based on implementation):
```bash
yarn start
```

### 2. Indexing Files

You can index files interactively or by passing a direct path.

**Interactive Mode:**
Opens a file browser TUI to navigate and select directories/files to index.
```bash
yarn index
```

**Direct Mode:**
Directly indexes a specific file or directory path.
```bash
yarn index -f /path/to/your/documents
```
Note: On the first run, the system will load dictionary data from data/dictionaries.zip into Redis. This might take a few moments.

### 3. Searching

Launch the interactive search interface to query your indexed documents.
```bash
yarn run search
```
* Use Tab to switch focus between the search bar and results list.
* Use Escape to switch between search modes (Keyword, Phrase, Boolean).
* Select a result to view the document content with hit highlighting.

## 🧪 Development

### Running Tests

The project includes both unit and integration tests (using Jest).

**Unit Tests:**
```bash
yarn test:unit
```

**Integration Tests:** Requires Redis to be running.
```bash
yarn test:integration
```

### Benchmarking

Performance scripts are located in the bench/ directory.

**Queue Throughput:** Measure how fast the system can process the indexing queue.
```bash
yarn bench:queue
```

**Query Latency:** Measure search response times.
```bash
yarn bench:query
```
## 🏗️ Architecture

**Frontend (CLI):**
* React components rendered to the terminal via Ink
* Handles user input and navigation

**Search Engine:**
* **Tokenizer/Normalizer**: Breaks text into terms and reduces them to base forms (lemmas)
* **Strategies**: Distinct logic for handling Keyword (scoring), Phrase (positional checks), and Boolean (set operations) queries

**Persistence (Redis):**
* `word:{term}`: Sets/Hashes storing document IDs and term frequencies
* `doc:{id}`: Metadata about indexed documents

## 📜 License

This project is licensed under the MIT License.
