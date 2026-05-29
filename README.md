# Pulse Framework

> A modular, scalable, and TypeScript-native performance engineering framework powered by **k6** and equipped with a beautiful **Desktop Dashboard**.

Pulse brings modern software engineering practices to performance testing. Write structured, maintainable load tests in TypeScript with auto-discovery, reuse business flows, mock dependencies with an integrated mock server, and execute/monitor runs via the CLI or a sleek Desktop GUI.

---

## Key Features

- **TypeScript Native**: Write clean, type-safe load testing scripts.
- **Modular Architecture**: Separate scenarios, user journeys (flows), API clients (use-cases), and load profiles.
- **Auto-Discovery**: No manual scenario registration. Pulse automatically discovers scenarios and profiles.
- **Cockpit Desktop App**: Run, manage, and inspect load tests and mock servers in real-time using a premium Electron-based GUI.
- **Integrated Mock Server**: Spin up local mock APIs on the fly for hermetic load testing.
- **Boilerplate Generator**: Scaffolding new tests in seconds using standard templates.

---

## Installation

Add the framework to your project or install it globally to access the `pulse` CLI:

```bash
# Install globally
npm install -g pulse-arch

# Or link locally during development
npm link
```

---

## Getting Started

### 1. Initialize the Workspace
Run the initialization command to generate the required directory tree, configuration templates, and the workspace `package.json`:

```bash
pulse init
```

Next, **install the local workspace dependencies** required for TypeScript compilation and Electron desktop operation:

```bash
npm install
```

This creates the following structure:
```text
├── config/              # Runtime and environment configurations
├── data/                # Payloads, generators, datasets, and mock server scripts
│   ├── datasets/
│   ├── generators/
│   └── payloads/
├── pulse/               # Framework core (HTTP client, config-resolver, logger, etc.)
│   └── desktop/         # Cockpit Electron Desktop dashboard
├── src/                 # Test code
│   ├── flows/           # User flows / transaction groups
│   ├── profiles/        # k6 load profiles (VUs, duration, etc.)
│   ├── scenarios/       # Test entrypoints
│   └── use-cases/       # Granular HTTP request calls
└── tsconfig.json        # TypeScript configuration
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and set up your target base URLs and tokens:

```bash
cp .env.example .env
```

You can also use the CLI to add/update environment variables directly:
```bash
pulse add-env BASE_URL_DEV http://localhost:3333
```

---

## CLI Usage

Pulse exposes the `pulse` command line interface:

### Run a Load Test
Execute a load test by specifying the scenario and target environment:
```bash
pulse run <scenario-name> [env]

# Examples:
pulse run sample_request_smoke_test dev
pulse run checkout_stress_test stg
```

Options:
- `-v, --vus <number>`: Override virtual users (VUs) count
- `-d, --duration <string>`: Override test duration (e.g. `10m`, `30s`)

### Generate a New Scenario
Scaffold a complete test scenario along with its flow, load profile, use case, and thresholds:
```bash
pulse gen <scenario-name-kebab-case>

# Example:
pulse gen user-login
```

### Run the Mock Server
Start the built-in mock server to run tests against local mock dependencies:
```bash
pulse mock
```

---

## Desktop Cockpit GUI

For a visual dashboard to run and monitor your load tests, launch the **Pulse Cockpit** Desktop App:

```bash
pulse open gui

# Or simply
pulse gui
```

The desktop app allows you to:
- Choose from auto-discovered scenarios and profiles.
- Configure variables dynamically.
- View real-time terminal output and performance logs.
- Control the mock server with simple start/stop buttons.
- View generated `summary.html` report pages instantly.

---

## Project Structure Explained

- **Scenarios (`src/scenarios/`)**: The main entry points for k6. They define the lifecycle hook setups and map options/thresholds.
- **Flows (`src/flows/`)**: Orchestrated actions that represent real-world user flows (e.g. browsing a product, adding to cart, checking out).
- **Profiles (`src/profiles/`)**: Custom load profiles defining the virtual user ramp-ups and targets.
- **Use Cases (`src/use-cases/`)**: Low-level, reusable API call definitions wrapped with validation checks.

---

## Credits

Developed and maintained by **Augusto Reis** ([@oaugustoreis](https://github.com/oaugustoreis)).

---

## License

This project is licensed under the [ISC License](LICENSE).
