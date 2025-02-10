# Puppeteer TypeScript Crawler

A high-performance, modular web crawler built with **Puppeteer**, **TypeScript**, and **SOLID** principles. This crawler is designed to be scalable, maintainable, and efficient for various web scraping use cases.

## Installation

Ensure you have **Node.js** (>=18) installed.

```sh
npm install
```

### Configuration

- You can enable remote browser connection by setting an environment variable `REMOTE_BROWSER` pointing to `<host>:<port>`.
- You Can set the executable path of your local browser setting an environment variable `EXECUTABLE_PATH` pointing to `/path/to/google-chrome`.

If none of those variables are set, the default is to launch local browser on `/usr/bin/google-chrome`.

If both are set, `REMOTE_BROWSER` takes priority.

## Usage

Run the crawler with:

```sh
npm start # run with local browser
npm run start:remote # run the docker image of browserless and connect to it

npm run build # generate docs and build the crawler to ./dist/ folder
```

## 🛠️ Core Concepts & Design Patterns

See [ABOUT](./ABOUT.md) section for detailed info.

## Dependencies

- **[Puppeteer](https://github.com/puppeteer/puppeteer)** – Headless browser automation
- **[TypeScript](https://www.typescriptlang.org/)** – Strongly typed JavaScript

## Contributing

Feel free to submit pull requests and report issues. Contributions are welcome!

## License

This project is licensed under the **MIT License**.
