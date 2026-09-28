// api/chat.js - DoraHR MBA Assistant Serverless Endpoint for Google Gemini

const DORAH_SYSTEM_PROMPT = `You are DoraHR, an expert, encouraging, and academically grounded MBA HR Assistant. You assist MBA students, HR researchers, scholars, and management professionals with clarity and practical rigor.

YOUR CORE DOMAIN EXPERTISE:
1. MBA Human Resource Management:
- Core Functions: Recruitment & Selection (competency mapping, structured interviews, job analysis, ATS), Training & Development (ADDIE framework, Kirkpatrick's 4 levels), Performance Management (KPIs, OKRs, 360-degree appraisal, Bell Curve / forced distribution), Compensation & Benefits (job evaluation, Hay system, wage structures, incentive models), Employee Engagement (Gallup Q12, retention tactics), Employee Relations & Industrial Relations (trade unions, collective bargaining, grievance handling, strikes/lockouts).
- Strategic & Contemporary HRM: Strategic HRM, Workforce Planning (Markov analysis, succession planning), HRIS & SAP HCM / PeopleSoft concepts, HR Analytics & People Analytics (turnover metrics, cost per hire, eNPS, predictive workforce analytics), Diversity Equity & Inclusion (DEI), Leadership styles, Team Building, and Organizational Behavior.
- Labour Laws & Indian Labour Compliance: Factories Act 1948, Industrial Disputes Act 1947, Minimum Wages Act, Employees' Provident Fund (EPF), ESI Act, Payment of Gratuity Act, POSH Act 2013, and Indian Labour Codes. (Always clearly note that labour laws and government notifications can change and encourage verifying official gazettes for exact compliance).

2. MBA Academic Projects, Assignments & Research:
- Problem identification, framing SMART objectives, and formulating research questions.
- Research Methodology: study design (descriptive/empirical), sampling techniques (simple random, stratified, convenience), sample size calculation.
- Questionnaire Design: Structured constructs using 5-point Likert scales, demographic profiles.
- Statistical Data Analysis & Interpretation: Chi-square test, ANOVA, Pearson Correlation, Multiple Regression, Percentage analysis.
- Findings, Managerial Suggestions, Research Limitations, and Conclusion.
- Viva-voce questions and confident, structured model answers.

3. Internships & Employability:
- Internship reports: Executive summary, company profile, industry overview, HR workflow observations, and weekly logbook reflections.
- Resume writing, HR interview preparation, seminar presentations, and employability skills.

ANSWERING STYLE & GUIDELINES:
- Simple, student-friendly, clear English.
- Use clean headings, short readable paragraphs, and structured bullet points.
- Provide real-world corporate examples (e.g. Tata, Infosys, Google, Unilever) wherever helpful.
- When an exam question specifies marks, calibrate depth accordingly:
  * 2 Marks: Concise definition + 2 key points (3-4 sentences).
  * 5 Marks: Definition, core points/process, and brief explanation (moderately detailed).
  * 10 Marks: Detailed academic structure (Introduction, Core Concept/Model, Step-by-step Process, Advantages/Challenges, Real-world Industry Example, Conclusion).
  * 15 Marks: In-depth comprehensive essay with Theoretical Background, Frameworks, Implementation Challenges, Case Study Illustration, and Strategic Recommendations.
- Multilingual Support: When the user asks for Tamil, respond in Tamil. When the user asks for Tanglish, respond in Tanglish.
- Keep tone supportive, academic, professional, and clear.`;

function formatMessagesForGemini(messages) {
  // Retain the last 20 messages to manage token size while maintaining multi-turn context
  const recentMessages = Array.isArray(messages) ? messages.slice(-20) : [];
  const contents = [];
  let lastRole = null;

  for (const m of recentMessages) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const text = String(m.content || '').trim();
    if (!text) continue;

    if (role === lastRole && contents.length > 0) {
      contents[contents.length - 1].parts[0].text += '\n\n' + text;
    } else {
      contents.push({
        role,
        parts: [{ text }]
      });
      lastRole = role;
    }
  }

  // Gemini requires the conversation to start with a user message
  if (contents.length > 0 && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: 'Hello DoraHR' }] });
  }

  return contents;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON payload.' });
      }
    }

    const { messages } = body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid request: "messages" array is required.' });
    }

    // Google Gemini API Key
    const rawGeminiKey = process.env.GEMINI_API_KEY;
    const geminiKey = rawGeminiKey ? rawGeminiKey.trim() : null;

    if (!geminiKey) {
      console.error('[DoraHR Server Error] Missing GEMINI_API_KEY environment variable in Vercel.');
      return res.status(503).json({
        error: "Sorry, DoraHR is temporarily unavailable. Please try again later."
      });
    }

    // Configured model with verified gemini-3.8-flash
    const configuredModel = (process.env.GEMINI_MODEL || '').trim();
    const candidateModels = [
      ...(configuredModel ? [configuredModel] : []),
      'gemini-3.8-flash'
    ];
    const modelsToTry = [...new Set(candidateModels)];

    const contents = formatMessagesForGemini(messages);

    let geminiRes = null;
    let successfulModel = '';
    let lastStatus = 0;
    let lastErrorDetails = null;
    let hadRateLimit = false;

    for (const m of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6500);

        const attempt = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: DORAH_SYSTEM_PROMPT }]
            },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048
            }
          })
        });

        clearTimeout(timeoutId);

        if (attempt.ok) {
          geminiRes = attempt;
          successfulModel = m;
          break;
        } else {
          lastStatus = attempt.status;
          const text = await attempt.text();
          let parsed = {};
          try { parsed = JSON.parse(text); } catch (e) {}
          lastErrorDetails = {
            model: m,
            status: attempt.status,
            message: parsed?.error?.message || text
          };

          console.warn(`[Gemini Attempt Failed] Model: ${m}, Status: ${attempt.status}`, lastErrorDetails.message);

          // Stop cycling immediately on rate limit (429) or invalid credentials to avoid masking real errors
          if (attempt.status === 429) {
            hadRateLimit = true;
            geminiRes = attempt;
            break;
          }
          if (attempt.status === 400 && lastErrorDetails.message.includes('API key')) {
            geminiRes = attempt;
            break;
          }
          if (attempt.status === 401 || attempt.status === 403) {
            geminiRes = attempt;
            break;
          }
        }
      } catch (networkErr) {
        console.error(`[Gemini Network/Timeout Error] Model: ${m}`, networkErr);
        lastStatus = 504;
        lastErrorDetails = { model: m, message: networkErr.message };
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      console.error('[Gemini All Candidates Failed]', lastErrorDetails);

      if (hadRateLimit || lastStatus === 429 || lastStatus === 503) {
        return res.status(429).json({
          error: "DoraHR is temporarily busy. Please wait a moment and try again."
        });
      }
      if (lastStatus === 404) {
        return res.status(503).json({
          error: "DoraHR is temporarily unavailable because of an AI model configuration issue."
        });
      }
      if (lastStatus === 401 || lastStatus === 403 || (lastStatus === 400 && lastErrorDetails?.message?.includes('API key'))) {
        return res.status(503).json({
          error: "Sorry, DoraHR is temporarily unavailable. Please try again later."
        });
      }
      if (lastStatus === 504 || lastStatus === 502) {
        return res.status(502).json({
          error: "Unable to connect right now. Please try again."
        });
      }

      return res.status(500).json({
        error: "Something went wrong. Please try again."
      });
    }

    const geminiData = await geminiRes.json();
    const candidate = geminiData?.candidates?.[0];
    let reply = candidate?.content?.parts?.[0]?.text;

    if (!reply) {
      if (candidate?.finishReason === 'SAFETY') {
        reply = "I apologize, but I cannot provide a response to that specific question in accordance with safety guidelines. Please ask another question about MBA HR concepts, projects, or viva preparation.";
      } else {
        reply = "Something went wrong generating the response. Please try again.";
      }
    }

    return res.status(200).json({ response: reply });
  } catch (error) {
    console.error('[DoraHR Server Exception]', error);
    return res.status(500).json({
      error: "Something went wrong. Please try again."
    });
  }
}
