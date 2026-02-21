// app/api/auth/settings/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateAuthAndGetUser } from '@/lib/utils/changelog';

/**
 * @method GET
 * @description Retrieves or creates the user's settings
 * @path /api/settings
 * @response 200 {
 *   "type": "object",
 *   "properties": {
 *     "id": { "type": "string" },
 *     "userId": { "type": "string" },
 *     "theme": { "type": "string", "enum": ["light", "dark"] },
 *     "name": { "type": "string" },
 *     "enableNotifications": { "type": "boolean" }
 *   }
 * }
 * @error 401 Unauthorized - User not authenticated
 * @error 500 An unexpected error occurred while fetching settings
 */
export async function GET() {
    try {
        const user = await validateAuthAndGetUser();

        const settings = await db.settings.findUnique({
            where: { userId: user.id },
        });

        if (!settings) {
            // Create default settings if they don't exist
            const defaultSettings = await db.settings.create({
                data: {
                    userId: user.id,
                    theme: 'light',
                    enableNotifications: true,
                },
            });
            return NextResponse.json(defaultSettings);
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Failed to fetch settings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

/**
 * @method PATCH
 * @description Updates the user's settings
 * @path /api/settings
 * @request {json}
 * @response 200 {
 *   "type": "object",
 *   "properties": {
 *     "id": { "type": "string" },
 *     "userId": { "type": "string" },
 *     "theme": { "type": "string", "enum": ["light", "dark"] },
 *     "name": { "type": "string" },
 *     "enableNotifications": { "type": "boolean" }
 *   }
 * }
 * @error 400 Invalid request data
 * @error 401 Unauthorized - User not authenticated
 * @error 500 An unexpected error occurred while updating settings
 */
export async function PATCH(request: Request) {
    try {
        const user = await validateAuthAndGetUser();
        const data = await request.json();

        // Validate the request data
        const validUpdates: {
            theme?: string;
            name?: string;
            enableNotifications?: boolean;
            timezone?: string | null;
        } = {};

        if (data.theme && ['light', 'dark'].includes(data.theme)) {
            validUpdates.theme = data.theme;
        }

        if (data.enableNotifications !== undefined) {
            validUpdates.enableNotifications = Boolean(data.enableNotifications);
        }

        if (data.timezone !== undefined) {
            // null clears the override (use system default), string sets it
            validUpdates.timezone = data.timezone === null ? null : String(data.timezone);
        }

        if (data.name !== undefined) {
            // Update user name
            await db.user.update({
                where: { id: user.id },
                data: { name: data.name },
            });
        }

        if (Object.keys(validUpdates).length > 0) {
            // Update settings
            const settings = await db.settings.upsert({
                where: { userId: user.id },
                create: {
                    userId: user.id,
                    theme: validUpdates.theme || 'light',
                    enableNotifications: validUpdates.enableNotifications !== undefined ? validUpdates.enableNotifications : true,
                },
                update: validUpdates,
            });

            return NextResponse.json(settings);
        }

        return NextResponse.json(
            { error: 'No valid updates provided' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Failed to update settings:', error);
        return NextResponse.json(
            { error: 'Failed to update settings' },
            { status: 500 }
        );
    }
}