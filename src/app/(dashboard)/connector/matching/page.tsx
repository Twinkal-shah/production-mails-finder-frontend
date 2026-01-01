'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

type Company = { company: string; website: string; industry: string }
type Match = { demandCompany: string; supplyCompany: string; score: number }

const demandList: Company[] = [
  { company: 'Finlytics', website: 'finlytics.com', industry: 'Fintech' },
  { company: 'CloudNest', website: 'cloudnest.dev', industry: 'Cloud' },
  { company: 'SalesWorks', website: 'salesworks.io', industry: 'SaaS' },
]

const supplyList: Company[] = [
  { company: 'Apollo', website: 'apollo.io', industry: 'Data' },
  { company: 'BuiltWith', website: 'builtwith.com', industry: 'Data' },
  { company: 'Crunchbase', website: 'crunchbase.com', industry: 'Data' },
]

export default function ConnectorMatchingPage() {
  const [isMatching, setIsMatching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<Match[]>([])

  const runMatch = async () => {
    setIsMatching(true)
    setResults([])
    setProgress(0)
    for (let i = 0; i < demandList.length; i++) {
      await new Promise((r) => setTimeout(r, 400))
      setProgress(Math.round(((i + 1) / demandList.length) * 100))
    }
    const generated: Match[] = demandList.map((d, i) => ({
      demandCompany: d.company,
      supplyCompany: supplyList[i % supplyList.length].company,
      score: Math.round(60 + Math.random() * 40),
    }))
    setResults(generated)
    setIsMatching(false)
  }

  const Table = ({ rows, side }: { rows: Company[]; side: 'Demand' | 'Supply' }) => (
    <Card>
      <CardHeader>
        <CardTitle>{side}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Company', 'Website', 'Industry'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-sm text-gray-700">{r.company}</td>
                  <td className="px-4 py-2 text-sm text-blue-600"><a href={`https://${r.website}`} target="_blank" rel="noreferrer">{r.website}</a></td>
                  <td className="px-4 py-2 text-sm text-gray-700">{r.industry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Matching Engine</h1>
        <p className="text-gray-600 mt-2">Match demand to supply sources.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Table rows={demandList} side="Demand" />
        <Table rows={supplyList} side="Supply" />
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={runMatch} disabled={isMatching}>Match Now</Button>
        {isMatching && <Progress value={progress} className="w-64" />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matched Results</CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="text-sm text-gray-600">No results yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Demand company', 'Supply company', 'Match score %'].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {results.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-sm text-gray-700">{r.demandCompany}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{r.supplyCompany}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{r.score}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

