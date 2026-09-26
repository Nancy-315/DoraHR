// api/chat.js - DoraHR MBA Assistant Server-side AI Endpoint

const DORAH_SYSTEM_PROMPT = `You are DoraHR, an expert MBA HR Assistant. You assist MBA students, HR researchers, scholars, and management professionals with academic rigor and clear explanations.

CORE CAPABILITIES & SUBJECT DOMAINS:
1. Human Resource Management (HRM):
- HR Analytics & People Analytics (attrition rate, cost per hire, training ROI, eNPS, predictive workforce analytics)
- Recruitment & Selection (competency mapping, job descriptions, ATS, structured interviews)
- Training and Development (ADDIE framework, Kirkpatrick's 4 levels of training evaluation)
- Performance Management (KPIs, OKRs, 360-degree feedback, Bell Curve / forced distribution)
- Compensation and Benefits (job evaluation, Hay system, wage structures, incentive models)
- Employee Engagement (Gallup Q12, employee morale, retention strategies)
- Talent Management & Workforce Planning (HRP, Markov matrix, 9-box grid, succession planning)
- Labour Laws & Industrial Relations (Factories Act 1948, Industrial Disputes Act 1947, Minimum Wages Act, Employees' Provident Fund (EPF), ESI Act, Payment of Gratuity Act, POSH Act 2013, Indian Labour Codes)
- HRIS & HR Tech (SAP HCM, Workday, PeopleSoft, core HR modules)
- Leadership, Team Building & Organizational Behavior

2. MBA Academic Projects & Research Methodology:
- Problem formulation and framing SMART objectives
- Research methodology (descriptive, empirical, exploratory)
- Sampling design (sample size, stratified sampling, simple random, convenience)
- Structured Questionnaires (5-point Likert scale constructs, demographic profiles)
- Statistical analysis & data interpretation (Chi-square test, ANOVA, Correlation, Multiple Regression, Percentage analysis)
- Writing Findings, Managerial Suggestions, Limitations, and Conclusions
- MBA viva-voce questions and confident answers

3. Internship Reports:
- Company overview, industry profile, organizational hierarchy, HR workflow
- HR practices observed (onboarding, payroll, benefits, welfare)
- Daily/weekly learning log reflections
- Internship viva preparation

4. MBA Exam Preparation & Marks-based Answering:
- When a user asks an exam question or specifies marks, adjust depth accordingly:
  * 2 Marks: Concise definition + 2 key points (3-4 sentences).
  * 5 Marks: Definition, core points/process, and brief explanation (moderately detailed).
  * 10 Marks: Detailed academic structure (Introduction, Core Concept/Model, Step-by-step Process, Advantages/Challenges, Real-world Industry Example, Conclusion).
  * 15 Marks: In-depth comprehensive essay with Theoretical Background, Frameworks, Implementation Challenges, Case Study Illustration, and Strategic Recommendations.

STYLE GUIDELINES:
- Simple, student-friendly, clear English.
- Use clean headings, short readable paragraphs, and structured bullet points.
- Provide real-world corporate examples (e.g. Tata, Infosys, Google, Unilever) wherever helpful.
- Keep tone supportive, academic, professional, and clear.`;

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

    // Identify configured AI API key (Trim whitespace/newlines)
    const rawOpenaiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
    const openaiKey = rawOpenaiKey ? rawOpenaiKey.trim() : null;
    const groqKey = process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.trim() : null;
    const geminiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

    const activeApiKey = openaiKey || groqKey || geminiKey;

    // FALLBACK DEMO MODE
    if (!activeApiKey) {
      return res.status(200).json({
        response:
          "DoraHR is currently running in demo mode. Configure the AI API key to enable live AI responses.",
        demoMode: true
      });
    }

    // 1. Google Gemini Provider
    if (geminiKey && !openaiKey && !groqKey) {
      const model = (process.env.AI_MODEL || 'gemini-1.5-flash').trim();
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

      const contents = [];
      for (const m of messages) {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m.content || '') }]
        });
      }

      if (contents.length > 0 && contents[0].role !== 'user') {
        contents.unshift({ role: 'user', parts: [{ text: 'Hello DoraHR' }] });
      }

      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error('Gemini API Error:', geminiRes.status, errText);
        let parsedErr = {};
        try { parsedErr = JSON.parse(errText); } catch (e) {}
        const safeMessage = String(parsedErr?.error?.message || errText).replace(/AIzaSy[a-zA-Z0-9_-]+/g, '[REDACTED]');
        
        return res.status(geminiRes.status).json({
          error: "Sorry, DoraHR couldn't process your request right now. Please try again.",
          diagnostic: {
            provider: 'Google Gemini',
            status: geminiRes.status,
            message: safeMessage,
            model: model
          }
        });
      }

      const geminiData = await geminiRes.json();
      const reply =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, DoraHR couldn't process your request right now. Please try again.";

      return res.status(200).json({ response: reply, demoMode: false });
    }

    // 2. OpenAI (Primary) or Groq / OpenAI-Compatible Provider
    const isGroq = Boolean(groqKey && !openaiKey);
    const apiKey = isGroq ? groqKey : openaiKey;
    const apiBaseUrl =
      process.env.AI_BASE_URL ? process.env.AI_BASE_URL.trim() :
      (isGroq ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1');
    const defaultModel = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
    const model = (process.env.AI_MODEL || defaultModel).trim();

    const formattedMessages = [
      { role: 'system', content: DORAH_SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '')
      }))
    ];

    const aiRes = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('AI API Error:', aiRes.status, errText);
      let parsedErr = {};
      try { parsedErr = JSON.parse(errText); } catch (e) {}

      const errMessage = parsedErr?.error?.message || errText;
      const errCode = parsedErr?.error?.code || parsedErr?.error?.type || `HTTP_${aiRes.status}`;
      // Never expose the secret API key in responses
      const safeMessage = String(errMessage).replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED_KEY]');

      return res.status(aiRes.status).json({
        error: "Sorry, DoraHR couldn't process your request right now. Please try again.",
        diagnostic: {
          provider: isGroq ? 'Groq' : 'OpenAI',
          status: aiRes.status,
          code: errCode,
          message: safeMessage,
          model: model
        }
      });
    }

    const data = await aiRes.json();
    const reply =
      data?.choices?.[0]?.message?.content ||
      "Sorry, DoraHR couldn't process your request right now. Please try again.";

    return res.status(200).json({ response: reply, demoMode: false });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      error: "Sorry, DoraHR couldn't process your request right now. Please try again."
    });
  }
}
