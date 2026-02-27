'use client'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, X } from 'lucide-react'

interface SSLVerificationProgressProps {
    type: 'http01' | 'dns01'
    onCancel: () => void
}

export function SSLVerificationProgress({ type, onCancel }: SSLVerificationProgressProps) {
    return (
        <div className="space-y-4">
            <Alert variant="info" icon={<RefreshCw className="h-4 w-4 animate-spin" />}>
                <AlertDescription>
                    <p className="font-medium">
                        {type === 'http01' ? 'Verifying Domain...' : 'Verifying DNS Record...'}
                    </p>
                    <p className="text-sm mt-1">
                        {type === 'http01'
                            ? 'Automatically verifying your domain ownership. This usually takes 10-30 seconds.'
                            : 'Checking DNS records and issuing certificate. This may take a minute.'
                        }
                    </p>
                </AlertDescription>
            </Alert>

            <Button variant="outline" onClick={onCancel} className="w-full">
                <X className="w-4 h-4 mr-2" />
                Cancel
            </Button>
        </div>
    )
}
