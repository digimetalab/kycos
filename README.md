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

*   **🧠 Multi-Agent Architecture**
    Deploys 7 distinct, specialized AI agents operating concurrently via Node.js `Promise.allSettled()`. This guarantees high fault tolerance; if one intelligence vector fails or times out, the rest of the investigation proceeds uninterrupted.
*   **🚦 Dynamic AI Router**
    Automatically selects the optimal Large Language Model (LLM) for each specific task based on complexity, cost, and privacy requirements. It supports **Anthropic Claude 3 Opus**, **Google Gemini 2.0 Flash**, and **OpenRouter (GPT-4o)** out of the box.
*   **📊 Institutional Financial Modeling**
    Implements the rigorous Indonesian OJK **5C+2W Credit Assessment Framework** (Character, Capacity, Capital, Collateral, Condition, Willingness, Wealth) alongside a proprietary 850-point credit scorecard.
*   **📉 Basel III/IV IRB Insolvency Projection**
    Calculates the statistical likelihood of corporate bankruptcy using the **Altman Z-Score** multivariate discriminant analysis. It autonomously maps outputs to compute Probability of Default (PD), Loss Given Default (LGD), and Expected Credit Loss (ECL).
*   **🕵️ Deep AML & Sanctions Screening**
    Cross-references targets against global watchlists (OFAC, UN Security Council, EU Consolidated) and detects structural illicit typologies (e.g., structuring, layering, shell company topologies).
*   **💾 Local SQLite Persistence & Caching**
    All investigations, agent telemetry, red flags, and generated reports are securely persisted to a local `better-sqlite3` database, allowing for instant historical retrieval and strict audit trailing.
*   **📄 Comprehensive Multi-Format Export**
    Generates exhaustive, executive-ready analytical reports in **Markdown (MD)**, **PDF** (via Puppeteer), **XLSX** (via ExcelJS), **HTML**, and **JSON**.

---

## 🚀 Installation & Prerequisites

### Prerequisites
*   **Node.js**: v20.0.0 or higher.
*   **npm**: v10.0.0 or higher.
*   **API Keys**: You will need valid API keys from Anthropic, Google AI, and/or OpenRouter.

### Quick Start
1. Clone the repository and install the dependencies:
   ```bash
   git clone https://github.com/your-org/kycos.git
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

KYCOS relies on several external APIs to orchestrate its intelligence gathering. Configure these in your `.env` file:

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

KYCOS provides an interactive, futuristic command-line dashboard with real-time progress indicators.

### 1. Run an Investigation
You can initiate an investigation interactively (by typing `node bin/kycos.js investigate` without arguments) or via direct flags:

```bash
# Execute a rapid screening on an individual (Identity, Legal, Risk)
node bin/kycos.js investigate -t "John Doe" -m quick

# Run a full institutional credit assessment on a corporation
node bin/kycos.js investigate -t "PT Bank Mandiri Tbk" --type corporation -m credit

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

## 🏗️ System Architecture & Agent Specialization

KYCOS is built on a modular, decentralized pipeline. The **Orchestrator** receives the user's prompt, builds an execution plan, and dispatches tasks to the following specialized agents:

| Sub-system Agent | Intelligence Domain | Algorithmic Responsibilities |
| :--- | :--- | :--- |
| **🪪 Identity Agent** | Biometric & Persona | Validates ID structures, maps semantic aliases, and attempts cryptographic verification. |
| **🌐 Social Agent** | OSINT Footprinting | Scrapes digital platforms, performs NLP sentiment analysis, and maps lifestyle-to-wealth consistency. |
| **💰 Financial Agent** | Capital & AML | Constructs the 5C+2W framework and actively hunts for structuring, layering, and shell-company topologies. |
| **⚖️ Legal Agent** | Compliance & Watchlists | Queries global sanctions (OFAC, UN, EU), determines Political Exposure (PEP), and scans litigation dockets. |
| **💻 Digital Agent** | Cyber Exposure | Analyzes WHOIS privacy, Shodan vulnerabilities, and interrogates Dark Web/Clear Web credential breaches. |
| **🔗 Network Agent** | UBO Graphing | Untangles complex corporate ownership chains to isolate the Ultimate Beneficial Owner (UBO) and cross-directorships. |
| **📊 Risk Agent** | Institutional Modeling | Generates the Altman Z-Score, calculates Basel III/IV IRB Expected Loss (ECL), and builds the final 850-point scorecard. |

---

## 📝 License

This project is licensed under the **MIT License**.

You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, provided that the original copyright notice and permission notice are included in all copies or substantial portions of the Software.

**Disclaimer:** KYCOS is a probabilistic AI intelligence tool. All algorithmic outputs, credit scores, and compliance determinations must be supplemented by institutional human judgment and localized legal counsel.
