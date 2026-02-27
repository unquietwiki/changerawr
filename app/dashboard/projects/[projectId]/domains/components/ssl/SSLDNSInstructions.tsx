'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { FileText, Copy, X, ArrowRight } from 'lucide-react'

interface SSLDNSInstructionsProps {
    txtName: string
    txtValue: string
    onVerify: () => void
    onBack: () => void
    onCopy: (text: string) => void
    isProcessing: boolean
}

export function SSLDNSInstructions({
    txtName,
    txtValue,
    onVerify,
    onBack,
    onCopy,
    isProcessing,
}: SSLDNSInstructionsProps) {
    return (
        <div className="space-y-4">
            <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="mb-2"
            >
                <X className="w-4 h-4 mr-2" />
                Cancel
            </Button>

            <div className="space-y-3">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold mb-1">Add DNS TXT Record</h3>
                        <p className="text-sm text-muted-foreground">
                            Add this TXT record to your DNS provider to verify ownership
                        </p>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-3 text-xs">
                            <div>
                                <span className="text-muted-foreground block mb-1">Type</span>
                                <code className="font-mono font-medium">TXT</code>
                            </div>
                            <div className="col-span-2">
                                <span className="text-muted-foreground block mb-1">Name</span>
                                <code className="font-mono text-xs break-all">{txtName}</code>
                            </div>
                        </div>
                        <Separator />
                        <div>
                            <span className="text-muted-foreground block mb-1 text-xs">Value</span>
                            <div className="bg-muted rounded p-2 font-mono text-xs break-all">
                                {txtValue}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCopy(txtValue)}
                            className="w-full"
                        >
                            <Copy className="w-3 h-3 mr-2" />
                            Copy Value
                        </Button>
                    </CardContent>
                </Card>

                <Alert variant="info">
                    <AlertDescription className="text-xs">
                        DNS changes can take 5-60 minutes to propagate. Click "Verify" once you've added the record.
                    </AlertDescription>
                </Alert>
            </div>

            <Button
                onClick={onVerify}
                disabled={isProcessing}
                className="w-full"
                size="lg"
            >
                {isProcessing ? 'Verifying...' : 'Verify DNS Record'}
                <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
        </div>
    )
}
