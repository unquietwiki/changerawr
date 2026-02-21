import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { validateAuthAndGetUser } from '@/lib/utils/changelog'
import { createAuditLog } from '@/lib/utils/auditLog' // Add this import

// Validation schema for project settings
const projectSettingsSchema = z.object({
    name: z.string().min(1).optional(),
    isPublic: z.boolean().optional(),
    allowAutoPublish: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
    defaultTags: z.array(z.string()).optional(),
})

/**
 * @method GET
 * @description Retrieves the project settings for a given project
 * @query {
 *   projectId: String, required
 * }
 * @response 200 {
 *   "type": "object",
 *   "properties": {
 *     "id": { "type": "string" },
 *     "name": { "type": "string" },
 *     "isPublic": { "type": "boolean" },
 *     "allowAutoPublish": { "type": "boolean" },
 *     "requireApproval": { "type": "boolean" },
 *     "defaultTags": { "type": "array", "items": { "type": "string" } },
 *     "updatedAt": { "type": "string", "format": "date-time" }
 *   }
 * }
 * @error 400 Invalid request data
 * @error 403 Unauthorized - User does not have 'ADMIN' role
 * @error 404 Project not found
 * @error 500 An unexpected error occurred while fetching the project settings
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await (async () => context.params)();
        const user = await validateAuthAndGetUser()

        const project = await db.project.findUnique({
            where: {
                id: projectId
            },
            select: {
                id: true,
                name: true,
                isPublic: true,
                allowAutoPublish: true,
                requireApproval: true,
                defaultTags: true,
                updatedAt: true,
            }
        })

        if (!project) {
            // Log attempt to view non-existent project
            try {
                await createAuditLog(
                    'PROJECT_NOT_FOUND',
                    user.id,
                    user.id, // Use user's own ID to avoid foreign key issues
                    {
                        action: 'VIEW_PROJECT_SETTINGS',
                        requestedProjectId: projectId,
                        timestamp: new Date().toISOString()
                    }
                );
            } catch (auditLogError) {
                console.error('Failed to create audit log:', auditLogError);
            }

            return new NextResponse(
                JSON.stringify({ error: 'Project not found' }),
                { status: 404 }
            )
        }

        // Log project settings view
        try {
            await createAuditLog(
                'VIEW_PROJECT_SETTINGS',
                user.id,
                user.id, // Use user's own ID to avoid foreign key issues
                {
                    projectId: project.id,
                    projectName: project.name,
                    timestamp: new Date().toISOString()
                }
            );
        } catch (auditLogError) {
            console.error('Failed to create audit log:', auditLogError);
        }

        return new NextResponse(JSON.stringify(project), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        console.error('Failed to fetch project settings:', error)

        // Log error
        try {
            const user = await validateAuthAndGetUser();
            await createAuditLog(
                'PROJECT_SETTINGS_ERROR',
                user.id,
                user.id, // Use user's own ID to avoid foreign key issues
                {
                    action: 'VIEW_PROJECT_SETTINGS',
                    projectId: (await context.params).projectId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                    timestamp: new Date().toISOString()
                }
            );
        } catch (auditLogError) {
            console.error('Failed to create audit log:', auditLogError);
        }

        return new NextResponse(
            JSON.stringify({ error: 'Failed to fetch project settings' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
}

/**
 * @method PATCH
 * @description Updates the project settings for a given project
 * @query {
 *   projectId: String, required
 * }
 * @body {
 *   "type": "object",
 *   "properties": {
 *     "name": { "type": "string" },
 *     "isPublic": { "type": "boolean" },
 *     "allowAutoPublish": { "type": "boolean" },
 *     "requireApproval": { "type": "boolean" },
 *     "defaultTags": {
 *       "type": "array",
 *       "items": { "type": "string" }
 *     }
 *   },
 *   "required": [
 *     "name"
 *   ]
 * }
 * @response 200 {
 *   "type": "object",
 *   "properties": {
 *     "id": { "type": "string" },
 *     "name": { "type": "string" },
 *     "isPublic": { "type": "boolean" },
 *     "allowAutoPublish": { "type": "boolean" },
 *     "requireApproval": { "type": "boolean" },
 *     "defaultTags": { "type": "array", "items": { "type": "string" } },
 *     "updatedAt": { "type": "string", "format": "date-time" }
 *   }
 * }
 * @error 400 Invalid request data
 * @error 403 Unauthorized - User does not have 'ADMIN' role
 * @error 404 Project not found
 * @error 500 An unexpected error occurred while updating the project settings
 */
export async function PATCH(
    request: Request,
    context: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await (async () => context.params)();
        const user = await validateAuthAndGetUser()

        // Log update attempt
        try {
            await createAuditLog(
                'PROJECT_SETTINGS_UPDATE_ATTEMPT',
                user.id,
                user.id, // Use user's own ID to avoid foreign key issues
                {
                    projectId,
                    timestamp: new Date().toISOString()
                }
            );
        } catch (auditLogError) {
            console.error('Failed to create update attempt audit log:', auditLogError);
        }

        // Get and validate request body
        const body = await request.json()
        const validatedData = projectSettingsSchema.parse(body)

        // Access settings (isPublic, allowAutoPublish, requireApproval) are admin-only
        const accessFields = ['isPublic', 'allowAutoPublish', 'requireApproval'] as const
        if (user.role !== 'ADMIN') {
            const attemptedAccessChange = accessFields.find(field => validatedData[field] !== undefined)
            if (attemptedAccessChange) {
                return new NextResponse(
                    JSON.stringify({ error: 'Only administrators can modify access settings' }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                )
            }
        }

        // Fetch current project to ensure it exists
        const existingProject = await db.project.findUnique({
            where: {
                id: projectId
            }
        })

        if (!existingProject) {
            // Log attempt to update non-existent project
            try {
                await createAuditLog(
                    'PROJECT_NOT_FOUND',
                    user.id,
                    user.id, // Use user's own ID to avoid foreign key issues
                    {
                        action: 'UPDATE_PROJECT_SETTINGS',
                        requestedProjectId: projectId,
                        timestamp: new Date().toISOString()
                    }
                );
            } catch (auditLogError) {
                console.error('Failed to create project not found audit log:', auditLogError);
            }

            return new NextResponse(
                JSON.stringify({ error: 'Project not found' }),
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                }
            )
        }

        // Track changes for audit log
        const changes: Record<string, { from: unknown; to: unknown }> = {};

        if (validatedData.name !== undefined && validatedData.name !== existingProject.name) {
            changes.name = {
                from: existingProject.name,
                to: validatedData.name
            };
        }

        if (validatedData.isPublic !== undefined && validatedData.isPublic !== existingProject.isPublic) {
            changes.isPublic = {
                from: existingProject.isPublic,
                to: validatedData.isPublic
            };
        }

        if (validatedData.allowAutoPublish !== undefined && validatedData.allowAutoPublish !== existingProject.allowAutoPublish) {
            changes.allowAutoPublish = {
                from: existingProject.allowAutoPublish,
                to: validatedData.allowAutoPublish
            };
        }

        if (validatedData.requireApproval !== undefined && validatedData.requireApproval !== existingProject.requireApproval) {
            changes.requireApproval = {
                from: existingProject.requireApproval,
                to: validatedData.requireApproval
            };
        }

        if (validatedData.defaultTags !== undefined) {
            const currentTags = existingProject.defaultTags || [];
            const newTags = validatedData.defaultTags;

            // Check if tags have changed
            if (JSON.stringify(currentTags.sort()) !== JSON.stringify(newTags.sort())) {
                changes.defaultTags = {
                    from: currentTags,
                    to: newTags
                };
            }
        }

        // Update project settings
        const updatedProject = await db.project.update({
            where: {
                id: projectId
            },
            data: {
                ...validatedData,
                updatedAt: new Date()
            },
            select: {
                id: true,
                name: true,
                isPublic: true,
                allowAutoPublish: true,
                requireApproval: true,
                defaultTags: true,
                updatedAt: true,
            }
        })

        // Create specific audit log action based on what changed
        let auditAction = 'UPDATE_PROJECT_SETTINGS';

        // If only one thing changed, use a more specific audit action
        if (Object.keys(changes).length === 1) {
            const changedField = Object.keys(changes)[0];

            if (changedField === 'name') {
                auditAction = 'RENAME_PROJECT';
            } else if (changedField === 'isPublic') {
                auditAction = validatedData.isPublic ? 'MAKE_PROJECT_PUBLIC' : 'MAKE_PROJECT_PRIVATE';
            } else if (changedField === 'allowAutoPublish') {
                auditAction = validatedData.allowAutoPublish ? 'ENABLE_AUTO_PUBLISH' : 'DISABLE_AUTO_PUBLISH';
            } else if (changedField === 'requireApproval') {
                auditAction = validatedData.requireApproval ? 'ENABLE_APPROVAL_REQUIREMENT' : 'DISABLE_APPROVAL_REQUIREMENT';
            }
        }

        // Log project settings update
        try {
            await createAuditLog(
                auditAction,
                user.id,
                user.id, // Use user's own ID to avoid foreign key issues
                {
                    projectId: updatedProject.id,
                    projectName: updatedProject.name,
                    changes,
                    changeCount: Object.keys(changes).length,
                    timestamp: new Date().toISOString()
                }
            );
        } catch (auditLogError) {
            console.error('Failed to create update audit log:', auditLogError);
        }

        return new NextResponse(JSON.stringify(updatedProject), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (error) {
        console.error('Failed to update project settings:', error)

        if (error instanceof z.ZodError) {
            // Log validation error
            try {
                const user = await validateAuthAndGetUser();
                await createAuditLog(
                    'PROJECT_SETTINGS_VALIDATION_ERROR',
                    user.id,
                    user.id, // Use user's own ID to avoid foreign key issues
                    {
                        projectId: (await context.params).projectId,
                        validationErrors: error.errors,
                        timestamp: new Date().toISOString()
                    }
                );
            } catch (auditLogError) {
                console.error('Failed to create validation error audit log:', auditLogError);
            }

            return new NextResponse(
                JSON.stringify({
                    error: 'Invalid request data',
                    details: error.errors
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                }
            )
        }

        // Log general error
        try {
            const user = await validateAuthAndGetUser();
            await createAuditLog(
                'PROJECT_SETTINGS_ERROR',
                user.id,
                user.id, // Use user's own ID to avoid foreign key issues
                {
                    action: 'UPDATE_PROJECT_SETTINGS',
                    projectId: (await context.params).projectId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    stack: error instanceof Error ? error.stack : undefined,
                    timestamp: new Date().toISOString()
                }
            );
        } catch (auditLogError) {
            console.error('Failed to create error audit log:', auditLogError);
        }

        return new NextResponse(
            JSON.stringify({ error: 'Failed to update project settings' }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        )
    }
}