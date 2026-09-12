import { createSupabaseAdmin } from '../../lib/supabaseAdmin'
import nodemailer from 'nodemailer'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

const BOM_NOTIFICATION_EMAIL = 'sales@odiscom.com'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' })
  }

  const { fileName, fileUrl, storagePath, company, contactName, customerEmail, phone, notes } = req.body || {}

  if (!fileName || !company || !customerEmail || !notes) {
    return res.status(400).json({ success: false, message: 'Company, email, file name, and notes are required.' })
  }

  const combinedNotes = `Contact: ${contactName || 'N/A'}\nPhone: ${phone || 'N/A'}\nStorage Path: ${storagePath || 'N/A'}\n\n${notes}`
  const supabase = createSupabaseAdmin()

  const { data, error } = await supabase.from('material_uploads').insert([
    {
      file_name: fileName,
      file_url: fileUrl || '',
      company,
      customer_email: customerEmail,
      notes: combinedNotes,
      status: 'new',
    },
  ]).select().single()

  if (error) {
    return res.status(500).json({ success: false, message: error.message })
  }

  let notificationStatus = 'not_configured'

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })

      const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER
      const notificationEmail = process.env.NOTIFY_EMAIL || BOM_NOTIFICATION_EMAIL

      await transporter.sendMail({
        from: `Odiscom Supply <${fromAddress}>`,
        to: notificationEmail,
        replyTo: customerEmail,
        subject: `New BOM / Material Upload: ${company}`,
        text: `A new BOM or material upload request was submitted.\n\nCompany: ${company}\nContact: ${contactName || 'N/A'}\nEmail: ${customerEmail}\nPhone: ${phone || 'N/A'}\nFile: ${fileName}\nLink: ${fileUrl || 'N/A'}\nStorage Path: ${storagePath || 'N/A'}\n\nNotes:\n${notes}\n\nReview in Odiscom Supply Admin: https://www.odiscomsupply.com/admin/material-uploads`,
      })

      await transporter.sendMail({
        from: `Odiscom Supply <${fromAddress}>`,
        to: customerEmail,
        replyTo: notificationEmail,
        subject: `Material Upload Received (${data.id})`,
        text: `Thank you. Odiscom Supply received your material request ${data.id} for ${fileName}. Our team will review availability, verified supplier pricing, freight, and lead time before preparing a quote. Unknown costs will not be treated as $0. Please reference ${data.id} if you contact sales@odiscom.com.`,
      })

      notificationStatus = 'sent'
    } catch (notificationError) {
      console.error('BOM notification email failed', notificationError)
      notificationStatus = 'failed'
    }
  } else {
    console.warn('BOM notification email not sent because SMTP is not configured.')
  }

  return res.status(200).json({
    success: true,
    requestId: data.id,
    message: notificationStatus === 'sent'
      ? 'Material upload request received and confirmation email sent.'
      : 'Material upload request saved, but email delivery is unavailable.',
    notificationStatus,
  })
}
