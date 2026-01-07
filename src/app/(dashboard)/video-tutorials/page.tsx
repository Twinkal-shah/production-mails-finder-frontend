'use client'

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'

export default function VideoTutorialsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Video Tutorials</h1>
        <p className="mt-2 text-gray-600">
          Tutorials to help you get the most from MailsFinder across all plans.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="relative aspect-video">
            <iframe
              title="MailsFinder Tutorial 1"
              src="https://www.loom.com/embed/d7cc3e82b3b14610a2ae75da438e5d40"
              className="absolute inset-0 w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <CardHeader>
            <CardTitle className="text-lg">Tutorial 1</CardTitle>
            <CardDescription>Watch this Loom video to learn more.</CardDescription>
          </CardHeader>
        </Card>
        <Card className="overflow-hidden">
          <div className="relative aspect-video">
            <iframe
              title="MailsFinder Tutorial 2"
              src="https://www.loom.com/embed/c501feb401304a518ce37e84792ca77d"
              className="absolute inset-0 w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <CardHeader>
            <CardTitle className="text-lg">Tutorial 2</CardTitle>
            <CardDescription>Watch this Loom video to learn more.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <div className="flex items-start gap-4">
          <Users className="h-6 w-6 text-blue-600 mt-1" />
          <div>
            <h3 className="font-semibold text-blue-900">Available For All Plans</h3>
            <p className="text-blue-700 mt-1">
              Free, Pro, Agency, and Lifetime users can access these tutorials.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
