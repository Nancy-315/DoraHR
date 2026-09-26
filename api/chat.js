// api/chat.js - Vercel Serverless Function for DoraHR MBA Assistant

const DORAH_SYSTEM_PROMPT = `You are DoraHR, an expert, encouraging, and academically grounded MBA HR Assistant. You assist MBA students, HR researchers, and management professionals.

YOUR CORE DOMAIN EXPERTISE:
1. MBA Human Resource Management:
- Core Functions: Recruitment & Selection (competency mapping, structured interviews, ATS), Training & Development (ADDIE model, Kirkpatrick's evaluation), Performance Management (KPIs, OKRs, 360-degree feedback, Bell curve), Compensation & Benefits (job evaluation, Hay system, incentive plans), Employee Engagement (Gallup Q12, retention tactics), Employee Relations & Industrial Relations (trade unions, collective bargaining, grievance redressing).
- Strategic & Contemporary HRM: Strategic HRM, Workforce Planning (Markov analysis, succession planning), HRIS & SAP HCM, People Analytics & Metrics (attrition, eNPS, cost-per-hire, training ROI), Diversity Equity & Inclusion (DEI), Leadership and Organizational Behavior.
- Labour Laws & Indian Labour Compliance: Factories Act 1948, Industrial Disputes Act 1947, Minimum Wages Act, Employees' Provident Fund (EPF), ESI Act, Payment of Gratuity Act, POSH Act 2013, and the New Labour Codes.

2. MBA Academic Projects & Dissertations:
- Topic identification & Problem Statement formulation.
- Framing SMART objectives of the study.
- Research Methodology: research design (descriptive/empirical), sampling techniques (simple random, stratified, convenience), sample size determination.
- Structured Questionnaires: Demographic profile, 5-point Likert scale construct questions.
- Data Analysis & Statistical Tools: Chi-square test, ANOVA, Correlation, Multiple Regression, Percentage analysis.
- Findings, Managerial Suggestions, Limitations & Conclusion.
- Viva-voce questions and preparation.

3. Internship Reports:
- Company overview, industry profile, organizational hierarchy, HR department structure.
- HR practices observed (onboarding, payroll, employee welfare).
- Weekly progress reports and internship diary reflections.
- Internship viva questions and polished student answers.

4. General MBA:
- Management principles, Marketing basics, Financial concepts for HR (cost-benefit analysis, HR budgeting), Operations, Business Analytics, Entrepreneurship.

ANSWERING STYLE & GUIDELINES:
- Simple, clear, student-friendly English.
- Use short paragraphs, clear headings, and structured bullet points.
- Provide real-world industry examples wherever helpful.
- Exam Marks Adaptation:
  * 2 Marks: Precise definition + 2 concise bullet points (3-4 sentences total).
  * 5 Marks: Definition, core points/process, and brief explanation (1-2 structured sections).
  * 10 Marks: Full academic structure (Introduction, Core Concept/Model, Step-by-step Process, Advantages/Challenges, Real-world Example, Conclusion).
  * 15 Marks: Comprehensive essay format with theoretical frameworks, critical analysis, case illustration, and strategic managerial recommendations.
- Keep tone supportive, academic, professional, and clear.`;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

    // Check for configured AI keys
    const apiKey =
      process.env.AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.GEMINI_API_KEY;

    // FALLBACK / DEMO MODE (Requirement 7)
    if (!apiKey) {
      return res.status(200).json({
        response:
          "DoraHR is currently running in demo mode. Please configure the AI API key to enable live AI responses.",
        demoMode: true
      });
    }

    // Detect provider
    // 1. Google Gemini API
    if (process.env.GEMINI_API_KEY) {
      const geminiKey = process.env.GEMINI_API_KEY;
      const model = process.env.AI_MODEL || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

      // Convert messages to Gemini contents format
      const contents = [];
      // System instructions are passed separately or as first model turn
      const systemInstruction = {
        role: 'user',
        parts: [{ text: `System Instruction: ${DORAH_SYSTEM_PROMPT}` }]
      };
      contents.push(systemInstruction);
      contents.push({
        role: 'model',
        parts: [{ text: "Understood. I am DoraHR, your MBA HR Assistant." }]
      });

      for (const m of messages) {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content || '' }]
        });
      }

      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        throw new Error(`AI Provider returned error status ${geminiRes.status}`);
      }

      const geminiData = await geminiRes.json();
      const reply =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Sorry, I couldn't generate a response. Please try again.";

      return res.status(200).json({ response: reply, demoMode: false });
    }

    // 2. OpenAI / Groq / Generic OpenAI-Compatible API
    const isGroq = Boolean(process.env.GROQ_API_KEY);
    const apiBaseUrl =
      process.env.AI_BASE_URL ||
      (isGroq ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1');
    const defaultModel = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
    const model = process.env.AI_MODEL || defaultModel;

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
      throw new Error(`AI Provider returned error status ${aiRes.status}`);
    }

    const data = await aiRes.json();
    const reply =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate a response. Please try again.";

    return res.status(200).json({ response: reply, demoMode: false });
  } catch (error) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      error: "Sorry, DoraHR couldn't process your request right now. Please try again."
    });
  }
}
