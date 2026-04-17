import { prisma } from '@/lib/prisma'

interface WhatsAppMessage {
  phone: string
  message: string
  customerId: string
  templateName?: string
  metadata?: Record<string, any>
}

interface WhatsAppResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendWhatsAppMessage(data: WhatsAppMessage): Promise<WhatsAppResult> {
  const { phone, message, customerId, templateName } = data
  
  try {
    const formattedPhone = formatSriLankaPhone(phone)
    
    const result = await sendViaWhatsAppAPI({
      phone: formattedPhone,
      message,
    })

    await prisma.customerCommunication.create({
      data: {
        customerId,
        channel: 'WHATSAPP',
        direction: 'OUTBOUND',
        content: message,
        subject: templateName || 'WhatsApp Message',
        status: result.success ? 'SENT' : 'FAILED',
        externalId: result.messageId,
        externalStatus: result.success ? 'DELIVERED' : 'FAILED',
        errorMessage: result.error,
        templateId: templateName,
        templateName: templateName,
      },
    })

    return result
  } catch (error: any) {
    await prisma.customerCommunication.create({
      data: {
        customerId,
        channel: 'WHATSAPP',
        direction: 'OUTBOUND',
        content: message,
        status: 'FAILED',
        errorMessage: error.message,
      },
    })

    return {
      success: false,
      error: error.message,
    }
  }
}

function formatSriLankaPhone(phone: string): string {
  let formatted = phone.replace(/[^0-9]/g, '')
  
  if (formatted.startsWith('0')) {
    formatted = '94' + formatted.substring(1)
  }
  
  if (!formatted.startsWith('94')) {
    formatted = '94' + formatted
  }
  
  return formatted + '@c.us'
}

async function sendViaWhatsAppAPI(data: { phone: string; message: string }): Promise<WhatsAppResult> {
  console.log('WhatsApp message would be sent:', data)
  
  return {
    success: true,
    messageId: `wa_${Date.now()}`,
  }
}

export async function sendBulkWhatsApp(
  customerIds: string[],
  message: string,
  templateName?: string,
  sentById?: string,
  sentByEmail?: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = { sent: 0, failed: 0, errors: [] as string[] }
  
  for (const customerId of customerIds) {
    try {
      const customer = await prisma.customerProfile.findUnique({
        where: { id: customerId },
        include: { user: true },
      })
      
      if (!customer?.user?.phone) {
        results.failed++
        results.errors.push(`Customer ${customerId}: No phone number`)
        continue
      }

      const result = await sendWhatsAppMessage({
        phone: customer.user.phone,
        message,
        customerId,
        templateName,
      })
      
      if (result.success) {
        results.sent++
      } else {
        results.failed++
        results.errors.push(`Customer ${customerId}: ${result.error}`)
      }
    } catch (error: any) {
      results.failed++
      results.errors.push(`Customer ${customerId}: ${error.message}`)
    }
  }
  
  return results
}