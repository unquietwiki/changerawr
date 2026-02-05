import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy Gravatar images to avoid tracking prevention blocks
 * GET /api/avatar/[hash]
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ hash: string }> }
) {
    try {
        const { hash } = await context.params;

        // Validate hash format (MD5 hex)
        if (!/^[a-f0-9]{32}$/i.test(hash)) {
            return new NextResponse('Invalid avatar hash', { status: 400 });
        }

        // Get size from query params, default to 200, max 2048
        const { searchParams } = new URL(req.url);
        const sizeParam = searchParams.get('s') || '200';
        const size = Math.min(parseInt(sizeParam, 10) || 200, 2048);

        // Fetch from Gravatar
        const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?d=mp&s=${size}`;
        const response = await fetch(gravatarUrl, {
            headers: {
                'User-Agent': 'Changerawr'
            }
        });

        if (!response.ok) {
            return new NextResponse('Avatar not found', { status: 404 });
        }

        // Get image data
        const imageBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // Return with proper caching headers
        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
                'CDN-Cache-Control': 'public, max-age=604800',
            },
        });
    } catch (error) {
        console.error('Error proxying avatar:', error);
        return new NextResponse('Error loading avatar', { status: 500 });
    }
}
