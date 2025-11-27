| Domain     | Scope                          | Description                                                                 | Risk   |
|------------|--------------------------------|-----------------------------------------------------------------------------|--------|
| slack.com  | admin                          | Administer a workspace                                                      | High   |
| slack.com  | admin.analytics:read           | Access analytics data about the organization                                | Medium |
| slack.com  | admin.apps:read                | View apps and app requests in a workspace                                   | Medium |
| slack.com  | admin.apps:write               | Manage apps in a workspace                                                  | High   |
| slack.com  | admin.barriers:read            | Read information barriers in the organization                               | Medium |
| slack.com  | admin.barriers:write           | Manage information barriers in the organization                             | High   |
| slack.com  | admin.conversations:read       | View the channel’s member list, topic, purpose and channel name             | Medium |
| slack.com  | admin.conversations:write      | Start a new conversation, modify a conversation and modify channel details  | High   |
| slack.com  | admin.invites:read             | Gain information about invite requests in a Grid organization               | Medium |
| slack.com  | admin.invites:write            | Approve or deny invite requests in a Grid organization                      | High   |
| slack.com  | admin.teams:read               | Access information about a workspace                                        | Medium |
| slack.com  | admin.teams:write              | Make changes to a workspace                                                 | High   |
| slack.com  | admin.usergroups:read          | Access information about user groups                                        | Medium |
| slack.com  | admin.usergroups:write         | Make changes to your usergroups                                             | High   |
| slack.com  | admin.users:read               | Access a workspace’s profile information                                    | Medium |
| slack.com  | admin.users:write              | Modify account information                                                  | High   |
| slack.com  | app_configurations:read        | Read app configuration info via App Manifest APIs                           | Medium |
| slack.com  | app_configurations:write       | Write app configuration info and create apps via App Manifest APIs          | High   |
| slack.com  | app_mentions:read              | View messages that directly mention @your_slack_app                         | Low    |
| slack.com  | auditlogs:read                 | View events from all workspaces, channels and users                         | Medium |
| slack.com  | authorizations:read            | List authorizations associated with Events API                              | Medium |
| slack.com  | calls:read                     | View information about ongoing and past calls                               | Medium |
| slack.com  | calls:write                    | Start and manage calls in a workspace                                       | Medium |
| slack.com  | channels:history               | View messages and content in public channels your app is added to           | Medium |
| slack.com  | channels:join                  | Join public channels in a workspace                                         | Medium |
| slack.com  | channels:manage                | Manage public channels and create new ones                                  | Medium |
| slack.com  | channels:read                  | View basic information about public channels                                | Low    |
| slack.com  | channels:write                 | Manage a user’s public channels and create new ones                         | Low    |
| slack.com  | chat:write                     | Post messages in approved channels & conversations                          | Medium |
| slack.com  | chat:write.customize           | Send messages with customized username and avatar                           | Medium |
| slack.com  | chat:write.public              | Send messages to channels your app isn't a member of                        | Medium |
| slack.com  | chat:write                     | Send messages as your slack app                                             | Medium |
| slack.com  | chat:write                     | Send messages on a user’s behalf                                            | High   |
| slack.com  | commands                       | Add shortcuts and slash commands                                            | Low    |
| slack.com  | connections:write              | Generate websocket URIs for Socket Mode                                     | Medium |
| slack.com  | conversations.connect:manage   | Manage Slack Connect channels                                               | Medium |
| slack.com  | conversations.connect:read     | Receive Slack Connect invite events                                         | Medium |
| slack.com  | conversations.connect:write    | Create and accept Slack Connect invitations                                 | Medium |
| slack.com  | dnd:read                       | View Do Not Disturb settings                                                | Low    |
| slack.com  | dnd:write                      | Edit Do Not Disturb settings                                                | Low    |
| slack.com  | email                          | View a user’s email address                                                 | Low    |
| slack.com  | emoji:read                     | View custom emoji                                                           | Low    |
| slack.com  | files:read                     | View files shared in channels your app is in                                | Medium |
| slack.com  | files:write                    | Upload, edit, and delete files                                              | Medium |
| slack.com  | groups:history                 | View messages in private channels your app is added to                      | Medium |
| slack.com  | groups:read                    | View basic info about private channels                                      | Low    |
| slack.com  | groups:write                   | Manage private channels and create new ones                                 | Low    |
| slack.com  | identify                       | View a user’s identity                                                      | Low    |
| slack.com  | identity.avatar                | View a user’s Slack avatar                                                  | Low    |
| slack.com  | identity.avatar:read           | View the user's profile picture                                             | Low    |
| slack.com  | identity.basic                 | View identity info                                                          | Low    |
| slack.com  | identity.email                 | View a user’s email address                                                 | Low    |
| slack.com  | identity.team                  | View a user’s workspace name                                                | Low    |
| slack.com  | identity.team:read             | View workspace name, domain, and icon                                       | Low    |
| slack.com  | im:history                     | View direct messages your app is in                                         | Medium |
| slack.com  | im:read                        | View basic information about direct messages                                | Low    |
| slack.com  | im:write                       | Start direct messages                                                       | Medium |
| slack.com  | incoming-webhook               | Create incoming webhooks                                                    | Medium |
| slack.com  | links:read                     | View URLs in messages                                                       | Medium |
| slack.com  | links:write                    | Show previews of URLs                                                       | Medium |
| slack.com  | mpim:history                   | View content in group direct messages                                       | Low    |
| slack.com  | mpim:read                      | View basic info about group direct messages                                 | Low    |
| slack.com  | mpim:write                     | Start group direct messages                                                 | Medium |
| slack.com  | pins:read                      | View pinned content                                                         | Low    |
| slack.com  | pins:write                     | Add and remove pinned content                                               | Low    |
| slack.com  | profile                        | View avatar and workspace info                                              | Low    |
| slack.com  | reactions:read                 | View emoji reactions                                                        | Low    |
| slack.com  | reactions:write                | Add and edit emoji reactions                                                | Low    |
| slack.com  | reminders:read                 | View reminders                                                              | Low    |
| slack.com  | reminders:write                | Add, remove, or complete reminders                                          | Low    |
| slack.com  | remote_files:read              | View remote files                                                           | Medium |
| slack.com  | remote_files:share             | Share remote files on a user's behalf                                       | Medium |
| slack.com  | remote_files:write             | Add, edit, and delete remote files                                          | Medium |
| slack.com  | search:read                    | Search workspace content                                                    | Medium |
| slack.com  | stars:read                     | View starred messages and files                                             | Low    |
| slack.com  | stars:write                    | Add or remove stars                                                         | Low    |
| slack.com  | team.billing:read              | Read billing plan                                                           | Medium |
| slack.com  | team.preferences:read          | Read workspace preferences                                                  | Medium |
| slack.com  | team:read                      | View workspace name, email domain and icon                                  | Medium |
| slack.com  | tokens.basic                   | Execute methods without needing a scope                                     | High   |
| slack.com  | usergroups:read                | View user groups                                                            | Low    |
| slack.com  | usergroups:write               | Create and manage user groups                                               | Medium |
| slack.com  | users.profile:read             | View profile details                                                        | Low    |
| slack.com  | users.profile:write            | Edit a user’s profile and status                                            | Medium |
| slack.com  | users:read                     | View people in a workspace                                                  | Medium |
| slack.com  | users:read.email               | View emails of people                                                       | Medium |
| slack.com  | users:write                    | Set presence for your slack app                                             | Low    |
| slack.com  | workflow.steps:execute         | Add steps for Workflow Builder                                              | Medium |
