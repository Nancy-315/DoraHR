# DoraHR MBA Assistant 🎓💼

DoraHR is an MBA-focused HR AI Assistant website built to help students, scholars, and researchers understand Human Resource Management concepts, prepare academic projects, create questionnaires, work on internship reports, and excel in viva examinations.

Live Website: [https://dora-hr.vercel.app](https://dora-hr.vercel.app)

---

## 🌟 Key Features

- **Direct Chat Interface (`/chat`)**: WhatsApp/ChatGPT-style clean interface with real-time response generation.
- **Academic Domain Specialization**:
  - **MBA HR Core**: HR Analytics, Recruitment & Selection, Training & Development, Performance Management, Compensation & Benefits, Employee Engagement, Employee Relations, Labour Laws (Factories Act, Industrial Disputes, Minimum Wages, PF, ESI, POSH).
  - **MBA Projects**: Topic selection, SMART objectives, research methodology, questionnaire design (Likert scale), statistical data interpretation (Chi-square, ANOVA, Correlation, Regression), findings, and conclusion.
  - **Internship Reports**: Executive summary, company profiles, HR workflow descriptions, daily/weekly learning logs, and viva prep.
  - **Marks-based Answering**: Answers calibrated for 2 marks, 5 marks, 10 marks, and 15 marks exam requirements.
- **Suggested Question Pills**: One-click suggested prompts for quick answers.
- **Multi-turn Memory**: Retains conversation context within the chat session.
- **New Chat & Clear Chat**: Simple controls to start fresh or clear session messages with confirmation.
- **Graceful Fallback Mode**: If no AI API key is configured, the assistant runs in demo mode without crashing.
- **Secure Serverless Architecture**: API keys are handled server-side via `/api/chat` and never exposed to the client.

---

## 🚀 Routes

| Route | Description |
|---|---|
| `/` | Homepage introducing DoraHR MBA Assistant with direct buttons to launch chat |
| `/chat` | Interactive chat interface with DoraHR |
| `/about` | About page explaining DoraHR's academic focus and educational purpose |
| `/api/chat` | Serverless POST API endpoint connecting securely to the AI provider |
| `/*` (404) | Custom 404 page with navigation back to homepage |

---

## ⚙️ Environment Variables

Add ONE of the following in your **Vercel Project Settings > Environment Variables**:

| Variable | Description |
|---|---|
| `AI_API_KEY` or `OPENAI_API_KEY` | Your OpenAI API key (defaults to `gpt-4o-mini`) |
| `GROQ_API_KEY` | (Optional) Your Groq API key (uses "openai/gpt-oss-120b") |
| `GEMINI_API_KEY` | (Optional) Your Google Gemini API key (uses `gemini-1.5-flash`) |
| `AI_MODEL` | (Optional) Specify a custom model name |
| `AI_BASE_URL` | (Optional) Specify a custom OpenAI-compatible API base URL |

*Note: If no API key is set, the website operates seamlessly in Demo Mode.*

---

## 📦 Local Development

To run DoraHR locally:

```bash
# Clone the repository
git clone https://github.com/Nancy-315/DoraHR.git
cd DoraHR

# Start local server
npm start
# Server will run at http://localhost:3000
```
