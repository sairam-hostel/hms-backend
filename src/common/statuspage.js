// statusPage.js
function formatSeconds(sec) {
  const hours   = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  return String(hours).padStart(2, "0") + ":" +
         String(minutes).padStart(2, "0") + ":" +
         String(seconds).padStart(2, "0");
}

function getStatusPage(username, serverInfo = {}) {
  const { nodeVersion = process.version, time = new Date().toISOString() } = serverInfo;
  const uptimeSeconds = process.uptime();      // seconds since process started
  const uptimeStr = formatSeconds(uptimeSeconds);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server Status</title>
  <style>
    /* Reset & base */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f4f6f8;
      color: #333;
      padding: 0;
    }
    .container {
      max-width: 700px;
      margin: 40px auto;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      padding: 24px;
    }
    header { text-align: center; margin-bottom: 24px; }
    header h1 { font-size: 1.8rem; color: #2c3e50; margin-bottom: 8px; }
    header .sub { color: #666; font-size: 0.9rem; }
    .info p { margin: 8px 0; font-size: 1rem; }
    .info strong { color: #2c3e50; }
    .btn-refresh {
      display: inline-block;
      margin-top: 16px;
      padding: 8px 16px;
      font-size: 0.9rem;
      background: #3498db;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .btn-refresh:hover { background: #2980b9; }
    .footer { text-align: center; font-size: 0.85rem; color: #888; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>✅ Server Running</h1>
      <div class="sub">Status page — updated: ${time}</div>
    </header>

    <div class="info">
      <p><strong>Last production push by:</strong> ${username}</p>
      <p><strong>Node version:</strong> ${nodeVersion}</p>
      <p><strong>Uptime:</strong> ${uptimeStr}</p>
    </div>

    <div style="margin-top: 20px; text-align: center;">
      <button class="btn-refresh" onclick="location.reload()">Refresh</button>
    </div>

    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} — MTech Cse (5 Years Integrated)</p>
    </div>
  </div>
</body>
</html>
`;
}

module.exports = { getStatusPage };
