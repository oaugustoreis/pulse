# Pulse Framework: Complete Developer & User Guide 🚀

Welcome to the **Pulse Framework**! Pulse is a modern, modular, and TypeScript-native performance engineering framework powered by **k6**. It is designed to bring clean software engineering practices (like modularity, loose decoupling, type-safety, fluent assertions, and contract testing) to the performance testing world.

This guide provides a comprehensive overview of the folder structure, core features, and CLI commands to get new developers up and running instantly.

---

## 1. Directory Structure & Architecture 📂

When you run `pulse init` in a workspace, the framework bootstraps a structured, decoupled architecture. Here is what every directory is for:

```text
├── config/              # Global runtime and SLA configurations
├── data/                # Payloads, CSV datasets, and local Mock dependencies
├── pulse/               # Framework Core, Compiler, and Cockpit Dashboard
├── src/                 # Test Suite Source Code (Your actual tests)
│   ├── flows/           # Logical user journeys (transactions)
│   ├── profiles/        # k6 load profiles (VUs, durations, stages)
│   ├── scenarios/       # Test entrypoints resolved by k6
│   ├── schemas/         # API contract JSON Schemas
│   └── use-cases/       # Granular, atomic REST API client requests
├── tsconfig.json        # TypeScript configuration with path aliases
└── package.json         # Workspace dependencies and scripts
```

### `/config` (Runtime Settings)
Stores global options like default timeouts, base thresholds, and target SLA profiles. Keeps testing logic separate from configuration.

### `/data` (Test Data & Mocking)
Stores CSV datasets, dynamic generators, static payloads, and the built-in mock server.
- **`data/datasets/`**: CSV files representing user accounts, product lists, or other database-seeded master data.
- **`data/generators/`**: Helper scripts to generate dynamic mock data on the fly (e.g., random names, unique identifiers, CPFs) to prevent cache hits or data collision under heavy load.
- **`data/server.js`**: An integrated mock server. Allows running performance runs locally without hitting live staging environments.

### `/pulse` (The Core Engine - Brief Overview)
This is the heart of the framework. Users **do not need to modify files here**, but it contains incredibly useful utilities:
- **`pulse/core/pulse.ts`**: Exposes the `ps` namespace, enabling transaction grouping (`ps.group`), pacing (`ps.sleep`), and fluent checks/SLAs (`ps.expect`).
- **`pulse/http/http.ts`**: A type-safe HTTP client wrapper around k6's HTTP library supporting auto-injected bearer tokens, content-type defaults, and telemetry.
- **`pulse/desktop/`**: The Electron-based **Cockpit Dashboard** application source code.
- **`pulse/build.mjs`**: The TypeScript compiler and automatic scenario discovery pipeline.

### `/src` (Your Test Code - Decoupled Architecture)
Pulse implements a highly decoupled 5-tier architecture to make tests clean and maintainable:
1. **Use Cases (`src/use-cases/`)**: Atomic REST client wrappers. They do the actual call and assert SLAs/contracts.
2. **Schemas (`src/schemas/`)**: JSON Schema files validating API contracts, decoupled from client logic for global reusability.
3. **Flows (`src/flows/`)**: High-level business flows orchestrating multiple Use Cases into transactional user stories (e.g. browsing -> selecting product -> checkout).
4. **Profiles (`src/profiles/`)**: Load patterns defining VU ramp-ups, targets, durations, and stages.
5. **Scenarios (`src/scenarios/`)**: Test entrypoints loaded by k6. They handle setup hooks, load CSV files, shard iterations, and trigger the Flows.

---

## 2. Core Features 🛠️

### ⚡ TypeScript Native (Compiled on the fly)
Write standard, type-safe TypeScript code. Pulse automatically compiles all tests, schemas, and configurations into a single bundled JavaScript file (`pulse/dist/main.js`) in milliseconds every time you trigger a scenario run.

### 🎯 Fluent Assertion SLA Layer (`ps.expect`)
Allows developers to declare functional SLAs during load tests elegantly, using a chainable assertion API instead of verbose, repetitive checks:
```typescript
ps.expect(res)
  .status(200)
  .bodyNotEmpty()
  .responseTimeLessThan(800)
  .header("Content-Type", "application/json");
```

### 🛡️ API Contract Validation (JSON Schema)
Catch API payload breaks under heavy load. Pulse comes with an integrated, native recursive JSON Schema validator compatible with the k6 Goja runtime:
```typescript
ps.expect(res).jsonSchema(myUserSchema);
```
If a database degradation or microservice failure causes the payload to return truncated properties or incorrect types, the schema validator catches it instantly!

---

## 3. CLI Command Reference 🖥️

The `pulse` CLI is designed to completely automate setup, scaffolding, running, and visual debugging.

### 1. `pulse init`
- **Why it exists**: Manually creating 15+ subdirectories, path aliases, typescript configs, and copying boilerplate files is tedious and prone to configuration mistakes.
- **How it helps**: Bootstraps the entire modular framework directory tree, copies default templates, configurations (`tsconfig.json`, `.env.example`), and generates a workspace `package.json` with all required dependencies in one click.
- **Usage**:
  ```bash
  pulse init
  ```

### 2. `pulse gen <scenario-name-kebab-case>`
- **Why it exists**: Creating a new scenario requires manually writing a Use Case, a Schema, a Flow, a Load Profile, and a Scenario entrypoint, keeping import paths aligned.
- **How it helps**: Instantly scaffolds a complete, type-safe performance test scenario based on naming conventions. It generates all 5 files, configures standard templates, imports schemas, and wires up standard assertions in seconds.
- **Usage**:
  ```bash
  pulse gen user-login
  ```

### 3. `pulse run <scenario-name> [env]`
- **Why it exists**: Executing a load test usually requires compiling code, setting k6 environment variables, mapping CLI overrides, and pointing to the correct bundled file.
- **How it helps**: Combines compilation and k6 execution into one simple command. It automatically resolves environment configs from `.env`, runs the `esbuild` compiler, prints a clean console UI, and triggers the k6 run.
- **Options**:
  - `-v, --vus <number>`: Override virtual users target count on the fly.
  - `-d, --duration <string>`: Override duration on the fly (e.g. `5m`, `10s`).
- **Usage**:
  ```bash
  pulse run user_login_smoke_test dev
  ```

### 4. `pulse mock`
- **Why it exists**: Hits live staging environments during performance scripting can trigger rate-limits, contaminate databases, or yield flaky results.
- **How it helps**: Starts the local mock server in the background, allowing scripts to be written and tested hermetically with zero external dependencies.
- **Usage**:
  ```bash
  pulse mock
  ```

### 5. `pulse gui` / `pulse open gui`
- **Why it exists**: Scripting and executing via command line can feel dry, and analyzing console logs or opening static HTML report files manually is annoying.
- **How it helps**: Launces the premium **Pulse Cockpit Dashboard** Desktop application. Enables visual scenario selection, real-time log streaming, mock controls, and instant HTML report reloading in a stunning visual interface.
- **Usage**:
  ```bash
  pulse open gui
  ```

### 6. `pulse add-env <key> <value>`
- **Why it exists**: Editing `.env` files manually requires opening editors and managing keys.
- **How it helps**: Safely updates or appends key-value pairs directly in your local `.env` file right from the terminal.
- **Usage**:
  ```bash
  pulse add-env BASE_URL_PROD https://api.pulse-project.com
  ```

---

## 4. End-to-End Code Example ✍️

Here is a complete, working example of a newly generated endpoint test using the Pulse 5-tier modular architecture:

### 1. The Schema (`src/schemas/product/product.schema.ts`)
```typescript
export const productSchema = {
    type: "object",
    required: ["id", "title", "price"],
    properties: {
        id: { type: "number" },
        title: { type: "string" },
        price: { type: "number" }
    }
};
```

### 2. The Use-Case (`src/use-cases/product/getProduct.useCase.ts`)
```typescript
import { get } from "@pulse/http";
import { ps } from "@pulse/core";
import { productSchema } from "@src/schemas/product/product.schema";

export interface ProductParams { baseUrl: string; token: string; productId: number; }

export function getProduct({ baseUrl, token, productId }: ProductParams) {
    const url = `${baseUrl}/products/${productId}`;
    const res = get(url, { token }, 200, "getProduct");

    // Enforce Functional SLAs & Schema contract checks
    ps.expect(res)
        .status(200)
        .bodyNotEmpty()
        .responseTimeLessThan(800) // SLA: Less than 800ms
        .jsonSchema(productSchema);

    return res;
}
```

### 3. The Flow (`src/flows/product/product.flow.ts`)
```typescript
import { ps } from "@pulse/core";
import { getProduct } from "@src/use-cases/product/getProduct.useCase";

export interface FlowParams { baseUrl: string; token: string; }

export function productFlow({ baseUrl, token }: FlowParams): void {
    // Wrap inside transaction group for aggregated telemetry
    ps.group("Browse Product Flow", () => {
        getProduct({ baseUrl, token, productId: 101 });
        
        // Pacing think-time
        ps.sleep(1);
    });
}
```

### 4. The Profile (`src/profiles/product/product.profiles.ts`)
```typescript
import { Options } from "k6/options";

export const productProfiles: Options["scenarios"] = {
    "product_smoke_test": {
        executor: "shared-iterations",
        exec: "engine",
        vus: 1,
        iterations: 1,
    },
    "product_stress_test": {
        executor: "ramping-vus",
        exec: "engine",
        startVUs: 0,
        stages: [
            { duration: "1m", target: 50 },  // Ramp-up
            { duration: "3m", target: 50 },  // Steady-state
            { duration: "1m", target: 0 }    // Ramp-down
        ]
    }
};
```

### 5. The Scenario (`src/scenarios/product/product.scenario.ts`)
```typescript
import { Env, configResolver } from "@pulse/config";
import { productFlow } from "@src/flows/product/product.flow";

export function setupProduct(): { baseUrl: string; token: string; } {
    const envSuffix = (Env.ENV || "dev").toUpperCase();
    const baseUrl = Env[`BASE_URL_${envSuffix}`] || Env.BASE_URL || "http://localhost:3333";
    const token = Env[`TOKEN_${envSuffix}`] || Env.TOKEN || "no-token";

    return { baseUrl, token };
}

export function productScenario(data: { baseUrl: string; token: string; }): void {
    productFlow({
        baseUrl: data.baseUrl,
        token: data.token
    });
}
```
