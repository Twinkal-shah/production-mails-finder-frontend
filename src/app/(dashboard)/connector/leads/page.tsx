'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Lead = {
  id: string
  first: string
  last: string
  company: string
  role: string
  email: string
  status: string
  funding: string
  tech: string
}

const mockLeads: Lead[] = [
  { id: '1', first: 'Jane', last: 'Doe', company: 'Acme SaaS', role: 'VP Marketing', email: 'jane@acme.io', status: 'new', funding: 'Series B', tech: 'HubSpot, Segment' },
  { id: '2', first: 'Tom', last: 'Lee', company: 'Finlytics', role: 'Head of Sales', email: 'tom@finlytics.com', status: 'new', funding: 'Seed', tech: 'Salesforce, Outreach' },
  { id: '3', first: 'Sara', last: 'Ng', company: 'CloudNest', role: 'CTO', email: 'sara@cloudnest.dev', status: 'new', funding: 'A', tech: 'AWS, Snowflake' },
]

export default function ConnectorLeadsPage() {
  const [selected, setSelected] = useState<string[]>([])
  const [campaign, setCampaign] = useState<string>('')
  const [isRouting, setIsRouting] = useState(false)
  const [progress, setProgress] = useState(0)

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const routeAll = async () => {
    if (!campaign) return
    setIsRouting(true)
    setProgress(0)
    for (let i = 0; i < mockLeads.length; i++) {
      await new Promise((r) => setTimeout(r, 400))
      setProgress(Math.round(((i + 1) / mockLeads.length) * 100))
    }
    setIsRouting(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
        <p className="text-gray-600 mt-2">Review and route leads to campaigns.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lead List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <Select value={campaign} onValueChange={setCampaign}>
              <SelectTrigger>
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {['Q1 Outreach', 'Beta Launch', 'Reactivation'].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={routeAll} disabled={!campaign || isRouting}>👉 Route all</Button>
            {isRouting && <Progress value={progress} className="w-48" />}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['', 'First name', 'Last name', 'Company', 'Role', 'Email', 'Status', 'Funding', 'Tech'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {mockLeads.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2"><input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} /></td>
                    <td className="px-4 py-2 text-sm text-gray-700">{l.first}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{l.last}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{l.company}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{l.role}</td>
                    <td className="px-4 py-2 text-sm text-blue-600">{l.email}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{l.status}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{l.funding}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{l.tech}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

