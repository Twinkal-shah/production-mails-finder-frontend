'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

export default function ConnectorDashboardPage() {
  const metrics = [
    { label: 'Supply sources', value: 12 },
    { label: 'Demand sources', value: 8 },
    { label: 'Matched leads', value: 327 },
    { label: 'Routed leads', value: 214 },
    { label: 'Replies today', value: 19 },
  ]

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const lineData = {
    labels,
    datasets: [
      {
        label: 'Matches',
        data: [42, 51, 39, 68, 72, 80, 74],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.3,
      },
    ],
  }
  const barData = {
    labels,
    datasets: [
      {
        label: 'Replies',
        data: [3, 5, 2, 7, 6, 9, 8],
        backgroundColor: '#10b981',
      },
    ],
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Connector OS Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of supply, demand, matching, and replies.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader>
              <CardTitle className="text-sm text-gray-600">{m.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Matches per day</CardTitle>
          </CardHeader>
          <CardContent>
            <Line data={lineData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Replies per day</CardTitle>
          </CardHeader>
          <CardContent>
            <Bar data={barData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="supply" className="mt-2">
        <TabsList>
          <TabsTrigger value="supply">Supply Signals</TabsTrigger>
          <TabsTrigger value="demand">Demand Signals</TabsTrigger>
        </TabsList>
        <TabsContent value="supply">
          <Card>
            <CardHeader>
              <CardTitle>Recent Supply Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">Top sources: Apollo, BuiltWith, Crunchbase</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="demand">
          <Card>
            <CardHeader>
              <CardTitle>Recent Demand Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">Top intents: funding, hiring, tech migrations</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

