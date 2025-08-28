> [!Important]
> ### Ongoing development ready in 1-3 days.. 98% done!
>
> If you want to test it now feel free to create an issue if you have any tips or implementations i can improve :)
> Install deno
> ```
> cd /path/to/your/repo
> export DISCORD_TOKEN="your-token"
> export APPLICATION_ID="your-app-id"
> ./index.ts --category projectname --user-id Your_Discord_User_ID_Here
> ```
> You can run without `--user-id Your_Discord_User_ID_Here` if you dont want to be notified when claude finishes

![zebbern](https://github.com/user-attachments/assets/0c9bab6d-a423-4b48-a7a1-b227fb1d5c9b)

<div align="center">

# claude-code-discord

**[Prerequisites](#pre)** | **[Setup Discord Bot](#setup)** | **[Run Discord Bot](#)** | **[How To Use](#)** 


![Status](https://img.shields.io/badge/Status-Active-green)

<kbd>

| Advantage                                   | Details                                                                                     | Status |
|---------------------------------------------|---------------------------------------------------------------------------------------------|:------:|
| Use Claude Code Anywhere                    | Host locally (VM / Docker / cloud) and send commands via the Discord API                    | ✅     |
| Centralized collaboration                   | Run commands and discuss results where your team already communicates                       | ✅     |
| Branch-aware organization                   | Maps Git branches to channels/categories so feature work stays separated                    | ✅     |
| Immediate, shareable feedback               | Execute `/git`, `/shell`, or `/claude` and get outputs directly in-channel                  | ✅     |
| Reduced context switching                   | Keep actions, logs, and discussion together — less switching between terminal and chat      | ✅     |
| Role-based access control                   | Restrict destructive commands (`/shell`, `/git`, worktree ops) to specific Discord roles    | ✅     |
| Non-developer friendly                      | PMs, QA, and stakeholders can trigger checks and view results without repo access          | ✅     |
| Automatable touchpoint                      | Integrate with CI/webhooks to triage issues and run fixes from chat                        | ✅     |
| Local hosting & security                    | Keep keys and code on your infra while exposing a controlled interface through Discord      | ✅     |
| Audit trail & accountability                | Channel history provides an easy-to-search record of who ran what and when                 | ✅     |

</kbd>


</div>





<h2 id="pre">Prerequisites</h2>

> [!Note]
> **Clone the project:**
> ```
> git clone https://github.com/zebbern/claude-code-discord.git
> cd claude-code-discord
> ```
> **Install claude `If you dont have it` and login:**
> ```
> npm install -g @anthropic-ai/claude-code
> claude /login
> ```

<h1 id="setup">Setup Discord Bot</h1>

<h2 id="1">1. Create a Discord Application</h2>

> [!Note]
> - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
> - Click <kbd>New Application</kbd>
> - Give your application a name (e.g., <kbd>ClaudeCode</kbd>)
> - Click <kbd>Create</kbd>
>
> <img width="500" height="500" alt="app-create" src="https://github.com/user-attachments/assets/ee8bdf4e-9bbf-4d01-8046-a182ca6d5da9" />

<h2 id="2">2. Copy Application ID (Needed For Config)</h2>

> [!Note]
> - Go to the <kbd>OAuth2</kbd> → <kbd>URL Generator</kbd> section
> - Under <kbd>Scopes</kbd> select:
> <img width="800" height="500" alt="APPLICATION_ID" src="https://github.com/user-attachments/assets/3ad02111-0a9f-4f0f-8a77-d61841f6dd27" />

<h2 id="3">3. Create a Bot User</h2>

> [!Note]
> - In your application, go to the <kbd>Bot</kbd> section in the left sidebar
> - Click <kbd>Add Bot</kbd>
> - Under <kbd>Token</kbd> click <kbd>Copy</kbd> to copy your bot token (keep this secure!)
> - Click <kbd>Save Changes</kbd>
>


<h2 id="4">4. Invite the Bot to Your Server</h2>

> [!Note]
> - Go to the <kbd>OAuth2</kbd> → <kbd>URL Generator</kbd> section
> - Under <kbd>Scopes</kbd> select:
> ```
> + | bot
> + | applications.commands
> ```
> - Under <kbd>Bot Permissions</kbd> select:
> ```
> + | Send Messages
> + | Use Slash Commands
> + | Read Message History
> + | Embed Links
> ```
> Copy the generated URL and open it in your browser
> Select your Discord server and authorize the bot
> 
> <img width="800" height="500" alt="oauth2" src="https://github.com/user-attachments/assets/3e1fe004-1ae5-4078-b1a4-882a11bc68cd" />
>
> <img width="800" height="500" alt="botallowcommands" src="https://github.com/user-attachments/assets/9cd92467-2f3d-4c03-abb0-9f10ec979a1b" />







