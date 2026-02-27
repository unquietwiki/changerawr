'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Zap, Globe, Check, ArrowLeft, Loader2 } from 'lucide-react'

interface SSLVerificationMethodProps {
    onSelectMethod: (method: 'HTTP01' | 'DNS01') => void
    onBack: () => void
    isProcessing: boolean
}

export function SSLVerificationMethod({
    onSelectMethod,
    onBack,
    isProcessing,
}: SSLVerificationMethodProps) {
    return (
        <div className="space-y-4">
            <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                disabled={isProcessing}
                className="mb-2"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
            </Button>

            <div className="text-center mb-6">
                <h3 className="text-lg font-bold mb-2">
                    {isProcessing ? 'Starting Certificate Issuance...' : 'Choose Verification Method'}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {isProcessing
                        ? 'Please wait while we initiate the SSL certificate process'
                        : 'How would you like to verify domain ownership?'}
                </p>
            </div>

            {isProcessing ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <>
                    {/* HTTP-01 Option */}
                    <button
                        onClick={() => onSelectMethod('HTTP01')}
                        className="w-full text-left p-4 rounded-xl border-2 border-border hover:border-blue-500 transition-all group bg-card"
                    >
                <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">HTTP-01 (Automatic)</p>
                            <Badge variant="secondary" className="text-xs">Recommended</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                            Fully automatic verification. Completes in seconds with no manual steps.
                        </p>
                        <div className="flex gap-2">
                            <Badge variant="outline" className="text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Instant
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Auto-Renewal
                            </Badge>
                        </div>
                    </div>
                </div>
            </button>

                    {/* DNS-01 Option */}
                    <button
                        onClick={() => onSelectMethod('DNS01')}
                        className="w-full text-left p-4 rounded-xl border-2 border-border hover:border-purple-500 transition-all group bg-card"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="font-semibold">DNS-01 (Manual)</p>
                                    <Badge variant="outline" className="text-xs">Advanced</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">
                                    Verify via DNS TXT record. Required for wildcard certificates.
                                </p>
                                <div className="flex gap-2">
                                    <Badge variant="outline" className="text-xs">
                                        DNS Access Required
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                        Manual Renewal
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </button>
                </>
            )}
        </div>
    )
}
