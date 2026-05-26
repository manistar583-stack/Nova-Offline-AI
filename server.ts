import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const systemPrompt = `You are Nova, an advanced AI assistant that combines the best qualities of Claude (Anthropic) and GPT-4.

Core Personality:
- Extremely helpful, intelligent, clear, and thoughtful
- Think step-by-step on complex questions
- Use markdown, bullet points, tables, and numbered lists for better readability
- Be proactive and give useful suggestions
- Match user's tone (casual or professional)

CRITICAL INSTRUCTION: Claude-Style Interactive Artifacts
Whenever the user asks you to build a UI widget, a game, a dashboard, a web app, or complex visual output, you MUST respond with a single, self-contained HTML file enclosed within an \`\`\`html code block. 
You MUST include all CSS (use Tailwind via CDN) and JavaScript inline inside the HTML.
The system will automatically extract this block and render it as an interactive "Artifact" preview directly in the chat, exactly like Claude! Do not just provide snippets, provide a full renderable document.

IMAGE GENERATION INSTRUCTION:
If the user asks to generate an image (or if they upload an image and ask you to modify/generate based on it), you MUST generate a high-quality, descriptive prompt for the image, and then output a markdown image tag using the Pollinations AI URL format:
![Image Focus](https://image.pollinations.ai/prompt/{URL_ENCODED_DETAILED_PROMPT}?width=1080&height=1080&nologo=true&enhance=true)
Make sure {URL_ENCODED_DETAILED_PROMPT} is a highly detailed, descriptive visual prompt of the image based on the user's request, completely URL-encoded. You can analyze uploaded images and write detailed prompts to recreate or modify them!

Strengths:
- Reasoning, coding, writing, studying, productivity
- Creative tasks and idea generation

Rules:
- Always try your best even on limited hardware
- Keep answers clear and well-organized
- Never make excuses about being a small model
- Current date: May 24, 2026
- User is from India

You can help with almost anything except illegal or harmful activities.`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API route for chat completion
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, mode, networkMode, modelName = "gemini-2.5-flash", searchEngine = "google" } = req.body;
      const lastMessage = messages[messages.length - 1].content;
      
      const dynamicPrompt = systemPrompt + `
${networkMode === 'offline' ? 'NOTE: You are currently functioning in Offline Mode. Provide responses based strictly on your pre-trained knowledge without relying on external web references.' : ''}
${mode === 'thinking' ? 'NOTE: You are in "Deep Thought" mode. Take extra time to outline your logical reasoning step-by-step and verify facts before providing the final answer.' : ''}
${mode === 'deep-research' ? `NOTE: You are in "DeepSearch AI" mode. You are searching using the ${searchEngine} search engine. Format your responses with high citation accuracy, comprehensively synthesizing multiple sources, providing links where necessary, and acting as a world-class research engine.` : ''}`;

      const videoRegex = /(?:(?:generate|create|make|show|provide)\b.*?\b(?:video|clip|animation|movie)\b)/i;
      const isVideoRequest = videoRegex.test(lastMessage);

      const audioRegex = /(?:(?:generate|create|make|provide)\b.*?\b(?:audio|voice|speech|sound)\b)/i;
      const isAudioRequest = audioRegex.test(lastMessage) && !isVideoRequest;

      if (isAudioRequest) {
        const textToSpeak = lastMessage.replace(/^(?:Generate audio of\s*)+/i, '').trim() || "Please provide some text to convert to speech.";
        
        try {
          // Import here to avoid top-level issues if any
          const googleTTS = await import('google-tts-api');
          
          let dataUrl = '';
          
          if (textToSpeak.length > 200) {
            const results = await googleTTS.getAllAudioBase64(textToSpeak, {
              lang: 'en',
              slow: false,
              host: 'https://translate.google.com',
              splitPunct: ',.?',
            });
            const buffers = results.map(r => Buffer.from(r.base64, 'base64'));
            const combined = Buffer.concat(buffers);
            dataUrl = `data:audio/mp3;base64,${combined.toString('base64')}`;
          } else {
            const base64 = await googleTTS.getAudioBase64(textToSpeak, {
              lang: 'en',
              slow: false,
              host: 'https://translate.google.com',
            });
            dataUrl = `data:audio/mp3;base64,${base64}`;
          }
          
          return res.json({
            response: `🔊 Generated audio:\n\n[generated_audio](${dataUrl} "audio")`
          });
        } catch(err: any) {
          console.error("Audio generation error:", err);
          return res.json({
            response: `❌ Failed to generate audio: ${err.message}`
          });
        }
      }

      if (isVideoRequest) {
        const cleanPrompt = lastMessage.replace(/[\r\n]/g, ' ').trim();
        const encodedPrompt = encodeURIComponent(cleanPrompt);
        const seed = Math.floor(Math.random() * 1000000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=576&nologo=true&seed=${seed}`;
        
        const modeText = networkMode === 'offline' ? 'Local Neural Engine (Offline)' : 'Cloud Render Cluster (Online)';

        return res.json({
          response: `🎬 **Video Generation Tools & Scripts**
          
True 30-second AI video generation requires massive dedicated GPU compute or a paid API service. I have prepared the exact scripts you need to run this on your own, along with free online options.

### Option 1: Free Online AI Video Generators (No Code Required)
You can copy your prompt (*"${cleanPrompt}"*) and paste it directly into these free community tools:
* **[Luma Dream Machine](https://lumalabs.ai/dream-machine)** (Free daily generations)
* **[Kling AI](https://klingai.com/)** (High quality, free daily credits)
* **[Haiper AI](https://haiper.ai/)** (Excellent for short viral clips)
* **[Runway Gen-3 Alpha](https://runwayml.com/)** (Free trial available)
* **[Pika Art](https://pika.art/)** (Discord-based and web generation)

### Option 2: Generate via Cloud API (Replicate / Luma)
If you have your own API key, you can dispatch this directly to a high-end video cluster:
\`\`\`bash
curl -s -X POST \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"input": {"prompt": "${cleanPrompt}"}}' \\
  https://api.replicate.com/v1/models/luma/ray/predictions
\`\`\`

### Option 3: Generate on your own Machine (Local GPU via ComfyUI)
If you have a powerful local GPU, you can run open-weights models like Stable Video Diffusion.
\`\`\`bash
# Send to your local ComfyUI API
curl -X POST http://127.0.0.1:8188/prompt -H "Content-Type: application/json" -d '{
  "prompt": { "text": "${cleanPrompt}", "frames": 120 }
}'
\`\`\`

*(Below is an AI-generated animated storyboard frame simulating your request for preview purposes!)*
![video-frame](${imageUrl})`
        });
      }

      // Formatting previous messages for the model
      // Gemini expects format: { role: "user" | "model", parts: [{ text: "..." }] }
      const formatMsg = (msg: any) => {
        const parts: any[] = [{ text: msg.content }];
        if (msg.image) {
          // extract base64 and mime type from data URL
          // data:image/jpeg;base64,...
          const matches = msg.image.match(/^data:(image\/\w+);base64,(.+)$/);
          if (matches) {
            parts.push({
              inlineData: {
                mimeType: matches[1],
                data: matches[2]
              }
            });
          }
        }
        return {
          role: msg.role === "assistant" ? "model" : "user",
          parts
        };
      };

      const history = messages.slice(0, -1).map(formatMsg);

      const chatResponse = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...history,
          formatMsg(messages[messages.length - 1])
        ],
        config: {
          systemInstruction: dynamicPrompt,
          temperature: mode === 'fast' ? 0.7 : 0.4,
          tools: mode === 'deep-research' ? [{ googleSearch: {} }] : undefined
        }
      });

      res.json({ response: chatResponse.text });
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      res.status(500).json({ error: "Failed to generate response" });
    }
  });

  // API route for title generation
  app.post("/api/generate-title", async (req, res) => {
    try {
      const { message } = req.body;
      const titlePrompt = `Generate a very concise, 2-5 word title for a conversation that starts with the following message. Do not include quotes or extra punctuation.\n\nMessage: "${message}"`;
      
      const chatResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: titlePrompt }] }
        ],
        config: {
          temperature: 0.7,
        }
      });
      res.json({ title: chatResponse.text?.trim() || "New Chat" });
    } catch (error) {
      console.error("Error generating title:", error);
      res.status(500).json({ title: "New Chat" });
    }
  });

  // API route for chat summarization
  app.post("/api/summarize", async (req, res) => {
    try {
      const { messages } = req.body;
      const history = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      const summarizePrompt = `Provide a very concise, high-level summary (1-3 sentences) of the following conversation:\n\n${history}`;
      
      const chatResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: summarizePrompt }] }
        ],
        config: {
          temperature: 0.3,
        }
      });
      res.json({ summary: chatResponse.text?.trim() || "No summary available." });
    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
