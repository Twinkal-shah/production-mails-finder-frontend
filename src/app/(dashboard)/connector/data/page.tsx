'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Row = {
  company: string
  website: string
  country: string
  industry: string
  size: string
}

const demandRows: Row[] = [
  { company: 'Acme SaaS', website: 'acme.io', country: 'USA', industry: 'SaaS', size: '50-100' },
  { company: 'Finlytics', website: 'finlytics.com', country: 'UK', industry: 'Fintech', size: '100-250' },
  { company: 'CloudNest', website: 'cloudnest.dev', country: 'Canada', industry: 'Cloud', size: '25-50' },
]

const supplyRows: Row[] = [
  { company: 'Apollo', website: 'apollo.io', country: 'USA', industry: 'Data', size: '500+' },
  { company: 'BuiltWith', website: 'builtwith.com', country: 'Australia', industry: 'Data', size: '50-100' },
  { company: 'Crunchbase', website: 'crunchbase.com', country: 'USA', industry: 'Data', size: '250-500' },
]

export default function ConnectorDataPage() {
  const Table = ({ rows }: { rows: Row[] }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {['Company', 'Website', 'Country', 'Industry', 'Size'].map((h) => (
              <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-4 py-2 text-sm text-gray-700">{r.company}</td>
              <td className="px-4 py-2 text-sm text-blue-600"><a href={`https://${r.website}`} target="_blank" rel="noreferrer">{r.website}</a></td>
              <td className="px-4 py-2 text-sm text-gray-700">{r.country}</td>
              <td className="px-4 py-2 text-sm text-gray-700">{r.industry}</td>
              <td className="px-4 py-2 text-sm text-gray-700">{r.size}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Connector OS Data</h1>
        <p className="text-gray-600 mt-2">View demand and supply datasets.</p>
      </div>

      <Tabs defaultValue="demand">
        <TabsList>
          <TabsTrigger value="demand">Demand</TabsTrigger>
          <TabsTrigger value="supply">Supply</TabsTrigger>
        </TabsList>
        <TabsContent value="demand">
          <Card>
            <CardHeader>
              <CardTitle>Demand</CardTitle>
            </CardHeader>
            <CardContent>
              <Table rows={demandRows} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="supply">
          <Card>
            <CardHeader>
              <CardTitle>Supply</CardTitle>
            </CardHeader>
            <CardContent>
              <Table rows={supplyRows} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

