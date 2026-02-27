'use client'

import { Badge } from '@/components/ui/badge'
import { Shield, Zap, Upload, Check, ArrowRight } from 'lucide-react'

interface SSLModeSelectorProps {
    onSelectMode: (mode: 'LETS_ENCRYPT' | 'EXTERNAL') => void
}

export function SSLModeSelector({ onSelectMode }: SSLModeSelectorProps) {
    return (
        <div className="space-y-3">
            <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Shield className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Enable SSL Certificate</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Secure your domain with HTTPS. Choose how you want to manage your SSL certificate.
                </p>
            </div>

            {/* Let's Encrypt Option */}
            <button
                onClick={() => onSelectMode('LETS_ENCRYPT')}
                className="w-full text-left p-5 rounded-xl border-2 border-border hover:border-blue-500 hover:shadow-lg transition-all group bg-card"
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-md">
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <p className="font-bold text-lg">Let's Encrypt</p>
                            <Badge className="bg-blue-600">Recommended</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            Free SSL certificates with automatic renewal. Perfect for most use cases.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Free Forever
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Auto-Renewal
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Trusted by Browsers
                            </Badge>
                        </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>
            </button>

            {/* External Certificate Option */}
            <button
                onClick={() => onSelectMode('EXTERNAL')}
                className="w-full text-left p-5 rounded-xl border-2 border-border hover:border-purple-500 hover:shadow-lg transition-all group bg-card"
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-md">
                        <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <p className="font-bold text-lg">Provider-Managed SSL</p>
                            <Badge variant="outline">External</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            SSL certificate managed by your hosting provider or CDN.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">
                                Provider Managed
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                No Configuration
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                                Third-Party SSL
                            </Badge>
                        </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                </div>
            </button>
        </div>
    )
}
