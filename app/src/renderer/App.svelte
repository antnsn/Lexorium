<script>
  let message = 'Lexorium — Svelte migration in progress';
</script>

<div class="container">
  <div class="sidebar">
    <h1 class="logo">Lexorium</h1>
    <p class="status">✓ Svelte + Vite working</p>
  </div>
  <div class="main">
    <h2>{message}</h2>
    <p>Build tooling verified. Components coming next.</p>
  </div>
</div>

<style>
  .container {
    display: flex;
    height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .sidebar {
    width: 240px;
    background: #2E3235;
    color: #D1D5DB;
    padding: 24px 16px;
  }
  .logo {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0 0 16px 0;
  }
  .status {
    font-size: 0.85rem;
    color: #6BCB77;
  }
  .main {
    flex: 1;
    padding: 32px;
    background: #fff;
  }
  h2 {
    font-size: 1.3rem;
    margin: 0 0 8px 0;
    color: #1A1D20;
  }
  p {
    color: #6B7280;
    margin: 0;
  }
</style>
