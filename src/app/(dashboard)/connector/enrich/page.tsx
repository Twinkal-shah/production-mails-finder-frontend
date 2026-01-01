'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'

type Mapping = { source: string; target: string }
const targets = [
  'Lead First Name',
  'Company',
  'Verified Email',
  'Tech Stack',
]

export default function ConnectorEnrichPage() {
  const [mappings, setMappings] = useState<Mapping[]>([
    { source: 'Apollo.first_name', target: 'Lead First Name' },
    { source: 'Apollo.company', target: 'Company' },
    { source: 'Mailsfinder.email', target: 'Verified Email' },
    { source: 'BuiltWith.tech', target: 'Tech Stack' },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<string[]>([])

  const updateTarget = (index: number, target: string) => {
    setMappings((prev) => prev.map((m, i) => (i === index ? { ...m, target } : m)))
  }

  const fakeAction = async (kind: 'decision-makers' | 'verify-emails') => {
    setIsLoading(true)
    setResults([])
    setProgress(0)
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 300))
      setProgress(Math.round(((i + 1) / 5) * 100))
    }
    setResults(
      kind === 'decision-makers'
        ? ['VP Marketing', 'Head of Sales', 'CTO']
        : ['jane@acme.io ✓', 'tom@finlytics.com ✓', 'dev@cloudnest.dev ✗']
    )
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Enrich & Mapping</h1>
        <p className="text-gray-600 mt-2">Configure field mappings and run enrichment.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Field Mappings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mappings.map((m, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div className="text-sm text-gray-700">{m.source}</div>
              <div>
                <Select value={m.target} onValueChange={(v) => updateTarget(i, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <Button onClick={() => fakeAction('decision-makers')} disabled={isLoading}>Find decision-makers</Button>
            <Button onClick={() => fakeAction('verify-emails')} disabled={isLoading} variant="outline">Find & verify emails</Button>
            {isLoading && <Progress value={progress} className="w-48" />}
          </div>

          {results.length > 0 && (
            <div className="mt-4 text-sm text-gray-700">
              Results: {results.join(', ')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
