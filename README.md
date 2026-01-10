<div align="center">

# 📊 Data Drift Monitor Pro

### AI-Powered Data Drift Detection & Monitoring for ML Pipelines

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![React 18](https://img.shields.io/badge/react-18.0+-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-316192.svg)](https://www.postgresql.org/)

[Features](#-features) • [Demo](#-demo) • [Installation](#️-installation) • [Usage](#-usage) • [API](#-api-reference) • [Contributing](#-contributing)


</div>

---

## 🎯 Overview

**Data Drift Monitor Pro** is an end-to-end production-ready system designed to monitor, detect, analyze, explain, and predict data drift in machine learning pipelines. Built for ML engineers and data teams who need to ensure long-term model reliability by tracking dataset changes, identifying drift patterns, and receiving actionable remediation insights.

### Why Data Drift Matters

- **Model Degradation**: 87% of ML models experience performance degradation due to undetected drift
- **Cost of Failure**: Data drift can cost companies millions in incorrect predictions
- **Regulatory Compliance**: Many industries require drift monitoring for AI/ML systems
- **Proactive Monitoring**: Catch issues before they impact production

---

## ✨ Features

### 🔍 Multi-Layered Drift Detection

<table>
<tr>
<td width="33%" align="center">

#### 📈 Statistical Drift
Detects distribution changes using KS test, Chi-square, and JS divergence

</td>
<td width="33%" align="center">

#### 🗂️ Schema Drift
Monitors column additions, deletions, type changes, and structural shifts

</td>
<td width="33%" align="center">

#### 🧠 Semantic Drift
Identifies meaning changes in text data using NLP embeddings

</td>
</tr>
</table>

### 📊 Comprehensive Monitoring

- **🎯 Unified Drift Score**: Single metric combining all drift types
- **⚠️ Severity Classification**: Automatic categorization (Low/Medium/High/Critical)
- **📸 Dataset Snapshots**: Version control for your data distributions
- **📉 Trend Visualization**: Track drift evolution over time
- **🔄 Real-time Updates**: WebSocket-powered live monitoring

### 🤖 AI-Powered Insights

- **🔮 Drift Prediction**: LSTM-based forecasting of future drift risk
- **🎯 Feature Importance**: Identify which features contribute most to drift
- **🔬 Root Cause Analysis**: Understand why drift is happening
- **💡 Smart Remediation**: Get automated suggestions to fix drift issues

### 🚨 Alerts & Reporting

- **📧 Email Notifications**: Configurable threshold-based alerts
- **📱 Dashboard Alerts**: Real-time visual warnings
- **📄 PDF Reports**: Professional drift analysis documents
- **📊 CSV Exports**: Raw data for further analysis

---

<img width="1697" height="963" alt="Screenshot 2026-01-11 at 1 35 54 AM" src="https://github.com/user-attachments/assets/ce4b79b6-ab8b-4787-9842-35540d47c446" />
<img width="1710" height="966" alt="Screenshot 2026-01-11 at 1 36 09 AM" src="https://github.com/user-attachments/assets/8d1d99b2-a52c-4777-a4c9-73559f8ec17a" />
<img width="1706" height="964" alt="Screenshot 2026-01-11 at 1 35 36 AM" src="https://github.com/user-attachments/assets/e39c00f7-cc08-4fb9-a9e0-d6ddc3054330" />
<img width="1710" height="951" alt="Screenshot 2026-01-11 at 1 46 48 AM" src="https://github.com/user-attachments/assets/ae8265a3-ed35-4661-9d3a-2bd0a114f0c3" />

## 🏗️ Architecture

```mermaid
graph LR
    A[Frontend<br/>React + WebSocket] -->|REST API| B[Backend<br/>FastAPI]
    B -->|SQL Queries| C[PostgreSQL<br/>Database]
    B -->|Analysis| D[Drift Engine]
    D -->|Statistical| E[KS/Chi²/JS]
    D -->|Schema| F[DDL Analysis]
    D -->|Semantic| G[NLP Embeddings]
    D -->|ML| H[LSTM Predictor]
    B -->|Notifications| I[Email Service]
    B -->|Export| J[Report Generator]
```

### Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Recharts, WebSockets, TailwindCSS |
| **Backend** | FastAPI, SQLAlchemy, Pydantic, WebSockets |
| **ML/Analytics** | scikit-learn, pandas, numpy, sentence-transformers |
| **Database** | PostgreSQL 14+ |
| **Auth** | JWT (JSON Web Tokens) |
| **Reporting** | ReportLab (PDF), pandas (CSV) |

---

## 📁 Project Structure

```
data-drift-monitor/
│
├── backend/
│   ├── main.py                     # FastAPI entry point & WebSocket server
│   │
│   ├── core/
│   │   ├── analyzer.py             # Dataset profiling & statistics
│   │   ├── drift.py                # Statistical & schema drift detection
│   │   ├── semantic_drift.py       # NLP-based semantic drift
│   │   └── ml_drift.py             # ML scoring & unified drift metrics
│   │
│   ├── services/
│   │   ├── severity.py             # Drift severity classification
│   │   ├── alerts.py               # Email notification service
│   │   └── report.py               # PDF/CSV report generation
│   │
│   ├── auth/
│   │   ├── routes.py               # Authentication endpoints
│   │   ├── dependencies.py         # JWT middleware
│   │   └── security.py             # Token utilities
│   │
│   ├── storage/
│   │   ├── models.py               # SQLAlchemy ORM models
│   │   ├── database.py             # Database connection & session
│   │   └── snapshot_store.py       # Snapshot persistence layer
│   │
│   └── requirements.txt            # Python dependencies
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   │
│   ├── src/
│   │   ├── App.js                  # Main application component
│   │   ├── components/
│   │   │   ├── DriftChart.js       # Trend visualization
│   │   │   ├── SnapshotTable.js    # Snapshot history
│   │   │   └── AlertPanel.js       # Alert management
│   │   ├── services/
│   │   │   └── api.js              # API client
│   │   └── App.css                 # Styling
│   │
│   ├── package.json
│   └── .env
│
├── data/
│   ├── raw/                        # Uploaded datasets
│   └── snapshots/                  # Snapshot storage
│
├── tests/
│   ├── test_drift.py
│   └── test_api.py
│
├── .env.example                    # Environment template
├── .gitignore
├── docker-compose.yml              # Docker orchestration
├── README.md                       # This file
└── LICENSE                         # MIT License

```

---

## ⚙️ Installation

### Prerequisites

Ensure you have the following installed:

- **Python** 3.10 or higher
- **Node.js** 18 or higher
- **PostgreSQL** 14 or higher
- **Git**

### 🚀 Quick Start

#### 1️⃣ Clone the Repository

```bash
git clone https://github.com/vishnugupta2711/data-drift-monitor.git
cd data-drift-monitor
```

#### 2️⃣ Set Up Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### 3️⃣ Configure Environment

Create a `.env` file in the `backend/` directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/datadrift

# JWT Authentication
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Application
DEBUG=True
CORS_ORIGINS=http://localhost:3000
```

#### 4️⃣ Set Up Database

```bash
# Start PostgreSQL
# On macOS:
brew services start postgresql

# On Linux:
sudo service postgresql start

# Create database
psql postgres
CREATE DATABASE datadrift;
\q
```

#### 5️⃣ Initialize Database Tables

```bash
# Run migrations
python -m backend.storage.database
```

#### 6️⃣ Start Backend Server

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: **http://localhost:8000**

#### 7️⃣ Set Up Frontend

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```


## 🎮 Usage

### Basic Workflow

#### 1. Upload Dataset

```bash
curl -X POST "http://localhost:8000/analyze" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@dataset.csv" \
  -F "name=Production Data"
```

#### 2. View Drift Analysis

Access the dashboard at `http://localhost:3000` to:
- View real-time drift scores
- Compare snapshots
- Analyze trends
- Review alerts

#### 3. Compare Snapshots

```python
import requests

response = requests.get(
    "http://localhost:8000/compare",
    params={"snapshot1": "id1", "snapshot2": "id2"},
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)

comparison = response.json()
print(f"Drift Score: {comparison['drift_score']}")
```

#### 4. Get Remediation Suggestions

```python
response = requests.post(
    f"http://localhost:8000/remediation-suggest/{snapshot_id}",
    headers={"Authorization": "Bearer YOUR_TOKEN"}
)

suggestions = response.json()
for suggestion in suggestions['recommendations']:
    print(f"- {suggestion['action']}: {suggestion['reason']}")
```

### Code Examples

#### Python SDK

```python
from drift_monitor import DriftMonitor

# Initialize monitor
monitor = DriftMonitor(
    api_url="http://localhost:8000",
    token="YOUR_TOKEN"
)

# Analyze dataset
result = monitor.analyze_dataset("data.csv")

if result.severity == "HIGH":
    print(f"⚠️ High drift detected: {result.drift_score:.2f}")
    
    # Get recommendations
    suggestions = monitor.get_remediation(result.snapshot_id)
    for s in suggestions:
        print(f"💡 {s.action}")
```

#### JavaScript SDK

```javascript
import { DriftMonitorClient } from './services/api';

const client = new DriftMonitorClient({
  baseURL: 'http://localhost:8000',
  token: localStorage.getItem('token')
});

// Upload and analyze
const result = await client.analyzeDataset(file, 'Production Data');

// Subscribe to real-time updates
client.onDriftUpdate((data) => {
  console.log('New drift detected:', data);
});
```

---

## 📚 API Reference

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "securepassword"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=user@example.com&password=securepassword
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

### Drift Detection

#### Analyze Dataset
```http
POST /analyze
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [binary]
name: "Dataset Name"
```

**Response:**
```json
{
  "snapshot_id": "snap_123abc",
  "drift_score": 0.42,
  "severity": "MEDIUM",
  "statistical_drift": {
    "ks_statistic": 0.15,
    "p_value": 0.03
  },
  "schema_drift": {
    "columns_added": [],
    "columns_removed": ["old_feature"],
    "type_changes": {}
  },
  "timestamp": "2026-01-05T10:30:00Z"
}
```

#### Get History
```http
GET /history?limit=10&offset=0
Authorization: Bearer {token}
```

#### Compare Snapshots
```http
GET /compare?snapshot1={id1}&snapshot2={id2}
Authorization: Bearer {token}
```

### Predictions & Insights

#### Predict Future Drift
```http
POST /predict-drift
Authorization: Bearer {token}
Content-Type: application/json

{
  "snapshot_ids": ["snap_1", "snap_2", "snap_3"],
  "forecast_periods": 7
}
```

**Response:**
```json
{
  "predictions": [
    {"day": 1, "drift_score": 0.45, "confidence": 0.92},
    {"day": 2, "drift_score": 0.48, "confidence": 0.89}
  ],
  "trend": "increasing",
  "alert_threshold_breach": "day_5"
}
```

#### Feature Importance
```http
GET /feature-importance/{snapshot_id}
Authorization: Bearer {token}
```

#### Remediation Suggestions
```http
POST /remediation-suggest/{snapshot_id}
Authorization: Bearer {token}
```

### Reporting

#### Generate PDF Report
```http
GET /report/{snapshot_id}?format=pdf
Authorization: Bearer {token}
```

#### Generate CSV Export
```http
GET /report/{snapshot_id}?format=csv
Authorization: Bearer {token}
```

### WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/{client_id}');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Drift update:', data);
};
```

---

## 🔒 Security

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt with salt rounds
- **SQL Injection Protection**: SQLAlchemy ORM with parameterized queries
- **CORS Configuration**: Configurable allowed origins
- **Rate Limiting**: Built-in request throttling
- **Environment Variables**: No hardcoded secrets

### Security Best Practices

1. **Never commit** `.env` files
2. **Rotate** JWT secret keys regularly
3. **Use HTTPS** in production
4. **Enable** database SSL connections
5. **Implement** rate limiting on public endpoints

---

## 🧪 Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest --cov=backend tests/

# Run specific test
pytest tests/test_drift.py::test_statistical_drift
```

### Example Test

```python
def test_drift_detection():
    from backend.core.drift import detect_drift
    
    baseline = pd.DataFrame({'feature': np.random.normal(0, 1, 1000)})
    current = pd.DataFrame({'feature': np.random.normal(0.5, 1, 1000)})
    
    result = detect_drift(baseline, current)
    
    assert result['drift_detected'] == True
    assert result['drift_score'] > 0.3
```

---


## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Getting Started

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Contribution Guidelines

- Follow PEP 8 for Python code
- Use ESLint rules for JavaScript
- Write tests for new features
- Update documentation
- Add comments for complex logic

### Areas for Contribution

- 🐛 Bug fixes
- ✨ New drift detection algorithms
- 📚 Documentation improvements
- 🧪 Test coverage
- 🎨 UI/UX enhancements
- 🌐 Translations

---

## 📖 Documentation

- **Full Documentation**: [docs.datadriftmonitor.com](https://docs.datadriftmonitor.com)
- **API Reference**: [api-docs.datadriftmonitor.com](https://api-docs.datadriftmonitor.com)
- **Tutorials**: [tutorials.datadriftmonitor.com](https://tutorials.datadriftmonitor.com)

---

## 🏆 Acknowledgments

Built with ❤️ using:
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [React](https://reactjs.org/) - UI library
- [PostgreSQL](https://www.postgresql.org/) - Database
- [scikit-learn](https://scikit-learn.org/) - ML algorithms
- [Recharts](https://recharts.org/) - Charting library

---

## 👨‍💻 Author

<h3 align="center">Vishnu Gupta</h3>

<h2 align="center">Connect with me</h2>
<p align="center">
  <a href="https://www.linkedin.com/in/vishnu-gupta-485910293/" target="_blank">
    <img src="https://user-images.githubusercontent.com/74038190/235294012-0a55e343-37ad-4b0f-924f-c8431d9d2483.gif" width="100" />
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="mailto:guptavishnu2711@gmail.com">
    <img src="https://user-images.githubusercontent.com/74038190/216122065-2f028bae-25d6-4a3c-bc9f-175394ed5011.png" width="80" />
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://github.com/vishnugupta2711" target="_blank">
    <img src="https://user-images.githubusercontent.com/74038190/212257468-1e9a91f1-b626-4baa-b15d-5c385dfa7ed2.gif" width="100" />
  </a>
</p>

---

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=vishnugupta2711/data-drift-monitor&type=Date)](https://star-history.com/#vishnugupta2711/data-drift-monitor&Date)

---

<div align="center">

### 💬 Questions or Feedback?

[Open an Issue](https://github.com/vishnugupta2711/data-drift-monitor/issues) • [Join Discussions](https://github.com/vishnugupta2711/data-drift-monitor/discussions) • [Read the Docs](https://docs.datadriftmonitor.com)

**If you find this project useful, please consider giving it a ⭐️!**

Made with 💻 and ☕ by [Vishnu Gupta](https://github.com/vishnugupta2711)

</div>
