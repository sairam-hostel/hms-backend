// =============================================================
// Simple HTML Pages for Mentor/HOD Responses
// =============================================================

function htmlPage(title, message) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
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
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 { margin-bottom: 16px; font-size: 1.8rem; }
    p { font-size: 1rem; color: #555; }
    .btn {
      display: inline-block;
      margin-top: 24px;
      padding: 10px 18px;
      background: #2563eb;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>
`;
}

module.exports = {
  successPage: (msg) =>
    htmlPage("Action Completed Successfully", msg || "Your action was recorded."),
  rejectPage: (msg) =>
    htmlPage("Action Rejected", msg || "You have rejected this request."),
  donePage: (msg) =>
    htmlPage("Already Completed", msg || "This request has already been handled."),
  errorPage: (msg) =>
    htmlPage("Error", msg || "Something went wrong. Please try again."),
};
