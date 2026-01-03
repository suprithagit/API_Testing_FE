import React, { useState } from "react";
import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { logLogin } from "../utils/logUserEvent";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError(""); // Clear previous errors
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // ✅ Store login details inside Firestore -> loginDetails collection
      await logLogin(userCredential.user);

      navigate("/");
    } catch (err) {
      setError("Failed to login: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: "url('/background.jpg')" }}
    >
      {/* Dark Overlay to ensure text pops against the background image */}
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-md rounded-lg bg-black/80 p-8 shadow-2xl border border-white/10 backdrop-blur-sm">
        
        {/* Close Button */}
        <button
          onClick={() => navigate("/")}
          className="absolute top-4 right-4 text-white hover:text-gray-200 text-2xl font-bold transition-colors"
        >
          ×
        </button>

        {/* Header Section */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
             <span className="text-3xl">⚡</span>
          </div>
          <h2 className="text-2xl font-bold text-white">API Tester</h2>
          <p className="text-white text-sm opacity-90">Sign in to your account</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded bg-red-900/80 border border-red-500 p-3 text-sm text-white font-medium">
            {error}
          </div>
        )}

        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-white mb-1">Email</label>
            <input
              type="email"
              placeholder="name@example.com"
              className="w-full rounded-md border border-white/20 bg-gray-900/60 px-4 py-2 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 backdrop-blur-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-white mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-md border border-white/20 bg-gray-900/60 px-4 py-2 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 backdrop-blur-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="mt-1 text-right">
              <Link to="/forgot-password" className="text-sm text-orange-400 hover:text-orange-300 font-medium">
                Forgot Password?
              </Link>
            </div>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-md bg-orange-600 py-3 font-bold text-white transition hover:bg-orange-500 disabled:opacity-50 mt-4 shadow-lg"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </div>

        {/* Footer Links */}
        <div className="mt-6 text-center text-sm text-white">
          Don't have an account?{" "}
          <Link to="/signup" className="font-bold text-orange-400 hover:text-orange-300">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}