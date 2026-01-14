import nodemailer from "nodemailer";

// create reusable transporter object using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT),
  secure: process.env.MAIL_SECURE === "true", // false for STARTTLS
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// generic sendEmail function
export async function sendEmail({
  from = process.env.MAIL_FROM,
  to,
  subject,
  text,
  html,
  cc,
  bcc,
  attachments,
}) {
  try {
    const mailOptions = {
      from,      // sender
      to,        // single or comma-separated addresses
      subject,   // subject line
      text,      // plain text body
      html,      // html body
      cc,        // optional CC
      bcc,       // optional BCC
      attachments, // optional attachments
    };
    
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    console.error("Error sending email:", err);
    throw err;
  }
}
