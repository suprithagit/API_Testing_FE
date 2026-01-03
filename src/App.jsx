import { useState, useEffect } from "react";
import HeadersSection from "./components/HeadersSection";
import ParamsSection from "./components/ParamsSection";
import AceEditor from "react-ace";
// Removed sidebar imports if you don't have them, but keeping based on your code
// import HistorySidebar from "./components/HistorySidebar"; 
// import CollectionsSidebar from "./components/CollectionsSidebar";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/theme-dracula";
import "ace-builds/src-noconflict/theme-twilight"; 
import "ace-builds/src-noconflict/theme-chrome";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { saveHistoryItem, getUserHistory } from "./utils/history";
import MobileTabs from "./components/MobileTabs";
import { logLogout } from "./utils/logUserEvent";

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return { message: str };
  }
}

export default function App() {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [apiStatus, setApiStatus] = useState(null);
  const [apiStatusText, setApiStatusText] = useState("");
  const [responseTime, setResponseTime] = useState(null);
  const [responseTab, setResponseTab] = useState("body");
  const [responseHeaders, setResponseHeaders] = useState({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [collections, setCollections] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSidebarTab, setActiveSidebarTab] = useState("history");
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [mobileTab, setMobileTab] = useState("home");
  const [openSaveModal, setOpenSaveModal] = useState(false);
  const [description, setDescription] = useState("");
  // const [collectionName, setCollectionName] = useState(""); // Not used directly in new logic
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saveError, setSaveError] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [newCollectionInput, setNewCollectionInput] = useState("");
  const [expandedCollections, setExpandedCollections] = useState({});

  // Headers & Params State
  const [headers, setHeaders] = useState([
    { key: "Content-Type", value: "application/json", enabled: true },
  ]);
  const [params, setParams] = useState([]);
  const [activeTab, setActiveTab] = useState("params");

  // --- EFFECTS ---

  useEffect(() => {
    if (!openSaveModal) {
      setSaveSuccess("");
      setSaveError("");
    }
  }, [openSaveModal]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Load Data
  useEffect(() => {
    if (!user) {
      setHistoryList([]);
      setCollections([]);
      return;
    }

    const loadHistory = async () => {
      // Keeping your existing history util as it seems to work, 
      // or you can refactor it similarly if it breaks.
      try {
        const { items = [] } = await getUserHistory(user.uid);
        const clean = items.map((doc) => ({
          id: doc.id,
          method: doc.method || "",
          url: doc.url || "",
          headers: doc.headers || [],
          params: doc.params || [],
          body: doc.body || "",
          created_at: doc.created_at || "",
        }));

        const deleted = JSON.parse(localStorage.getItem("deletedHistory") || "[]");
        const filtered = clean.filter((item) => !deleted.includes(item.id));
        setHistoryList(filtered);
      } catch (err) {
        console.error("Error loading history:", err);
      }
    };

    loadHistory();
    fetchCollections(); 
  }, [user]);

  // Direct Firestore Fetch to ensure path correctness
  const fetchCollections = async () => {
    if (!user) return;
    try {
      // FIX: Query specifically under users/{uid}/collections
      const colRef = collection(db, "users", user.uid, "collections");
      const q = query(colRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      
      const loadedCols = await Promise.all(snapshot.docs.map(async (docSnap) => {
        // Fetch sub-items for each collection
        const itemsRef = collection(db, "users", user.uid, "collections", docSnap.id, "requests");
        const itemsSnap = await getDocs(query(itemsRef, orderBy("createdAt", "desc")));
        const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return {
          id: docSnap.id,
          ...docSnap.data(),
          items: items
        };
      }));

      setCollections(loadedCols);
    } catch (err) {
      console.error("Failed to load collections:", err);
    }
  };

  // --- HANDLERS ---

  const sendRequest = async () => {
    if (!url) {
      alert("Please enter a URL");
      return;
    }

    setLoading(true);
    setApiStatus(null);
    setApiStatusText("");
    setResponse("Loading...");

    const enabledHeaders = {};
    headers.forEach((h) => {
      if (h.enabled && h.key.trim() !== "") enabledHeaders[h.key] = h.value;
    });

    const enabledParams = params.filter(
      (p) => p.enabled && p.key.trim() !== ""
    );

    let finalUrl = url;

    if (enabledParams.length > 0) {
      const qs = enabledParams
        .map(
          (p) =>
            `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`
        )
        .join("&");

      finalUrl += finalUrl.includes("?") ? "&" + qs : "?" + qs;
    }

    let parsedBody = null;
    try {
      parsedBody = body ? JSON.parse(body) : null;
    } catch {
      alert("Invalid JSON in body");
      setLoading(false);
      return;
    }

    const payload = {
      url: finalUrl,
      method: method.toUpperCase(),
      headers: enabledHeaders,
    };
    if (parsedBody) {
      payload.body = parsedBody;
    }

    const start = performance.now();

    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || (
        import.meta.env.DEV ? "http://localhost:5000" : ""
      );

      const res = await fetch(`${API_BASE}/proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const rawHeaders = {};
      res.headers.forEach((val, key) => (rawHeaders[key] = val));
      setResponseHeaders(rawHeaders);

      let result;
      try {
        result = await res.json();
      } catch {
        result = {
          status: res.status,
          statusText: res.statusText,
          data: "Non-JSON response",
        };
      }

      setApiStatus(result.status);
      setApiStatusText(result.statusText);

      let bodyOut = result.data;
      if (typeof bodyOut === "object") {
        bodyOut = JSON.stringify(bodyOut, null, 2);
      }

      setResponse(String(bodyOut));

      if (user) {
        const docRef = await saveHistoryItem(user.uid, {
          method,
          url: finalUrl,
          headers: enabledHeaders,
          params: enabledParams,
          body: parsedBody,
        });

        setHistoryList((prev) => [
          {
            id: docRef.id,
            method,
            url: finalUrl,
            headers: enabledHeaders,
            params: enabledParams,
            body: parsedBody,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (err) {
      setResponse("Error: " + err.message);
    } finally {
      setResponseTime(Math.round(performance.now() - start));
      setLoading(false);
    }
  };

  const handleHistorySelect = (item) => {
    setUrl(item.url || "");
    setMethod((item.method || "GET").toUpperCase());

    const normHeaders = Array.isArray(item.headers)
      ? item.headers.map((h) => ({
          key: (h.key ?? "").toString(),
          value: (h.value ?? "").toString(),
          enabled: h.enabled !== false,
        }))
      : [];

    if (normHeaders.length === 0) {
      setHeaders([
        { key: "Content-Type", value: "application/json", enabled: true },
      ]);
    } else {
      setHeaders(normHeaders);
    }

    const normParams = Array.isArray(item.params)
      ? item.params.map((p) => ({
          key: (p.key ?? "").toString(),
          value: (p.value ?? "").toString(),
          enabled: p.enabled !== false,
        }))
      : [];
    setParams(normParams);

    let bodyText = "";
    if (typeof item.body === "string") {
      bodyText = item.body;
    } else if (item.body && typeof item.body === "object") {
      bodyText = JSON.stringify(item.body, null, 2);
    }
    setBody(bodyText);

    setResponse(null);
    setApiStatus(null);
    setApiStatusText("");
    setResponseHeaders({});
    setResponseTime(null);
    setHistoryOpen(false);
  };

  // --- CREATE COLLECTION FIX ---
  // We now create directly under users/{uid}/collections to satisfy Security Rules
  const handleCreateCollection = async (name) => {
    if (!name || !name.trim()) {
      alert("Collection name cannot be empty.");
      return;
    }

    if (!user) {
      // Local only mode
      setCollections((prev) => [
        { id: "local-" + Date.now(), name, items: [] },
        ...prev,
      ]);
      return;
    }

    try {
      const colRef = collection(db, "users", user.uid, "collections");
      const docRef = await addDoc(colRef, {
        name: name,
        createdAt: serverTimestamp()
      });

      const newItem = { id: docRef.id, name, items: [] };
      
      setCollections((prev) => [newItem, ...prev]);
      return docRef.id; // Return ID for use in handleSave
    } catch (error) {
      console.error("Failed to create collection:", error);
      alert("Failed to create collection. Permission denied?");
      throw error; 
    }
  };

  // --- DELETE COLLECTION FIX ---
  const handleDeleteCollection = async (id) => {
    if (!window.confirm("Are you sure you want to delete this collection?")) return;

    // Optimistically update UI
    setCollections((prev) => prev.filter((c) => c.id !== id));

    if(user && !id.startsWith("local-")) {
      try {
        // Correct path: users/{uid}/collections/{id}
        await deleteDoc(doc(db, "users", user.uid, "collections", id));
      } catch (err) {
        console.error("Error deleting from DB:", err);
        // Optional: Revert state if failed
      }
    }
  };

  const handleDeleteSavedRequest = async (collectionId, itemId) => {
    // UI Update
    setCollections((prev) =>
      prev.map((col) => {
        if (col.id === collectionId) {
          return {
            ...col,
            items: col.items.filter((item) => item.id !== itemId),
          };
        }
        return col;
      })
    );

    // DB Update
    if (user && !collectionId.startsWith("local-") && !itemId.startsWith("local-")) {
      try {
        await deleteDoc(doc(db, "users", user.uid, "collections", collectionId, "requests", itemId));
      } catch (e) {
        console.error("Delete request failed", e);
      }
    }
  };

  const filteredHistory = historyList.filter((item) =>
    item.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCollections = collections.filter((col) =>
    col.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = async () => {
    if (!description.trim()) {
      setSaveError("Description is required.");
      setSaveSuccess("");
      return;
    }

    let targetCollectionId = "";
    let finalCollectionName = "";

    // 1. Determine Collection
    if (selectedCollection === "+new") {
      if (!newCollectionInput.trim()) {
        setSaveError("Please enter a name for the new collection.");
        return;
      }
      finalCollectionName = newCollectionInput.trim();
      // Create it immediately
      try {
        targetCollectionId = await handleCreateCollection(finalCollectionName);
      } catch(e) {
        setSaveError("Could not create collection: " + e.message);
        return;
      }
    } else {
      if (!selectedCollection) {
        setSaveError("Please select a collection.");
        return;
      }
      finalCollectionName = selectedCollection; // Here selectedCollection holds the Name, but we need ID
      const found = collections.find(c => c.name === finalCollectionName);
      if(found) targetCollectionId = found.id;
      else {
        // Fallback if UI is out of sync
        setSaveError("Collection not found.");
        return;
      }
    }

    if (!response) {
      alert("No response to save!");
      return;
    }

    const payload = {
      description,
      request: { url, method, headers, params, body },
      response: {
        status: apiStatus,
        statusText: apiStatusText,
        headers: responseHeaders,
        data: response,
        time: responseTime,
      },
      createdAt: new Date().toISOString(), // Use ISO string for JSON compatibility in state, DB will convert if needed
    };

    try {
      // 2. Save Item
      let savedItemId = "local-item-" + Date.now();

      if (user) {
        // Write to subcollection: users/{uid}/collections/{colId}/requests
        const requestsRef = collection(db, "users", user.uid, "collections", targetCollectionId, "requests");
        const docRef = await addDoc(requestsRef, {
            ...payload,
            createdAt: serverTimestamp() 
        });
        savedItemId = docRef.id;
      }

      // 3. Update UI
      setCollections((prev) =>
        prev.map((col) =>
          col.id === targetCollectionId
            ? {
                ...col,
                items: [
                  { id: savedItemId, ...payload },
                  ...(col.items || []),
                ],
              }
            : col
        )
      );

      setSaveSuccess("Saved successfully!");
      setSaveError("");
      setTimeout(() => {
        setOpenSaveModal(false);
        setSaveSuccess("");
        // Reset inputs
        setNewCollectionInput("");
        setDescription("");
        setSelectedCollection("");
      }, 1200);

    } catch (err) {
      console.error(err);
      setSaveError("Save failed: " + err.message);
    }
  };

  const handleLoadSavedCollectionItem = (item) => {
    const req = item.request;
    setUrl(req.url || "");
    setMethod(req.method || "GET");
    setHeaders(
      Array.isArray(req.headers)
        ? req.headers
        : [{ key: "Content-Type", value: "application/json", enabled: true }]
    );
    setParams(Array.isArray(req.params) ? req.params : []);

    let bodyText = "";
    if (typeof req.body === "string") {
      bodyText = req.body;
    } else if (req.body && typeof req.body === "object") {
      bodyText = JSON.stringify(req.body, null, 2);
    }
    setBody(bodyText);

    const res = item.response;
    if (res) {
      setApiStatus(res.status || null);
      setApiStatusText(res.statusText || "");
      setResponseHeaders(res.headers || {});
      let resBody = res.data;
      if (typeof resBody === "object") {
        resBody = JSON.stringify(resBody, null, 2);
      }
      setResponse(resBody || "");
      setResponseTime(res.time || null);
    } else {
      setApiStatus(null);
      setApiStatusText("");
      setResponse("");
      setResponseHeaders({});
      setResponseTime(null);
    }
    setCollectionsOpen(false);
  };

  // --- RENDER ---
  return (
    <div
      className="w-screen h-screen overflow-hidden flex flex-col text-white"
      style={{
        backgroundImage: `url(/background.jpg)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* DESKTOP UI */}
      <div className="hidden md:grid grid-cols-[260px_1fr_0.8fr] w-full h-full bg-black/40 backdrop-blur-sm">
        
        {/* LEFT SIDEBAR */}
        <aside className="border-r border-white/10 p-4 bg-black/30 overflow-auto h-full backdrop-blur-md">
          <h3 className="font-bold text-lg mb-4 text-white tracking-wide">API Tester</h3>
          
          {user ? (
            <div className="mb-4">
              <p className="text-sm font-semibold text-blue-200">Welcome, {user.email}</p>
              <button
                onClick={async () => {
                  try {
                    if (user) await logLogout(user);
                    await signOut(auth);
                  } catch (error) {
                    console.error("Logout failed:", error);
                  }
                }}
                className="text-red-400 text-xs underline mt-1 cursor-pointer hover:text-red-300"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mb-4">
              <button
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded font-medium border border-white/20 transition-colors"
                onClick={() => navigate("/login")}
              >
                Login
              </button>
              <button
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded font-medium border border-white/20 transition-colors"
                onClick={() => navigate("/signup")}
              >
                Sign Up
              </button>
            </div>
          )}

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full border border-white/20 rounded px-3 py-2 text-sm bg-black/40 text-white placeholder-white/60 focus:outline-none focus:border-blue-400 mb-4"
          />

          <div className="mb-4 flex gap-2 border-b border-white/10 pb-2">
            <button
              onClick={() => {
                setActiveSidebarTab("history");
                setHistoryOpen(true);
              }}
              className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                activeSidebarTab === "history"
                  ? "text-blue-300 border-b-2 border-blue-400"
                  : "text-white/70 hover:text-white"
              }`}
            >
              History
            </button>
            <button
              onClick={() => {
                setActiveSidebarTab("collections");
                setCollectionsOpen(true);
              }}
              className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                activeSidebarTab === "collections"
                  ? "text-blue-300 border-b-2 border-blue-400"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Collections
            </button>
          </div>

          <div className="mt-2 text-sm space-y-2">
            {activeSidebarTab === "history" && (
              <div>
                {(searchQuery.trim() ? filteredHistory : historyList).length ===
                0 ? (
                  <div className="text-xs text-gray-300 mt-2">No history yet</div>
                ) : (
                  (searchQuery.trim() ? filteredHistory : historyList).map(
                    (item) => (
                      <div
                        key={item.id || item.tempId}
                        onClick={() => handleHistorySelect(item)}
                        className="p-2 border border-white/10 rounded cursor-pointer hover:bg-white/10 bg-white/5 mb-2 transition-colors"
                      >
                        <div className="text-xs text-blue-300 font-bold mb-1">
                          {item.method}
                        </div>
                        <div className="text-xs break-all text-white">
                          {item.url}
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            )}

            {activeSidebarTab === "collections" && (
              <div className="flex flex-col gap-2">
                {/* --- ADD NEW COLLECTION INPUT --- */}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="New Collection Name"
                    className="flex-1 bg-black/20 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-white/50 focus:border-blue-400 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateCollection(e.target.value);
                        e.target.value = ''; // Clear input
                      }
                    }}
                  />
                  <button 
                    onClick={(e) => {
                        const input = e.target.previousSibling;
                        handleCreateCollection(input.value);
                        input.value = '';
                    }}
                    className="bg-blue-600/80 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 border border-white/10"
                  >
                    +
                  </button>
                </div>

                {filteredCollections.length === 0 ? (
                  <div className="text-xs text-gray-300 mt-2">
                    No matching collections
                  </div>
                ) : (
                  filteredCollections.map((col) => (
                    <div
                      key={col.id}
                      className="border border-white/10 rounded bg-white/5 mb-2 overflow-hidden"
                    >
                      <div
                        className="p-2 hover:bg-white/10 flex justify-between items-center cursor-pointer transition-colors"
                        onClick={() =>
                          setExpandedCollections((prev) => ({
                            ...prev,
                            [col.name]: !prev[col.name],
                          }))
                        }
                      >
                        <span className="font-medium text-white">{col.name}</span>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               handleDeleteCollection(col.id);
                             }}
                             className="text-red-400 hover:text-red-300 text-xs px-1"
                             title="Delete Collection"
                           >
                             🗑
                           </button>
                           <span className="text-sm text-gray-300">
                             {expandedCollections[col.name] ? "▾" : "▸"}
                           </span>
                        </div>
                      </div>
                      {expandedCollections[col.name] && (
                        <div className="bg-black/20 border-t border-white/10">
                          {col.items && col.items.length > 0 ? (
                            col.items.map((item) => (
                              <div
                                key={item.id}
                                className="p-2 hover:bg-white/5 flex justify-between items-start border-b border-white/5 last:border-0"
                              >
                                <div
                                  className="flex-1 cursor-pointer"
                                  onClick={() =>
                                    handleLoadSavedCollectionItem(item)
                                  }
                                >
                                  <div className="font-semibold text-xs text-white">
                                    {item.description}
                                  </div>
                                  <div className="text-xs text-gray-400 break-all">
                                    {item.request.url}
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSavedRequest(col.id, item.id);
                                  }}
                                  className="text-red-400 hover:text-red-300 ml-2"
                                >
                                  🗑
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="p-2 text-xs text-gray-400">
                              No saved requests
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        {/* MIDDLE: Request Builder */}
        <main className="flex flex-col min-h-0 bg-transparent relative">
          {/* Top Bar */}
          <div className="p-4 flex gap-2 items-center bg-transparent">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="border border-white/20 rounded px-3 py-2 bg-[#2d2d2d] text-white text-sm font-bold w-24 focus:outline-none"
            >
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
              <option>PATCH</option>
            </select>

            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter request URL..."
              className="flex-1 border border-white/20 rounded px-3 py-2 text-sm bg-black/50 text-white placeholder-white/50 focus:outline-none focus:border-blue-400"
            />

            <button
              onClick={sendRequest}
              disabled={loading}
              className="bg-[#2d2a26] text-white border border-white/20 px-5 py-2 rounded font-semibold hover:bg-[#3d3a36] transition-colors shadow-lg"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 px-4 mb-4">
            <button
              onClick={() => setActiveTab("params")}
              className={`px-4 py-1.5 rounded text-sm transition-colors ${
                activeTab === "params"
                  ? "bg-blue-600/80 text-white font-medium shadow-md"
                  : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white"
              }`}
            >
              Params
            </button>
            <button
              onClick={() => setActiveTab("headers")}
              className={`px-4 py-1.5 rounded text-sm transition-colors ${
                activeTab === "headers"
                  ? "bg-blue-600/80 text-white font-medium shadow-md"
                  : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white"
              }`}
            >
              Headers
            </button>
            <button
              onClick={() => setActiveTab("body")}
              className={`px-4 py-1.5 rounded text-sm transition-colors ${
                activeTab === "body"
                  ? "bg-blue-600/80 text-white font-medium shadow-md"
                  : "bg-black/30 text-white/70 hover:bg-black/50 hover:text-white"
              }`}
            >
              Body
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto px-4 pb-4">
            <div className="h-full rounded-lg bg-transparent">
              {activeTab === "params" && (
                <div className="text-white">
                  <ParamsSection params={params} setParams={setParams} />
                </div>
              )}

              {activeTab === "headers" && (
                <div className="text-white">
                  <div className="text-sm text-gray-300 mb-2 px-1">
                    Headers
                  </div>
                  <HeadersSection headers={headers} setHeaders={setHeaders} />
                </div>
              )}

              {activeTab === "body" && (
                <div className="h-full flex flex-col">
                  <div className="text-sm text-white/80 mb-2">
                    Request Body (JSON)
                  </div>
                  <div className="flex-1 border border-white/20 rounded overflow-hidden shadow-inner">
                    <AceEditor
                      mode="json"
                      theme="twilight"
                      name="body-editor"
                      fontSize={14}
                      width="100%"
                      height="100%"
                      value={body}
                      onChange={(val) => setBody(val)}
                      setOptions={{
                        useWorker: false,
                        showLineNumbers: true,
                        tabSize: 2,
                      }}
                      style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT: Response */}
        <aside className="border-l border-white/10 p-4 bg-transparent h-full overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Response</h3>
            <button
              onClick={() => setOpenSaveModal(true)}
              className="px-4 py-1.5 bg-[#3d3a36] text-white border border-white/20 rounded text-sm hover:bg-[#4d4a46] transition-colors shadow-md"
            >
              Save
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm mb-4">
            <span className="text-white/80">Status:</span>
            <span
              className={
                apiStatus >= 400
                  ? "text-red-400 font-bold"
                  : "text-green-400 font-bold"
              }
            >
              {apiStatus !== null ? apiStatus : "--"}
            </span>
            <span className="text-white/80">{apiStatusText}</span>
            {responseTime !== null && (
              <span className="text-white/60 text-xs ml-auto">
                ⏱ {responseTime}ms
              </span>
            )}
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setResponseTab("body")}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                responseTab === "body"
                  ? "bg-blue-600/80 text-white"
                  : "bg-black/30 text-white/70 hover:bg-black/50"
              }`}
            >
              Body
            </button>
            <button
              onClick={() => setResponseTab("headers")}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                responseTab === "headers"
                  ? "bg-blue-600/80 text-white"
                  : "bg-black/30 text-white/70 hover:bg-black/50"
              }`}
            >
              Headers
            </button>
          </div>

          <div className="flex-1 border border-white/20 rounded overflow-hidden bg-black/30 shadow-inner">
            {responseTab === "body" &&
              (response ? (
                <AceEditor
                  mode="json"
                  theme="twilight"
                  name="response-editor"
                  fontSize={14}
                  width="100%"
                  height="100%"
                  readOnly={true}
                  value={
                    typeof response === "string"
                      ? response
                      : JSON.stringify(response, null, 2)
                  }
                  setOptions={{ useWorker: false }}
                  style={{ backgroundColor: "transparent" }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-white/50">
                  No response yet
                </div>
              ))}

            {responseTab === "headers" && (
              <div className="p-4 h-full overflow-auto text-white">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {Object.entries(responseHeaders).map(
                    ([k, v]) => `${k}: ${v}\n`
                  )}
                </pre>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Save Modal */}
      {openSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999]">
          <div className="bg-[#1e1e1e] border border-white/10 p-6 rounded-lg w-96 shadow-2xl">
            <h2 className="text-xl font-semibold mb-4 text-white">
              Save Request
            </h2>

            <label className="block mb-1 text-sm font-medium text-white/80">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-white/20 rounded mb-4 bg-black/50 text-white focus:outline-none focus:border-blue-500"
              placeholder="e.g. User List API"
            />

            <label className="block mb-1 text-sm font-medium text-white/80">
              Collection
            </label>
            <select
              className="w-full px-3 py-2 border border-white/20 rounded mb-4 bg-black/50 text-white focus:outline-none focus:border-blue-500"
              value={selectedCollection}
              onChange={(e) => {
                setSelectedCollection(e.target.value);
                if (e.target.value !== "+new") setNewCollectionInput("");
              }}
            >
              <option value="">-- Select Collection --</option>
              {collections.map((col) => (
                <option key={col.id} value={col.name}>
                  {col.name}
                </option>
              ))}
              <option value="+new">+ Create New Collection</option>
            </select>

            {selectedCollection === "+new" && (
              <input
                className="w-full px-3 py-2 border border-white/20 rounded mb-4 bg-black/50 text-white focus:outline-none focus:border-blue-500"
                placeholder="Enter new collection name"
                value={newCollectionInput}
                onChange={(e) => setNewCollectionInput(e.target.value)}
              />
            )}

            {saveSuccess && (
              <div className="text-green-400 text-sm mb-2">{saveSuccess}</div>
            )}
            {saveError && (
              <div className="text-red-400 text-sm mb-2">{saveError}</div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setOpenSaveModal(false)}
                className="px-4 py-2 bg-transparent border border-white/20 text-white/80 rounded hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors shadow-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE VIEW */}
      <div className="md:hidden min-h-screen pb-16 bg-black/80 backdrop-blur-md">
        {mobileTab === "home" && (
          <div className="p-4 space-y-6">
            <h2 className="text-xl font-bold text-center text-white">
              API Tester
            </h2>
            {!user && (
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/login")}
                  className="w-full py-2 bg-blue-600 text-white rounded shadow-md"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate("/signup")}
                  className="w-full py-2 bg-transparent border border-white/20 text-white rounded"
                >
                  Sign Up
                </button>
              </div>
            )}
            <div className="border-b border-white/10 my-4"></div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="border border-white/20 rounded px-3 py-2 bg-black/50 text-white text-sm w-28"
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>DELETE</option>
                </select>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter request URL..."
                  className="flex-1 border border-white/20 rounded px-3 py-2 text-sm bg-black/50 text-white"
                />
              </div>
              <button
                onClick={sendRequest}
                disabled={loading}
                className="w-full py-2 bg-blue-600 text-white rounded font-semibold shadow-md"
              >
                {loading ? "Sending..." : "Send"}
              </button>
              <div className="flex gap-4 border-b border-white/10 pb-2">
                <button
                  onClick={() => setActiveTab("params")}
                  className={
                    activeTab === "params"
                      ? "font-bold text-blue-400"
                      : "text-gray-400"
                  }
                >
                  Params
                </button>
                <button
                  onClick={() => setActiveTab("headers")}
                  className={
                    activeTab === "headers"
                      ? "font-bold text-blue-400"
                      : "text-gray-400"
                  }
                >
                  Headers
                </button>
                <button
                  onClick={() => setActiveTab("body")}
                  className={
                    activeTab === "body"
                      ? "font-bold text-blue-400"
                      : "text-gray-400"
                  }
                >
                  Body
                </button>
              </div>
              {/* Mobile Tab Content */}
              <div className="min-h-[200px] text-white">
                {activeTab === "params" && (
                  <ParamsSection params={params} setParams={setParams} />
                )}
                {activeTab === "headers" && (
                  <HeadersSection headers={headers} setHeaders={setHeaders} />
                )}
                {activeTab === "body" && (
                  <AceEditor
                    mode="json"
                    theme="twilight"
                    className="border border-white/20 rounded"
                    width="100%"
                    height="300px"
                    value={body}
                    onChange={(val) => setBody(val)}
                    setOptions={{ useWorker: false }}
                    style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
        <MobileTabs activeTab={mobileTab} setActiveTab={setMobileTab} />
      </div>
    </div>
  );
}