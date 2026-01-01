'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type InboxItem = {
  id: string
  lead: string
  company: string
  reply: string
}

const inbox: InboxItem[] = [
  { id: '1', lead: 'Jane Doe', company: 'Acme SaaS', reply: 'Thanks for reaching out. We are interested in a demo.' },
  { id: '2', lead: 'Tom Lee', company: 'Finlytics', reply: 'Please send more details about integration.' },
  { id: '3', lead: 'Sara Ng', company: 'CloudNest', reply: 'We recently migrated tech, timing is perfect.' },
]

function suggestReply(text: string) {
  if (text.toLowerCase().includes('demo')) return 'Great! How about Thursday 2pm? Here is a calendar link.'
  if (text.toLowerCase().includes('details')) return 'Absolutely. Sharing a one-pager and integration docs. Any specific questions?'
  return 'Thanks for the update! Let’s explore fit and next steps.'
}

export default function ConnectorRepliesPage() {
  const [sentIds, setSentIds] = useState<string[]>([])

  const send = (id: string) => {
    setSentIds((prev) => [...prev, id])
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Replies</h1>
        <p className="text-gray-600 mt-2">Inbox-style view of lead replies.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {inbox.map((item) => (
              <div key={item.id} className="border rounded-md p-3 bg-white">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-700 font-medium">{item.lead} • {item.company}</div>
                  <Button size="sm" onClick={() => send(item.id)} disabled={sentIds.includes(item.id)}>
                    {sentIds.includes(item.id) ? 'Sent' : 'Send'}
                  </Button>
                </div>
                <div className="mt-2 text-sm text-gray-700">{item.reply}</div>
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1">AI suggested reply</div>
                  <div className="bg-gray-50 rounded-md p-2 text-sm text-gray-800">
                    {suggestReply(item.reply)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

