import { useState } from "react";
import { useApp } from "../context/useApp";

function LoginView() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    try {
      setError("");
      await login(email, password);
    } catch (e) {
      setError(e?.response?.data?.message || "Login failed");
    }
  }

  return (
    <main className="container">
      <h1>Mini IPL Turf Manager</h1>
      <form className="card grid login-card" onSubmit={onSubmit}>
        <h2>Login</h2>
        <input required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input required placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Sign in</button>
        {error && <small>{error}</small>}
      </form>
    </main>
  );
}

export default LoginView;
