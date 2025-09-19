import {JobRunnerService} from '@/lib/services/jobs/job-runner.service';
import {TelemetryService} from '@/lib/services/telemetry/service';
import {spawn, exec} from 'child_process';
import path from 'path';
import {promisify} from 'util';

const execAsync = promisify(exec);

let servicesStarted = false;

interface EnvironmentValidationError extends Error {
    name: 'EnvironmentValidationError';
    missingVariables: string[];
}

function createEnvironmentError(missingVars: string[]): EnvironmentValidationError {
    const error = new Error(
        `FTB (Failure to Boot): Missing required environment variables: ${missingVars.join(', ')}`
    ) as EnvironmentValidationError;
    error.name = 'EnvironmentValidationError';
    error.missingVariables = missingVars;
    return error;
}

function validateEnvironment(): void {
    const requiredEnvVars = [
        'NEXT_PUBLIC_APP_URL',
        'DATABASE_URL',
        'JWT_ACCESS_SECRET',
        'ANALYTICS_SALT',
        'GITHUB_ENCRYPTION_KEY'
    ];

    const missingVars: string[] = [];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missingVars.push(envVar);
        }
    }

    if (missingVars.length > 0) {
        throw createEnvironmentError(missingVars);
    }
}

async function killErrorServer(): Promise<void> {
    try {
        // Kill any existing error server processes
        if (process.platform === 'win32') {
            // Windows
            await execAsync('taskkill /f /im node.exe /fi "WINDOWTITLE eq FTB Error Server*"').catch(() => {});
        } else {
            // Unix-like systems (Linux, macOS)
            await execAsync('pkill -f "scripts/ftb/server.js"').catch(() => {});
        }
        console.log('✓ Cleaned up any existing error servers');
    } catch (error) {
        // Ignore errors - error server might not be running
        console.log(error);
    }
}

function startErrorServer(missingVars: string[]): void {
    const serverPath = path.join(process.cwd(), 'scripts', 'ftb', 'server.js');

    console.log('\n🚨 LAUNCHING FAILURE TO BOOT ERROR SERVER 🚨');
    console.log('Terminating Next.js server to free port 3000...\n');

    // Kill the current process (Next.js server) after a short delay to allow logging
    setTimeout(() => {
        // Spawn the error server with missing variables as arguments
        const errorServer = spawn('node', [serverPath, ...missingVars], {
            stdio: 'inherit',
            cwd: process.cwd(),
            detached: true // Run independently of parent process
        });

        errorServer.on('error', (err) => {
            console.error('Failed to start error server:', err);
            console.error('Please check that scripts/ftb/server.js exists and is accessible.');
        });

        // Detach the error server so it continues running
        errorServer.unref();

        // Kill the Next.js process
        process.exit(1);
    }, 1000);
}

export async function startBackgroundServices(): Promise<void> {
    if (servicesStarted) {
        console.log('Background services already started');
        return;
    }

    console.log('Starting background services...');

    try {
        // Kill any existing error servers first
        await killErrorServer();

        // Validate environment before doing anything else
        validateEnvironment();
        console.log('✓ Environment validation passed');

        // Initialize telemetry system
        await TelemetryService.initialize();
        console.log('✓ Telemetry service initialized');

        // Start job runner (this will handle telemetry jobs and existing jobs)
        JobRunnerService.start(60000); // Check every minute
        console.log('✓ Job runner started');

        // Handle graceful shutdown
        const handleShutdown = async (signal: string): Promise<void> => {
            console.log(`Received ${signal}, shutting down gracefully...`);

            // Stop job runner
            JobRunnerService.stop();
            console.log('✓ Job runner stopped');

            // Handle telemetry shutdown
            await TelemetryService.shutdown();
            console.log('✓ Telemetry service shutdown complete');

            process.exit(0);
        };

        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));

        servicesStarted = true;
        console.log('✓ All background services started successfully');
    } catch (error) {
        if (error instanceof Error && error.name === 'EnvironmentValidationError') {
            const envError = error as EnvironmentValidationError;

            console.error('🚨 FTB Error:', error.message);
            console.error('Starting error server to guide you through setup...\n');

            // Start the error server instead of exiting
            startErrorServer(envError.missingVariables);

            // Don't exit - let the error server handle the user experience
            return;
        } else {
            console.error('Failed to start background services:', error);
            throw error; // Re-throw non-environment errors
        }
    }
}