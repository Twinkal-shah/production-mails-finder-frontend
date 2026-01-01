'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useConnector } from '@/components/providers/connector-provider'

export default function ConnectorSetupPage() {
  const { apiKeys, datasetIds, outreachPlatform, setApiKeys, setDatasetIds, setOutreachPlatform } = useConnector()
  const [step, setStep] = useState(1)

  const next = () => setStep((s) => Math.min(s + 1, 3))
  const prev = () => setStep((s) => Math.max(s - 1, 1))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Connector OS Setup</h1>
        <p className="text-gray-600 mt-2">Configure tools, datasets, and outreach platform.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step {step} of 3</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="apolloKey">Apollo API Key</Label>
                <Input id="apolloKey" value={apiKeys.apollo || ''} onChange={(e) => setApiKeys({ apollo: e.target.value })} placeholder="sk_************************" />
              </div>
              <div>
                <Label htmlFor="mfKey">Mailsfinder API Key</Label>
                <Input id="mfKey" value={apiKeys.mailsfinder || ''} onChange={(e) => setApiKeys({ mailsfinder: e.target.value })} placeholder="mf_************************" />
              </div>
              <div>
                <Label htmlFor="apifyKey">Apify API Key</Label>
                <Input id="apifyKey" value={apiKeys.apify || ''} onChange={(e) => setApiKeys({ apify: e.target.value })} placeholder="apify_************************" />
              </div>
              <div>
                <Label htmlFor="smartleadKey">Smartlead API Key</Label>
                <Input id="smartleadKey" value={apiKeys.smartlead || ''} onChange={(e) => setApiKeys({ smartlead: e.target.value })} placeholder="sl_************************" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="demandId">Demand Dataset ID</Label>
                <Input id="demandId" value={datasetIds.demand || ''} onChange={(e) => setDatasetIds({ demand: e.target.value })} placeholder="dataset_123" />
              </div>
              <div>
                <Label htmlFor="supplyId">Supply Dataset ID</Label>
                <Input id="supplyId" value={datasetIds.supply || ''} onChange={(e) => setDatasetIds({ supply: e.target.value })} placeholder="dataset_456" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Outreach platform</Label>
                <div className="space-y-2">
                  {(['Smartlead', 'Instantly', 'Plusvibe'] as const).map((opt) => (
                    <label key={opt} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="outreach"
                        value={opt}
                        checked={outreachPlatform === opt}
                        onChange={() => setOutreachPlatform(opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="text-sm text-gray-600">
                Settings are saved in your browser and will be used across Connector OS pages.
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={prev} disabled={step === 1}>Back</Button>
            {step < 3 ? (
              <Button onClick={next}>Next</Button>
            ) : (
              <Button onClick={() => { /* data already persisted by state change */ }}>Finish</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

