import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import { getSettings } from './db'

let imapClient: ImapFlow | null = null

export function isGmailConnected(): boolean {
  const { email_address, app_password } = getSettings()
  return !!(email_address && app_password)
}

export async function connectGmail(): Promise<{ success: boolean; error?: string }> {
  try {
    const { email_address, app_password } = getSettings()
    if (!email_address || !app_password) return { success: false, error: 'Missing credentials' }
    
    const cleanPassword = app_password.replace(/\s+/g, '')
    imapClient = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: email_address, pass: cleanPassword },
      logger: false
    })
    
    imapClient.on('error', (err) => {
      console.error('ImapFlow error:', err)
    })
    
    await imapClient.connect()
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export function disconnectGmail(): void {
  if (imapClient) {
    imapClient.logout().catch(() => {})
    imapClient = null
  }
}

export async function getImapClient(): Promise<ImapFlow> {
  if (!imapClient) {
    const res = await connectGmail()
    if (!res.success) throw new Error(res.error)
  }
  return imapClient!
}

export interface ParsedMessage {
  gmail_id: string
  thread_id: string
  from_address: string
  from_name: string | null
  subject: string
  snippet: string
  body_text: string | null
  received_at: number
  label_ids: string[]
}

async function parseImapMessage(msg: any): Promise<ParsedMessage> {
  const parsed = await simpleParser(msg.source)
  const fromAddr = parsed.from?.value[0]?.address || ''
  const fromName = parsed.from?.value[0]?.name || null
  const subject = parsed.subject || ''
  const text = parsed.text || ''
  const snippet = text.substring(0, 200).replace(/\s+/g, ' ').trim()
  
  return {
    gmail_id: String(msg.uid),
    thread_id: String(msg.uid),
    from_address: fromAddr,
    from_name: fromName,
    subject,
    snippet,
    body_text: text,
    received_at: msg.internalDate ? msg.internalDate.getTime() : Date.now(),
    label_ids: Array.from(msg.flags || [])
  }
}

export async function fetchMessage(gmailId: string): Promise<ParsedMessage | null> {
  const client = await getImapClient()
  const lock = await client.getMailboxLock('INBOX')
  try {
    const msg = await client.fetchOne(gmailId, { source: true, uid: true, flags: true, internalDate: true }, { uid: true })
    if (!msg) return null
    return await parseImapMessage(msg)
  } catch (err) {
    console.error('fetchMessage error', err)
    return null
  } finally {
    lock.release()
  }
}

export async function listMessageIds(query: string, maxResults = 100): Promise<string[]> {
  return []
}

export async function fetchRecentMessages(days: number): Promise<ParsedMessage[]> {
  const client = await getImapClient()
  const lock = await client.getMailboxLock('INBOX')
  const messages: ParsedMessage[] = []
  try {
    const since = new Date()
    since.setDate(since.getDate() - days)
    for await (const msg of client.fetch({ since }, { source: true, uid: true, flags: true, internalDate: true }, { uid: true })) {
      messages.push(await parseImapMessage(msg))
    }
  } catch (err) {
  } finally {
    lock.release()
  }
  return messages
}

export async function fetchSentMessages(days: number): Promise<ParsedMessage[]> {
  const client = await getImapClient()
  let lock;
  try {
    lock = await client.getMailboxLock('[Gmail]/Sent Mail')
  } catch (e) {
    try { lock = await client.getMailboxLock('Sent') } catch(e2) { return [] }
  }
  
  const messages: ParsedMessage[] = []
  try {
    const since = new Date()
    since.setDate(since.getDate() - days)
    for await (const msg of client.fetch({ since }, { source: true, uid: true, flags: true, internalDate: true }, { uid: true })) {
      messages.push(await parseImapMessage(msg))
    }
  } catch (err) {
  } finally {
    if (lock) lock.release()
  }
  return messages
}

export async function fetchHistoryChanges(startHistoryId: string): Promise<{ messages: ParsedMessage[]; newHistoryId: string }> {
  const client = await getImapClient()
  const lock = await client.getMailboxLock('INBOX')
  const messages: ParsedMessage[] = []
  let newHistoryId = startHistoryId
  try {
    const nextUid = parseInt(startHistoryId || '0') + 1
    for await (const msg of client.fetch({ uid: `${nextUid}:*` }, { source: true, uid: true, flags: true, internalDate: true }, { uid: true })) {
      messages.push(await parseImapMessage(msg))
      if (msg.uid > parseInt(newHistoryId || '0')) {
        newHistoryId = String(msg.uid)
      }
    }
  } catch (err) {
    return { messages: await fetchRecentMessages(7), newHistoryId: startHistoryId }
  } finally {
    lock.release()
  }
  return { messages, newHistoryId }
}

export async function createOrGetLabel(labelName: string): Promise<string> {
  const client = await getImapClient()
  try {
    await client.mailboxCreate(labelName)
  } catch (e) {
  }
  return labelName
}

export async function applyLabelToMessage(gmailId: string, labelId: string): Promise<void> {
  const client = await getImapClient()
  const lock = await client.getMailboxLock('INBOX')
  try {
    await client.messageCopy(gmailId, labelId, { uid: true })
  } finally {
    lock.release()
  }
}

export async function archiveMessage(gmailId: string): Promise<void> {
  const client = await getImapClient()
  const lock = await client.getMailboxLock('INBOX')
  try {
    await client.messageDelete(gmailId, { uid: true })
  } finally {
    lock.release()
  }
}

export async function createDraft(threadId: string, replyText: string, toAddress: string, subject: string): Promise<void> {
  const client = await getImapClient()
  const subjectPrefix = subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`
  const rawMsg = [
    `To: ${toAddress}`,
    `Subject: ${subjectPrefix}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    replyText
  ].join('\r\n')

  await client.append('[Gmail]/Drafts', rawMsg, ['\\Draft'])
}

export async function getProfileHistoryId(): Promise<string> {
  const client = await getImapClient()
  const lock = await client.getMailboxLock('INBOX')
  try {
    const next = (client.mailbox && typeof client.mailbox === 'object' && 'uidNext' in client.mailbox) 
      ? client.mailbox.uidNext 
      : '0'
    return String(next)
  } finally {
    lock.release()
  }
}
