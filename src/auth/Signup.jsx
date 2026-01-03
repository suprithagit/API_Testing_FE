import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { logSignup } from "../utils/logUserEvent";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Auto-redirect when success occurs
  useEffect(() => {
    if (success) {
      const timeout = setTimeout(() => navigate("/"), 1500);
      return () => clearTimeout(timeout);
    }
  }, [success, navigate]);

  const handleSignup = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    // Validate input
    if (!email || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    try {
      // 1️⃣ Create user in Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // 2️⃣ Log signup event
      try {
        await logSignup(userCredential.user);
      } catch (logError) {
        console.error("Failed to log signup event:", logError);
      }

      // 3️⃣ Success
      setSuccess("🎉 Account created successfully! Redirecting...");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: "url('/background.jpg')" }}
    >
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-md rounded-lg bg-black/80 p-8 shadow-2xl border border-white/10 backdrop-blur-sm">
        
        {/* Close Button */}
        <button
          onClick={() => navigate("/")}
          className="absolute top-4 right-4 text-white hover:text-gray-200 text-2xl font-bold transition-colors"
        >
          ×
        </button>

        {/* Header with Logo */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <span className="text-3xl">⚡</span>
          </div>
          <h2 className="text-2xl font-bold text-white">API Tester</h2>
          <p className="text-white text-sm opacity-90">Create a new account</p>
        </div>

        {/* Tabs (Sign In / Sign Up) */}
        <div className="flex border-b border-white/20 mb-6">
          <button
            onClick={() => navigate("/login")}
            className="w-1/2 py-2 font-semibold text-white/60 hover:text-orange-400 transition-colors"
          >
            Sign In
          </button>
          <button className="w-1/2 border-b-2 border-orange-500 py-2 font-bold text-white">
            Sign Up
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded bg-red-900/80 border border-red-500 p-3 text-sm text-white font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded bg-green-900/80 border border-green-500 p-3 text-sm text-white font-medium">
            {success}
          </div>
        )}

        {/* Form Inputs */}
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
              placeholder="Create a password"
              className="w-full rounded-md border border-white/20 bg-gray-900/60 px-4 py-2 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 backdrop-blur-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* Create Account Button */}
          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full rounded-md bg-orange-600 py-3 font-bold text-white transition hover:bg-orange-500 disabled:opacity-50 mt-4 shadow-lg"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </div>

        {/* Footer Link */}
        <div className="mt-6 text-center text-sm text-white">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-orange-400 hover:text-orange-300">
            Login
          </Link>
        </div>

      </div>
    </div>
  );
}