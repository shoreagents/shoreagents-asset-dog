import { Resend } from 'resend'

// Initialize Resend client (only if API key is available)
let resend: Resend | null = null

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY)
} else {
  console.warn('RESEND_API_KEY is not configured. Email functionality will be disabled.')
}

/**
 * Send automated report via email
 */
export async function sendAutomatedReportEmail(params: {
  to: string[]
  reportName: string
  reportType: string
  format: string
  attachment?: {
    filename: string
    content: Buffer | string
  }
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY || !resend) {
      const errorMsg = 'Email service not configured. Please set RESEND_API_KEY environment variable.'
      console.error('[REPORT EMAIL]', errorMsg)
      return { success: false, error: errorMsg }
    }

    const { to, reportName, reportType, format, attachment } = params
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Asset Dog'

    const emailPayload: any = {
      from: fromEmail,
      to,
      subject: `${reportName} - ${siteName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${reportName}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">${siteName}</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
              <h2 style="color: #333; margin-top: 0;">Automated Report</h2>
              <p style="color: #666; font-size: 16px;">
                Your scheduled report <strong>${reportName}</strong> has been generated and is attached to this email.
              </p>
              <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
                <p style="margin: 5px 0;"><strong>Report Type:</strong> ${reportType}</p>
                <p style="margin: 5px 0;"><strong>Format:</strong> ${format.toUpperCase()}</p>
                <p style="margin: 5px 0;"><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                This is an automated email. Please do not reply to this message.
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
    }

    // Add attachment if provided
    if (attachment) {
      emailPayload.attachments = [
        {
          filename: attachment.filename,
          content: attachment.content instanceof Buffer 
            ? attachment.content 
            : typeof attachment.content === 'string'
            ? Buffer.from(attachment.content, 'base64')
            : Buffer.from(attachment.content),
        },
      ]
    }

    const result = await resend.emails.send(emailPayload)

    if (result.error) {
      let errorMessage = result.error.message || 'Failed to send email'
      
      if (result.error.message?.includes('only send testing emails')) {
        errorMessage = 'Email service is in testing mode. To send emails to any recipient, please verify a domain at resend.com/domains and set RESEND_FROM_EMAIL environment variable to use that domain.'
      } else if (result.error.message?.includes('domain') || result.error.message?.includes('verify')) {
        errorMessage = 'Email domain not verified. Please verify your domain at resend.com/domains and update RESEND_FROM_EMAIL.'
      }
      
      console.error('[REPORT EMAIL] Failed to send automated report email:', errorMessage)
      return { success: false, error: errorMessage }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending automated report email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

