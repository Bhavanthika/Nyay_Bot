import React, { useState, useEffect } from "react";
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
import { PlusCircle } from "lucide-react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";


const App = () => {
  const [message, setMessage] = useState("");
  const [isResponseScreen, setIsResponseScreen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [lastLegalTopic, setLastLegalTopic] = useState("");
  const [darkMode, setDarkMode] = useState(true);

  const [chatHistory, setChatHistory] = useState([]);
  const [activeChatIndex, setActiveChatIndex] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = promptTemplate(msg, lastLegalTopic);
    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();

    const userMsgTime = new Date().toISOString();
    const responseTime = new Date().toISOString();

    const newMessages = [
  { type: "userMsg", text: msg, timestamp: userMsgTime },
  { type: "responseMsg", text: responseText, isHtml: true, timestamp: responseTime }
];

    let updatedHistory = [...chatHistory];

    if (activeChatIndex !== null) {
      // Append to the existing chat conversation
      const updatedConversation = [...updatedHistory[activeChatIndex].conversation, ...newMessages];
updatedHistory[activeChatIndex] = {
  ...updatedHistory[activeChatIndex],
  conversation: updatedConversation,
  title: generateChatTitle(updatedConversation),
  createdAt: new Date().toISOString()  // <-- Add this line
};

      
    } else {
      // Create a new chat conversation
      updatedHistory.push({
  title: generateChatTitle(newMessages),
  conversation: newMessages,
  createdAt: new Date().toISOString()  // <-- Add this line
});

    }

    setChatHistory(updatedHistory);
    setActiveChatIndex(
      activeChatIndex !== null ? activeChatIndex : updatedHistory.length - 1
    );
    setMessages(
      activeChatIndex !== null
        ? [...messages, ...newMessages]
        : newMessages
    );
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

  

 const newChat = () => {
  setIsResponseScreen(false);
  setMessages([]);
  setMessage("");
  setLastLegalTopic("");
  setActiveChatIndex(null);
  resetTranscript();
};


  const toggleDarkMode = () => {
  const newMode = !darkMode;
  setDarkMode(newMode);
  localStorage.setItem("darkMode", JSON.stringify(newMode));
};

  
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
  } ${darkMode ? "bg-gray-800 text-white" : "bg-white border-r border-gray-300"}`}
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
      {chats.map((chat, idx) => {
        const realIndex = chatHistory.findIndex(c => c === chat);

        return (
          <div
            key={realIndex}
            className={`group w-full flex justify-between items-center px-3 py-2 rounded-md text-sm cursor-pointer relative
              ${activeChatIndex === realIndex ? "bg-[#2c09c5] text-white font-semibold" : ""}
            `}
            onClick={() => {
              setMessages(chat.conversation);
              setIsResponseScreen(true);
              setActiveChatIndex(realIndex);
              setIsSidebarOpen(false);
            }}
            onMouseEnter={e => {
              if (activeChatIndex !== realIndex) {
                e.currentTarget.style.backgroundColor = "#2c09c5";
                e.currentTarget.style.color = "white";
              }
            }}
            onMouseLeave={e => {
              if (activeChatIndex !== realIndex) {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "inherit";
              }
            }}
          >
            <span>{chat.title}</span>

            {/* Dot button with delete on hover */}
            <div
              className="relative"
              onClick={e => e.stopPropagation()} // Prevent triggering the parent click
            >
              <button className="text-white font-bold px-2"></button>

              <button
                className="absolute right-0 top-full mt-1 bg-gray-600 text-white rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onClick={() => deleteChat(realIndex)}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  ))}
</div>



          <div className="px-4 py-2 ">
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
    
    {!isSidebarOpen && (
      <div
    onClick={() => setIsSidebarOpen(true)}
    className={`absolute top-4 left-4 m-2 p-2 rounded-full cursor-pointer z-50 ${
      darkMode ? "bg-gray-700 text-white" : "bg-white text-black border border-gray-300"
    } hover:scale-105 transition`}
    title="Open Chat History"
  >
    ☰
  </div>
    )}    
        </div>

        {/* DARK/LIGHT MODE TOGGLE BUTTON FIXED TOP RIGHT */}
  <div
  onClick={toggleDarkMode}
  className={`absolute top-4 right-4 m-2 p-2 rounded-full cursor-pointer z-50 ${
    darkMode ? "bg-gray-800 text-yellow-400" : "bg-gray-200 text-gray-700"
  } hover:scale-105 transition`}
  title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
>
  {darkMode ? <FaSun size={20} /> : <FaMoon size={20} />}
</div>

   
      {isResponseScreen ? (   
         <div className={`flex-1 transition-margin duration-300 ease-in-out ${isSidebarOpen ? "ml-[100px]" : "ml-0"}`}
         >     
        <div className="flex flex-col h-[80vh]">
          <div className="pt-6 flex items-center justify-between w-full px-4 md:px-16 lg:px-60">
  <div className="w-full flex justify-center md:justify-start px-4 md:px-8">
  <h2 className="animated-gradient text-2xl md:text-3xl font-semibold font-serif tracking-wide pb-1 mb-6">
    Nyay Bot
  </h2>
</div>

  <div className="flex items-center gap-4">
   <button
  className={`absolute top-4 right-20 m-2 px-4 py-2 rounded-full font-medium z-40 flex items-center gap-2 transition-all duration-300 ease-in-out transform hover:scale-105
    ${
      darkMode
        ? "bg-gradient-to-r from-[#1a1a1a] to-[#333] text-white hover:from-[#2a2a2a] hover:to-[#444] shadow-lg"
        : "bg-gradient-to-r from-white to-gray-100 border border-gray-300 text-black hover:from-gray-100 hover:to-gray-200 shadow-md"
    }`}
  onClick={newChat}
>
  <PlusCircle size={20} strokeWidth={2.2} />
  New Chat
</button>


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
  
            <div className="boxes mt-[30px] flex flex-wrap items-center gap-4 justify-center w-full px-2">
              {[
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
              ].map((card, index) => (
                <div
                  key={index}
                  className={`card w-[45vw] sm:w-[180px] h-[180px] rounded-lg relative p-4 text-center shadow-md ${
                    darkMode ? "bg-[#1f1f1f] text-gray-100" : "bg-white text-gray-900 border"
                  }`}
                >
                  <p className="text-[16px] font-serif italic">
                    {card.text}
                    <br />– {card.author}
                  </p>
                  <i className="absolute right-3 bottom-3 text-[18px]">{card.icon}</i>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="w-full flex flex-col items-center py-6 px-4">
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
        <p className="text-gray-400 text-xs mt-4 text-center px-4">
          &copy; {new Date().getFullYear()} Nyay Bot. All rights reserved. | Disclaimer: This is an AI legal assistant developed by Bhavanthika Selvarajan and does not replace professional legal advice. 
        </p>
      </div>
    </div>
      
  );
};

export default App;  
