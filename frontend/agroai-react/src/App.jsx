import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import BentoGrid from "./components/Features/BentoGrid";
import { translations } from "./data/translations";
import AIProcessingOverlay from "./components/AIProcessingOverlay";

const STREAMLIT_APP_URL = import.meta.env.VITE_STREAMLIT_APP_URL || "http://localhost:8501";
const FRONTEND_APP_URL = import.meta.env.VITE_FRONTEND_APP_URL || window.location.origin;

function normalizeOrigin(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return window.location.origin;
  }
}

function buildStreamlitRedirectUrl() {
  const target = new URL(STREAMLIT_APP_URL);
  target.searchParams.set("return_to", normalizeOrigin(FRONTEND_APP_URL));
  return target.toString();
}

function App() {
  const [lang, setLang] = useState("en");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMode, setProcessingMode] = useState("outbound");
  const [prefillSelection, setPrefillSelection] = useState(null);
  const [initialSearch] = useState(() => window.location.search);
  const t = translations[lang] || translations.en;

  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setMessages([
      {
        sender: "bot",
        text: (translations[lang]?.chatbotBotMsg || "") + " **₹2,600/qtl**. " + (translations[lang]?.chatbotBotMsg2 || "")
      }
    ]);
  }, [lang]);

  const formatText = (text) => {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\//g);
      // Fallback regex to capture bold markers if split format differs
      const finalParts = line.includes("**") ? line.split(/\*\*(.*?)\*\*/g) : [line];
      return (
        <span key={i} className="block min-h-[1em]">
          {finalParts.map((part, index) => {
            if (index % 2 === 1) {
              return <strong key={index} className="text-brand-light font-black">{part}</strong>;
            }
            return part;
          })}
        </span>
      );
    });
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || isTyping) return;

    const userText = inputVal.trim();
    setInputVal("");

    setMessages(prev => [...prev, { sender: "user", text: userText }]);
    setIsTyping(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.");
      }

      const systemInstruction = `You are Krishi Mitra, a friendly, professional AI agricultural advisor helper for Indian farmers. 
Answer the farmer's question precisely and conversationally. You support English and regional Indian languages like Hindi. 
Always respond in the same language as the query (e.g. if asked in Hindi, respond in Hindi). 
Keep your responses structured, encouraging, and focused on helping the farmer get better yields, pricing, weather, or farming practices. 
Use markdown bold (**text**) to highlight key prices, names, or metrics. Keep answers under 4 sentences.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: systemInstruction },
                  { text: `Query: ${userText}` }
                ]
              }
            ]
          }),
        }
      );

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }

      const botText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't formulate a response. Please try again.";
      setMessages(prev => [...prev, { sender: "bot", text: botText }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        { 
          sender: "bot", 
          text: `⚠️ Error: ${err.message || "Failed to contact Krishi Mitra. Please check your internet connection."}` 
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePredict = () => {
    if (isProcessing) return;
    localStorage.setItem("aiVisited", "true");
    setProcessingMode("outbound");
    setIsProcessing(true);
  };

  useEffect(() => {
    const params = new URLSearchParams(initialSearch);
    const returnFlag = params.get("return") === "1";
    const crop = params.get("crop");
    const state = params.get("state");

    if (crop || state) {
      setPrefillSelection({
        crop: crop || undefined,
        state: state || undefined,
      });
    }

    if (returnFlag || localStorage.getItem("aiVisited") === "true") {
      setProcessingMode("return");
      setIsProcessing(true);

      const resumeTimer = setTimeout(() => {
        setIsProcessing(false);
        setProcessingMode("outbound");
        localStorage.removeItem("aiVisited");
      }, 1800);

      // Clean URL immediately after we capture params so refreshes don't replay return mode.
      if (window.location.search) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      return () => clearTimeout(resumeTimer);
    }

    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    return undefined;
  }, [initialSearch]);

  useEffect(() => {
    if (isProcessing) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }

    document.body.style.overflow = "";
    return undefined;
  }, [isProcessing]);

  useEffect(() => {
    if (!isProcessing || processingMode !== "outbound") return;

    const timeout = setTimeout(() => {
      window.location.href = buildStreamlitRedirectUrl();
    }, 2800);

    return () => {
      clearTimeout(timeout);
    };
  }, [isProcessing, processingMode]);

  return (
    <div className="antialiased overflow-x-hidden selection:bg-brand selection:text-forest">
      <Navbar lang={lang} setLang={setLang} onPredict={handlePredict} />
      <Hero lang={lang} onPredict={handlePredict} prefillSelection={prefillSelection} />
      <BentoGrid lang={lang} onPredict={handlePredict} />

      {/* Krishi Mitra Chatbot Section */}
      <section className="relative py-32 bg-forest border-t border-white/5" id="demo">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1592982537446-5ba58ac5dc7b?q=80&w=600&auto=format&fit=crop')] bg-cover opacity-10 blur-sm pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-sans font-black text-white mb-4 tracking-tight">
              {t.chatbotTitlePrefix} <span className="text-brand-light">{t.chatbotTitleHighlight}</span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              {t.chatbotDesc}
            </p>
          </div>
          
          <div className="glass-panel border-white/20 rounded-[2rem] p-6 md:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden backdrop-blur-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand to-brand-light"></div>
            <div className="flex flex-col gap-6 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`flex items-start gap-4 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div className={`w-12 h-12 rounded-full flex flex-shrink-0 items-center justify-center border ${
                    msg.sender === "user" 
                      ? "bg-white/10 border-white/20" 
                      : "bg-brand/20 border-brand/40 shadow-[0_0_15px_rgba(132,204,22,0.2)]"
                  }`}>
                    <i className={`ph-bold ${msg.sender === "user" ? "ph-user text-white/70" : "ph-robot text-brand-light"} text-2xl`}></i>
                  </div>
                  <div className={`border rounded-2xl p-4 backdrop-blur-md max-w-[85%] ${
                    msg.sender === "user"
                      ? "bg-brand/10 border-brand/30 rounded-tr-sm text-white"
                      : "bg-white/5 border-white/10 rounded-tl-sm text-white/90"
                  }`}>
                    {msg.sender === "bot" ? (
                      <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                        {formatText(msg.text)}
                      </div>
                    ) : (
                      <p className="text-sm md:text-base leading-relaxed">{msg.text}</p>
                    )}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand/20 flex flex-shrink-0 items-center justify-center border border-brand/40 shadow-[0_0_15px_rgba(132,204,22,0.2)]">
                    <i className="ph-bold ph-robot text-2xl text-brand-light"></i>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-4 backdrop-blur-md text-white/50 text-sm flex items-center gap-1">
                    <span>Krishi Mitra is thinking</span>
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce [animation-delay:0.2s]">.</span>
                    <span className="animate-bounce [animation-delay:0.4s]">.</span>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-3">
              <input 
                type="text" 
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={t.chatbotInputPlaceholder} 
                disabled={isTyping}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/40 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/50 transition-all disabled:opacity-50" 
              />
              <button 
                type="submit"
                disabled={isTyping || !inputVal.trim()}
                className="bg-brand text-forest hover:bg-brand-light transition-colors rounded-xl px-6 font-bold flex items-center justify-center shadow-[0_0_20px_rgba(132,204,22,0.3)] disabled:opacity-50 cursor-pointer"
              >
                <i className="ph-bold ph-paper-plane-right text-xl"></i>
              </button>
            </form>
          </div>
        </div>
      </section>
      
      {/* Final CTA */ }
      <section className="py-32 bg-[#0a140c] relative overflow-hidden flex flex-col items-center justify-center border-t border-brand/10">
        <div className="absolute w-[800px] h-[800px] bg-brand/5 rounded-full blur-[100px] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="relative z-10 text-center max-w-3xl mx-auto px-6">
          <h2 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight">
            {t.finalTitle1} <span className="text-gradient">{t.finalTitle2}</span>
          </h2>
          <p className="text-white/60 text-lg mb-10">{t.finalDesc}</p>
          <button onClick={handlePredict} className="signal-pulse inline-block bg-brand text-forest px-10 py-5 rounded-full font-extrabold text-xl transition-transform hover:scale-105">
            {t.cta} &rarr;
          </button>
        </div>
      </section>

      {/* Footer */ }
      <footer className="bg-forest py-10 border-t border-white/5 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <i className="ph-fill ph-plant text-brand"></i>
          <span className="text-white font-extrabold tracking-tight">AgroAI</span>
        </div>
        <p className="text-white/40 text-sm">&copy; 2026 AgroAI. {t.footerText}</p>
      </footer>

      <AIProcessingOverlay isVisible={isProcessing} lang={lang} mode={processingMode} />
    </div>
  );
}

export default App;
