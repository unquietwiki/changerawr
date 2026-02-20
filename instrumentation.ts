export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const {startBackgroundServices} = await import('@/app/startup')
        await startBackgroundServices()
    }
}
