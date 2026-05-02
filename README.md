# KYCOS — KYC OSINT Multi-Agent Intelligence System

```text
  ██╗  ██╗██╗   ██╗ ██████╗ ██████╗ ███████╗
  ██║ ██╔╝╚██╗ ██╔╝██╔════╝██╔═══██╗██╔════╝
  █████╔╝  ╚████╔╝ ██║     ██║   ██║███████╗
  ██╔═██╗   ╚██╔╝  ██║     ██║   ██║╚════██║
  ██║  ██╗   ██║   ╚██████╗╚██████╔╝███████║
  ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═════╝ ╚══════╝
```

[![Node.js Version](https://img.shields.io/badge/Node.js-20+-success.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![NPM Version](https://img.shields.io/npm/v/@digimetalab/kycos.svg)](https://www.npmjs.com/package/@digimetalab/kycos)
[![Repository](https://img.shields.io/badge/GitHub-kycos-black?logo=github)](https://github.com/digimetalab/kycos)

**KYCOS** is a production-grade, highly scalable Node.js Command Line Interface (CLI) tool designed to orchestrate a cluster of specialized Artificial Intelligence agents. It autonomously conducts deep-tier **Know Your Customer (KYC)**, **Anti-Money Laundering (AML)**, and **Open Source Intelligence (OSINT)** investigations on both individuals and corporate entities.

By utilizing an advanced multi-agent architecture, KYCOS dramatically reduces the time required for comprehensive due diligence from days to mere seconds.

---

## ✨ Core Features

*   **🧠 Multi-Agent Architecture**: Deploys 7 distinct, specialized AI agents operating concurrently via Node.js `Promise.allSettled()`. Guarantees high fault tolerance; if one intelligence vector fails or times out, the rest of the investigation proceeds uninterrupted.
*   **🚦 Dynamic AI Router**: Automatically selects the optimal Large Language Model (LLM) for each specific task based on complexity, cost, and privacy requirements. Supports Anthropic Claude 3 Opus, Google Gemini 2.0 Flash, and OpenRouter (GPT-4o).
*   **📊 Institutional Financial Modeling**: Implements the rigorous Indonesian OJK **5C+2W Credit Assessment Framework** alongside a proprietary 850-point credit scorecard.
*   **📉 Basel III/IV IRB Insolvency Projection**: Calculates the statistical likelihood of corporate bankruptcy using the **Altman Z-Score**. Autonomously maps outputs to compute Probability of Default (PD), Loss Given Default (LGD), and Expected Credit Loss (ECL) per PSAK 71.
*   **🕵️ Deep AML & Sanctions Screening**: Cross-references targets against global watchlists (OFAC, UN Security Council, EU Consolidated) and detects structural illicit typologies (e.g., structuring, layering, shell company topologies).
*   **💾 Local SQLite Persistence & Caching**: All investigations, agent telemetry, red flags, and generated reports are securely persisted to a local `better-sqlite3` database, allowing for instant historical retrieval and strict audit trailing.
*   **📄 Comprehensive Multi-Format Export**: Generates exhaustive, executive-ready analytical reports in Markdown (MD), PDF, XLSX, HTML, and JSON.

---

## 🏗️ Project Structure

The codebase is organized into a modular, highly extensible domain-driven architecture:

```text
kycos/
├── bin/
│   └── kycos.js                    # CLI entry point
├── src/
│   ├── core/
│   │   ├── base-agent.js           # Abstract BaseAgent class with error boundaries
│   │   ├── orchestrator.js         # Investigation planner + parallel dispatcher
│   │   ├── ai-router.js            # Strategy pattern for LLM routing
│   │   ├── ai-clients.js           # Lazy-loaded Provider SDK wrappers
│   │   └── schemas.js              # Zod schemas (AgentResult, RedFlag, etc.)
│   ├── agents/
│   │   ├── identity.agent.js       # Name/alias/ID/photo OSINT
│   │   ├── social.agent.js         # Social media scraping + NLP sentiment
│   │   ├── financial.agent.js      # 5C+2W scoring + financial ratios + AML
│   │   ├── legal.agent.js          # Court records + sanctions (OFAC/UN/EU) + PEP
│   │   ├── digital.agent.js        # WHOIS/Shodan/HIBP/email breach
│   │   ├── network.agent.js        # UBO relationship graph
│   │   └── risk.agent.js           # Basel IRB: PD/LGD/EAD/EL + credit scorecard
│   ├── services/
│   │   ├── investigation-db.js     # Relational persistence for completed queries
│   │   ├── scraper.js              # Playwright + Cheerio layer
│   │   └── cache.js                # SQLite request caching layer
│   └── reports/
│       ├── report-engine.js        # Handlebars template renderer
│       └── md-report.js            # Deep-thinking Markdown report compiler
├── data/                           # Local SQLite databases (auto-created)
├── logs/                           # Automated file-logging output
└── report/                         # Final generated investigation reports
```

---

## 🧬 Technical Architecture & AI Routing

The system uses a **Strategy Pattern** for model selection. Instead of relying on a single AI, KYCOS routes tasks to the most efficient LLM:

| Task Type | Designated Model | Engineering Rationale |
|---|---|---|
| `narrative_synthesis` | **Claude 3 Opus** | Deepest reasoning and superior logical synthesis. |
| `data_extraction` | **Gemini 2.0 Flash** | Ultra-high speed structured JSON extraction. |
| `pattern_matching` | **GPT-4o** (via OpenRouter) | Exceptionally strong at traversing graph topologies and network matching. |
| `cost_sensitive` | **Claude 3.5 Haiku** | Fallback for rapid, low-complexity tasks. |

The **Orchestrator** dynamically generates an `InvestigationPlan` using an LLM, dispatches the required agents in parallel via `Promise.allSettled()`, and aggregates their strictly-typed `AgentResult` objects.

---

## 🤖 The 7 Intelligence Agents

### 1. 🪪 Identity Agent
- **Focus**: Biometric & Persona validation.
- **Capabilities**: Full name resolution, semantic alias detection, and cryptographic ID number validation format checks (KTP/Passport/NPWP).

### 2. 🌐 Social Agent
- **Focus**: OSINT Footprinting.
- **Capabilities**: Scrapes platforms (LinkedIn/X/Facebook), performs NLP sentiment analysis on public posts, and maps lifestyle-to-wealth consistency.

### 3. 💰 Financial Agent (5C+2W & AML)
**5C+2W Scoring Matrix (OJK Standard):**
- **Character (20%)**: SLIK kolektibilitas + OSINT sentiment overlay.
- **Capacity (25%)**: Debt Service Coverage Ratio (DSCR > 1.2x).
- **Capital (20%)**: Debt-to-Equity (DER < 3x), Equity Ratio.
- **Collateral (15%)**: LTV haircuts.
- **Condition (10%)**: Industry macroeconomic risk score.
- **Willingness (5%)**: Payment behavior consistency.
- **Wealth (5%)**: LHKPN delta + wealth-income consistency.

**AML Structural Detection:** Actively hunts for transactions clustering below reporting thresholds (Structuring), rapid inter-account transfers (Layering), and Nominee/Shell company signals.

### 4. ⚖️ Legal Agent
- **Focus**: Compliance & Watchlists.
- **Capabilities**: Interrogates international sanctions (OFAC SDN, UN, EU Consolidated), determines Political Exposure (PEP), and scans domestic/international civil and criminal litigation dockets.

### 5. 💻 Digital Agent
- **Focus**: Cyber Exposure.
- **Capabilities**: Analyzes WHOIS privacy, Shodan device vulnerabilities, HaveIBeenPwned (HIBP) clear-web credential breaches, and extrapolates Dark Web chatter.

### 6. 🔗 Network Agent
- **Focus**: Graph Topology & UBO.
- **Capabilities**: Untangles complex corporate ownership chains to isolate the **Ultimate Beneficial Owner (UBO)** and detects anomalous cross-jurisdictional directorships.

### 7. 📊 Risk Agent (Basel III/IV IRB)
**Altman Z-Score (Probability of Default):**
`Z = 1.2(X₁) + 1.4(X₂) + 3.3(X₃) + 0.6(X₄) + 1.0(X₅)`
*(Calculates the statistical likelihood of absolute corporate bankruptcy within a 24-month horizon)*

**Expected Credit Loss (ECL / PSAK 71):**
`EL = PD × LGD × EAD`
*(Maps the Z-Score to Probability of Default and applies collateral haircuts to compute provisioning requirements)*

**Proprietary 850-Point Credit Scorecard:**
Calculates final institutional rating (AAA to D) based on repayment velocity, credit utilization elasticity, credit mix, and an OSINT alternative-data overlay.

---

## 🚀 Installation & Prerequisites

### Prerequisites
*   **Node.js**: v20.0.0 or higher.
*   **npm**: v10.0.0 or higher.
*   **API Keys**: You will need valid API keys from Anthropic, Google AI, and/or OpenRouter.

### Quick Start
1. Clone the repository and install the dependencies:
   ```bash
   git clone https://github.com/digimetalab/kycos.git
   cd kycos
   npm install
   ```
2. Initialize the environment configuration:
   ```bash
   cp .env.example .env
   ```
3. Open the `.env` file and populate your secure API keys.

---

## ⚙️ Environment Configuration

Configure external API keys in your `.env` file:

| Environment Variable | Provider / Purpose | Requirement |
| :--- | :--- | :--- |
| `ANTHROPIC_API_KEY` | **Claude 3** (Used for deep narrative synthesis & risk modeling) | **Required** (At least one AI key) |
| `GOOGLE_AI_API_KEY` | **Gemini 2.0** (Used for high-speed OSINT data extraction) | **Required** (At least one AI key) |
| `OPENROUTER_API_KEY` | **GPT-4o** (Used for complex network & graph pattern matching) | **Required** (At least one AI key) |
| `SHODAN_API_KEY` | **Shodan** (Infrastructure & IoT vulnerability scanning) | *Optional* |
| `HIBP_API_KEY` | **HaveIBeenPwned** (Credential breach exposure) | *Optional* |
| `OPENCORPORATES_API_KEY`| **OpenCorporates** (Global corporate registry validation) | *Optional* |

---

## 💻 CLI Usage Guide

KYCOS provides an interactive command-line dashboard with real-time progress indicators.

### 1. Run an Investigation
You can initiate an investigation interactively (by typing `node bin/kycos.js investigate` without arguments) or via direct flags:

```bash
# Execute a rapid screening on an individual (Identity, Legal, Risk)
node bin/kycos.js investigate -t "John Doe" -m quick

# Run a full institutional credit assessment on a corporation
node bin/kycos.js investigate -t "PT Nusantara Teknologi" --type corporation -m credit

# Execute a deep-dive investigation and output results strictly as JSON
node bin/kycos.js investigate -t "Jane Doe" -m deep --output json
```

### 2. Available Investigation Modes

| Execution Mode | Activated AI Agents | Estimated Time | Primary Use Case |
| :--- | :--- | :--- | :--- |
| `quick` | Identity, Legal, Risk | ~10 sec | Instant triage and PEP/Sanctions screening. |
| `standard` | Identity, Legal, Risk, Social, Digital | ~15 sec | Standard vendor or employee onboarding. |
| `credit` | Identity, Financial, Legal, Network, Risk | ~25 sec | Institutional lending and corporate underwriting. |
| `deep` | **All 7 Agents** | ~40 sec | Maximum due diligence for high-risk profiles. |

### 3. Database & System Commands

```bash
# View the local SQLite database history of all past investigations
node bin/kycos.js history

# View high-level analytical statistics across all historical data
node bin/kycos.js history --stats

# Verify API key connectivity and provider status
node bin/kycos.js config --check

# Purge expired data from the local SQLite cache
node bin/kycos.js cache --purge
```

---

## 📝 License

This project is licensed under the **MIT License**.

You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, provided that the original copyright notice and permission notice are included in all copies or substantial portions of the Software.

**Disclaimer:** KYCOS is a probabilistic AI intelligence tool. All algorithmic outputs, credit scores, and compliance determinations must be supplemented by institutional human judgment and localized legal counsel.
