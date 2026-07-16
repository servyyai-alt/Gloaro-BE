require("dotenv").config({ override: true });
const { sendTemplateEmail } = require("../src/utils/email");

async function test() {
  try {
    console.log("Testing email send...");
    console.log("SMTP_HOST:", process.env.SMTP_HOST);
    console.log("SMTP_PORT:", process.env.SMTP_PORT);
    console.log("SMTP_SECURE:", process.env.SMTP_SECURE);
    console.log("SMTP_USER:", process.env.SMTP_USER);
    console.log("EMAIL_FROM:", process.env.EMAIL_FROM);
    console.log("EMAIL_FROM_NAME:", process.env.EMAIL_FROM_NAME);
    console.log("SMTP_FROM:", process.env.SMTP_FROM);

    const result = await sendTemplateEmail(
      "dharanidwork2024@gmail.com",
      "welcome",
      "Test User"
    );
    console.log("Email sent successfully!", result);
  } catch (error) {
    console.error("Test email failed with error:", error);
  }
}

test();
