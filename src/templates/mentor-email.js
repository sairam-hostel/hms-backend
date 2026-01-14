export const mentorEmailTemplate = ({
  mentorName,
  studentName,
  leaveType,
  approvalLink,
  expiry
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Leave/Outpass Approval</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      padding: 0;
      margin: 0;
    }
    .container {
      padding: 20px;
    }
    .btn {
      display: inline-block;
      padding: 12px 20px;
      background-color: #2563eb;
      color: #fff;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
    }
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: #888888;
    }
  </style>
</head>
<body>
  <div class="container">
    <p>Hello ${mentorName},</p>

    <p>
      You have a new <strong>${leaveType}</strong> request from
      <strong>${studentName}</strong>:
    </p>

    <p>
      Please review and respond using the button below:
    </p>

    <p>
      <a href="${approvalLink}" class="btn">
        Review Request
      </a>
    </p>

    <p class="footer">
      This link expires in approximately ${expiry}.
    </p>
  </div>
</body>
</html>
`;
