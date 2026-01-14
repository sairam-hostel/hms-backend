function hodEmailTemplate({
  hodName,
  studentName,
  leaveType,
  fromDate,
  toDate,
  approvalLink
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Leave / Outpass HOD Approval</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
    a.btn {
      display: inline-block;
      padding: 10px 16px;
      background: #2563eb;
      color: #fff;
      text-decoration: none;
      border-radius: 5px;
      font-weight: bold;
    }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>

  <p>Hello ${hodName},</p>

  <p>
    A leave/outpass request from <strong>${studentName}</strong> needs your review:
  </p>

  <p>
    <strong>Type:</strong> ${leaveType}<br>
    <strong>From:</strong> ${fromDate}<br>
    <strong>To:</strong> ${toDate}
  </p>

  <p>
    <a href="${approvalLink}" class="btn">Review Request</a>
  </p>

  <p class="footer">
    You can use this link to respond anytime.
  </p>

</body>
</html>
`;
}

module.exports = hodEmailTemplate;
