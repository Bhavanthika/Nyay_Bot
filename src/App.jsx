import React, { useState, useEffect, useRef } from "react"; 
import "./App.css";
import { FaBalanceScale, FaGavel, FaMoon, FaSun } from "react-icons/fa";
import { GiJusticeStar } from "react-icons/gi";
import { PiBooksDuotone } from "react-icons/pi";
import { IoSend } from "react-icons/io5";
import { BsFillMicFill, BsFillMicMuteFill } from "react-icons/bs";
import Lottie from "lottie-react";
import AIAnimation from "./Animation_AI.json";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ReactMarkdown from 'react-markdown';
import { MessageSquarePlus } from 'lucide-react';
import { v4 as uuidv4 } from "uuid";
import { IoIosArrowBack, IoIosArrowForward } from "react-icons/io";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";


const App = () => {
  const [message, setMessage] = useState("");
  const [isResponseScreen, setIsResponseScreen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [lastLegalTopic, setLastLegalTopic] = useState("");
  const [darkMode, setDarkMode] = useState(true);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);


  const [chatHistory, setChatHistory] = useState([]);
  const [activeChatIndex, setActiveChatIndex] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userId, setUserId] = useState("");

  const { transcript, resetTranscript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();

  const deleteChat = (index) => {
    const updatedHistory = [...chatHistory];
    updatedHistory.splice(index, 1);
    setChatHistory(updatedHistory);

    if (activeChatIndex === index) {
      setActiveChatIndex(null);
      setMessages([]);
      setIsResponseScreen(false);
    } else if (activeChatIndex > index) {
      setActiveChatIndex(activeChatIndex - 1);
    }
  };

    const handleVoiceInput = async () => {
    if (!listening) {
      // Start recording
      setListening(true);
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setListening(false);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioBase64 = await blobToBase64(audioBlob);
        const transcript = await sendAudioToGoogleSpeech(audioBase64);
        if (transcript) {
          setInput(transcript);
        }
      };

      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop(); // Automatically stop after 5 seconds
      }, 5000);
    }
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  };

  const sendAudioToGoogleSpeech = async (base64Audio) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    const response = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        config: {
          encoding: "WEBM_OPUS",
          sampleRateHertz: 48000,
          languageCode: "en-US"
        },
        audio: {
          content: base64Audio
        }
      })
    });

    const data = await response.json();
    return data.results?.[0]?.alternatives?.[0]?.transcript || "";
  };


   const generateChatTitle = (msgs) => {
    const firstUserMsg = msgs.find(m => m.type === "userMsg");
    if (!firstUserMsg) return "Untitled Chat";
    return firstUserMsg.text.length > 20 ? firstUserMsg.text.slice(0, 20) + "..." : firstUserMsg.text;
  };

 const promptTemplate = (userMessage) => `
You are a legal assistant chatbot. Respond with well-structured legal information.

Instructions:
- Use clear section titles.
- Add a line break after each sentence or point.
- Do NOT use stars, bullets, or markdown.
- Do NOT put everything into a paragraph.

Greeting Rule:
- If the user sends only a greeting (e.g., "hi", "hello", "hey", "good morning", "good evening"), respond with a friendly greeting and include a suitable emoji.
- If the user includes a question or topic (e.g., "hello, what is law?"), skip the greeting and answer the question directly.

Language Rule:
- Respond in the same language as the user's query.
- Tamil → Respond in Tamil.
- Hindi → Respond in Hindi.
- English → Respond in English.
- Spanish → Respond in Spanish.

"${userMessage}"
`;

function toLocalDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function groupChatsByDate(chats) {
  const groupedChats = {
    Today: [],
    Yesterday: [],
    Older: [],
  };

  const now = new Date();
  const today = toLocalDateOnly(now);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  chats.forEach(chat => {
    const chatDateObj = new Date(chat.createdAt);

    // Convert to local midnight date
    const chatDate = toLocalDateOnly(chatDateObj);

    if (chatDate.getTime() === today.getTime()) {
      groupedChats.Today.push(chat);
    } else if (chatDate.getTime() === yesterday.getTime()) {
      groupedChats.Yesterday.push(chat);
    } else {
      groupedChats.Older.push(chat);
    }
  });

  // Remove empty groups
  Object.keys(groupedChats).forEach(key => {
    if (groupedChats[key].length === 0) {
      delete groupedChats[key];
    }
  });

  return groupedChats;
}

const generateResponse = async (msg) => {
  try {
    const userMsgTime = new Date().toISOString();

    // Show the user's message and a "Typing..." response immediately
    const userMessage = { type: "userMsg", text: msg, timestamp: userMsgTime };
    const loadingMessage = { type: "responseMsg", text: "Typing...", isHtml: false, timestamp: null, loading: true };

    let updatedMessages = [...(activeChatIndex !== null ? messages : []), userMessage, loadingMessage];
    setMessages(updatedMessages); // Show messages immediately

    const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = promptTemplate(msg, lastLegalTopic);
    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();

    const responseTime = new Date().toISOString();

    const realResponse = { type: "responseMsg", text: responseText, isHtml: true, timestamp: responseTime };

    // Replace "Typing..." with the real response
    updatedMessages = updatedMessages.map((m) =>
      m.loading ? realResponse : m
    );
    setMessages(updatedMessages);

    // Update chat history
    let updatedHistory = [...chatHistory];
    const newMessages = [userMessage, realResponse];

    if (activeChatIndex !== null) {
      const updatedConversation = [...updatedHistory[activeChatIndex].conversation, ...newMessages];
      updatedHistory[activeChatIndex] = {
        ...updatedHistory[activeChatIndex],
        conversation: updatedConversation,
        title: generateChatTitle(updatedConversation),
        createdAt: new Date().toISOString()
      };
    } else {
      updatedHistory.push({
        title: generateChatTitle(newMessages),
        conversation: newMessages,
        createdAt: new Date().toISOString()
      });
    }

    setChatHistory(updatedHistory);
    setActiveChatIndex(activeChatIndex !== null ? activeChatIndex : updatedHistory.length - 1);
    setIsResponseScreen(true);
    setMessage("");
    setLastLegalTopic(msg);
    resetTranscript();
  } catch (error) {
    alert("Error generating response: " + error.message);
  }
};



  const hitRequest = () => {
    if (message.trim()) {
      generateResponse(message.trim());
    } else {
      alert("You must write something!");
    }
  };
  const quotes = [
  {
    text: "Justice means giving everyone their fair share.",
    author: "Ulpian",
    icon: <FaBalanceScale />,
  },
  {
    text: "The power of the gavel lies in its finality.",
    author: "Johnnie Cochran",
    icon: <FaGavel />,
  },
  {
    text: "Equality before the law is the foundation of freedom.",
    author: "John Adams",
    icon: <GiJusticeStar />,
  },
  {
    text: "Knowledge of the law is the guardian of liberty.",
    author: "Edward Coke",
    icon: <PiBooksDuotone />,
  },
];

const [current, setCurrent] = useState(0);

const nextQuote = () => {
  setCurrent((prev) => (prev + 1) % quotes.length);
};

const prevQuote = () => {
  setCurrent((prev) => (prev - 1 + quotes.length) % quotes.length);
};

  
const newChat = () => {
  window.location.reload(); // 🔁 Reloads the whole page
};


  const toggleDarkMode = () => {
  const newMode = !darkMode;
  setDarkMode(newMode);
  localStorage.setItem("darkMode", JSON.stringify(newMode));
};

const [showMenuId, setShowMenuId] = useState(null);
let pressTimer = null;

const handlePressStart = (id) => {
  pressTimer = setTimeout(() => {
    setShowMenuId(id);
  }, 800);
};

const handlePressEnd = () => {
  clearTimeout(pressTimer);
};

useEffect(() => {
  const handleClickOutside = () => setShowMenuId(null);
  window.addEventListener("click", handleClickOutside);
  return () => window.removeEventListener("click", handleClickOutside);
}, []);


  
  const toggleListening = () => {
    if (!browserSupportsSpeechRecognition) {
      alert("Browser does not support speech recognition.");
      return;
    }

    if (isListening) {
      SpeechRecognition.stopListening();
      setIsListening(false);
    } else {
      SpeechRecognition.startListening({ continuous: true, language: "en-IN" });
      setIsListening(true);
    }
  };

  useEffect(() => {
  const chatContainer = document.querySelector('.overflow-y-auto');
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}, [messages]);

useEffect(() => {
  let storedId = localStorage.getItem("chat_user_id");
  if (!storedId) {
    storedId = uuidv4();
    localStorage.setItem("chat_user_id", storedId);
  }
  setUserId(storedId);
}, []);

useEffect(() => {
  if (userId) {
    const savedChats = localStorage.getItem(`chat_history_${userId}`);
    if (savedChats) {
      setChatHistory(JSON.parse(savedChats));
    }
  }
}, [userId]);

useEffect(() => {
  if (userId) {
    localStorage.setItem(`chat_history_${userId}`, JSON.stringify(chatHistory));
  }
}, [chatHistory, userId]);



  useEffect(() => {
    setMessage(transcript);
  }, [transcript]);

  useEffect(() => {
  const savedMode = localStorage.getItem("darkMode");
  if (savedMode !== null) {
    setDarkMode(JSON.parse(savedMode));
  }
}, []);


  return (
    <div
  className={`fixed top-0 left-0 w-full h-full overflow-hidden ${
    darkMode ? "bg-[#0E0E0E] text-white" : "bg-[#F7F7F7] text-[#1A1A1A]"
  }`}
>

      
      <div className="relative flex">
        {/* Sidebar */}
        <div
  className={`fixed top-0 left-0 h-full w-[260px] z-40 transition-transform transform ${
    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
  } ${darkMode ? "bg-[#222222] text-white" : "bg-white border-r border-gray-300"}`}
>
  {/* Header */}
  <div className="flex justify-between items-center px-4 py-3">
    <h3 className="font-semibold text-lg">💬 Chats</h3>
    <button onClick={() => setIsSidebarOpen(false)} className="text-xl font-bold">
      ×
    </button>
  </div>
<div className="overflow-y-auto h-[85%] px-3 py-2 space-y-4">
  {Object.entries(groupChatsByDate(chatHistory)).map(([groupName, chats]) => (
    <div key={groupName}>
      <h4 className="font-semibold text-sm mb-2 px-2">{groupName}</h4>
      {chats.map((chat) => {
        const realIndex = chatHistory.indexOf(chat);
        const isActive = activeChatIndex === realIndex;

        return (
          <div
            key={realIndex}
            className={`
              group w-full flex justify-between items-center px-3 py-2 rounded-md text-sm cursor-pointer relative
              ${isActive ? "bg-gray-200 text-black font-semibold" : "hover:bg-gray-200 hover:text-black"}
            `}
            onClick={() => {
              setMessages(chat.conversation);
              setIsResponseScreen(true);
              setActiveChatIndex(realIndex);
              setIsSidebarOpen(false);
            }}
            onMouseDown={() => handlePressStart(realIndex)}
            onTouchStart={() => handlePressStart(realIndex)}
            onMouseUp={handlePressEnd}
            onTouchEnd={handlePressEnd}
            onMouseLeave={handlePressEnd}
          >
            <span className="truncate w-[80%]">{chat.title}</span>

            {/* Dots & Delete Menu */}
            <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
              <button
                className="text-xl px-2 hover:text-black"
                onClick={() => setShowMenuId(realIndex)}
              >
                ⋮
              </button>

              {showMenuId === realIndex && (
  <div
    className={`absolute right-0 top-full mt-1 rounded shadow z-50 border ${
      darkMode
        ? "bg-[#2b2b2b] border-gray-700 text-white"
        : "bg-white border-gray-300 text-black"
    }`}
  >
    <button
      onClick={() => {
        deleteChat(realIndex);
        setShowMenuId(null);
      }}
       className={`block w-full px-4 py-2 text-sm text-left 
        ${darkMode ? "text-white" : "text-black"}`}
    >
      Delete
    </button>
  </div>
)}

            </div>
          </div>
        );
      })}
    </div>
  ))}
</div>

<div className="px-4 py-2">
  <button
    onClick={() => {
      setChatHistory([]);
      setMessages([]);
      setActiveChatIndex(null);
      setIsResponseScreen(false);
    }}
    className="w-full px-3 py-2 rounded-md bg-red-500 text-white hover:bg-red-600"
  >
    Delete All Chats
  </button>
</div>
</div>
        {/* CHATBOT CONTAINER */}
  
    {/* Hamburger in top-left corner inside container */}
    
    {/* Sidebar Toggle Button (☰) */}
{!isSidebarOpen && (
  <div
    onClick={() => setIsSidebarOpen(true)}
    className={`fixed top-4 left-4 p-2 rounded-full cursor-pointer z-50
      ${
        darkMode
          ? "bg-gray-700 text-white"
          : "bg-white text-black border border-gray-300"
      } hover:scale-105 transition`}
    title="Open Chat History"
  >
    ☰
  </div>
)}
</div>

 {/* Top-right controls: New Chat first, then Mode Toggle */}
<div className="fixed top-4 right-4 z-50 flex items-center gap-2">
  {/* New Chat Button */}
  <div onClick={newChat} className="cursor-pointer hover:scale-105 transition" title="New Chat">
    <MessageSquarePlus size={30} strokeWidth={2.2} />
  </div>

  {/* Mode Toggle Button */}
  <div
    onClick={toggleDarkMode}
    className={`ml-1 p-2 rounded-full cursor-pointer hover:scale-105 transition ${
      darkMode ? "bg-gray-700 text-yellow-400" : "bg-gray-200 text-gray-700"
    }`}
    title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
  >
    {darkMode ? <FaSun size={20} /> : <FaMoon size={20} />}
  </div>
</div>
 
      {isResponseScreen ? (   
         <div className={`flex-1 transition-margin duration-300 ease-in-out ${isSidebarOpen ? "ml-[100px]" : "ml-0"}`}
         >     
        <div className="flex flex-col h-[80vh]">
          <div className="pt-6 flex items-center justify-between w-full px-4 md:px-16 lg:px-60">
  <div className="w-full flex justify-center md:justify-start px-4 md:px-8">
  
<h2 className="fixed top-4 left-1/2 transform -translate-x-1/2 animated-gradient text-2xl md:text-3xl font-semibold font-serif tracking-wide pb-1 mb-6 z-30">
  Nyay Bot
</h2>

</div>
</div>

          <div className="flex-1 overflow-y-auto px-4 md:px-16 lg:px-60 mt-6">
            {messages.map((msg, index) => (
  <div
    key={index}
    className={`my-3 flex ${
      msg.type === "userMsg" ? "justify-end" : "justify-start"
    }`}
  >
    <div
      className={`p-4 rounded-2xl max-w-[80%] md:max-w-[60%] text-sm md:text-base leading-relaxed tracking-wide ${
        msg.type === "userMsg"
          ? "bg-gradient-to-r from-blue-600 to-blue-400 text-white shadow-lg"
          : darkMode
          ? "bg-[#1f2937] text-gray-200 shadow-md"
          : "bg-white border border-gray-200 text-black shadow"
          
      }`}
      style={{ wordBreak: "break-word" }}
    >
      {msg.type === "userMsg" ? (
        msg.text
      ) : (
        msg.text.split("\n\n").map((para, i) => (
          <p key={i} className="mb-3">
            <ReactMarkdown>{para}</ReactMarkdown>
          </p>
        ))
      )}
    </div>
  </div>
))}

          </div>
        </div>
        </div>
      ) : (
        <div className="header pt-[25px] w-full px-4 md:px-20 lg:px-[200px] flex flex-col items-center">
          <div className="flex flex-col items-center mb-4">

            <div className="relative flex flex-col items-center mb-4 w-full px-4 md:px-20 lg:px-[200px]">
  

  <div className="w-[100px] sm:w-[120px] md:w-[140px] lg:w-[160px] xl:w-[180px]">
    <Lottie animationData={AIAnimation} loop={true} className="w-full h-auto" />
  </div>
  <h2 className="animated-gradient text-3xl sm:text-4xl md:text-5xl font-semibold font-serif tracking-wide pb-1 overflow-visible mb-6">
  Nyay Bot
</h2>

</div>
<div className="w-full flex justify-center items-center my-6">
  <div
    className={`group relative w-[90vw] max-w-sm h-[220px] rounded-xl p-4 transition-all duration-300 flex items-center ${
      darkMode ? "bg-[#2a2a2a] text-gray-100" : "bg-white text-gray-900 border"
    }`}
  >
    {/* Left Arrow (hover only) */}
    <button
      onClick={prevQuote}
      className="absolute left-2 top-1/2 -translate-y-1/2 text-2xl text-gray-400 opacity-0 group-hover:opacity-100 transition"
    >
      <IoIosArrowBack />
    </button>

    {/* Centered Quote Content */}
    <div className="w-full flex flex-col items-center justify-center text-center px-4 space-y-2">
      {/* Quote Text */}
     {/* Quote Text */}
{/* Quote Text */}
<p
  className={`text-2xl sm:text-2xl italic font-serif text-center leading-relaxed ${
    darkMode ? "text-white" : "text-black"
  }`}
>
  {quotes[current].text}
</p>

{/* Author */}
<p
  className={`mt-2 font-medium text-lg sm:text-1xl text-center ${
    darkMode ? "text-white" : "text-black"
  }`}
>
  -{quotes[current].author}
</p>


    </div>

    {/* Icon in bottom right corner */}
    <div className="absolute bottom-3 right-4 text-4xl text-green-500">
      {quotes[current].icon}
    </div>

    {/* Right Arrow (hover only) */}
    <button
      onClick={nextQuote}
      className="absolute right-2 top-1/2 -translate-y-1/2 text-2xl text-gray-400 opacity-0 group-hover:opacity-100 transition"
    >
      <IoIosArrowForward />
    </button>
  </div>
</div>

          </div>
        </div>
      )}

<div
  className={`w-full absolute bottom-0 px-4 pt-4 pb-6 ${
    darkMode ? "bg-[#0E0E0E]" : "bg-[#fffff]"
  }`}
>

      <div className="w-full flex flex-col items-center">
        <div
          className={`w-full md:w-[80%] lg:w-[60%] text-sm py-2 flex items-center rounded-full ${
            darkMode ? "bg-[#222222]" : "bg-white border border-gray-300"
          }`}
        >
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            type="text"
            className="p-2 pl-4 bg-transparent flex-1 outline-none border-none"
            placeholder="Write your message here..."
            onKeyDown={(e) => {
              if (e.key === "Enter") hitRequest();
            }}
          />
          <div className="flex items-center pr-4">
            <i
              style={{ color: listening ? "#FF4D4F" : darkMode ? "white" : "#333" }}
              className="text-lg mr-4 cursor-pointer"
              onClick={toggleListening}
            >
              {listening ? <BsFillMicMuteFill /> : <BsFillMicFill />}
            </i>
            <i
              style={{ color: darkMode ? "white" : "#333" }}
              className="text-lg cursor-pointer"
              onClick={hitRequest}
            >
              <IoSend />
            </i>
          </div>
        </div>
       <p className="text-gray-400 text-xs text-center mt-4">
  © {new Date().getFullYear()} Nyay Bot by Bhavanthika Selvarajan – AI legal assistant, not a substitute for professional legal advice.
</p>

      </div>
    </div>
  </div>
      
  );
};

export default App;  
