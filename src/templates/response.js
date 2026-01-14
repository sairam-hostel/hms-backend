function getActionResultHTML({ status, message }) {
  const config = {
    success: {
      title: "Action Completed Successfully",
      color: "#16a34a"
    },
    rejected: {
      title: "Request Rejected",
      color: "#dc2626"
    },
    done: {
      title: "Already Completed",
      color: "#6b7280"
    },
    error: {
      title: "Error",
      color: "#b91c1c"
    }
  };

  const cfg = config[status] || config.error;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${cfg.title}</title>

<style>
  body {
    font-family: Arial, sans-serif;
    background: #f8f9fa;
    margin: 0;
    padding: 40px;
    text-align: center;
    color: #333;
  }
  .container {
    max-width: 600px;
    margin: auto;
    background: #fff;
    padding: 32px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
  h1 {
    font-size: 1.8rem;
    margin-bottom: 16px;
    color: ${cfg.color};
  }
  p {
    font-size: 1rem;
    color: #555;
    line-height: 1.5;
  }
</style>
</head>

<body>
  <div class="container">
    <h1>${cfg.title}</h1>
    <p>${message || "Your action has been processed."}</p>
  </div>
</body>
</html>
`;
}

module.exports = getActionResultHTML;
