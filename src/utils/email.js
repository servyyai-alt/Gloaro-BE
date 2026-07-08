const nodemailer = require("nodemailer");
const logger = require("./logger");

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html, text, attachments }) => {
  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text,
      attachments,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error("Email send failed:", error.message);
    throw error;
  }
};

// Email templates
const emailTemplates = {
  emailVerification: (name, token) => ({
    subject: "Verify Your Email - Vendor Directory",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Verify Your Email</h2>
        <p>Hi ${name},</p>
        <p>Click the button below to verify your email address:</p>
        <a href="${process.env.CLIENT_URL}/verify-email/${token}"
           style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          Verify Email
        </a>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      </div>`,
  }),

  resetPassword: (name, token) => ({
    subject: "Reset Your Password - Vendor Directory",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Reset Password</h2>
        <p>Hi ${name},</p>
        <p>Click the button below to reset your password:</p>
        <a href="${process.env.CLIENT_URL}/reset-password/${token}"
           style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          Reset Password
        </a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
      </div>`,
  }),

  otp: (name, otp) => ({
    subject: "Your OTP - Vendor Directory",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Your OTP</h2>
        <p>Hi ${name},</p>
        <p>Your One-Time Password is:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;background:#f3f4f6;padding:20px;text-align:center;border-radius:8px;margin:16px 0">
          ${otp}
        </div>
        <p>This OTP expires in ${process.env.OTP_EXPIRE_MINUTES || 10} minutes.</p>
      </div>`,
  }),

  vendorApproved: (businessName) => ({
    subject: "Your Vendor Account is Approved! - Vendor Directory",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#16a34a">Congratulations! Your Vendor Account is Approved</h2>
        <p>Hi ${businessName},</p>
        <p>Your vendor account has been approved. You can now list your products and services.</p>
        <a href="${process.env.CLIENT_URL}/vendor/dashboard"
           style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          Go to Dashboard
        </a>
      </div>`,
  }),

  membershipExpiry: (name, plan, daysLeft) => ({
    subject: `Membership Expiring Soon - ${daysLeft} Days Left`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#d97706">Membership Expiring Soon</h2>
        <p>Hi ${name},</p>
        <p>Your <strong>${plan}</strong> membership expires in <strong>${daysLeft} days</strong>.</p>
        <a href="${process.env.CLIENT_URL}/membership/renew"
           style="display:inline-block;background:#d97706;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          Renew Now
        </a>
      </div>`,
  }),

  newLead: (vendorName, leadName, phone) => ({
    subject: "New Enquiry Received - Vendor Directory",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">New Enquiry Received</h2>
        <p>Hi ${vendorName},</p>
        <p>You have received a new enquiry from <strong>${leadName}</strong>.</p>
        <p>Phone: <strong>${phone}</strong></p>
        <a href="${process.env.CLIENT_URL}/vendor/leads"
           style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          View Lead
        </a>
      </div>`,
  }),

  membershipApplicationNew: (name, applicationNumber, chapterName) => ({
    subject: `New Membership Application Submitted - ${applicationNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">New Membership Application</h2>
        <p>Hi ${name},</p>
        <p>A new membership application with number <strong>${applicationNumber}</strong> has been submitted for chapter <strong>${chapterName}</strong>.</p>
        <p>Please log in to your dashboard to review it.</p>
        <a href="${process.env.CLIENT_URL}/admin"
           style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          Review Application
        </a>
      </div>`,
  }),

  membershipApplicationApproved: (name, applicationNumber, memberId) => ({
    subject: "Your Membership Application is Approved! - Gloaro Network",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#16a34a">Congratulations! Your Application is Approved</h2>
        <p>Hi ${name},</p>
        <p>Your membership application <strong>${applicationNumber}</strong> has been approved.</p>
        <p>Your unique Member ID is: <strong>${memberId}</strong></p>
        <p>Welcome to the Gloaro Network community!</p>
        <a href="${process.env.CLIENT_URL}"
           style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          Access Platform
        </a>
      </div>`,
  }),

  membershipApplicationRejected: (name, applicationNumber, reason) => ({
    subject: "Membership Application Status Update - Gloaro Network",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#dc2626">Application Update</h2>
        <p>Hi ${name},</p>
        <p>Your membership application <strong>${applicationNumber}</strong> was not approved at this time.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Please log in and update your onboarding portfolio to resubmit.</p>
        <a href="${process.env.CLIENT_URL}/membership-application"
           style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          Update Portfolio
        </a>
      </div>`,
  }),

  adminCredentials: (name, email, password, officialId) => ({
    subject: "Your Gloaro Official Account Credentials",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Welcome to Gloaro Network</h2>
        <p>Hi ${name},</p>
        <p>An official account has been created for you. Here are your temporary login credentials:</p>
        <p><strong>Official ID:</strong> ${officialId}</p>
        <p><strong>Login Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> ${password}</p>
        <p>Please log in and change your password immediately.</p>
        <a href="${process.env.CLIENT_URL}/login"
           style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          Log In Now
        </a>
      </div>`,
  }),

  welcome: (name) => ({
    subject: "Welcome to Gloaro Network!",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Welcome, ${name}!</h2>
        <p>Your account has been registered successfully. We are excited to have you join our network.</p>
        <p>Explore the marketplace, connect with other members, and make the most of your journey.</p>
        <a href="${process.env.CLIENT_URL}/login"
           style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          Get Started
        </a>
      </div>`,
  }),

  meetingInvitation: (name, title, date, venue) => ({
    subject: `Meeting Invitation: ${title}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Meeting Invitation</h2>
        <p>Hi ${name},</p>
        <p>You are invited to the upcoming meeting: <strong>${title}</strong></p>
        <p><strong>Date & Time:</strong> ${date}</p>
        <p><strong>Venue:</strong> ${venue}</p>
        <p>Please log in to your portal to RSVP or view details.</p>
        <a href="${process.env.CLIENT_URL}"
           style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
          View Portal
        </a>
      </div>`,
  }),
};

const sendTemplateEmail = async (to, template, ...args) => {
  const { subject, html } = emailTemplates[template](...args);
  return sendEmail({ to, subject, html });
};

module.exports = { sendEmail, sendTemplateEmail, emailTemplates };
