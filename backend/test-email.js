require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendLicenseEmail({ email, name, licenseKey, plan }) {
  try {
    const data = await resend.emails.send({
      from: 'NovaSift <noreply@thesidejob.tech>',
      to: email,
      subject: '🎉 Your NovaSift Pro License Key',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 40px; border-radius: 12px;">
          <h1 style="color: #ffffff; font-size: 24px;">Welcome to NovaSift Pro</h1>
          <p style="color: #a0a0a0;">Hi ${name}, your payment was successful. Here is your license key:</p>
          <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <code style="font-size: 22px; color: #6366f1; letter-spacing: 3px; font-weight: bold;">
              ${licenseKey}
            </code>
          </div>
          <p style="color: #a0a0a0;">
            <strong style="color: #fff;">How to activate:</strong><br/>
            1. Open NovaSift on your desktop<br/>
            2. Go to Settings → License<br/>
            3. Paste your key and click Activate
          </p>
          <p style="color: #a0a0a0;">
            Plan: <strong style="color: #fff;">${plan === 'lifetime' ? 'Lifetime (never expires)' : 'Pro Monthly'}</strong>
          </p>
          <hr style="border-color: #222; margin: 32px 0;"/>
          <p style="color: #555; font-size: 12px;">
            Save this email. If you need to activate on a new device, visit thesidejob.tech/account or email support@thesidejob.tech
          </p>
        </div>
      `
    });
    console.log("Email sent successfully:", data);
  } catch (error) {
    console.error('Failed to send license email', error);
  }
}

sendLicenseEmail({ 
    email: 'pateldev2317@gmail.com', 
    name: 'Dev Patel', 
    licenseKey: 'NOVA-TEST-ABCD-1234-EFGH', 
    plan: 'monthly' 
});
